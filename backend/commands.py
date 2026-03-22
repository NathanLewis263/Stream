import json
import os
import logging
from pathlib import Path

# File to store commands/snippets
DATA_FILE = Path("user_data.json")

DEFAULT_DATA = {
    "snippets": {},
    "dictionary": {} 
}

class CommandManager:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.data = self._load_data()
        self._normalize_dictionary_keys()

    def _normalize_dictionary_keys(self):
        """Ensure dictionary keys are lowercased to match add_to_dictionary / remove lookups."""
        d = self.data.get("dictionary") or {}
        if not d:
            return
        new_d = {}
        for k, v in d.items():
            lk = k.strip().lower() if isinstance(k, str) else k
            if not lk:
                continue
            new_d[lk] = v
        if new_d != d:
            self.data["dictionary"] = new_d
            self._save_data(self.data)

    def _load_data(self):
        if not DATA_FILE.exists():
            self._save_data(DEFAULT_DATA)
            return DEFAULT_DATA
        try:
            with open(DATA_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            self.logger.error(f"Failed to load data: {e}")
            return DEFAULT_DATA

    def _save_data(self, data):
        try:
            with open(DATA_FILE, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            self.logger.error(f"Failed to save data: {e}")

    def get_snippets(self):
        return self.data.get("snippets", {})

    def add_snippet(self, key, value):
        self.data.setdefault("snippets", {})[key] = value
        self._save_data(self.data)

    def remove_snippet(self, key) -> bool:
        """Remove a snippet by key. Returns True if removed, False if not found."""
        if key in self.data.get("snippets", {}):
            del self.data["snippets"][key]
            self._save_data(self.data)
            return True
        return False

    def get_dictionary(self) -> dict:
        """Get the dictionary mapping incorrect → correct words."""
        return self.data.get("dictionary", {})

    def add_to_dictionary(self, incorrect: str, correct: str) -> bool:
        """Add a correction to the dictionary. Returns True if added/updated."""
        incorrect = incorrect.strip().lower()
        correct = correct.strip()
        if not incorrect or not correct:
            return False
        dictionary = self.data.setdefault("dictionary", {})
        dictionary[incorrect] = correct
        self._save_data(self.data)
        return True

    def remove_from_dictionary(self, incorrect: str) -> bool:
        """Remove a correction from the dictionary. Returns True if removed, False if not found."""
        target = incorrect.strip().lower()
        dictionary = self.data.get("dictionary", {})
        if target in dictionary:
            del dictionary[target]
            self._save_data(self.data)
            return True
        for k in list(dictionary.keys()):
            if isinstance(k, str) and k.strip().lower() == target:
                del dictionary[k]
                self._save_data(self.data)
                return True
        return False

    def get_keyterms(self) -> list:
        """Get list of correct words for ElevenLabs keyterms (max 100)."""
        dictionary = self.data.get("dictionary", {})
        # Return unique correct words (values)
        return list(set(dictionary.values()))[:100]

command_manager = CommandManager()
