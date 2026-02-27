import React, { useEffect, useCallback } from "react";
import { Switch } from "./ui/switch";
import { useHotkeys } from "../hooks/useHotkeys";

declare global {
  interface Window {
    overlay: {
      statusPort: number;
      setIgnoreMouseEvents: (ignore: boolean) => void;
      updateTray: (recording: boolean) => void;
      getOverlayVisible: () => Promise<boolean>;
      toggleOverlay: () => Promise<boolean>;
      quitApp: () => void;
      setPreferredAI: (ai: string) => void;
      openSettings: () => void;
    };
  }
}

const AI_OPTIONS = [
  { value: "perplexity", label: "Perplexity"},
  { value: "chatgpt", label: "ChatGPT"},
  { value: "grok", label: "Grok"},
] as const;

export const SettingsStatus = () => {
  const [ai, setAI] = React.useState("perplexity");
  const [overlayVisible, setOverlayVisible] = React.useState(true);
  const { hotkeys, platform } = useHotkeys();

  const getKeyDisplay = useCallback(
    (actionName: string): string => {
      if (!hotkeys) {
        if (actionName === "push_to_talk") return "fn";
        if (actionName === "hands_free_modifier") return "Space";
        if (actionName === "command_mode_modifier") return "⌘";
        return "Unknown";
      }
      const action = hotkeys[actionName as keyof typeof hotkeys];
      if (!action) return "Not set";
      const platformConfig = action[platform as keyof typeof action];
      if (!platformConfig) return "Not set";
      return platformConfig.key || "Unknown";
    },
    [hotkeys, platform]
  );

  useEffect(() => {
    window.overlay
      ?.getOverlayVisible?.()
      .then(setOverlayVisible)
      .catch(() => {});
  }, []);

  const handleOverlayToggle = (checked: boolean) => {
    setOverlayVisible(checked);
    window.overlay
      ?.toggleOverlay?.()
      .then(setOverlayVisible)
      .catch(() => {
        setOverlayVisible(!checked);
      });
  };

  const handleAIChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAI = e.target.value;
    setAI(newAI);
    if (window.overlay?.setPreferredAI) {
      window.overlay.setPreferredAI(newAI);
    }
  };

  const HotkeyRow = ({
    label,
    keys,
    delay,
  }: {
    label: string;
    keys: string[];
    delay: number;
  }) => (
    <div
      className="flex items-center justify-between gap-3 py-2 px-1 rounded-md transition-colors hover:bg-white/[0.02] stagger-1"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-[11px] text-zinc-400 font-medium">{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-zinc-600 text-[10px] mx-0.5">+</span>}
            <kbd className="kbd-key shrink-0 px-2 py-1 rounded text-[10px] text-zinc-300 min-w-[28px] text-center">
              {key}
            </kbd>
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Settings sections */}
      <div className="flex flex-col gap-3">
        {/* Hotkeys Section */}
        <section className="glass-card rounded-xl p-3 animate-[slide-up_0.3s_ease-out]">
          <h3 className="section-header mb-2 flex items-center gap-2">
            <svg
              className="w-3 h-3 text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"
              />
            </svg>
            Hotkeys
          </h3>
          <div className="flex flex-col divide-y divide-white/[0.03]">
            <HotkeyRow
              label="Push to talk"
              keys={[getKeyDisplay("push_to_talk")]}
              delay={50}
            />
            <HotkeyRow
              label="Hands-free"
              keys={[
                getKeyDisplay("push_to_talk"),
                getKeyDisplay("hands_free_modifier"),
              ]}
              delay={100}
            />
            <HotkeyRow
              label="Command mode"
              keys={[
                getKeyDisplay("push_to_talk"),
                getKeyDisplay("command_mode_modifier"),
              ]}
              delay={150}
            />
          </div>
        </section>

        {/* Browser Mode Section */}
        <section className="glass-card rounded-xl p-3 animate-[slide-up_0.3s_ease-out] stagger-2">
          <h3 className="section-header mb-2.5 flex items-center gap-2">
            <svg
              className="w-3 h-3 text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"
              />
            </svg>
            Browser Mode
          </h3>
          <label className="block text-[10px] text-zinc-500 mb-1.5 font-medium">
            Preferred AI
          </label>
          <div className="relative">
            <select
              value={ai}
              onChange={handleAIChange}
              className="w-full glass-input rounded-lg pl-3 pr-9 py-2 text-[12px] text-zinc-200 outline-none cursor-pointer appearance-none font-medium"
            >
              {AI_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </section>
      </div>

      {/* Actions */}
      <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-white/[0.04]">
        {/* Overlay Toggle */}
        <div className="glass-card rounded-xl px-3 py-2.5 animate-[slide-up_0.3s_ease-out] stagger-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full transition-colors ${
                  overlayVisible ? "bg-emerald-400" : "bg-zinc-600"
                }`}
              />
              <span className="text-[11px] text-zinc-300 font-medium">
                Overlay visible
              </span>
            </div>
            <Switch
              checked={overlayVisible}
              onCheckedChange={handleOverlayToggle}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <button
          onClick={() => window.overlay?.openSettings?.()}
          className="btn-ghost w-full px-3 py-2.5 rounded-lg text-[12px] text-zinc-300 font-medium flex items-center justify-center gap-2 active:scale-[0.98] animate-[slide-up_0.3s_ease-out] stagger-4"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Open Settings
        </button>
        <button
          onClick={() => window.overlay?.quitApp()}
          className="btn-danger w-full px-3 py-2.5 rounded-lg text-[12px] font-medium flex items-center justify-center gap-2 active:scale-[0.98] animate-[slide-up_0.3s_ease-out] stagger-5"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Quit Application
        </button>
      </div>
    </div>
  );
};
