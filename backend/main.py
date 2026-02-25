import os
import sys
import threading
import logging
import time
from dotenv import load_dotenv

from voice_engine import VoiceEngine
from server import run_status_server, STATUS_SERVER_PORT
from hotkeys import HotkeyListener, HotkeyCallbacks

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
        # Status is tracked in HotkeyListener

    def on_command_mode(active: bool):
        global command_mode_active
        command_mode_active = active
        logger.info(f"Command mode: {active}")

    callbacks.on_start_recording = on_start
    callbacks.on_stop_recording = on_stop
    callbacks.on_toggle_hands_free = on_toggle_hands_free
    callbacks.on_command_mode = on_command_mode

    # --- Start Hotkey Listener ---
    hotkey_listener = HotkeyListener(callbacks)
    hotkey_listener.start()

    # --- Start the API Server ---
    threading.Thread(
        target=run_status_server,
        args=(engine,),
        daemon=True
    ).start()

    # Platform-specific hotkey info
    if sys.platform == "darwin":
        hotkey_info = "fn (hold to talk)"
    else:
        hotkey_info = "Ctrl + Win (hold to talk)"

    print(f"\nStream Dictation Ready")
    print(f"   • Hotkey: {hotkey_info}")
    print(f"   • Hands-free: Hotkey + Space")
    print(f"   • Command mode: Hotkey + Cmd")
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
