import React, { useState } from "react";

export const GroqApiPrompt = ({ statusPort, compact = false }: { statusPort: number, compact?: boolean }) => {
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!key.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`http://127.0.0.1:${statusPort}/settings/api_key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim() }),
      });
      if (!res.ok) throw new Error("Failed to save");
    } catch (err: any) {
      setError(err.message || "Failed to save API key");
    } finally {
      setSaving(false);
    }
  };

  if (compact) {
    return (
      <div className="space-y-3 bg-[#1a1a1f] p-3 rounded-xl border border-red-500/20">
        <div className="flex items-center gap-2 text-red-400 font-medium text-xs">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Groq API Key Required
        </div>
        <input
          type="password"
          placeholder="gsk_..."
          className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none focus:border-red-500/50"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <button
          onClick={handleSave}
          disabled={!key.trim() || saving}
          className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Key"}
        </button>
        {error && <p className="text-red-400 text-[10px]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-zinc-100 mb-2">Groq API Key Required</h2>
          <p className="text-sm text-zinc-400 mb-4">
            To use the dictation engine, you must provide a valid Groq API key.
          </p>
          <div className="flex gap-3">
            <input
              type="password"
              placeholder="gsk_..."
              className="flex-1 bg-[#0a0a0c] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-200 outline-none focus:border-red-500/50"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <button
              onClick={handleSave}
              disabled={!key.trim() || saving}
              className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Key"}
            </button>
          </div>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
};
