"""
Cross-platform keycode mappings for human-readable key names.
Used by HotkeyListener to display captured keys.

Supports macOS (CGEvent keycodes) and Windows (Virtual Key codes).
"""

import sys

IS_MACOS = sys.platform == "darwin"
IS_WINDOWS = sys.platform == "win32"

# ============================================================================
# macOS Keycodes
# ============================================================================

# Modifier keycodes to modifier type (for flag checking)
MAC_KEYCODE_TO_MODIFIER = {
    0x3F: "fn",        # fn key
    0x3B: "control",   # Left Control
    0x3E: "control",   # Right Control
    0x3A: "option",    # Left Option
    0x3D: "option",    # Right Option
    0x37: "command",   # Left Cmd
    0x36: "command",   # Right Cmd
    0x38: "shift",     # Left Shift
    0x3C: "shift",     # Right Shift
    0x39: "capslock",  # Caps Lock
}

# Comprehensive keycode to display name mapping
MAC_KEYCODE_TO_NAME = {
    # Modifier keys
    0x3F: "fn",
    0x3B: "Ctrl",
    0x3E: "Ctrl",
    0x3A: "Option",
    0x3D: "Option",
    0x37: "Cmd",
    0x36: "Cmd",
    0x38: "Shift",
    0x3C: "Shift",
    0x39: "CapsLock",

    # Function keys
    0x7A: "F1",
    0x78: "F2",
    0x63: "F3",
    0x76: "F4",
    0x60: "F5",
    0x61: "F6",
    0x62: "F7",
    0x64: "F8",
    0x65: "F9",
    0x6D: "F10",
    0x67: "F11",
    0x6F: "F12",
    0x69: "F13",
    0x6B: "F14",
    0x71: "F15",
    0x6A: "F16",
    0x40: "F17",
    0x4F: "F18",
    0x50: "F19",
    0x5A: "F20",

    # Special keys
    0x31: "Space",
    0x30: "Tab",
    0x35: "Esc",
    0x33: "Delete",
    0x75: "Fwd Del",
    0x24: "Return",
    0x4C: "Enter",      # Numpad enter
    0x73: "Home",
    0x77: "End",
    0x74: "Page Up",
    0x79: "Page Down",

    # Arrow keys
    0x7E: "↑",
    0x7D: "↓",
    0x7B: "←",
    0x7C: "→",

    # Letter keys (QWERTY layout)
    0x00: "A",
    0x0B: "B",
    0x08: "C",
    0x02: "D",
    0x0E: "E",
    0x03: "F",
    0x05: "G",
    0x04: "H",
    0x22: "I",
    0x26: "J",
    0x28: "K",
    0x25: "L",
    0x2E: "M",
    0x2D: "N",
    0x1F: "O",
    0x23: "P",
    0x0C: "Q",
    0x0F: "R",
    0x01: "S",
    0x11: "T",
    0x20: "U",
    0x09: "V",
    0x0D: "W",
    0x07: "X",
    0x10: "Y",
    0x06: "Z",

    # Number keys (top row)
    0x1D: "0",
    0x12: "1",
    0x13: "2",
    0x14: "3",
    0x15: "4",
    0x17: "5",
    0x16: "6",
    0x1A: "7",
    0x1C: "8",
    0x19: "9",

    # Punctuation and symbols
    0x32: "`",          # Backtick/tilde
    0x1B: "-",          # Minus/underscore
    0x18: "=",          # Equals/plus
    0x21: "[",          # Left bracket
    0x1E: "]",          # Right bracket
    0x2A: "\\",         # Backslash
    0x29: ";",          # Semicolon
    0x27: "'",          # Quote
    0x2B: ",",          # Comma
    0x2F: ".",          # Period
    0x2C: "/",          # Slash

    # Numpad keys
    0x52: "Num 0",
    0x53: "Num 1",
    0x54: "Num 2",
    0x55: "Num 3",
    0x56: "Num 4",
    0x57: "Num 5",
    0x58: "Num 6",
    0x59: "Num 7",
    0x5B: "Num 8",
    0x5C: "Num 9",
    0x41: "Num .",
    0x43: "Num *",
    0x45: "Num +",
    0x47: "Num Clear",
    0x4B: "Num /",
    0x4E: "Num -",
    0x51: "Num =",

    # Media keys (may vary by keyboard)
    0x48: "Volume Up",
    0x49: "Volume Down",
    0x4A: "Mute",
}


# ============================================================================
# Windows Virtual Key Codes
# ============================================================================

# Windows modifier VK codes to modifier type
WIN_VK_TO_MODIFIER = {
    0x10: "shift",      # VK_SHIFT
    0xA0: "shift",      # VK_LSHIFT
    0xA1: "shift",      # VK_RSHIFT
    0x11: "control",    # VK_CONTROL
    0xA2: "control",    # VK_LCONTROL
    0xA3: "control",    # VK_RCONTROL
    0x12: "alt",        # VK_MENU (Alt)
    0xA4: "alt",        # VK_LMENU
    0xA5: "alt",        # VK_RMENU
    0x5B: "win",        # VK_LWIN
    0x5C: "win",        # VK_RWIN
    0x14: "capslock",   # VK_CAPITAL
}

