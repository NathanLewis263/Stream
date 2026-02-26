"""
macOS keycode mappings for human-readable key names.
Used by HotkeyListener to display captured keys.
"""

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


def get_key_name(keycode: int) -> str:
    """Get human-readable name for a keycode."""
    return MAC_KEYCODE_TO_NAME.get(keycode, f"Key {keycode:#04x}")


def is_modifier(keycode: int) -> bool:
    """Check if keycode is a modifier key."""
    return keycode in MAC_KEYCODE_TO_MODIFIER


def get_modifier_type(keycode: int) -> str | None:
    """Get modifier type (e.g., 'command', 'shift') for a keycode."""
    return MAC_KEYCODE_TO_MODIFIER.get(keycode)
