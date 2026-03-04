"""
Type-First Text Output with Clipboard Fallback

Outputs text to the user's cursor position using two strategies:
1. Primary: CGEvent Keyboard Simulation (handles Unicode, instant)
2. Fallback: Clipboard (if focus is not on a text-accepting element)
"""

import logging
from collections import deque

from AppKit import NSWorkspace
import ApplicationServices
from Quartz import (
    CGEventCreateKeyboardEvent,
    CGEventKeyboardSetUnicodeString,
    CGEventPost,
    kCGHIDEventTap,
)

logger = logging.getLogger(__name__)


def is_accessibility_enabled() -> bool:
    """Check if accessibility permissions are granted."""
    try:
        # AXIsProcessTrusted returns True if the app has accessibility permissions
        return ApplicationServices.AXIsProcessTrusted()
    except Exception as e:
        logger.debug(f"Error checking accessibility: {e}")
        return False

# AX roles that accept text input
TEXT_ACCEPTING_ROLES = {
    "AXTextField",      # Single-line text input
    "AXTextArea",       # Multi-line text input
    "AXComboBox",       # Dropdown with text input
    "AXSearchField",    # Search input
    "AXWebArea",        # Web content (browser fields, Electron apps)
    "AXStaticText",     # Sometimes editable in web contexts
}

# Roles that might contain editable children (need deeper check)
CONTAINER_ROLES = {
    "AXGroup",
    "AXScrollArea",
    "AXSplitGroup",
}

# Maximum characters per CGEvent (macOS limit is ~20 for Unicode)
CHUNK_SIZE = 20


def get_ax_attribute(element, attr_name: str):
    """Safely retrieves an accessibility attribute."""
    try:
        err, val = ApplicationServices.AXUIElementCopyAttributeValue(element, attr_name, None)
        if err == 0:
            return val
    except Exception:
        pass
    return None


def get_system_focused_element():
    """Gets the currently focused UI element system-wide."""
    try:
        # Get the system-wide accessibility element
        system_element = ApplicationServices.AXUIElementCreateSystemWide()

        # Get the focused element
        focused = get_ax_attribute(system_element, "AXFocusedUIElement")
        return focused
    except Exception as e:
        logger.debug(f"Error getting system focused element: {e}")
        return None


def get_app_focused_element():
    """Gets the focused element from the frontmost application."""
    try:
        workspace = NSWorkspace.sharedWorkspace()
        active_app = workspace.frontmostApplication()
        if not active_app:
            return None

        pid = active_app.processIdentifier()
        app_element = ApplicationServices.AXUIElementCreateApplication(pid)

        # Get the app's focused element
        focused = get_ax_attribute(app_element, "AXFocusedUIElement")
        return focused
    except Exception as e:
        logger.debug(f"Error getting app focused element: {e}")
        return None


def get_focused_window_first_text_element():
    """Searches the focused window for the first text-accepting element."""
    try:
        workspace = NSWorkspace.sharedWorkspace()
        active_app = workspace.frontmostApplication()
        if not active_app:
            return None

        pid = active_app.processIdentifier()
        app_element = ApplicationServices.AXUIElementCreateApplication(pid)

        # Get focused window
        focused_window = get_ax_attribute(app_element, "AXFocusedWindow")
        if not focused_window:
            windows = get_ax_attribute(app_element, "AXWindows")
            if windows and len(windows) > 0:
                focused_window = windows[0]

        if not focused_window:
            return None

        # BFS to find first text-accepting element
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
                # Check if it's enabled and potentially editable
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
    """Checks if an AX element is editable/accepts text input."""
    if not element:
        return False

    try:
        role = get_ax_attribute(element, "AXRole")

        # Direct text-accepting roles
        if role in TEXT_ACCEPTING_ROLES:
            # Check if explicitly disabled
            enabled = get_ax_attribute(element, "AXEnabled")
            if enabled is False:
                return False

            # For most roles, just accept it
            # AXWebArea is common in Electron apps and browsers
            return True

        # Check container roles for editable children (shallow)
        if role in CONTAINER_ROLES:
            children = get_ax_attribute(element, "AXChildren")
            if children:
                for child in children[:5]:
                    child_role = get_ax_attribute(child, "AXRole")
                    if child_role in TEXT_ACCEPTING_ROLES:
                        return True

        # Check if element has AXEditable attribute set to True
        editable = get_ax_attribute(element, "AXEditable")
        if editable is True:
            return True

        # Check role description for text hints
        role_desc = get_ax_attribute(element, "AXRoleDescription")
        if role_desc:
            role_desc_str = str(role_desc).lower()
            if any(hint in role_desc_str for hint in ["text", "edit", "input", "field"]):
                return True

        return False

    except Exception as e:
        logger.debug(f"Error checking editability: {e}")
        return False


