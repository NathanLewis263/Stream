"""
Type-First Text Output with Clipboard Fallback

Outputs text to the user's cursor position using two strategies:
1. Primary: Keyboard Simulation (handles Unicode, instant)
2. Fallback: Clipboard (if focus is not on a text-accepting element)

Cross-platform support for macOS and Windows.
"""

import logging
import sys
import subprocess
from collections import deque

logger = logging.getLogger(__name__)

# Platform detection
IS_MACOS = sys.platform == "darwin"
IS_WINDOWS = sys.platform == "win32"

# Maximum characters per event
CHUNK_SIZE = 20

# Platform-specific imports
if IS_MACOS:
    try:
        from AppKit import NSWorkspace
        import ApplicationServices
        from Quartz import (
            CGEventCreateKeyboardEvent,
            CGEventKeyboardSetUnicodeString,
            CGEventPost,
            kCGHIDEventTap,
        )
        MACOS_AVAILABLE = True
    except ImportError:
        MACOS_AVAILABLE = False
        logger.warning("macOS frameworks not available")

elif IS_WINDOWS:
    try:
        import ctypes
        from ctypes import wintypes
        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32

        # Windows constants
        INPUT_KEYBOARD = 1
        KEYEVENTF_UNICODE = 0x0004
        KEYEVENTF_KEYUP = 0x0002

        # Structures for SendInput
        class KEYBDINPUT(ctypes.Structure):
            _fields_ = [
                ("wVk", wintypes.WORD),
                ("wScan", wintypes.WORD),
                ("dwFlags", wintypes.DWORD),
                ("time", wintypes.DWORD),
                ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong)),
            ]

        class INPUT(ctypes.Structure):
            class _INPUT(ctypes.Union):
                _fields_ = [("ki", KEYBDINPUT)]
            _anonymous_ = ("_input",)
            _fields_ = [
                ("type", wintypes.DWORD),
                ("_input", _INPUT),
            ]

        WINDOWS_AVAILABLE = True
    except Exception as e:
        WINDOWS_AVAILABLE = False
        logger.warning(f"Windows APIs not available: {e}")
else:
    MACOS_AVAILABLE = False
    WINDOWS_AVAILABLE = False


# ============================================================================
# Accessibility / Focus Detection
# ============================================================================

def is_accessibility_enabled() -> bool:
    """Check if accessibility permissions are granted."""
    if IS_MACOS and MACOS_AVAILABLE:
        try:
            return ApplicationServices.AXIsProcessTrusted()
        except Exception as e:
            logger.debug(f"Error checking accessibility: {e}")
            return False
    elif IS_WINDOWS:
        # Windows doesn't require explicit accessibility permissions
        return True
    return False


# AX roles that accept text input (macOS)
TEXT_ACCEPTING_ROLES = {
    "AXTextField",
    "AXTextArea",
    "AXComboBox",
    "AXSearchField",
    "AXWebArea",
    "AXStaticText",
}

CONTAINER_ROLES = {
    "AXGroup",
    "AXScrollArea",
    "AXSplitGroup",
}


def get_ax_attribute(element, attr_name: str):
    """Safely retrieves an accessibility attribute (macOS)."""
    if not IS_MACOS or not MACOS_AVAILABLE:
        return None
    try:
        err, val = ApplicationServices.AXUIElementCopyAttributeValue(element, attr_name, None)
        if err == 0:
            return val
    except Exception:
        pass
    return None


def get_system_focused_element():
    """Gets the currently focused UI element system-wide (macOS)."""
    if not IS_MACOS or not MACOS_AVAILABLE:
        return None
    try:
        system_element = ApplicationServices.AXUIElementCreateSystemWide()
        focused = get_ax_attribute(system_element, "AXFocusedUIElement")
        return focused
    except Exception as e:
        logger.debug(f"Error getting system focused element: {e}")
        return None


def get_app_focused_element():
    """Gets the focused element from the frontmost application (macOS)."""
    if not IS_MACOS or not MACOS_AVAILABLE:
        return None
    try:
        workspace = NSWorkspace.sharedWorkspace()
        active_app = workspace.frontmostApplication()
        if not active_app:
            return None

        pid = active_app.processIdentifier()
        app_element = ApplicationServices.AXUIElementCreateApplication(pid)
        focused = get_ax_attribute(app_element, "AXFocusedUIElement")
        return focused
    except Exception as e:
        logger.debug(f"Error getting app focused element: {e}")
        return None


