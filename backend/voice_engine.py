import logging
import os
import io
import sys
import json
import subprocess
import threading
from typing import Optional
from pathlib import Path
from datetime import datetime

import sounddevice as sd
import numpy as np
from elevenlabs import ElevenLabs
from google import genai
import ten_vad
from commands import command_manager
from text_output import output_text

# Constants
SAMPLE_RATE = 16000
CHANNELS = 1
DTYPE = 'int16'

class VoiceEngine:
    """
    Manages the audio pipeline:
    1. Record Audio (sounddevice)
    2. Transcribe (ElevenLabs with keyterms)
    3. Refine/Format (Gemini)
    4. Output (type-first with clipboard fallback)
    """
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.lock = threading.RLock()

        # Initialize TEN VAD if available
        self.vad = None
        try:
            self.vad = ten_vad.TenVad()
            self.logger.info("TEN VAD initialized successfully")
        except Exception as e:
            self.logger.error(f"Failed to initialize TEN VAD: {e}")

        # Initialize ElevenLabs client for transcription
        elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
        if not elevenlabs_api_key:
            self.logger.error("ELEVENLABS_API_KEY environment variable not found!")
        self.client = ElevenLabs(api_key=elevenlabs_api_key) if elevenlabs_api_key else None

        # Initialize Gemini client for refinement
        self.gemini_client = None
        google_api_key = os.getenv("GOOGLE_API_KEY")
        if google_api_key:
            try:
                self.gemini_client = genai.Client(api_key=google_api_key)
                self.logger.info("Gemini client initialized successfully")
            except Exception as e:
                self.logger.error(f"Failed to initialize Gemini client: {e}")
        else:
            self.logger.error("GOOGLE_API_KEY environment variable not found!")

        self.is_recording = False
        self.is_processing = False
        self.is_hands_free = False
        self.is_command_mode = False
        self.audio_data = []
        self.current_audio_level = 0.0
        # Callbacks
        self.on_status_change = None
        self.on_text_generated = None
        self.on_audio_level = None

    def notify_status(self):
        """Helper to trigger status callback"""
        if self.on_status_change:
            status = {
                "recording": self.is_recording,
                "processing": self.is_processing,
                "hands_free": self.is_hands_free,
                "command_mode": self.is_command_mode,
                "hotkey": "Ctrl Left",  # TODO: Make dynamic
                "snippets": command_manager.get_snippets()
            }
            try:
                self.on_status_change(status)
            except Exception as e:
                self.logger.error(f"Error in status callback: {e}")

    def get_system_prompt(self):
        """Loads the AI persona/instructions from templates/system.md"""
        try:
            system_prompt_path = Path(__file__).resolve().parent / "templates" / "system.md"

            if not system_prompt_path.exists():
                self.logger.warning(f"File not found: {system_prompt_path}")
                return "You are a helpful assistant."

            with open(system_prompt_path, "r") as f:
                return f.read().strip()
        except Exception as e:
            self.logger.warning(f"Could not read system.md: {e}")
            return "You are a helpful assistant."

    def _get_active_context(self) -> dict:
        """Gets active UI context via subprocess to avoid PyObjC caching."""
        try:
            script_path = os.path.join(os.path.dirname(__file__), "active_context.py")
            result = subprocess.run(
                [sys.executable, script_path],
                capture_output=True, text=True, check=True
            )
            ctx = json.loads(result.stdout.strip())
            self.logger.info(f"Active Context: {ctx}")
            return ctx
        except Exception as e:
            self.logger.error(f"Failed to fetch active context: {e}")
            return {}

    def start_recording(self):
        """Begins capturing audio from the microphone."""
        with self.lock:
            if self.is_recording:
                self.logger.warning("Already recording, ignoring start request")
                return

            self.logger.info("*** STARTING RECORDING ***")
            self.is_recording = True
            self.audio_data = []

            try:
                self.stream = sd.InputStream(
                    samplerate=SAMPLE_RATE,
                    channels=CHANNELS,
                    dtype=DTYPE,
                    callback=self._audio_callback
                )
                self.stream.start()
                self.logger.info("Audio stream started successfully")
                self.notify_status()
            except Exception as e:
                self.logger.error(f"Failed to start audio stream: {e}")
                self.is_recording = False

    def _audio_callback(self, indata, frames, time, status):
        """Internal callback for sounddevice."""
        if status:
            self.logger.warning(f"Audio status: {status}")
        if self.is_recording:
            self.audio_data.append(indata.copy())
            # Calculate audio level (RMS normalized to 0-1)
            rms = np.sqrt(np.mean(indata.astype(np.float32) ** 2))
            normalized = rms / 3000.0
            self.current_audio_level = float(normalized)
            if self.on_audio_level:
                try:
                    self.on_audio_level(self.current_audio_level)
                except Exception:
                    pass

    def stop_recording(self) -> Optional[np.ndarray]:
        """Stops capturing and returns the full audio buffer."""
        with self.lock:
            if not self.is_recording:
                self.logger.warning("Not recording, ignoring stop request")
                return None

            self.logger.info("*** STOPPING RECORDING ***")
            self.is_recording = False
            self.current_audio_level = 0.0
            self.notify_status()

            try:
                if hasattr(self, 'stream'):
                    self.stream.stop()
                    self.stream.close()
            except Exception as e:
                self.logger.error(f"Error stopping stream: {e}")

            if not self.audio_data:
                self.logger.warning("No audio data captured")
                return None

            return np.concatenate(self.audio_data, axis=0)

    def discard_recording(self):
        """Stops capturing and discards the audio without processing."""
        with self.lock:
            if not self.is_recording:
                self.logger.warning("Not recording, ignoring discard request")
                return

            self.logger.info("*** DISCARDING RECORDING ***")
            self.is_recording = False
            self.current_audio_level = 0.0
            self.audio_data = []
            self.notify_status()

            try:
                if hasattr(self, 'stream'):
                    self.stream.stop()
                    self.stream.close()
            except Exception as e:
                self.logger.error(f"Error stopping stream: {e}")

    def _contains_speech(self, audio_data: np.ndarray) -> bool:
        """
        Checks for sustained, high-confidence speech using ten-vad.
        Tuned to filter out background music/noise.
        """
        if not self.vad:
            return True

        try:
            hop_size = 256
            consecutive = 0
            min_consecutive = 8
            min_prob = 0.85

            for i in range(0, len(audio_data) - hop_size, hop_size):
                frame = audio_data[i:i + hop_size]
                prob, is_speech = self.vad.process(frame)

                if is_speech and prob >= min_prob:
                    consecutive += 1
                    if consecutive >= min_consecutive:
                        return True
                else:
                    consecutive = 0

            self.logger.info(f"No speech detected: {consecutive} consecutive frames")
            return False

        except Exception as e:
            self.logger.error(f"VAD check failed: {e}")
            return True

    def _transcribe_audio(self, audio_data: np.ndarray) -> Optional[str]:
        """Transcribe audio using ElevenLabs batch API with keyterms."""
        if not self.client:
            self.logger.error("ElevenLabs client not available")
            return None

        try:
            import wave

            # Convert numpy array to WAV format in memory
            audio_bytes = audio_data.flatten().astype(np.int16).tobytes()
            wav_buffer = io.BytesIO()
            with wave.open(wav_buffer, 'wb') as wav_file:
                wav_file.setnchannels(CHANNELS)
                wav_file.setsampwidth(2)  # 16-bit = 2 bytes
                wav_file.setframerate(SAMPLE_RATE)
                wav_file.writeframes(audio_bytes)
            wav_buffer.seek(0)
            wav_buffer.name = "audio.wav"

            # Get correct words as keyterms for ElevenLabs (max 100)
            keyterms = command_manager.get_keyterms()

            self.logger.info(f"Transcribing {len(audio_bytes)} bytes with {len(keyterms)} keyterms")

            # Call ElevenLabs batch transcription API
            result = self.client.speech_to_text.convert(
                file=wav_buffer,
                model_id="scribe_v2",
                language_code="en",
                tag_audio_events=False,
                keyterms=keyterms if keyterms else None,
            )

            # Extract text from result
            if hasattr(result, 'text'):
                return result.text.strip()
            elif isinstance(result, dict) and 'text' in result:
                return result['text'].strip()
            else:
                self.logger.warning(f"Unexpected result format: {type(result)}")
                return str(result)

        except Exception as e:
            self.logger.error(f"ElevenLabs transcription error: {e}")
            return None

    def _log_training_example(self, raw_text: str, refined_text: str, context: dict):
        """Log input/output pairs for fine-tuning data collection."""
        try:
            log_path = Path(__file__).resolve().parent / "training_data.jsonl"
            example = {
                "timestamp": datetime.now().isoformat(),
                "input": raw_text,
                "output": refined_text,
                "snippets": context.get("snippets", {}),
                "dictionary": context.get("dictionary", {}),
                "app_context": context.get("app_context", {}),
            }
            # Include selected_text for editor mode examples
            if context.get("selected_text"):
                example["selected_text"] = context["selected_text"]
            with open(log_path, "a") as f:
                f.write(json.dumps(example) + "\n")
            self.logger.info(f"Logged training example to {log_path}")
        except Exception as e:
            self.logger.error(f"Failed to log training example: {e}")

    def _refine_text(self, raw_text: str, system_prompt: str, context: dict = None) -> str:
        """Refine raw transcription using Gemini."""
        if not self.gemini_client:
            self.logger.warning("Gemini client not available, returning raw text")
            return raw_text

        try:
            full_prompt = f"{system_prompt}\n\n---\n\nUser input:\n{raw_text}"
            response = self.gemini_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=full_prompt,
                config=genai.types.GenerateContentConfig(
                    temperature=0.0,
                )
            )
            refined = response.text.strip()

            # Log for fine-tuning data collection
            if context is None:
                context = {}
            self._log_training_example(raw_text, refined, context)

            return refined
        except Exception as e:
            self.logger.error(f"Gemini refinement error: {e}")
            return raw_text

    def process_audio(self, audio_data: Optional[np.ndarray], command_mode: bool = False):
        """
        The main processing pipeline.
        Runs in a separate thread to not block the UI/Hotkey listener.
        """
        if audio_data is None:
            self.logger.warning("process_audio called with None data")
            return

        self.is_processing = True
        self.notify_status()
        try:
            if not self.client:
                self.logger.error("No API Client available.")
                return

            # --- 0. Silence Detection (VAD) ---
            if not self._contains_speech(audio_data):
                self.logger.info("Discarded audio due to silence (ten-vad detection).")
                return

            # --- 1. Transcribe using ElevenLabs ---
            self.logger.info("Transcribing audio with ElevenLabs...")
            raw_text = self._transcribe_audio(audio_data)

            self.logger.info(f"Raw (ElevenLabs): {raw_text}")

            if not raw_text:
                return

            # --- 2. Refine/Format using Gemini ---
            system_prompt = self.get_system_prompt()
            system_prompt += f"\n\n### Snippet Context\nSnippets: {command_manager.get_snippets()}"
            system_prompt += f"\nDictionary: {command_manager.get_dictionary()}"

            # Add active UI context via subprocess to avoid PyObjC caching bugs
            active_ctx = self._get_active_context()
            if active_ctx:
                system_prompt += "\n\n### Application Context"
                system_prompt += f"\nActive Application: {active_ctx.get('app', 'Unknown')}"
                if 'url' in active_ctx:
                    system_prompt += f"\nBrowser URL: {active_ctx['url']}"
                if 'title' in active_ctx:
                    system_prompt += f"\nBrowser Tab Title: {active_ctx['title']}"

            # Context for training data logging
            training_context = {
                "snippets": command_manager.get_snippets(),
                "dictionary": command_manager.get_dictionary(),
                "app_context": active_ctx,
            }

            final_text = self._refine_text(raw_text, system_prompt, training_context)
            self.logger.info(f"Final: {final_text}")

            # --- 3. Output Text (type-first with clipboard fallback) ---
            output_result = None
            if not command_mode:
                output_result = output_text(final_text)
                self.logger.info(f"Output result: {output_result}")

            # Notify listeners
            if self.on_text_generated:
                self.on_text_generated({
                    "text": final_text,
                    "type": "dictation",
                    "command_mode": command_mode,
                    "output_method": output_result.get("method") if output_result else None
                })

        except Exception as e:
            self.logger.error(f"Processing error: {e}")
        finally:
            self.is_processing = False
            self.notify_status()

    def process_editor_command(self, selected_text: str, instruction: str):
        """Processes a text-based command on selected text."""
        self.is_processing = True
        self.notify_status()
        try:
            if not self.gemini_client:
                self.logger.error("No Gemini client available.")
                return

            if not instruction or not selected_text:
                return

            # --- Refine/Format using Gemini ---
            system_prompt = self.get_system_prompt()
            system_prompt += f"\n\n### Edit Context\nSelected Text: {selected_text}\nSnippets: {command_manager.get_snippets()}"
            system_prompt += f"\nDictionary: {command_manager.get_dictionary()}"

            # Add active UI context via subprocess to avoid PyObjC caching bugs
            active_ctx = self._get_active_context()
            if active_ctx:
                system_prompt += "\n\n### Application Context"
                system_prompt += f"\nActive Application: {active_ctx.get('app', 'Unknown')}"
                if 'url' in active_ctx:
                    system_prompt += f"\nBrowser URL: {active_ctx['url']}"
                if 'title' in active_ctx:
                    system_prompt += f"\nBrowser Tab Title: {active_ctx['title']}"

            # Context for training data logging
            training_context = {
                "snippets": command_manager.get_snippets(),
                "dictionary": command_manager.get_dictionary(),
                "app_context": active_ctx,
                "selected_text": selected_text,
            }

            final_text = self._refine_text(instruction, system_prompt, training_context)
            self.logger.info(f"Editor Mode Selected Text: {selected_text}")
            self.logger.info(f"Final: {final_text}")

            # Output text (type-first with clipboard fallback)
            output_result = output_text(final_text)
            self.logger.info(f"Output result: {output_result}")

            # Notify listeners
            if self.on_text_generated:
                self.on_text_generated({
                    "text": final_text,
                    "type": "paste",
                    "output_method": output_result.get("method")
                })

        except Exception as e:
            self.logger.error(f"Processing error: {e}")
        finally:
            self.is_processing = False
            self.notify_status()
