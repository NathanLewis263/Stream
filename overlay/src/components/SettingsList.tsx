import { useState } from "react";

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
      <div className="glass-card rounded-xl p-4 mb-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="section-header">Trigger</label>
            <input
              type="text"
              placeholder="Trigger"
              className="w-full glass-input rounded-lg px-3 py-2 text-[12px] text-zinc-200 placeholder-zinc-600 outline-none font-mono"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="flex-[2] flex flex-col gap-1.5">
            <label className="section-header">Replacement</label>
            <input
              type="text"
              placeholder="Replacement"
              className="w-full glass-input rounded-lg px-3 py-2 text-[12px] text-zinc-200 placeholder-zinc-600 outline-none"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <button
            onClick={addItem}
            disabled={!newKey || !newValue || isAdding}
            className="btn-primary px-4 py-2 rounded-lg text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-all duration-200"
          >
            {isAdding ? "..." : "Add"}
          </button>
        </div>
      </div>

      {/* Snippets list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
        {itemsArray.length > 0 ? (
          itemsArray.map(([k, v]) => (
            <div
              key={k}
              className="glass-card rounded-xl p-3.5 group"
            >
              <div className="flex justify-between items-center gap-4">
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <span className="kbd-key px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-300 shrink-0 font-mono">
                    {k}
                  </span>
                  <svg
                    className="w-3.5 h-3.5 text-zinc-600 shrink-0"
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
                  <p className="text-[12px] text-zinc-400 truncate leading-relaxed">
                    {v}
                  </p>
                </div>
                <button
                  onClick={() => deleteItem(k)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-all duration-150 shrink-0"
                  title="Delete snippet"
                >
                  <svg
                    className="w-4 h-4"
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
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4">
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
            <p className="text-sm text-zinc-500 font-medium mb-1">
              No snippets yet
            </p>
            <p className="text-xs text-zinc-600">
              Add a trigger and replacement text above
            </p>
          </div>
        )}
      </div>

      {/* Footer count */}
      {itemsArray.length > 0 && (
        <div className="pt-3 mt-3 border-t border-white/[0.04]">
          <p className="text-[11px] text-zinc-600 text-center">
            {itemsArray.length} snippet{itemsArray.length !== 1 ? "s" : ""} saved
          </p>
        </div>
      )}
    </div>
  );
};
