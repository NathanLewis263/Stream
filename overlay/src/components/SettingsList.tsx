import { useState } from "react";

interface SnippetEntryProps {
  trigger: string;
  replacement: string;
  onRemove: () => void;
}

const SnippetEntry = ({ trigger, replacement, onRemove }: SnippetEntryProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="group flex items-center justify-between p-3.5 rounded-xl glass-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-sm text-amber-400/80 font-mono truncate max-w-[140px] bg-amber-500/10 px-2 py-1 rounded-lg">
          {trigger}
        </span>
        <svg className="w-4 h-4 text-zinc-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
        <span className="text-sm text-zinc-300 font-mono truncate max-w-[140px]">
          {replacement}
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

interface SettingsListProps {
  items: Record<string, string> | null;
  statusPort: number;
  compact?: boolean;
}

export const SettingsList: React.FC<SettingsListProps> = ({
  items,
  statusPort,
  compact = false,
}) => {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const addItem = async () => {
    if (!newKey || !newValue) return;
    setIsAdding(true);
    try {
      await fetch(`http://127.0.0.1:${statusPort}/snippets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newKey, value: newValue }),
      });
      setNewKey("");
      setNewValue("");
    } catch (e) {
      console.error(`Failed to add snippet`, e);
    } finally {
      setIsAdding(false);
    }
  };

  const deleteItem = async (key: string) => {
    try {
      await fetch(`http://127.0.0.1:${statusPort}/snippets/${key}`, {
        method: "DELETE",
      });
    } catch (e) {
      console.error(`Failed to delete snippet`, e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addItem();
    }
  };

  const itemsArray = items ? Object.entries(items) : [];

  if (compact) {
    return (
      <div className="space-y-3 text-xs">
        <div className="space-y-2">
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Trigger..."
            className="w-full px-3 py-2 rounded-lg bg-[#0a0a0c] border border-white/5 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-[#4d65ff]/40"
          />
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Replacement text..."
            className="w-full px-3 py-2 rounded-lg bg-[#0a0a0c] border border-white/5 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-[#4d65ff]/40"
          />
          <button
            type="button"
            onClick={() => void addItem()}
            disabled={!newKey.trim() || !newValue.trim() || isAdding}
            className="w-full py-2 rounded-lg text-[11px] font-medium btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isAdding ? "Adding..." : "Add Snippet"}
          </button>
        </div>

        <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
          {itemsArray.length === 0 ? (
            <p className="text-zinc-600 text-[11px] text-center py-2">No snippets yet</p>
          ) : (
            itemsArray.map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between gap-2 py-2 px-2 rounded-lg bg-[#1a1a1f] border border-white/[0.03]"
              >
                <span className="text-zinc-400 truncate flex-1 min-w-0 text-[11px]">
                  <span className="text-amber-400/70">{k}</span>
                  <span className="text-zinc-600 mx-1.5">→</span>
                  <span className="text-zinc-300">{v}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void deleteItem(k)}
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
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-100 mb-1">
              Text Snippets
            </h2>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Create shortcuts that expand into longer text.
            </p>
          </div>
        </div>
      </div>

      {/* Add new snippet form */}
      <div className="glass-card rounded-2xl p-4 border border-white/5">
        <div className="flex gap-3 items-center">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Trigger..."
              className="w-full bg-[#111114] border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-[#4d65ff]/40"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <svg className="w-5 h-5 text-zinc-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
          <div className="flex-[2]">
            <input
              type="text"
              placeholder="Replacement text..."
              className="w-full bg-[#111114] border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-[#4d65ff]/40"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <button
            onClick={addItem}
            disabled={!newKey || !newValue || isAdding}
            className={`
              px-5 py-2.5 rounded-xl text-sm font-medium shrink-0 transition-all duration-200
              ${newKey && newValue && !isAdding
                ? "btn-primary"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              }
            `}
          >
            {isAdding ? "..." : "Add"}
          </button>
        </div>
      </div>

      {/* Snippets list */}
      {itemsArray.length > 0 ? (
        <div className="space-y-2">
          {itemsArray.map(([k, v]) => (
            <SnippetEntry
              key={k}
              trigger={k}
              replacement={v}
              onRemove={() => deleteItem(k)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <p className="text-sm text-zinc-500">No snippets yet</p>
          <p className="text-xs text-zinc-600 mt-1">Add a trigger and replacement text above</p>
        </div>
      )}
    </div>
  );
};