def get_focused_window_first_text_element():
    """Searches the focused window for the first text-accepting element (macOS)."""
    if not IS_MACOS or not MACOS_AVAILABLE:
        return None
    try:
        workspace = NSWorkspace.sharedWorkspace()
        active_app = workspace.frontmostApplication()
        if not active_app:
            return None

        pid = active_app.processIdentifier()
        app_element = ApplicationServices.AXUIElementCreateApplication(pid)

        focused_window = get_ax_attribute(app_element, "AXFocusedWindow")
        if not focused_window:
            windows = get_ax_attribute(app_element, "AXWindows")
            if windows and len(windows) > 0:
                focused_window = windows[0]

        if not focused_window:
            return None

        queue = deque([focused_window])
        visited = set()

        while queue and len(visited) < 500:
            element = queue.popleft()
            elem_id = id(element)
            if elem_id in visited:
                continue
            visited.add(elem_id)

            role = get_ax_attribute(element, "AXRole")
            if role in TEXT_ACCEPTING_ROLES:
                enabled = get_ax_attribute(element, "AXEnabled")
                if enabled is not False:
                    return element

            children = get_ax_attribute(element, "AXChildren")
            if children:
                for child in children:
                    queue.append(child)

        return None
    except Exception as e:
        logger.debug(f"Error searching for text element: {e}")
        return None


def is_element_editable(element) -> bool:
    """Checks if an AX element is editable/accepts text input (macOS)."""
    if not element or not IS_MACOS or not MACOS_AVAILABLE:
        return False

    try:
        role = get_ax_attribute(element, "AXRole")

        if role in TEXT_ACCEPTING_ROLES:
            enabled = get_ax_attribute(element, "AXEnabled")
            if enabled is False:
                return False
            return True

        if role in CONTAINER_ROLES:
            children = get_ax_attribute(element, "AXChildren")
            if children:
                for child in children[:5]:
                    child_role = get_ax_attribute(child, "AXRole")
                    if child_role in TEXT_ACCEPTING_ROLES:
                        return True

        editable = get_ax_attribute(element, "AXEditable")
        if editable is True:
            return True

        role_desc = get_ax_attribute(element, "AXRoleDescription")
        if role_desc:
            role_desc_str = str(role_desc).lower()
            if any(hint in role_desc_str for hint in ["text", "edit", "input", "field"]):
                return True

        return False

    except Exception as e:
        logger.debug(f"Error checking editability: {e}")
        return False


def _can_accept_text_input_macos() -> bool:
    """macOS implementation of focus detection."""
    if not is_accessibility_enabled():
        logger.warning("Accessibility permissions not granted - cannot detect text fields")
        return False

    focused = get_system_focused_element()
    if focused:
        role = get_ax_attribute(focused, "AXRole")
        logger.debug(f"System focus element role: {role}")
        if is_element_editable(focused):
            logger.debug("Found editable element via system focus")
            return True
    else:
        logger.debug("No system focused element found")

    focused = get_app_focused_element()
    if focused:
        role = get_ax_attribute(focused, "AXRole")
        logger.debug(f"App focus element role: {role}")
        if is_element_editable(focused):
            logger.debug("Found editable element via app focus")
            return True
    else:
        logger.debug("No app focused element found")

    text_element = get_focused_window_first_text_element()
    if text_element:
        logger.debug("Found text element via window search")
        return True

    logger.debug("No text-accepting element found")
    return False


