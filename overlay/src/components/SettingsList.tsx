import React, { useState } from "react";

interface SettingsListProps {
  items: Record<string, string> | null;
  statusPort: number;
}

export const SettingsList: React.FC<SettingsListProps> = ({
  items,
  statusPort,
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Add new snippet form */}
      <div className="glass-card rounded-xl p-3 mb-3 animate-[slide-up_0.3s_ease-out]">
        <div className="flex gap-2 items-end">
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-[9px] text-zinc-500 uppercase tracking-wider font-medium">Key</label>
            <input
              type="text"
              placeholder="trigger"
              className="w-full glass-input rounded-md px-2.5 py-1.5 text-[11px] text-zinc-200 placeholder-zinc-600 outline-none font-mono"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="flex-[2] flex flex-col gap-1">
            <label className="text-[9px] text-zinc-500 uppercase tracking-wider font-medium">Snippet</label>
            <input
              type="text"
              placeholder="replacement text"
              className="w-full glass-input rounded-md px-2.5 py-1.5 text-[11px] text-zinc-200 placeholder-zinc-600 outline-none"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <button
            onClick={addItem}
            disabled={!newKey || !newValue || isAdding}
            className="btn-primary px-3 py-1.5 rounded-md text-[11px] font-medium disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none active:scale-[0.98] shrink-0"
          >
            {isAdding ? (
              <svg
                className="w-3.5 h-3.5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              "Add"
            )}
          </button>
        </div>
      </div>

      {/* Snippets list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {itemsArray.length > 0 ? (
          itemsArray.map(([k, v], index) => (
            <div
              key={k}
              className="glass-card rounded-xl p-3 group animate-[scale-in_0.2s_ease-out]"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <span className="kbd-key px-2 py-1 rounded text-[10px] text-zinc-300 shrink-0 font-mono">
                    {k}
                  </span>
                  <svg
                    className="w-3 h-3 text-zinc-600 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                  <p className="text-[11px] text-zinc-400 truncate leading-relaxed font-mono">
                    {v}
                  </p>
                </div>
                <button
                  onClick={() => deleteItem(k)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-all shrink-0"
                  title="Delete snippet"
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center animate-[fade-in_0.3s_ease-out]">
            <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-3">
              <svg
                className="w-6 h-6 text-zinc-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
            </div>
            <p className="text-[11px] text-zinc-500 font-medium mb-1">
              No snippets yet
            </p>
            <p className="text-[10px] text-zinc-600">
              Add a trigger key and replacement text above
            </p>
          </div>
        )}
      </div>

      {/* Footer count */}
      {itemsArray.length > 0 && (
        <div className="pt-2 mt-2 border-t border-white/[0.04]">
          <p className="text-[10px] text-zinc-600 text-center">
            {itemsArray.length} snippet{itemsArray.length !== 1 ? "s" : ""}{" "}
            saved
          </p>
        </div>
      )}
    </div>
  );
};
