import React, { useState, useCallback, useEffect } from "react";
import { useHotkeys, CapturedKeyData } from "../hooks/useHotkeys";

// Reserved macOS shortcuts (display names for checking)
const RESERVED_SHORTCUTS = new Set([
  "Cmd + C", "Cmd + V", "Cmd + X", "Cmd + Z", "Cmd + Shift + Z",
  "Cmd + A", "Cmd + Q", "Cmd + W", "Cmd + R", "Cmd + T", "Cmd + S",
  "Cmd + P", "Cmd + N", "Cmd + M", "Cmd + H", "Cmd + F", "Cmd + G",
  "Cmd + Space", "Cmd + Tab", "Cmd + Esc",
  "Cmd + B", "Cmd + I", "Cmd + U",
]);

// Modifier keycodes (macOS)
const MAC_MODIFIER_KEYCODES = new Set([
  0x3F,       // fn
  0x3B, 0x3E, // Ctrl left/right
  0x3A, 0x3D, // Option left/right
  0x37, 0x36, // Cmd left/right
  0x38, 0x3C, // Shift left/right
  0x39,       // CapsLock
]);

interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateShortcut(data: CapturedKeyData): ValidationResult {
  // Rule 1: 3 keys or fewer
  if (data.keyCount > 3) {
    return { valid: false, error: "Maximum 3 keys allowed" };
  }

  // Rule 2: Must include at least one modifier or special key
  const hasModifier = data.keycodes.some((kc: number) => MAC_MODIFIER_KEYCODES.has(kc));
  // Check if it's a function key (F1-F12) or other special key
  const isFunctionKey = data.displayName.match(/^F\d+$/);
  const isSpecialKey = ["Space", "Tab", "Esc", "CapsLock"].some(k => data.displayName === k);

  if (!hasModifier && !isFunctionKey && !isSpecialKey) {
    return { valid: false, error: "Must include a modifier or special key" };
  }

  // Rule 3: Not a reserved system shortcut
  if (RESERVED_SHORTCUTS.has(data.displayName)) {
    return { valid: false, error: "This is a reserved system shortcut" };
  }

  return { valid: true };
}

interface HotkeyItemProps {
  label: string;
  description: string;
  currentKey: string;
  isCapturing: boolean;
  capturedData: CapturedKeyData | null;
  validationError: string | null;
  onStartCapture: () => void;
  onSave: () => void;
  onCancel: () => void;
}

const HotkeyItem = ({
  label,
  description,
  currentKey,
  isCapturing,
  capturedData,
  validationError,
  onStartCapture,
  onSave,
  onCancel,
}: HotkeyItemProps) => {
  return (
    <div className="p-4 bg-zinc-800/50 rounded-lg border border-white/5">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-zinc-100">{label}</div>
          <div className="text-sm text-zinc-400 mt-0.5">{description}</div>
        </div>
        {isCapturing ? (
          <div className="ml-4 flex items-center gap-2">
            <div className="px-4 py-2 bg-blue-600 text-white rounded-md font-mono text-sm min-w-[120px] text-center animate-pulse">
              {capturedData?.displayName || "Press keys"}
            </div>
            <button
              onClick={onSave}
              disabled={!capturedData || !!validationError}
              className="px-3 py-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white rounded-md text-sm"
            >
              Save
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-2 bg-zinc-600 hover:bg-zinc-500 text-white rounded-md text-sm"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={onStartCapture}
            className="ml-4 px-4 py-2 rounded-md font-mono text-sm bg-zinc-700 text-zinc-200 hover:bg-zinc-600 border border-white/10 min-w-[120px]"
          >
            {currentKey}
          </button>
        )}
      </div>
      {isCapturing && validationError && (
        <div className="mt-2 text-sm text-red-400">
          {validationError}
        </div>
      )}
      {isCapturing && !validationError && capturedData && capturedData.keyCount > 0 && (
        <div className="mt-2 text-sm text-green-400">
          Valid shortcut! Click Save to apply.
        </div>
      )}
    </div>
  );
};