def _can_accept_text_input_windows() -> bool:
    """Windows implementation of focus detection using UI Automation."""
    if not WINDOWS_AVAILABLE:
        return False

    try:
        # Get the foreground window
        hwnd = user32.GetForegroundWindow()
        if not hwnd:
            return False

        # Get the focused control within the window
        thread_id = user32.GetWindowThreadProcessId(hwnd, None)
        current_thread = kernel32.GetCurrentThreadId()

        # Attach to the foreground thread to get focus info
        user32.AttachThreadInput(current_thread, thread_id, True)
        try:
            focus_hwnd = user32.GetFocus()
        finally:
            user32.AttachThreadInput(current_thread, thread_id, False)

        if not focus_hwnd:
            focus_hwnd = hwnd

        # Get window class name
        class_name = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(focus_hwnd, class_name, 256)
        class_name_str = class_name.value.lower()

        # Common edit control class names
        edit_classes = [
            "edit", "richedit", "richedit20a", "richedit20w",
            "scintilla", "textedit", "chrome_widgetwin",
            "mozillawindowclass", "consolewindowclass",
        ]

        for edit_class in edit_classes:
            if edit_class in class_name_str:
                return True

        # Check window styles for edit controls
        GWL_STYLE = -16
        ES_READONLY = 0x0800
        style = user32.GetWindowLongW(focus_hwnd, GWL_STYLE)

        # If it's an edit control that's not readonly
        if "edit" in class_name_str and not (style & ES_READONLY):
            return True

        # For other windows (like browsers), assume text can be typed
        # This is a permissive fallback - we'll try typing and fall back to clipboard
        return True

    except Exception as e:
        logger.debug(f"Error checking Windows focus: {e}")
        return True  # Permissive fallback


def _can_accept_text_input_internal() -> bool:
    """Internal implementation of focus detection."""
    if IS_MACOS:
        return _can_accept_text_input_macos()
    elif IS_WINDOWS:
        return _can_accept_text_input_windows()
    return False


def can_accept_text_input() -> bool:
    """Determines if the currently focused element can accept text input."""
    if IS_MACOS:
        # Use subprocess to avoid caching issues with NSWorkspace
        try:
            script_path = __file__
            result = subprocess.run(
                [sys.executable, script_path, "--check-focus"],
                capture_output=True,
                text=True,
                timeout=1
            )

            if result.returncode == 0:
                return result.stdout.strip() == "true"
            else:
                logger.debug(f"Focus check subprocess failed: {result.stderr}")
                return _can_accept_text_input_internal()

        except Exception as e:
            logger.debug(f"Focus check subprocess error: {e}")
            return _can_accept_text_input_internal()
    else:
        return _can_accept_text_input_internal()


# ============================================================================
# Text Typing
# ============================================================================

def type_text_macos(text: str) -> bool:
    """Types text using CGEvent keyboard simulation (macOS)."""
    if not text or not MACOS_AVAILABLE:
        return False

    try:
        for i in range(0, len(text), CHUNK_SIZE):
            chunk = text[i:i + CHUNK_SIZE]

            key_down = CGEventCreateKeyboardEvent(None, 0, True)
            key_up = CGEventCreateKeyboardEvent(None, 0, False)

            if not key_down or not key_up:
                logger.error("Failed to create CGEvent")
                return False

            CGEventKeyboardSetUnicodeString(key_down, len(chunk), chunk)
            CGEventKeyboardSetUnicodeString(key_up, len(chunk), chunk)

            CGEventPost(kCGHIDEventTap, key_down)
            CGEventPost(kCGHIDEventTap, key_up)

        logger.debug(f"Typed {len(text)} characters via CGEvent")
        return True

    except Exception as e:
        logger.error(f"CGEvent typing failed: {e}")
        return False


def type_text_windows(text: str) -> bool:
    """Types text using SendInput (Windows)."""
    if not text or not WINDOWS_AVAILABLE:
        return False

    try:
        inputs = []

        for char in text:
            # Key down
            ki_down = KEYBDINPUT(
                wVk=0,
                wScan=ord(char),
                dwFlags=KEYEVENTF_UNICODE,
                time=0,
                dwExtraInfo=None
            )
            input_down = INPUT(type=INPUT_KEYBOARD)
            input_down.ki = ki_down
            inputs.append(input_down)

            # Key up
            ki_up = KEYBDINPUT(
                wVk=0,
                wScan=ord(char),
                dwFlags=KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                time=0,
                dwExtraInfo=None
            )
            input_up = INPUT(type=INPUT_KEYBOARD)
            input_up.ki = ki_up
            inputs.append(input_up)

        # Send all inputs
        n_inputs = len(inputs)
        input_array = (INPUT * n_inputs)(*inputs)
        sent = user32.SendInput(n_inputs, input_array, ctypes.sizeof(INPUT))

        if sent != n_inputs:
            logger.warning(f"SendInput sent {sent}/{n_inputs} events")
            return False

        logger.debug(f"Typed {len(text)} characters via SendInput")
        return True

    except Exception as e:
        logger.error(f"SendInput typing failed: {e}")
        return False


