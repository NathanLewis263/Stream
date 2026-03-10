import logging
import os
import io
import sys
import json
import subprocess
import threading
from typing import Optional
from pathlib import Path

import sounddevice as sd
import numpy as np
import scipy.io.wavfile as wav
from groq import Groq
import ten_vad
from commands import command_manager
from text_output import output_text

import torch
from transformers import MoonshineForConditionalGeneration, AutoProcessor

# Constants (moved from main.py)
SAMPLE_RATE = 16000
CHANNELS = 1
DTYPE = 'int16'

class VoiceEngine:
    """
    Manages the audio pipeline:
    1. Record Audio (sounddevice)
    2. Transcribe (Groq Whisper)
    3. Refine/Format (LLM)
    4. Output (type-first with clipboard fallback)
    """
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.api_key = os.getenv("GROQ_API_KEY")
        self.lock = threading.RLock()

        # Initialize TEN VAD if available
        self.vad = None
        try:
            self.vad = ten_vad.TenVad()
        except Exception as e:
            self.logger.error(f"Failed to initialize TEN VAD: {e}")
        
        if not self.api_key:
            self.logger.error("GROQ_API_KEY environment variable not found!")
        
        self.client = Groq(api_key=self.api_key) if self.api_key else None
        
        backend_dir = Path(__file__).resolve().parent
        self.whisper_cli = backend_dir / "whisper.cpp" / "build" / "bin" / "whisper-cli"
        self.whisper_model = backend_dir / "whisper.cpp" / "models" / "ggml-medium-q8_0.bin"
        
        if not self.whisper_cli.exists() or not self.whisper_model.exists():
            self.logger.error("whisper.cpp CLI or model not found. Run make and download the model.")
        else:
            self.logger.info("whisper.cpp tools found successfully.")

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
                "hotkey": "Ctrl Left", # TODO: Make dynamic
                "snippets": command_manager.get_snippets()
            }
            try:
                self.on_status_change(status)
            except Exception as e:
                self.logger.error(f"Error in status callback: {e}")

    def get_system_prompt(self):
        """Loads the AI persona/instructions from templates/system.md"""
        try:
            # Resolves to absolute path relative to THIS file's location
            # If this file is in backend/, then templates/ is sibling
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
            # Calculate audio level (RMS normalized to 0-1, exaggerated for visibility)
            rms = np.sqrt(np.mean(indata.astype(np.float32) ** 2))
            # More sensitive normalization for better visual feedback
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
        This is tuned to be AGGRESSIVE (filter out background music/noise).
        """
        if not getattr(self, 'vad', None):
            return True

        try: 
            hop_size = 256 
            consecutive = 0
            min_consecutive = 8 
            min_prob = 0.85      # require high VAD confidence
            
            for i in range(0, len(audio_data) - hop_size, hop_size):
                frame = audio_data[i:i+hop_size]
                prob, is_speech = self.vad.process(frame)

                if is_speech and prob >= min_prob:
                    consecutive += 1
                    if consecutive >= min_consecutive:
                        return True
                else:
                    consecutive = 0
            print(f"No speech detected: {consecutive} frames")
            return False
            
        except Exception as e:
            self.logger.error(f"VAD check failed: {e}")
            return True

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

            # --- 1 & 2. Transcribe using local whisper.cpp ---
            if not getattr(self, "whisper_cli", None) or not self.whisper_cli.exists():
                self.logger.error("whisper.cpp CLI not found.")
                return

            self.logger.info("Transcribing audio with whisper.cpp locally...")
            
            import tempfile
            import uuid
            
            temp_wav_path = os.path.join(tempfile.gettempdir(), f"whisper_{uuid.uuid4().hex}.wav")
            raw_text = ""
            try:
                wav.write(temp_wav_path, SAMPLE_RATE, audio_data)
                
                result = subprocess.run(
                    [str(self.whisper_cli), "-m", str(self.whisper_model), "-f", temp_wav_path, "-nt", "-np", "-l", "auto", "-tr"],
                    capture_output=True,
                    text=True,
                    check=False
                )
                
                if result.returncode != 0:
                    self.logger.error(f"whisper.cpp error: {result.stderr}")
                    return
                
                raw_text = result.stdout.strip()
            finally:
                if os.path.exists(temp_wav_path):
                    os.remove(temp_wav_path)
            
            self.logger.info(f"Raw (Whisper): {raw_text}")
            
            if not raw_text:
                return

            # --- 3. Refine/Format using LLM ---
            system_prompt = self.get_system_prompt()
            system_prompt += f"\n\n### Snippet Context\nSnippets: {command_manager.get_snippets()}"

            # Add active UI context via subprocess to avoid PyObjC caching bugs
            active_ctx = self._get_active_context()
            if active_ctx:
                system_prompt += "\n\n### Application Context"
                system_prompt += f"\nActive Application: {active_ctx.get('app', 'Unknown')}"
                if 'url' in active_ctx:
                    system_prompt += f"\nBrowser URL: {active_ctx['url']}"
                if 'title' in active_ctx:
                    system_prompt += f"\nBrowser Tab Title: {active_ctx['title']}"

            completion = self.client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": raw_text}
                ],
                temperature=0.0
            )
            final_text = completion.choices[0].message.content.strip()
            self.logger.info(f"Final: {final_text}")

            # --- 4. Output Text (type-first with clipboard fallback) ---
            if not command_mode:
                output_result = output_text(final_text)
                self.logger.info(f"Output result: {output_result}")

            # Notify listeners
            if self.on_text_generated:
                self.on_text_generated({
                    "text": final_text,
                    "type": "dictation",
                    "command_mode": command_mode,
                    "output_method": output_result.get("method") if not command_mode else None
                })

        except Exception as e:
            self.logger.error(f"Processing error: {e}")
        finally:
            self.is_processing = False
            self.notify_status()

    def process_editor_command(self, selected_text: str, instruction: str):
        """
        Processes a text-based command on selected text.
        """
        self.is_processing = True
        self.notify_status()
        try:
            if not self.client:
                self.logger.error("No API Client available.")
                return
            
            if not instruction or not selected_text:
                return

            # --- Refine/Format using LLM ---
            system_prompt = self.get_system_prompt()
            system_prompt += f"\n\n### Edit Context\nSelected Text: {selected_text}\nSnippets: {command_manager.get_snippets()}"

            # Add active UI context via subprocess to avoid PyObjC caching bugs
            active_ctx = self._get_active_context()
            if active_ctx:
                system_prompt += "\n\n### Application Context"
                system_prompt += f"\nActive Application: {active_ctx.get('app', 'Unknown')}"
                if 'url' in active_ctx:
                    system_prompt += f"\nBrowser URL: {active_ctx['url']}"
                if 'title' in active_ctx:
                    system_prompt += f"\nBrowser Tab Title: {active_ctx['title']}"

            completion = self.client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": instruction}
                ],
                temperature=0.0
            )
            final_text = completion.choices[0].message.content.strip()
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