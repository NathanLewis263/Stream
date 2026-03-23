import { useCallback, useEffect, useState } from "react";

const LANGUAGES: { code: string; label: string }[] = [
  { code: "auto", label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "ru", label: "Russian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
];

const STYLES: { id: string; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "formal", label: "Formal" },
  { id: "casual", label: "Casual" },
  { id: "enthusiastic", label: "Enthusiastic" },
  { id: "technical", label: "Technical" },
];

type DictationSettingsProps = {
  compact?: boolean;
};

export const DictationSettings = ({ compact = false }: DictationSettingsProps) => {
  const statusPort = window.overlay?.statusPort || 3847;
  const baseUrl = `http://127.0.0.1:${statusPort}`;

  const [language, setLanguage] = useState("auto");
  const [style, setStyle] = useState("default");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/settings/dictation`);
      if (!res.ok) throw new Error("Failed to load settings");
      const d = await res.json();
      setLanguage(d.language ?? "auto");
      setStyle(d.style ?? "default");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (patch: { language?: string; style?: string }) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/settings/dictation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to save");
      const d = await res.json();
      setLanguage(d.language ?? "auto");
      setStyle(d.style ?? "default");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${compact ? "py-6" : "py-16"}`}>
        <div className="w-5 h-5 rounded-full border-2 border-zinc-700 border-t-zinc-400 animate-spin" />
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-5">
        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Language</label>
          <select
            value={language}
            disabled={saving}
            onChange={(e) => {
              const v = e.target.value;
              setLanguage(v);
              save({ language: v });
            }}
            className="w-full bg-[#111114] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-[#4d65ff]/40"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Tone</label>
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={saving}
                onClick={() => {
                  setStyle(s.id);
                  save({ style: s.id });
                }}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
                  ${style === s.id
                    ? "bg-[#4d65ff] text-white"
                    : "bg-[#111114] text-zinc-400 hover:text-zinc-200 border border-white/[0.06]"
                  }
                `}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Language */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-zinc-200">Language</label>
          <p className="text-xs text-zinc-500 mt-0.5">Helps Whisper transcribe more accurately</p>
        </div>
        <select
          value={language}
          disabled={saving}
          onChange={(e) => {
            const v = e.target.value;
            setLanguage(v);
            save({ language: v });
          }}
          className="w-full max-w-xs bg-[#111114] border border-white/[0.06] rounded-lg px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-[#4d65ff]/40 transition-colors"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>

      {/* Tone */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-zinc-200">Tone</label>
          <p className="text-xs text-zinc-500 mt-0.5">How the transcription should be formatted</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={saving}
              onClick={() => {
                setStyle(s.id);
                save({ style: s.id });
              }}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150
                ${style === s.id
                  ? "bg-[#4d65ff] text-white shadow-[0_0_12px_rgba(77,101,255,0.3)]"
                  : "bg-[#111114] text-zinc-400 hover:text-zinc-200 border border-white/[0.06] hover:border-white/[0.1]"
                }
              `}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