def type_text(text: str) -> bool:
    """Types text using platform-appropriate method."""
    if IS_MACOS:
        return type_text_macos(text)
    elif IS_WINDOWS:
        return type_text_windows(text)
    return False


# ============================================================================
# Clipboard
# ============================================================================

def copy_to_clipboard(text: str) -> bool:
    """Copies text to the system clipboard."""
    try:
        if IS_MACOS:
            process = subprocess.Popen(
                ['pbcopy'],
                stdin=subprocess.PIPE,
                env={'LANG': 'en_US.UTF-8'}
            )
            process.communicate(text.encode('utf-8'))
            success = process.returncode == 0

        elif IS_WINDOWS:
            # Use PowerShell method for better Unicode support
            try:
                process = subprocess.Popen(
                    ['powershell', '-command', 'Set-Clipboard', '-Value', text],
                    stdin=subprocess.PIPE,
                    creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
                )
                process.communicate()
                success = process.returncode == 0
            except Exception:
                # Fallback to clip.exe
                process = subprocess.Popen(
                    ['clip'],
                    stdin=subprocess.PIPE,
                )
                process.communicate(text.encode('utf-16-le'))
                success = process.returncode == 0
        else:
            # Linux fallback (xclip/xsel)
            for cmd in [['xclip', '-selection', 'clipboard'], ['xsel', '--clipboard', '--input']]:
                try:
                    process = subprocess.Popen(cmd, stdin=subprocess.PIPE)
                    process.communicate(text.encode('utf-8'))
                    if process.returncode == 0:
                        success = True
                        break
                except FileNotFoundError:
                    continue
            else:
                success = False

        if success:
            logger.debug(f"Copied {len(text)} characters to clipboard")
        else:
            logger.error("Clipboard copy failed")

        return success

    except Exception as e:
        logger.error(f"Clipboard copy failed: {e}")
        return False


# ============================================================================
# Main Output Function
# ============================================================================

def output_text(text: str, notify_on_clipboard: bool = True) -> dict:
    """Outputs text to the user's cursor position (type-first, clipboard fallback)."""
    if not text:
        return {"method": "typed", "success": True}

    result = {
        "method": "typed",
        "success": False,
    }

    has_text_element = can_accept_text_input()

    if has_text_element:
        if type_text(text):
            result["success"] = True
            logger.info(f"Typed {len(text)} characters directly")
            return result
        else:
            result["reason"] = "Typing failed"
            logger.warning("Typing failed, falling back to clipboard")

    if not has_text_element:
        result["reason"] = "No text-accepting element detected"
        logger.info("No text field detected, using clipboard fallback")

    result["method"] = "clipboard"

    if copy_to_clipboard(text):
        result["success"] = True
    else:
        result["success"] = False
        result["reason"] = "Clipboard copy failed"

    return result


# ============================================================================
# Debug / CLI
# ============================================================================

def _get_focused_element_info() -> dict:
    """Returns information about the currently focused element."""
    if IS_MACOS and MACOS_AVAILABLE:
        focused = get_system_focused_element()
        if not focused:
            focused = get_app_focused_element()

        if not focused:
            return {"focused": False}

        info = {"focused": True}

        try:
            info["role"] = get_ax_attribute(focused, "AXRole")
            info["role_description"] = get_ax_attribute(focused, "AXRoleDescription")
            info["title"] = get_ax_attribute(focused, "AXTitle")
            info["editable"] = get_ax_attribute(focused, "AXEditable")
            info["enabled"] = get_ax_attribute(focused, "AXEnabled")
            info["can_accept_text"] = is_element_editable(focused)
        except Exception as e:
            info["error"] = str(e)

        return info

    elif IS_WINDOWS and WINDOWS_AVAILABLE:
        try:
            hwnd = user32.GetForegroundWindow()
            if not hwnd:
                return {"focused": False}

            class_name = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(hwnd, class_name, 256)

            window_text = ctypes.create_unicode_buffer(256)
            user32.GetWindowTextW(hwnd, window_text, 256)

            return {
                "focused": True,
                "class_name": class_name.value,
                "window_text": window_text.value,
                "can_accept_text": _can_accept_text_input_windows(),
            }
        except Exception as e:
            return {"focused": False, "error": str(e)}

    return {"focused": False, "platform": sys.platform}


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--check-focus":
        result = _can_accept_text_input_internal()
        print("true" if result else "false")
        sys.exit(0)
