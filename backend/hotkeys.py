"""
Cross-platform hotkey detection using native APIs.
Supports single keys and key combinations for push-to-talk.
"""

import sys
import threading
import logging
from typing import Callable, Optional, Dict, Any, List, Set

from keycodes import MAC_KEYCODE_TO_MODIFIER, MAC_KEYCODE_TO_NAME, get_key_name

logger = logging.getLogger(__name__)

# Default key codes (used if no config provided)
DEFAULT_MAC_CONFIG = {
    "push_to_talk": {"keycode": 0x3F},  # fn key
    "hands_free_modifier": {"keycode": 0x31},  # Space
    "command_mode_modifier": {"keycodes": [0x37, 0x36]}  # Cmd left/right
}

DEFAULT_WIN_CONFIG = {
    "push_to_talk": {"vk_codes": [0x11, 0x5B]},  # Ctrl + Win
    "hands_free_modifier": {"vk_code": 0x20},  # Space
    "command_mode_modifier": {"vk_code": 0x10}  # Shift
}


class HotkeyCallbacks:
    def __init__(self):
        self.on_start_recording: Optional[Callable] = None
        self.on_stop_recording: Optional[Callable] = None
        self.on_toggle_hands_free: Optional[Callable] = None
        self.on_command_mode: Optional[Callable[[bool], None]] = None
        self.on_key_captured: Optional[Callable[[Dict[str, Any]], None]] = None


