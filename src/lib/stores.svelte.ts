import type { RunResult } from "./games/dissociation.ts";

const STORAGE_KEY = "brainTraining_v1";

type GameData = Record<string, RunResult[]>;

function loadFromStorage(): GameData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GameData) : {};
  } catch {
    return {};
  }
}

function createProgress() {
  let data = $state<GameData>(loadFromStorage());

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }

  return {
    get(gameId: string): RunResult[] {
      return data[gameId] ?? [];
    },
    add(gameId: string, result: Omit<RunResult, "date">) {
      const prev = data[gameId] ?? [];
      data = {
        ...data,
        [gameId]: [...prev, { ...result, date: Date.now() }].slice(-100),
      };
      save();
    },
    clear(gameId: string) {
      data = { ...data, [gameId]: [] };
      save();
    },
  };
}

export const progress = createProgress();
