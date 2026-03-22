import { useState, useEffect, useCallback, useMemo } from "react";

export interface DictionaryEntry {
  incorrect: string;
  correct: string;
}

interface UseDictionaryReturn {
  dictionary: Record<string, string>;
  loading: boolean;
  error: string | null;
  addEntry: (incorrect: string, correct: string) => Promise<boolean>;
  removeEntry: (incorrect: string) => Promise<boolean>;
  refresh: () => void;
}

export const useDictionary = (): UseDictionaryReturn => {
  const [dictionary, setDictionary] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statusPort = useMemo(() => window.overlay?.statusPort || 3847, []);
  const baseUrl = useMemo(() => `http://127.0.0.1:${statusPort}`, [statusPort]);

  const fetchDictionary = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${baseUrl}/dictionary`);
      if (!response.ok) throw new Error("Failed to fetch dictionary");
      const data = await response.json();
      setDictionary(data.dictionary || {});
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dictionary");
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchDictionary();
  }, [fetchDictionary]);

  const addEntry = useCallback(async (incorrect: string, correct: string): Promise<boolean> => {
    try {
      const response = await fetch(`${baseUrl}/dictionary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: incorrect, value: correct }),
      });
      if (!response.ok) throw new Error("Failed to add entry");
      await fetchDictionary();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add entry");
      return false;
    }
  }, [baseUrl, fetchDictionary]);

  const removeEntry = useCallback(async (incorrect: string): Promise<boolean> => {
    try {
      const response = await fetch(`${baseUrl}/dictionary/${encodeURIComponent(incorrect)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to remove entry");
      await fetchDictionary();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove entry");
      return false;
    }
  }, [baseUrl, fetchDictionary]);

  return {
    dictionary,
    loading,
    error,
    addEntry,
    removeEntry,
    refresh: fetchDictionary,
  };
};
