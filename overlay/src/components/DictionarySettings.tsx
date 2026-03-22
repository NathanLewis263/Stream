import React, { useState } from "react";
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
      className="group flex items-center justify-between p-3 rounded-xl bg-zinc-800/40 border border-white/5 hover:border-white/10 transition-all duration-200"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-sm text-red-400/80 font-mono line-through truncate max-w-[140px]">
          {incorrect}
        </span>
        <svg
          className="w-4 h-4 text-zinc-600 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
        <span className="text-sm text-emerald-400/90 font-mono truncate max-w-[140px]">
          {correct}
        </span>
      </div>
      <button
        onClick={onRemove}
        className={`p-1.5 rounded-lg transition-all duration-200 ${
          isHovered
            ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
            : "text-transparent"
        }`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export const DictionarySettings = () => {
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
      <div className="flex flex-col items-center justify-center h-48 gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
        <div className="text-sm text-zinc-500">Loading dictionary...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-4">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="text-sm text-red-400">{error}</div>
      </div>
    );
  }

  const entries = Object.entries(dictionary);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="glass-card rounded-2xl p-5 border border-white/5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 mb-1">
              Transcription Dictionary
            </h2>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Add words that are commonly misheard during transcription. The AI will automatically correct these.
            </p>
          </div>
        </div>
      </div>

      {/* Add Entry Form */}
      <div className="glass-card rounded-2xl p-5 border border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={newIncorrect}
              onChange={(e) => setNewIncorrect(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Misheard word..."
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/60 border border-white/5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all duration-200"
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
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/60 border border-white/5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all duration-200"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!newIncorrect.trim() || !newCorrect.trim() || isAdding}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 shrink-0 ${
              newIncorrect.trim() && newCorrect.trim() && !isAdding
                ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-[0_2px_10px_rgba(139,92,246,0.3)] hover:shadow-[0_4px_15px_rgba(139,92,246,0.4)] hover:-translate-y-0.5 active:translate-y-0"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            }`}
          >
            {isAdding ? (
              <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              "Add"
            )}
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
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/40 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
