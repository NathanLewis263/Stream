import json
import copy
import logging
from pathlib import Path

# File to store commands/snippets
DATA_FILE = Path("user_data.json")

DEFAULT_DATA = {
    "snippets": {},
    "dictionary": {},
    "dictation": {
        "language": "auto",
        "style": "default",
    },
}

# Appended to the refine prompt (Wispr-style tone presets)
STYLE_PROMPTS = {
    "default": "",
    "formal": (
        "\n\n### Style\nUse a formal, professional tone suitable for business documents and external email. "
        "Avoid slang; keep sentences clear and complete."
    ),
    "casual": (
        "\n\n### Style\nUse a casual, conversational tone suitable for Slack, DMs, and quick internal notes. "
        "Contractions are fine; keep it natural and brief."
    ),
    "enthusiastic": (
        "\n\n### Style\nUse an enthusiastic, warm tone while staying clear and concise. "
        "Avoid excessive exclamation points."
    ),
    "technical": (
        "\n\n### Style\nOptimize for technical writing: preserve identifiers, file paths, flags, and API names. "
        "Use markdown fenced code blocks for code. Do not invent library names or commands."
    ),
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
            data = copy.deepcopy(DEFAULT_DATA)
            self._save_data(data)
            return data
        try:
            with open(DATA_FILE, "r") as f:
                data = json.load(f)
            if self._merge_dictation_defaults(data):
                self._save_data(data)
            return data
        except Exception as e:
            self.logger.error(f"Failed to load data: {e}")
            return copy.deepcopy(DEFAULT_DATA)

    def _merge_dictation_defaults(self, data: dict) -> bool:
        """Ensure dictation block exists with known keys. Returns True if data was modified."""
        changed = False
        d = data.get("dictation")
        if not isinstance(d, dict):
            d = {}
            changed = True
        for k, v in DEFAULT_DATA["dictation"].items():
            if k not in d:
                d[k] = v
                changed = True
        data["dictation"] = d
        return changed

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

    def get_dictation_settings(self) -> dict:
        d = self.data.get("dictation") or DEFAULT_DATA["dictation"].copy()
        out = {**DEFAULT_DATA["dictation"], **d}
        out.pop("live_preview", None)
        if out.get("style") not in STYLE_PROMPTS:
            out["style"] = "default"
        return out

    def set_dictation_settings(self, language: str = None, style: str = None) -> dict:
        d = self.data.setdefault("dictation", {})
        if language is not None:
            d["language"] = (language or "auto").strip().lower() or "auto"
        if style is not None:
            st = style.strip().lower() if isinstance(style, str) else "default"
            d["style"] = st if st in STYLE_PROMPTS else "default"
        d.pop("live_preview", None)
        self._save_data(self.data)
        return self.get_dictation_settings()

    def get_style_prompt_fragment(self) -> str:
        st = self.get_dictation_settings().get("style", "default")
        return STYLE_PROMPTS.get(st, STYLE_PROMPTS["default"])

command_manager = CommandManager()
