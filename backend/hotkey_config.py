"""
Hotkey configuration manager.
Stores hotkey bindings in user_data.json alongside snippets.
"""

import json
import sys
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Callable

DATA_FILE = Path("user_data.json")

# Default hotkey configuration per platform
DEFAULT_HOTKEYS = {
    "push_to_talk": {
        "darwin": {"key": "fn", "keycode": 0x3F},
        "win32": {"key": "Ctrl+Win", "vk_codes": [0x11, 0x5B]}
    },
    "hands_free_modifier": {
        "darwin": {"key": "Space", "keycode": 0x31},
        "win32": {"key": "Space", "vk_code": 0x20}
    },
    "command_mode_modifier": {
        "darwin": {"key": "Cmd", "keycodes": [0x37, 0x36]},
        "win32": {"key": "Shift", "vk_code": 0x10}
    }
}


class HotkeyConfigManager:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self._on_change_callback: Optional[Callable[[Dict], None]] = None
        self._load_data()

    def _load_data(self):
        """Load hotkey config from user_data.json"""
        if not DATA_FILE.exists():
            return

        try:
            with open(DATA_FILE, "r") as f:
                data = json.load(f)
                # Hotkeys might not exist yet
                if "hotkeys" not in data:
                    data["hotkeys"] = DEFAULT_HOTKEYS.copy()
                    self._save_to_file(data)
        except Exception as e:
            self.logger.error(f"Failed to load hotkey config: {e}")

    def _save_to_file(self, data: Dict):
        """Save data to user_data.json"""
        try:
            with open(DATA_FILE, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            self.logger.error(f"Failed to save hotkey config: {e}")

    def _read_file(self) -> Dict:
        """Read the full user_data.json file"""
        if not DATA_FILE.exists():
            return {"snippets": {}, "hotkeys": DEFAULT_HOTKEYS.copy()}

        try:
            with open(DATA_FILE, "r") as f:
                data = json.load(f)
                if "hotkeys" not in data:
                    data["hotkeys"] = DEFAULT_HOTKEYS.copy()
                return data
        except Exception as e:
            self.logger.error(f"Failed to read file: {e}")
            return {"snippets": {}, "hotkeys": DEFAULT_HOTKEYS.copy()}

    def get_hotkeys(self) -> Dict[str, Any]:
        """Get all hotkey configurations"""
        data = self._read_file()
        return data.get("hotkeys", DEFAULT_HOTKEYS.copy())

    def get_hotkey(self, action: str) -> Dict[str, Any]:
        """Get hotkey config for a specific action"""
        hotkeys = self.get_hotkeys()
        return hotkeys.get(action, DEFAULT_HOTKEYS.get(action, {}))

    def get_platform_hotkey(self, action: str, platform: Optional[str] = None) -> Dict[str, Any]:
        """Get hotkey config for a specific action and platform"""
        if platform is None:
            platform = sys.platform
        hotkey = self.get_hotkey(action)
        return hotkey.get(platform, {})

    def set_hotkey(self, action: str, platform: str, config: Dict[str, Any]):
        """Set hotkey config for a specific action and platform"""
        data = self._read_file()
        if "hotkeys" not in data:
            data["hotkeys"] = DEFAULT_HOTKEYS.copy()

        if action not in data["hotkeys"]:
            data["hotkeys"][action] = {}

        data["hotkeys"][action][platform] = config
        self._save_to_file(data)

        # Notify listener of change
        if self._on_change_callback:
            self._on_change_callback(data["hotkeys"])

    def reset_to_defaults(self):
        """Reset all hotkeys to default values"""
        data = self._read_file()
        data["hotkeys"] = DEFAULT_HOTKEYS.copy()
        self._save_to_file(data)

        if self._on_change_callback:
            self._on_change_callback(data["hotkeys"])

    def on_change(self, callback: Callable[[Dict], None]):
        """Register a callback to be called when hotkeys change"""
        self._on_change_callback = callback


# Singleton instance
hotkey_config = HotkeyConfigManager()