def _can_accept_text_input_internal() -> bool:
    """Internal implementation of focus detection."""
    # Check accessibility permissions first
    if not is_accessibility_enabled():
        logger.warning("Accessibility permissions not granted - cannot detect text fields")
        return False

    # Try system-wide focus first
    focused = get_system_focused_element()
    if focused:
        role = get_ax_attribute(focused, "AXRole")
        logger.debug(f"System focus element role: {role}")
        if is_element_editable(focused):
            logger.debug("Found editable element via system focus")
            return True
    else:
        logger.debug("No system focused element found")

    # Fallback to app focus
    focused = get_app_focused_element()
    if focused:
        role = get_ax_attribute(focused, "AXRole")
        logger.debug(f"App focus element role: {role}")
        if is_element_editable(focused):
            logger.debug("Found editable element via app focus")
            return True
    else:
        logger.debug("No app focused element found")

    # Last resort: search the focused window for any text element
    # This handles cases where focus is on a container but text field exists
    text_element = get_focused_window_first_text_element()
    if text_element:
        logger.debug("Found text element via window search")
        return True

    logger.debug("No text-accepting element found")
    return False


def can_accept_text_input() -> bool:
    """Determines if the currently focused element can accept text input via subprocess."""
    try:
        import subprocess
        import sys
        import os

        script_path = os.path.abspath(__file__)
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
            # Fall back to direct call
            return _can_accept_text_input_internal()

    except Exception as e:
        logger.debug(f"Focus check subprocess error: {e}")
        # Fall back to direct call
        return _can_accept_text_input_internal()


def type_text_cgevent(text: str) -> bool:
    """Types text using CGEvent keyboard simulation."""
    if not text:
        return True

    try:
        # Process text in chunks (macOS CGEvent limit is ~20 chars for Unicode)
        for i in range(0, len(text), CHUNK_SIZE):
            chunk = text[i:i + CHUNK_SIZE]

            # Create a key down event (keycode 0 = 'a', but we override with Unicode)
            key_down = CGEventCreateKeyboardEvent(None, 0, True)
            key_up = CGEventCreateKeyboardEvent(None, 0, False)

            if not key_down or not key_up:
                logger.error("Failed to create CGEvent")
                return False

            # Set the Unicode string for this chunk
            # This overrides the keycode and types the exact Unicode text
            CGEventKeyboardSetUnicodeString(key_down, len(chunk), chunk)
            CGEventKeyboardSetUnicodeString(key_up, len(chunk), chunk)

            # Post the events to the HID event tap
            CGEventPost(kCGHIDEventTap, key_down)
            CGEventPost(kCGHIDEventTap, key_up)

        logger.debug(f"Typed {len(text)} characters via CGEvent")
        return True

    except Exception as e:
        logger.error(f"CGEvent typing failed: {e}")
        return False


def copy_to_clipboard(text: str) -> bool:
    """Copies text to the system clipboard using pbcopy."""
    try:
        import subprocess
        process = subprocess.Popen(
            ['pbcopy'],
            stdin=subprocess.PIPE,
            env={'LANG': 'en_US.UTF-8'}
        )
        process.communicate(text.encode('utf-8'))

        if process.returncode == 0:
            logger.debug(f"Copied {len(text)} characters to clipboard")
            return True
        else:
            logger.error(f"pbcopy failed with return code {process.returncode}")
            return False

    except Exception as e:
        logger.error(f"Clipboard copy failed: {e}")
        return False



def output_text(text: str, notify_on_clipboard: bool = True) -> dict:
    """Outputs text to the user's cursor position (type-first, clipboard fallback)."""
    if not text:
        return {"method": "typed", "success": True}

    result = {
        "method": "typed",
        "success": False,
    }

    # Check if we can detect a text-accepting element
    has_text_element = can_accept_text_input()

    # Only type if we detected a text-accepting element
    if has_text_element:
        if type_text_cgevent(text):
            result["success"] = True
            logger.info(f"Typed {len(text)} characters directly")
            return result
        else:
            result["reason"] = "CGEvent typing failed"
            logger.warning("CGEvent typing failed, falling back to clipboard")

    # No text element detected or typing failed -> clipboard fallback
    if not has_text_element:
        result["reason"] = "No text-accepting element detected"
        logger.info("No text field detected, using clipboard fallback")

    # Clipboard fallback
    result["method"] = "clipboard"

    if copy_to_clipboard(text):
        result["success"] = True
    else:
        result["success"] = False
        result["reason"] = "Clipboard copy failed"

    return result


def _get_focused_element_info() -> dict:
    """Returns information about the currently focused element."""
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


if __name__ == "__main__":
    import sys

    # Handle subprocess focus check (no logging to keep stdout clean)
    if len(sys.argv) > 1 and sys.argv[1] == "--check-focus":
        result = _can_accept_text_input_internal()
        print("true" if result else "false")
        sys.exit(0)