# Windows VK code to display name mapping
WIN_VK_TO_NAME = {
    # Modifier keys
    0x10: "Shift",
    0xA0: "Shift",
    0xA1: "Shift",
    0x11: "Ctrl",
    0xA2: "Ctrl",
    0xA3: "Ctrl",
    0x12: "Alt",
    0xA4: "Alt",
    0xA5: "Alt",
    0x5B: "Win",
    0x5C: "Win",
    0x14: "CapsLock",

    # Function keys
    0x70: "F1",
    0x71: "F2",
    0x72: "F3",
    0x73: "F4",
    0x74: "F5",
    0x75: "F6",
    0x76: "F7",
    0x77: "F8",
    0x78: "F9",
    0x79: "F10",
    0x7A: "F11",
    0x7B: "F12",
    0x7C: "F13",
    0x7D: "F14",
    0x7E: "F15",
    0x7F: "F16",
    0x80: "F17",
    0x81: "F18",
    0x82: "F19",
    0x83: "F20",
    0x84: "F21",
    0x85: "F22",
    0x86: "F23",
    0x87: "F24",

    # Special keys
    0x20: "Space",
    0x09: "Tab",
    0x1B: "Esc",
    0x08: "Backspace",
    0x2E: "Delete",
    0x0D: "Enter",
    0x24: "Home",
    0x23: "End",
    0x21: "Page Up",
    0x22: "Page Down",
    0x2D: "Insert",
    0x90: "Num Lock",
    0x91: "Scroll Lock",
    0x13: "Pause",
    0x2C: "Print Screen",

    # Arrow keys
    0x26: "↑",
    0x28: "↓",
    0x25: "←",
    0x27: "→",

    # Letter keys (A-Z: 0x41-0x5A)
    0x41: "A", 0x42: "B", 0x43: "C", 0x44: "D", 0x45: "E",
    0x46: "F", 0x47: "G", 0x48: "H", 0x49: "I", 0x4A: "J",
    0x4B: "K", 0x4C: "L", 0x4D: "M", 0x4E: "N", 0x4F: "O",
    0x50: "P", 0x51: "Q", 0x52: "R", 0x53: "S", 0x54: "T",
    0x55: "U", 0x56: "V", 0x57: "W", 0x58: "X", 0x59: "Y",
    0x5A: "Z",

    # Number keys (top row: 0x30-0x39)
    0x30: "0", 0x31: "1", 0x32: "2", 0x33: "3", 0x34: "4",
    0x35: "5", 0x36: "6", 0x37: "7", 0x38: "8", 0x39: "9",

    # Numpad keys
    0x60: "Num 0", 0x61: "Num 1", 0x62: "Num 2", 0x63: "Num 3",
    0x64: "Num 4", 0x65: "Num 5", 0x66: "Num 6", 0x67: "Num 7",
    0x68: "Num 8", 0x69: "Num 9",
    0x6A: "Num *",
    0x6B: "Num +",
    0x6C: "Num Enter",
    0x6D: "Num -",
    0x6E: "Num .",
    0x6F: "Num /",

    # OEM keys (may vary by keyboard layout)
    0xBA: ";",
    0xBB: "=",
    0xBC: ",",
    0xBD: "-",
    0xBE: ".",
    0xBF: "/",
    0xC0: "`",
    0xDB: "[",
    0xDC: "\\",
    0xDD: "]",
    0xDE: "'",

    # Media keys
    0xAF: "Volume Up",
    0xAE: "Volume Down",
    0xAD: "Mute",
    0xB0: "Media Next",
    0xB1: "Media Prev",
    0xB2: "Media Stop",
    0xB3: "Media Play/Pause",
}


# ============================================================================
# Cross-Platform Functions
# ============================================================================

def get_key_name(keycode: int) -> str:
    """Get human-readable name for a keycode. Platform-aware."""
    if IS_MACOS:
        return MAC_KEYCODE_TO_NAME.get(keycode, f"Key {keycode:#04x}")
    elif IS_WINDOWS:
        return WIN_VK_TO_NAME.get(keycode, f"VK {keycode:#04x}")
    return f"Key {keycode:#04x}"


def is_modifier(keycode: int) -> bool:
    """Check if keycode is a modifier key. Platform-aware."""
    if IS_MACOS:
        return keycode in MAC_KEYCODE_TO_MODIFIER
    elif IS_WINDOWS:
        return keycode in WIN_VK_TO_MODIFIER
    return False


def get_modifier_type(keycode: int) -> str | None:
    """Get modifier type (e.g., 'command', 'shift') for a keycode. Platform-aware."""
    if IS_MACOS:
        return MAC_KEYCODE_TO_MODIFIER.get(keycode)
    elif IS_WINDOWS:
        return WIN_VK_TO_MODIFIER.get(keycode)
    return None


def get_keycode_to_name_map() -> dict:
    """Get the keycode to name mapping for the current platform."""
    if IS_MACOS:
        return MAC_KEYCODE_TO_NAME
    elif IS_WINDOWS:
        return WIN_VK_TO_NAME
    return {}


def get_modifier_map() -> dict:
    """Get the modifier keycode mapping for the current platform."""
    if IS_MACOS:
        return MAC_KEYCODE_TO_MODIFIER
    elif IS_WINDOWS:
        return WIN_VK_TO_MODIFIER
    return {}
