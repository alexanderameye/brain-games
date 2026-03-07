// Svelte 5 runes store — note the .svelte.js extension, which enables runes.

const STORAGE_KEY = "brainTraining_v1";

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function createProgress() {
  let data = $state(loadFromStorage());

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }

  return {
    /** Returns the run history array for a game (never undefined). */
    get(gameId) {
      return data[gameId] ?? [];
    },

    /** Appends a result for a game and persists to localStorage. */
    add(gameId, result) {
      const prev = data[gameId] ?? [];
      data = {
        ...data,
        [gameId]: [...prev, { ...result, date: Date.now() }].slice(-100),
      };
      save();
    },

    /** Clears history for a single game. */
    clear(gameId) {
      data = { ...data, [gameId]: [] };
      save();
    },
  };
}

// Single instance — import this everywhere.
export const progress = createProgress();
