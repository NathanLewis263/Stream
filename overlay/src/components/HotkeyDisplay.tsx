import { useHotkeys } from "../hooks/useHotkeys";

const HotkeyRow = ({ label, keyDisplay }: { label: string; keyDisplay: string }) => (
  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-800/40 border border-white/[0.04]">
    <span className="text-[13px] font-medium text-zinc-200">{label}</span>
    <span className="px-3 py-1.5 rounded-lg font-mono text-[12px] bg-zinc-900/60 text-zinc-300 border border-white/[0.06]">
      {keyDisplay}
    </span>
  </div>
);

export const HotkeyDisplay = () => {
  const { hotkeys, platform, loading, error } = useHotkeys();

  const getKeyDisplay = (action: string): string => {
    const config = hotkeys?.[action as keyof typeof hotkeys]?.[platform as "darwin" | "win32"];
    return config?.key || "Not set";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-4 h-4 rounded-full border-2 border-[#4d65ff]/30 border-t-[#4d65ff] animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="text-xs text-red-400 text-center py-8">{error}</div>;
  }

  const pttKey = getKeyDisplay("push_to_talk");

  return (
    <div className="space-y-2">
      <HotkeyRow label="Push to Talk" keyDisplay={pttKey} />
      <HotkeyRow label="Hands-free" keyDisplay={`${pttKey} + ${getKeyDisplay("hands_free_modifier")}`} />
      <HotkeyRow label="Command Mode" keyDisplay={`${pttKey} + ${getKeyDisplay("command_mode_modifier")}`} />
      <p className="text-[11px] text-zinc-500 text-center pt-3 border-t border-white/[0.04] mt-3">
        Open Settings to modify hotkeys
      </p>
    </div>
  );
};
