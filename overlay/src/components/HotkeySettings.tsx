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
  0x3f, // fn
  0x3b,
  0x3e, // Ctrl left/right
  0x3a,
  0x3d, // Option left/right
  0x37,
  0x36, // Cmd left/right
  0x38,
  0x3c, // Shift left/right
  0x39, // CapsLock
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
  const hasModifier = data.keycodes.some((kc: number) =>
    MAC_MODIFIER_KEYCODES.has(kc)
  );
  // Check if it's a function key (F1-F12) or other special key
  const isFunctionKey = data.displayName.match(/^F\d+$/);
  const isSpecialKey = ["Space", "Tab", "Esc", "CapsLock"].some(
    (k) => data.displayName === k
  );

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
  icon: React.ReactNode;
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
  icon,
  currentKey,
  isCapturing,
  capturedData,
  validationError,
  onStartCapture,
  onSave,
  onCancel,
}: HotkeyItemProps) => {
  const isValid = capturedData && capturedData.keyCount > 0 && !validationError;

  return (
    <div
      className={`
        relative p-5 rounded-2xl transition-all duration-300
        ${
          isCapturing
            ? "bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent border-violet-500/30 shadow-[0_0_30px_rgba(139,92,246,0.15)]"
            : "glass-card hover:border-white/10"
        }
        border
      `}
    >
      {/* Capture mode glow effect */}
      {isCapturing && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-500/5 to-purple-500/5 animate-pulse pointer-events-none" />
      )}

      <div className="relative flex items-start justify-between gap-6">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {/* Icon */}
          <div
            className={`
              w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors
              ${isCapturing ? "bg-violet-500/20 text-violet-400" : "bg-zinc-800/80 text-zinc-400"}
            `}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-[15px] text-zinc-100">{label}</div>
            <div className="text-sm text-zinc-500 mt-0.5 leading-relaxed">
              {description}
            </div>
          </div>
        </div>

        {isCapturing ? (
          <div className="flex items-center gap-2 shrink-0">
            {/* Capture display */}
            <div
              className={`
                px-4 py-2.5 rounded-xl font-mono text-sm min-w-[140px] text-center
                transition-all duration-200 border
                ${
                  isValid
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : validationError
                      ? "bg-red-500/10 border-red-500/30 text-red-300"
                      : "bg-violet-500/20 border-violet-500/30 text-violet-200 animate-pulse"
                }
              `}
            >
              {capturedData?.displayName || "Press keys..."}
            </div>
            {/* Save button */}
            <button
              onClick={onSave}
              disabled={!isValid}
              className={`
                px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${
                  isValid
                    ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-[0_2px_10px_rgba(16,185,129,0.3)] hover:shadow-[0_4px_15px_rgba(16,185,129,0.4)] hover:-translate-y-0.5 active:translate-y-0"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                }
              `}
            >
              Save
            </button>
            {/* Cancel button */}
            <button
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-all duration-200 border border-white/5"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={onStartCapture}
            className="group shrink-0 px-5 py-2.5 rounded-xl font-mono text-sm bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700 border border-white/10 hover:border-white/20 min-w-[140px] transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
          >
            <span className="flex items-center justify-center gap-2">
              {currentKey}
              <svg
                className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </span>
          </button>
        )}
      </div>

      {/* Validation feedback */}
      {isCapturing && (
        <div
          className={`
            mt-4 flex items-center gap-2 text-sm transition-all duration-200
            ${validationError ? "text-red-400" : isValid ? "text-emerald-400" : "text-zinc-500"}
          `}
        >
          {validationError ? (
            <>
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {validationError}
            </>
          ) : isValid ? (
            <>
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Valid shortcut! Click Save to apply.
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4 shrink-0 animate-pulse"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Listening for key combination...
            </>
          )}
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
      <div className="flex flex-col items-center justify-center h-48 gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
        <div className="text-sm text-zinc-500">Loading hotkey settings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-4">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="text-sm text-red-400">{error}</div>
      </div>
    );
  }

  // Icons for each hotkey type
  const MicrophoneIcon = (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );

  const InfinityIcon = (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 12c0-2.5 2-4.5 4.5-4.5 1.657 0 3.107.895 3.89 2.228L12 10l-.39.272c.783 1.333 2.233 2.228 3.89 2.228C18 12.5 20 10.5 20 8s-2-4.5-4.5-4.5c-1.657 0-3.107.895-3.89 2.228M4 12c0 2.5 2 4.5 4.5 4.5 1.657 0 3.107-.895 3.89-2.228M20 12c0 2.5-2 4.5-4.5 4.5-1.657 0-3.107-.895-3.89-2.228"
      />
    </svg>
  );

  const CommandIcon = (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="glass-card rounded-2xl p-5 border border-white/5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5 text-violet-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 mb-1">
              Keyboard Shortcuts
            </h2>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Click a hotkey to record a new shortcut. Hold the keys you want to
              use, then click Save.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/60 text-xs text-zinc-400 border border-white/5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
                1-3 keys max
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/60 text-xs text-zinc-400 border border-white/5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400/60" />
                Include modifier key
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hotkey Items */}
      <div className="space-y-4">
        <HotkeyItem
          label="Push to Talk"
          description="Hold to record, release to transcribe"
          icon={MicrophoneIcon}
          currentKey={getKeyDisplay("push_to_talk")}
          isCapturing={isCapturing && capturingAction === "push_to_talk"}
          capturedData={capturingAction === "push_to_talk" ? capturedData : null}
          validationError={
            capturingAction === "push_to_talk" ? validationError : null
          }
          onStartCapture={() => handleStartCapture("push_to_talk")}
          onSave={saveCapture}
          onCancel={handleStopCapture}
        />

        <HotkeyItem
          label="Hands-free Modifier"
          description="Combined with push-to-talk to toggle continuous recording"
          icon={InfinityIcon}
          currentKey={getKeyDisplay("hands_free_modifier")}
          isCapturing={isCapturing && capturingAction === "hands_free_modifier"}
          capturedData={
            capturingAction === "hands_free_modifier" ? capturedData : null
          }
          validationError={
            capturingAction === "hands_free_modifier" ? validationError : null
          }
          onStartCapture={() => handleStartCapture("hands_free_modifier")}
          onSave={saveCapture}
          onCancel={handleStopCapture}
        />

        <HotkeyItem
          label="Command Mode Modifier"
          description="Combined with push-to-talk to activate command mode"
          icon={CommandIcon}
          currentKey={getKeyDisplay("command_mode_modifier")}
          isCapturing={
            isCapturing && capturingAction === "command_mode_modifier"
          }
          capturedData={
            capturingAction === "command_mode_modifier" ? capturedData : null
          }
          validationError={
            capturingAction === "command_mode_modifier" ? validationError : null
          }
          onStartCapture={() => handleStartCapture("command_mode_modifier")}
          onSave={saveCapture}
          onCancel={handleStopCapture}
        />
      </div>

      {/* Reset Button */}
      <div className="pt-6 border-t border-white/[0.04]">
        <button
          onClick={resetToDefaults}
          className="group flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 hover:border-white/10 transition-all duration-200"
        >
          <svg
            className="w-4 h-4 group-hover:rotate-[-45deg] transition-transform duration-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};
