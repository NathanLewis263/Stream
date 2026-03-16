import os
import sys
import threading
import logging
import time
from dotenv import load_dotenv

from voice_engine import VoiceEngine
from server import run_status_server, STATUS_SERVER_PORT, set_hotkey_reload_callback, set_hotkey_capture_callbacks, set_hotkey_key_captured_callback_setter
from hotkeys import HotkeyListener, HotkeyCallbacks
from hotkey_config import hotkey_config

# --- Setup & Configuration ---
load_dotenv()

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Global state for command mode
command_mode_active = False


# --- Main Application Loop ---
def main():
    global command_mode_active

    if not os.getenv("GROQ_API_KEY"):
        print("\n❌ CRITICAL: GROQ_API_KEY is missing from .env\n")
        return

    engine = VoiceEngine()

    # --- Setup Hotkey Callbacks ---
    callbacks = HotkeyCallbacks()

    def on_start():
        logger.info("Starting recording via hotkey")
        with engine.lock:
            if not engine.is_recording:
                engine.start_recording()

    def on_stop():
        logger.info("Stopping recording via hotkey")
        # Capture command mode state before processing
        was_command_mode = command_mode_active
        logger.info(f"Command mode at stop: {was_command_mode}")
        with engine.lock:
            if engine.is_recording:
                audio_data = engine.stop_recording()
                # Process in background thread, passing command mode state
                threading.Thread(
                    target=lambda: engine.process_audio(audio_data, command_mode=was_command_mode),
                    daemon=True
                ).start()

    def on_toggle_hands_free():
        logger.info("Hands-free toggled")
        engine.is_hands_free = hotkey_listener.is_hands_free
        engine.notify_status()

    def on_command_mode(active: bool):
        global command_mode_active
        command_mode_active = active
        engine.is_command_mode = active
        engine.notify_status()
        logger.info(f"Command mode: {active}")

    callbacks.on_start_recording = on_start
    callbacks.on_stop_recording = on_stop
    callbacks.on_toggle_hands_free = on_toggle_hands_free
    callbacks.on_command_mode = on_command_mode

    # --- Start Hotkey Listener ---
    hotkey_listener = HotkeyListener(callbacks, hotkey_config.get_hotkeys())
    hotkey_listener.start()

    # Set up reload callback for when hotkeys are changed via settings
    set_hotkey_reload_callback(hotkey_listener.reload_config)

    # Set up capture callbacks for settings UI
    set_hotkey_capture_callbacks(hotkey_listener.start_capture, hotkey_listener.stop_capture)

    # Set up key captured callback setter
    def set_key_captured_callback(cb):
        callbacks.on_key_captured = cb
    set_hotkey_key_captured_callback_setter(set_key_captured_callback)

    # --- Start the API Server ---
    threading.Thread(
        target=run_status_server,
        args=(engine,),
        daemon=True
    ).start()

    # Get hotkey info from config
    hotkeys = hotkey_config.get_hotkeys()
    platform = sys.platform
    ptt_key = hotkeys.get("push_to_talk", {}).get(platform, {}).get("key", "fn" if platform == "darwin" else "Ctrl+Win")
    hands_free_key = hotkeys.get("hands_free_modifier", {}).get(platform, {}).get("key", "Space")
    cmd_mode_key = hotkeys.get("command_mode_modifier", {}).get(platform, {}).get("key", "Cmd" if platform == "darwin" else "Shift")

    print(f"\nStream Dictation Ready")
    print(f"   • Hotkey: {ptt_key} (hold to talk)")
    print(f"   • Hands-free: {ptt_key} + {hands_free_key}")
    print(f"   • Command mode: {ptt_key} + {cmd_mode_key}")
    print(f"   • Ctrl+C to Exit\n")

    # Keep the main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nExiting...")
        hotkey_listener.stop()


if __name__ == "__main__":
    main()