class HotkeyListener:
    def __init__(self, callbacks: HotkeyCallbacks, config: Optional[Dict[str, Any]] = None):
        self.callbacks = callbacks
        self.config = config or {}
        self.running = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

        # State tracking
        self.hotkey_pressed = False
        self.modifier_pressed = False
        self.hands_free_pressed = False
        self.is_recording = False
        self.is_hands_free = False
        self.is_command_mode = False

        # Track currently pressed keys for combinations
        self.pressed_keycodes: Set[int] = set()

        # Track fn key separately (arrow keys falsely trigger SecondaryFn flag)
        self.fn_key_pressed = False

        # Capture mode for settings UI
        self.is_capturing = False
        self.captured_keycodes: Set[int] = set()

        self._command_timer: Optional[threading.Timer] = None

    def _cancel_command_timer(self):
        if self._command_timer:
            self._command_timer.cancel()
            self._command_timer = None

    def _get_platform_config(self) -> Dict[str, Any]:
        """Get config for current platform"""
        platform = sys.platform
        result = {}
        for action, platforms in self.config.items():
            if isinstance(platforms, dict) and platform in platforms:
                result[action] = platforms[platform]
        return result

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

    def reload_config(self, new_config: Dict[str, Any]):
        """Reload hotkey configuration at runtime"""
        logger.info("Reloading hotkey configuration...")
        with self._lock:
            was_running = self.running
            if was_running:
                self.stop()
            self.config = new_config
            # Reset state
            self.hotkey_pressed = False
            self.modifier_pressed = False
            self.hands_free_pressed = False
            self.is_recording = False
            self.is_hands_free = False
            self.is_command_mode = False
            self.pressed_keycodes = set()
            self.fn_key_pressed = False
            self._cancel_command_timer()
            if was_running:
                self.start()

    def start_capture(self):
        """Start capture mode for recording new hotkeys"""
        logger.info("Starting hotkey capture mode")
        self.is_capturing = True
        self.captured_keycodes = set()

    def stop_capture(self):
        """Stop capture mode"""
        logger.info("Stopping hotkey capture mode")
        self.is_capturing = False
        self.captured_keycodes = set()

    def _send_captured_keys(self, keycodes: List[int]):
        """Send captured keycodes to callback"""
        if not self.callbacks.on_key_captured:
            return

        # Build display name from keycodes
        names = []
        for kc in keycodes:
            name = get_key_name(kc)
            if name not in names:  # Dedupe left/right modifiers
                names.append(name)

        self.callbacks.on_key_captured({
            "keycodes": keycodes,
            "displayName": " + ".join(names),
            "keyCount": len(keycodes)
        })

    def _run(self):
        if sys.platform == "darwin":
            self._run_macos()
        elif sys.platform == "win32":
            self._run_windows()
        else:
            logger.warning(f"Unsupported platform: {sys.platform}")

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

        # Get keycodes from config or use defaults
        platform_config = self._get_platform_config()
        ptt_config = platform_config.get("push_to_talk", DEFAULT_MAC_CONFIG["push_to_talk"])
        hands_free_config = platform_config.get("hands_free_modifier", DEFAULT_MAC_CONFIG["hands_free_modifier"])
        cmd_mode_config = platform_config.get("command_mode_modifier", DEFAULT_MAC_CONFIG["command_mode_modifier"])

        # PTT can be single keycode or array of keycodes (for combinations)
        ptt_keycodes: List[int] = []
        if "keycodes" in ptt_config:
            ptt_keycodes = ptt_config["keycodes"]
        elif "keycode" in ptt_config:
            ptt_keycodes = [ptt_config["keycode"]]
        else:
            ptt_keycodes = [0x3F]  # Default to fn

        hands_free_keycode = hands_free_config.get("keycodes", hands_free_config.get("keycode", [0x31]))

        cmd_mode_keycodes = cmd_mode_config.get("keycodes", cmd_mode_config.get("keycode", [0x37, 0x36]))
        if not isinstance(cmd_mode_keycodes, list):
            cmd_mode_keycodes = [cmd_mode_keycodes]

        # Determine which PTT keycodes are modifiers
        ptt_modifier_keycodes = [kc for kc in ptt_keycodes if kc in MAC_KEYCODE_TO_MODIFIER]
        ptt_regular_keycodes = [kc for kc in ptt_keycodes if kc not in MAC_KEYCODE_TO_MODIFIER]

        logger.info(f"macOS hotkeys configured - PTT keycodes: {[hex(k) for k in ptt_keycodes]}, "
                    f"Hands-free: {hands_free_keycode:#x}, Cmd mode: {[hex(k) for k in cmd_mode_keycodes]}")

        def get_pressed_modifiers(flags) -> Set[str]:
            """Get set of currently pressed modifier types from flags"""
            pressed = set()
            # Note: We track fn key state separately via keycode because
            # arrow keys falsely trigger kCGEventFlagMaskSecondaryFn
            if self.fn_key_pressed:
                pressed.add("fn")
            if flags & Quartz.kCGEventFlagMaskControl:
                pressed.add("control")
            if flags & Quartz.kCGEventFlagMaskAlternate:
                pressed.add("option")
            if flags & Quartz.kCGEventFlagMaskCommand:
                pressed.add("command")
            if flags & Quartz.kCGEventFlagMaskShift:
                pressed.add("shift")
            return pressed

        def check_ptt_combination(flags) -> bool:
            """Check if all PTT keys are pressed"""
            pressed_modifiers = get_pressed_modifiers(flags)

            # Check all modifier PTT keys
            for kc in ptt_modifier_keycodes:
                mod_type = MAC_KEYCODE_TO_MODIFIER.get(kc)
                if mod_type and mod_type not in pressed_modifiers:
                    return False

            # Check all regular PTT keys (must be in pressed_keycodes)
            for kc in ptt_regular_keycodes:
                if kc not in self.pressed_keycodes:
                    return False

            return True

        def get_keycodes_from_flags(flags, keycode) -> List[int]:
            """Get list of currently pressed keycodes from flags"""
            keycodes = []
            # Only include fn if the actual fn key (0x3F) is pressed
            if keycode == 0x3F and (flags & Quartz.kCGEventFlagMaskSecondaryFn):
                keycodes.append(0x3F)  # fn
            if flags & Quartz.kCGEventFlagMaskControl:
                keycodes.append(0x3B)  # Ctrl (left)
            if flags & Quartz.kCGEventFlagMaskAlternate:
                keycodes.append(0x3A)  # Option (left)
            if flags & Quartz.kCGEventFlagMaskCommand:
                keycodes.append(0x37)  # Cmd (left)
            if flags & Quartz.kCGEventFlagMaskShift:
                keycodes.append(0x38)  # Shift (left)
            # Add the current key if it's not a modifier
            if keycode not in MAC_KEYCODE_TO_MODIFIER and keycode not in keycodes:
                keycodes.append(keycode)
            return keycodes

        def callback(proxy, event_type, event, refcon):
            try:
                keycode = CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode)
                flags = Quartz.CGEventGetFlags(event)

                # Handle capture mode
                if self.is_capturing:
                    if event_type in (kCGEventKeyDown, kCGEventFlagsChanged):
                        # Add keycode to captured set
                        self.captured_keycodes.add(keycode)
                        # Also add any modifiers from flags
                        for kc in get_keycodes_from_flags(flags, keycode):
                            self.captured_keycodes.add(kc)
                        # Send captured keys
                        self._send_captured_keys(list(self.captured_keycodes))
                    elif event_type == kCGEventKeyUp:
                        # Remove keycode from captured set
                        self.captured_keycodes.discard(keycode)
                    return event  # Don't process normal hotkey logic when capturing

                # Track key press/release for regular keys
                if event_type == kCGEventKeyDown:
                    self.pressed_keycodes.add(keycode)
                elif event_type == kCGEventKeyUp:
                    self.pressed_keycodes.discard(keycode)

                # Track fn key state separately (keycode 0x3F)
                # This avoids false positives from arrow keys triggering SecondaryFn flag
                if event_type == kCGEventFlagsChanged and keycode == 0x3F:
                    self.fn_key_pressed = bool(flags & Quartz.kCGEventFlagMaskSecondaryFn)

                # Check PTT combination state
                ptt_now = check_ptt_combination(flags)

                if ptt_now and not self.hotkey_pressed:
                    self.hotkey_pressed = True
                    self._on_hotkey_down()
                elif not ptt_now and self.hotkey_pressed:
                    self.hotkey_pressed = False
                    self._on_hotkey_up()

                # Check command mode modifier (only when PTT is pressed)
                if event_type == kCGEventFlagsChanged and keycode in cmd_mode_keycodes:
                    pressed_modifiers = get_pressed_modifiers(flags)
                    mod_type = MAC_KEYCODE_TO_MODIFIER.get(keycode)
                    mod_pressed = mod_type in pressed_modifiers if mod_type else False

                    if mod_pressed and not self.modifier_pressed:
                        self.modifier_pressed = True
                        if self.hotkey_pressed:
                            self._cancel_command_timer()
                            self._on_command_mode(True)
                    elif not mod_pressed and self.modifier_pressed:
                        self.modifier_pressed = False
                        if self.is_command_mode:
                            self._cancel_command_timer()
                            self._command_timer = threading.Timer(0.1, lambda: self._on_command_mode(False))
                            self._command_timer.start()

                # Handle hands-free toggle (regular key press while PTT held)
                if event_type == kCGEventKeyDown:
                    if keycode == hands_free_keycode and self.hotkey_pressed:
                        if not self.hands_free_pressed:
                            self.hands_free_pressed = True
                            self._on_toggle_hands_free()
                elif event_type == kCGEventKeyUp:
                    if keycode == hands_free_keycode:
                        self.hands_free_pressed = False

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

        logger.info("macOS CGEvent tap active - listening for hotkeys")

        # Store run loop reference for stopping
        self._run_loop = CFRunLoopGetCurrent()

        # Run the loop
        while self.running:
            Quartz.CFRunLoopRunInMode(Quartz.kCFRunLoopDefaultMode, 0.1, False)

    def _run_windows(self):
        """Windows hotkey detection using win32api"""
        try:
            import ctypes
        except ImportError:
            logger.error("ctypes not available")
            return

        user32 = ctypes.windll.user32

        # Get keycodes from config or use defaults
        platform_config = self._get_platform_config()
        ptt_config = platform_config.get("push_to_talk", DEFAULT_WIN_CONFIG["push_to_talk"])
        hands_free_config = platform_config.get("hands_free_modifier", DEFAULT_WIN_CONFIG["hands_free_modifier"])

        ptt_vk_codes = ptt_config.get("vk_codes", ptt_config.get("vk_code"))
        if not isinstance(ptt_vk_codes, list):
            ptt_vk_codes = [ptt_vk_codes] if ptt_vk_codes else [0x11, 0x5B]
        hands_free_vk = hands_free_config.get("vk_code", 0x20)

        cmd_mode_config = platform_config.get("command_mode_modifier", DEFAULT_WIN_CONFIG["command_mode_modifier"])
        cmd_mode_vk = cmd_mode_config.get("vk_code", 0x10)

        logger.info(f"Windows hotkeys configured - PTT: {[hex(vk) for vk in ptt_vk_codes]}, Hands-free: {hands_free_vk:#x}, Cmd: {cmd_mode_vk:#x}")

        while self.running:
            # Check if all push-to-talk keys are pressed
            hotkey_now = all(
                user32.GetAsyncKeyState(vk) & 0x8000 for vk in ptt_vk_codes
            )
            space_pressed = user32.GetAsyncKeyState(hands_free_vk) & 0x8000

            if hotkey_now and not self.hotkey_pressed:
                self.hotkey_pressed = True
                self._on_hotkey_down()
            elif not hotkey_now and self.hotkey_pressed:
                self.hotkey_pressed = False
                self._on_hotkey_up()

            # Hands-free toggle
            if space_pressed and self.hotkey_pressed and not self.hands_free_pressed:
                self.hands_free_pressed = True
                self._on_toggle_hands_free()
            elif not space_pressed:
                self.hands_free_pressed = False

            # Command mode toggle
            cmd_pressed = user32.GetAsyncKeyState(cmd_mode_vk) & 0x8000
            
            if cmd_pressed and not self.modifier_pressed:
                self.modifier_pressed = True
                if self.hotkey_pressed:
                    self._cancel_command_timer()
                    self._on_command_mode(True)
            elif not cmd_pressed and self.modifier_pressed:
                self.modifier_pressed = False
                if self.is_command_mode:
                    self._cancel_command_timer()
                    self._command_timer = threading.Timer(0.1, lambda: self._on_command_mode(False))
                    self._command_timer.start()

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

        self._cancel_command_timer()

        # Reset command mode on hotkey release
        if self.is_command_mode:
            self.is_command_mode = False
            if self.callbacks.on_command_mode:
                self.callbacks.on_command_mode(False)

    def _on_toggle_hands_free(self):
        """Called when hands-free toggle is triggered"""
        logger.info("Hands-free toggle")
        self.is_hands_free = not self.is_hands_free

        if self.is_hands_free:
            if not self.is_recording:
                self.is_recording = True
                if self.callbacks.on_start_recording:
                    self.callbacks.on_start_recording()
        else:
            if self.is_recording:
                self.is_recording = False
                if self.callbacks.on_stop_recording:
                    self.callbacks.on_stop_recording()

        if self.callbacks.on_toggle_hands_free:
            self.callbacks.on_toggle_hands_free()

    def _on_command_mode(self, active: bool):
        """Called when command mode changes"""
        logger.info(f"Command mode: {active}")
        self.is_command_mode = active
        if self.callbacks.on_command_mode:
            self.callbacks.on_command_mode(active)
