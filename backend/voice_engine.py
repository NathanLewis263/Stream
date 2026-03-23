import logging
import os
import io
import sys
import json
import wave
import subprocess
import threading
from typing import Optional
from pathlib import Path

import sounddevice as sd
import numpy as np
from groq import Groq
import ten_vad
from commands import command_manager
from hotkey_config import hotkey_config
from text_output import output_text

SAMPLE_RATE = 16000
CHANNELS = 1
DTYPE = 'int16'


class VoiceEngine:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.lock = threading.RLock()

        # VAD
        self.vad = None
        try:
            self.vad = ten_vad.TenVad()
        except Exception as e:
            self.logger.error(f"TEN VAD init failed: {e}")

        # Groq client
        self.client = None
        if api_key := os.getenv("GROQ_API_KEY"):
            try:
                self.client = Groq(api_key=api_key)
            except Exception as e:
                self.logger.error(f"Groq init failed: {e}")

        self.is_recording = False
        self.is_processing = False
        self.is_hands_free = False
        self.is_command_mode = False
        self.audio_data = []
        self.current_audio_level = 0.0
        self.on_status_change = None
        self.on_text_generated = None
        self.on_audio_level = None
        self.on_processing_error = None

        self.last_raw_text: Optional[str] = None
        self.last_final_text: Optional[str] = None

    def _push_to_talk_label(self) -> str:
        try:
            hk = hotkey_config.get_hotkeys()
            return hk.get("push_to_talk", {}).get(sys.platform, {}).get("key", "—")
        except Exception as e:
            self.logger.debug("push_to_talk label: %s", e)
            return "—"

    def _notify_processing_error(self, code: str, message: str):
        if self.on_processing_error:
            self.on_processing_error({"code": code, "message": message})

    def notify_status(self):
        if self.on_status_change:
            self.on_status_change({
                "recording": self.is_recording,
                "processing": self.is_processing,
                "hands_free": self.is_hands_free,
                "command_mode": self.is_command_mode,
                "hotkey": self._push_to_talk_label(),
                "snippets": command_manager.get_snippets(),
                "dictation": command_manager.get_dictation_settings(),
            })

    def get_system_prompt(self):
        path = Path(__file__).resolve().parent / "templates" / "system.md"
        try:
            return path.read_text().strip() if path.exists() else "You are a helpful assistant."
        except Exception as e:
            self.logger.warning("get_system_prompt: %s", e)
            return "You are a helpful assistant."

    def _get_active_context(self) -> dict:
        try:
            result = subprocess.run(
                [sys.executable, os.path.join(os.path.dirname(__file__), "active_context.py")],
                capture_output=True, text=True, check=True
            )
            return json.loads(result.stdout.strip())
        except Exception as e:
            self.logger.warning("active_context: %s", e)
            return {}

    def _build_prompt(self, base_prompt: str, extra: str = "") -> str:
        prompt = base_prompt + command_manager.get_style_prompt_fragment()
        snippets = command_manager.get_snippets()
        dictionary = command_manager.get_dictionary()
        prompt += "\n\n### Replacements"
        if snippets:
            prompt += "\nSnippets (key -> value):"
            for k, v in snippets.items():
                prompt += f"\n  \"{k}\" -> \"{v}\""
        if dictionary:
            prompt += "\nDictionary (misheard -> correct):"
            for k, v in dictionary.items():
                prompt += f"\n  \"{k}\" -> \"{v}\""
        if extra:
            prompt += extra
        if ctx := self._get_active_context():
            prompt += f"\n\n### Application Context\nActive Application: {ctx.get('app', 'Unknown')}"
            if 'url' in ctx:
                prompt += f"\nURL: {ctx['url']}"
            if 'title' in ctx:
                prompt += f"\nTab Title: {ctx['title']}"
        return prompt

    def start_recording(self):
        with self.lock:
            if self.is_recording:
                return
            self.is_recording = True
            self.audio_data = []
            try:
                self.stream = sd.InputStream(
                    samplerate=SAMPLE_RATE, channels=CHANNELS, dtype=DTYPE,
                    callback=self._audio_callback
                )
                self.stream.start()
                self.notify_status()
            except Exception as e:
                self.logger.error(f"Audio stream failed: {e}")
                self.is_recording = False

    def _audio_callback(self, indata, frames, time, status):
        if self.is_recording:
            self.audio_data.append(indata.copy())
            self.current_audio_level = float(np.sqrt(np.mean(indata.astype(np.float32) ** 2)) / 3000.0)
            if self.on_audio_level:
                self.on_audio_level(self.current_audio_level)

    def stop_recording(self) -> Optional[np.ndarray]:
        with self.lock:
            if not self.is_recording:
                return None
            self.is_recording = False
            self.current_audio_level = 0.0
            self.notify_status()
            if hasattr(self, 'stream'):
                self.stream.stop()
                self.stream.close()
            audio = np.concatenate(self.audio_data, axis=0) if self.audio_data else None
        return audio

    def discard_recording(self):
        with self.lock:
            if not self.is_recording:
                return
            self.is_recording = False
            self.current_audio_level = 0.0
            self.audio_data = []
            self.notify_status()
            if hasattr(self, 'stream'):
                self.stream.stop()
                self.stream.close()

    def _contains_speech(self, audio_data: np.ndarray) -> bool:
        if not self.vad:
            return True
        try:
            consecutive = 0
            for i in range(0, len(audio_data) - 256, 256):
                prob, is_speech = self.vad.process(audio_data[i:i + 256])
                if is_speech and prob >= 0.75:
                    consecutive += 1
                    if consecutive >= 8:
                        return True
                else:
                    consecutive = 0
            return False
        except Exception as e:
            self.logger.warning("VAD _contains_speech: %s", e)
            return True

    def _transcribe_audio(self, audio_data: np.ndarray) -> Optional[str]:
        if not self.client:
            return None
        try:
            wav_buffer = io.BytesIO()
            with wave.open(wav_buffer, 'wb') as f:
                f.setnchannels(CHANNELS)
                f.setsampwidth(2)
                f.setframerate(SAMPLE_RATE)
                f.writeframes(audio_data.flatten().astype(np.int16).tobytes())
            wav_buffer.seek(0)
            wav_buffer.name = "audio.wav"
            lang = command_manager.get_dictation_settings().get("language") or "auto"
            kwargs = {"file": wav_buffer, "model": "whisper-large-v3"}
            if lang and lang != "auto":
                kwargs["language"] = lang
            return self.client.audio.transcriptions.create(**kwargs).text.strip()
        except Exception as e:
            self.logger.error(f"Transcription error: {e}")
            return None

    def _refine_text(self, raw_text: str, system_prompt: str) -> str:
        if not self.client:
            return raw_text
        try:
            self.logger.info(f"raw text: {raw_text}")
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": raw_text}],
                temperature=0.0,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            self.logger.error(f"Refinement error: {e}")
            return raw_text

    def process_audio(self, audio_data: Optional[np.ndarray], command_mode: bool = False):
        if audio_data is None:
            return
        if not self.client:
            self._notify_processing_error("no_client", "Groq client is not configured.")
            return

        self.is_processing = True
        self.notify_status()
        try:
            if not self._contains_speech(audio_data):
                self._notify_processing_error("no_speech", "No speech detected — try speaking longer or louder.")
                return

            raw_text = self._transcribe_audio(audio_data)
            self.logger.info(f"Raw: {raw_text}")
            if not raw_text:
                self._notify_processing_error("empty_transcription", "Transcription returned empty audio.")
                return

            prompt = self._build_prompt(self.get_system_prompt())
            final_text = self._refine_text(raw_text, prompt)
            self.logger.info(f"Final: {final_text}")

            self.last_raw_text = raw_text
            self.last_final_text = final_text

            output_result = output_text(final_text) if not command_mode else None

            if self.on_text_generated:
                self.on_text_generated({
                    "text": final_text,
                    "type": "dictation",
                    "command_mode": command_mode,
                    "output_method": output_result.get("method") if output_result else None
                })
        finally:
            self.is_processing = False
            self.notify_status()

    def process_editor_command(self, selected_text: str, instruction: str):
        if not instruction or not selected_text:
            return
        if not self.client:
            self._notify_processing_error("no_client", "Groq client is not configured.")
            return

        self.is_processing = True
        self.notify_status()
        try:
            prompt = self._build_prompt(self.get_system_prompt(), f"\n\n### Edit Context\nSelected Text: {selected_text}")
            final_text = self._refine_text(instruction, prompt)
            self.logger.info(f"Final: {final_text}")

            output_result = output_text(final_text)

            if self.on_text_generated:
                self.on_text_generated({
                    "text": final_text,
                    "type": "paste",
                    "output_method": output_result.get("method")
                })
        finally:
            self.is_processing = False
            self.notify_status()