export const HotkeySettings = () => {
  const {
    hotkeys,
    platform,
    loading,
    error,
    updateHotkey,
    resetToDefaults,
    isCapturing,
    capturedData,
    startCapture,
    stopCapture
  } = useHotkeys();

  const [capturingAction, setCapturingAction] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Validate captured data when it changes
  useEffect(() => {
    if (capturedData && capturingAction) {
      const validation = validateShortcut(capturedData);
      setValidationError(validation.valid ? null : validation.error || "Invalid shortcut");
    }
  }, [capturedData, capturingAction]);

  const getKeyDisplay = useCallback((actionName: string): string => {
    if (!hotkeys) return "fn";
    const action = hotkeys[actionName as keyof typeof hotkeys];
    if (!action) return "Not set";
    const platformConfig = action[platform as keyof typeof action];
    if (!platformConfig) return "Not set";
    return platformConfig.key || "Unknown";
  }, [hotkeys, platform]);

  const handleStartCapture = (actionName: string) => {
    setCapturingAction(actionName);
    setValidationError(null);
    startCapture();
  };

  const saveCapture = () => {
    if (!capturedData || validationError || !capturingAction) return;

    // Convert to config format (backend now sends macOS keycodes directly)
    if (capturedData.keycodes.length === 1) {
      updateHotkey(capturingAction, {
        key: capturedData.displayName,
        keycode: capturedData.keycodes[0],
      });
    } else {
      updateHotkey(capturingAction, {
        key: capturedData.displayName,
        keycodes: capturedData.keycodes,
      });
    }

    handleStopCapture();
  };

  const handleStopCapture = () => {
    stopCapture();
    setCapturingAction(null);
    setValidationError(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-zinc-400">Loading hotkey settings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-zinc-400 mb-4">
        Click a hotkey to record a new shortcut. Hold the keys you want to use, then click Save.
        <div className="mt-2 text-xs text-zinc-500 space-y-1">
          <p>Valid shortcuts must use 1-3 keys and include at least one modifier (Ctrl, Option, Cmd, Shift) or special key (F1-F12).</p>
        </div>
      </div>

      <div className="space-y-3">
        <HotkeyItem
          label="Push to Talk"
          description="Hold to record, release to transcribe"
          currentKey={getKeyDisplay("push_to_talk")}
          isCapturing={isCapturing && capturingAction === "push_to_talk"}
          capturedData={capturingAction === "push_to_talk" ? capturedData : null}
          validationError={capturingAction === "push_to_talk" ? validationError : null}
          onStartCapture={() => handleStartCapture("push_to_talk")}
          onSave={saveCapture}
          onCancel={handleStopCapture}
        />

        <HotkeyItem
          label="Hands-free Modifier"
          description="Combined with push-to-talk to toggle continuous recording"
          currentKey={getKeyDisplay("hands_free_modifier")}
          isCapturing={isCapturing && capturingAction === "hands_free_modifier"}
          capturedData={capturingAction === "hands_free_modifier" ? capturedData : null}
          validationError={capturingAction === "hands_free_modifier" ? validationError : null}
          onStartCapture={() => handleStartCapture("hands_free_modifier")}
          onSave={saveCapture}
          onCancel={handleStopCapture}
        />

        <HotkeyItem
          label="Command Mode Modifier"
          description="Combined with push-to-talk to activate command mode"
          currentKey={getKeyDisplay("command_mode_modifier")}
          isCapturing={isCapturing && capturingAction === "command_mode_modifier"}
          capturedData={capturingAction === "command_mode_modifier" ? capturedData : null}
          validationError={capturingAction === "command_mode_modifier" ? validationError : null}
          onStartCapture={() => handleStartCapture("command_mode_modifier")}
          onSave={saveCapture}
          onCancel={handleStopCapture}
        />
      </div>

      <div className="pt-4 border-t border-zinc-700">
        <button
          onClick={resetToDefaults}
          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-md text-sm transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};
