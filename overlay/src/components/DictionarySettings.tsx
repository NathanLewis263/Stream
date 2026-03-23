import { useState } from "react";
import { useDictionary } from "../hooks/useDictionary";

interface DictionaryEntryProps {
  incorrect: string;
  correct: string;
  onRemove: () => void;
}

const DictionaryEntry = ({ incorrect, correct, onRemove }: DictionaryEntryProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="group flex items-center justify-between p-3.5 rounded-xl glass-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-sm text-red-400/80 font-mono line-through truncate max-w-[140px] bg-red-500/10 px-2 py-1 rounded-lg">
          {incorrect}
        </span>
        <svg className="w-4 h-4 text-zinc-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
        <span className="text-sm text-teal-400/90 font-mono truncate max-w-[140px] bg-teal-500/10 px-2 py-1 rounded-lg">
          {correct}
        </span>
      </div>
      <button
        onClick={onRemove}
        className={`
          p-1.5 rounded-lg transition-all duration-150
          ${isHovered ? "bg-red-500/10 text-red-400" : "text-transparent"}
        `}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

type DictionarySettingsProps = {
  compact?: boolean;
};

export const DictionarySettings = ({ compact = false }: DictionarySettingsProps) => {
  const { dictionary, loading, error, addEntry, removeEntry } = useDictionary();
  const [newIncorrect, setNewIncorrect] = useState("");
  const [newCorrect, setNewCorrect] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!newIncorrect.trim() || !newCorrect.trim()) return;
    setIsAdding(true);
    const success = await addEntry(newIncorrect.trim(), newCorrect.trim());
    if (success) {
      setNewIncorrect("");
      setNewCorrect("");
    }
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newIncorrect.trim() && newCorrect.trim()) {
      handleAdd();
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${compact ? "py-4" : "py-12"}`}>
        <div className="flex items-center gap-3 text-zinc-500">
          <div className="w-4 h-4 rounded-full border-2 border-[#4d65ff]/30 border-t-[#4d65ff] animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center ${compact ? "py-4" : "py-12"} gap-3`}>
        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="text-sm text-red-400">{error}</div>
      </div>
    );
  }

  const entries = Object.entries(dictionary);

  if (compact) {
    return (
      <div className="space-y-3 text-xs">
        <div className="space-y-2">
          <input
            type="text"
            value={newIncorrect}
            onChange={(e) => setNewIncorrect(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Misheard word..."
            className="w-full px-3 py-2 rounded-lg bg-[#0a0a0c] border border-white/5 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-[#4d65ff]/40"
          />
          <input
            type="text"
            value={newCorrect}
            onChange={(e) => setNewCorrect(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Correct spelling..."
            className="w-full px-3 py-2 rounded-lg bg-[#0a0a0c] border border-white/5 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-[#4d65ff]/40"
          />
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={!newIncorrect.trim() || !newCorrect.trim() || isAdding}
            className="w-full py-2 rounded-lg text-[11px] font-medium btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isAdding ? "Adding..." : "Add Entry"}
          </button>
        </div>

        <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
          {entries.length === 0 ? (
            <p className="text-zinc-600 text-[11px] text-center py-2">No entries yet</p>
          ) : (
            entries.map(([incorrect, correct]) => (
              <div
                key={incorrect}
                className="flex items-center justify-between gap-2 py-2 px-2 rounded-lg bg-[#1a1a1f] border border-white/[0.03]"
              >
                <span className="text-zinc-400 truncate flex-1 min-w-0 text-[11px]">
                  <span className="line-through text-red-400/70">{incorrect}</span>
                  <span className="text-zinc-600 mx-1.5">→</span>
                  <span className="text-teal-400/90">{correct}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void removeEntry(incorrect)}
                  className="shrink-0 text-zinc-600 hover:text-red-400 px-1 transition-colors"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="glass-card rounded-2xl p-5 border border-white/5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-100 mb-1">
              Transcription Dictionary
            </h2>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Add words that are commonly misheard during transcription.
            </p>
          </div>
        </div>
      </div>

      {/* Add Entry Form */}
      <div className="glass-card rounded-2xl p-4 border border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={newIncorrect}
              onChange={(e) => setNewIncorrect(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Misheard word..."
              className="input-field"
            />
          </div>
          <svg className="w-5 h-5 text-zinc-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
          <div className="flex-1">
            <input
              type="text"
              value={newCorrect}
              onChange={(e) => setNewCorrect(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Correct spelling..."
              className="input-field"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!newIncorrect.trim() || !newCorrect.trim() || isAdding}
            className={`
              px-5 py-2.5 rounded-xl text-sm font-medium shrink-0 transition-all duration-200
              ${newIncorrect.trim() && newCorrect.trim() && !isAdding
                ? "btn-primary"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              }
            `}
          >
            {isAdding ? "..." : "Add"}
          </button>
        </div>
      </div>

      {/* Dictionary Entries */}
      {entries.length > 0 ? (
        <div className="space-y-2">
          {entries.map(([incorrect, correct]) => (
            <DictionaryEntry
              key={incorrect}
              incorrect={incorrect}
              correct={correct}
              onRemove={() => removeEntry(incorrect)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p className="text-sm text-zinc-500">No dictionary entries yet</p>
          <p className="text-xs text-zinc-600 mt-1">Add words that are commonly misheard</p>
        </div>
      )}
    </div>
  );
};
