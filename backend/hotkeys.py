"""
Cross-platform hotkey detection using native APIs.
"""

import sys
import threading
import logging
from typing import Callable, Optional

logger = logging.getLogger(__name__)

# Key codes
MAC_FN_KEY = 0x3F  # 63
MAC_CMD_LEFT = 0x37  # 55 (left cmd)
MAC_CMD_RIGHT = 0x36  # 54 (right cmd)
MAC_SPACE_KEY = 0x31  # 49
WIN_CTRL_KEY = 0x11  # 17
WIN_WIN_KEY = 0x5B  # 91 (left win)

class HotkeyCallbacks:
    def __init__(self):
        self.on_start_recording: Optional[Callable] = None
        self.on_stop_recording: Optional[Callable] = None
        self.on_toggle_hands_free: Optional[Callable] = None
        self.on_command_mode: Optional[Callable[[bool], None]] = None


class HotkeyListener:
    def __init__(self, callbacks: HotkeyCallbacks):
        self.callbacks = callbacks
        self.running = False
        self._thread: Optional[threading.Thread] = None

        # State tracking
        self.hotkey_pressed = False
        self.cmd_pressed = False
        self.space_pressed = False
        self.is_recording = False
        self.is_hands_free = False
        self.is_command_mode = False

    def start(self):
        if self.running:
            return
        self.running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        logger.info("Hotkey listener started")

    def stop(self):
        self.running = False
        if self._thread:
            self._thread.join(timeout=1.0)
        logger.info("Hotkey listener stopped")

    def _run(self):
        if sys.platform == "darwin":
            self._run_macos()
        elif sys.platform == "win32":
            self._run_windows()
        else:
            logger.warning(f"Unsupported platform: {sys.platform}")

    # Hotkey detection
    def _run_macos(self):
        """macOS hotkey detection using CGEvent tap"""
        try:
            import Quartz
            from Quartz import (
                CGEventTapCreate,
                CGEventTapEnable,
                CFMachPortCreateRunLoopSource,
                CFRunLoopAddSource,
                CFRunLoopGetCurrent,
                CFRunLoopRun,
                CFRunLoopStop,
                kCGSessionEventTap,
                kCGHeadInsertEventTap,
                kCGEventTapOptionDefault,
                kCGEventKeyDown,
                kCGEventKeyUp,
                kCGEventFlagsChanged,
                CGEventGetIntegerValueField,
                kCGKeyboardEventKeycode,
                kCFRunLoopCommonModes,
            )
        except ImportError:
            logger.error("pyobjc-framework-Quartz not installed. Run: pip install pyobjc-framework-Quartz")
            return

        def callback(proxy, event_type, event, refcon):
            try:
                keycode = CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode)

                # Handle fn key (flags changed event)
                if event_type == kCGEventFlagsChanged:
                    flags = Quartz.CGEventGetFlags(event)
                    logger.info(f"Flags changed: keycode={keycode}, flags={flags:#x}")
                    if keycode == MAC_FN_KEY:
                        # fn key state changed
                        fn_pressed = bool(flags & Quartz.kCGEventFlagMaskSecondaryFn)

                        if fn_pressed and not self.hotkey_pressed:
                            self.hotkey_pressed = True
                            self._on_hotkey_down()
                        elif not fn_pressed and self.hotkey_pressed:
                            self.hotkey_pressed = False
                            self._on_hotkey_up()

                    elif keycode in (MAC_CMD_LEFT, MAC_CMD_RIGHT):
                        cmd_pressed = bool(flags & Quartz.kCGEventFlagMaskCommand)

                        if cmd_pressed and not self.cmd_pressed:
                            self.cmd_pressed = True
                            logger.info(f"Cmd pressed, hotkey_pressed={self.hotkey_pressed}")
                            if self.hotkey_pressed:
                                # Enable command mode - stays active until fn is released
                                self._on_command_mode(True)
                        elif not cmd_pressed and self.cmd_pressed:
                            self.cmd_pressed = False
                            logger.info("Cmd released (command mode stays active)")

                # Handle space key for hands-free toggle
                elif event_type == kCGEventKeyDown:
                    if keycode == MAC_SPACE_KEY and self.hotkey_pressed:
                        self._on_toggle_hands_free()

            except Exception as e:
                logger.error(f"Error in hotkey callback: {e}")

            return event

        # Create event tap for key events
        event_mask = (
            (1 << kCGEventKeyDown) |
            (1 << kCGEventKeyUp) |
            (1 << kCGEventFlagsChanged)
        )

        tap = CGEventTapCreate(
            kCGSessionEventTap,
            kCGHeadInsertEventTap,
            kCGEventTapOptionDefault,
            event_mask,
            callback,
            None
        )

        if tap is None:
            logger.error("Failed to create event tap. Grant accessibility permissions in System Settings > Privacy & Security > Accessibility")
            return

        # Create run loop source
        run_loop_source = CFMachPortCreateRunLoopSource(None, tap, 0)
        CFRunLoopAddSource(CFRunLoopGetCurrent(), run_loop_source, kCFRunLoopCommonModes)
        CGEventTapEnable(tap, True)

        logger.info("macOS CGEvent tap active - listening for fn key")

        # Store run loop reference for stopping
        self._run_loop = CFRunLoopGetCurrent()

        # Run the loop
        while self.running:
            Quartz.CFRunLoopRunInMode(Quartz.kCFRunLoopDefaultMode, 0.1, False)

    def _run_windows(self):
        """Windows hotkey detection using win32api"""
        try:
            import ctypes
            from ctypes import wintypes
        except ImportError:
            logger.error("ctypes not available")
            return

        user32 = ctypes.windll.user32

        # Virtual key codes
        VK_CONTROL = 0x11
        VK_LWIN = 0x5B
        VK_SPACE = 0x20

        logger.info("Windows hotkey listener active - listening for Ctrl+Win")

        while self.running:
            ctrl_pressed = user32.GetAsyncKeyState(VK_CONTROL) & 0x8000
            win_pressed = user32.GetAsyncKeyState(VK_LWIN) & 0x8000
            space_pressed = user32.GetAsyncKeyState(VK_SPACE) & 0x8000

            hotkey_now = ctrl_pressed and win_pressed

            if hotkey_now and not self.hotkey_pressed:
                self.hotkey_pressed = True
                self._on_hotkey_down()
            elif not hotkey_now and self.hotkey_pressed:
                self.hotkey_pressed = False
                self._on_hotkey_up()

            # Space for hands-free toggle
            if space_pressed and self.hotkey_pressed and not self.space_pressed:
                self.space_pressed = True
                self._on_toggle_hands_free()
            elif not space_pressed:
                self.space_pressed = False

            # Small sleep to prevent CPU spinning
            import time
            time.sleep(0.01)

    # Hotkey handling
    def _on_hotkey_down(self):
        """Called when the main hotkey is pressed"""
        logger.info("Hotkey pressed")
        if not self.is_recording and not self.is_hands_free:
            self.is_recording = True
            if self.callbacks.on_start_recording:
                self.callbacks.on_start_recording()

    def _on_hotkey_up(self):
        """Called when the main hotkey is released"""
        logger.info("Hotkey released")
        if self.is_recording and not self.is_hands_free:
            self.is_recording = False
            if self.callbacks.on_stop_recording:
                self.callbacks.on_stop_recording()

        # Reset command mode on hotkey release
        if self.is_command_mode:
            self.is_command_mode = False
            if self.callbacks.on_command_mode:
                self.callbacks.on_command_mode(False)

    def _on_toggle_hands_free(self):
        """Called when hands-free toggle is triggered (hotkey + space)"""
        logger.info("Hands-free toggle")
        self.is_hands_free = not self.is_hands_free

        if self.is_hands_free:
            # Start recording in hands-free mode
            if not self.is_recording:
                self.is_recording = True
                if self.callbacks.on_start_recording:
                    self.callbacks.on_start_recording()
        else:
            # Stop recording when disabling hands-free
            if self.is_recording:
                self.is_recording = False
                if self.callbacks.on_stop_recording:
                    self.callbacks.on_stop_recording()

        if self.callbacks.on_toggle_hands_free:
            self.callbacks.on_toggle_hands_free()

    def _on_command_mode(self, active: bool):
        """Called when command mode changes (hotkey + cmd)"""
        logger.info(f"Command mode: {active}")
        self.is_command_mode = active
        if self.callbacks.on_command_mode:
            self.callbacks.on_command_mode(active)
