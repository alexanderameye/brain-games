export type ParamKey = "F" | "A" | "H" | "S";

export interface Param {
  key: ParamKey;
  label: string;
  value: string;
}

export interface Series {
  params: Param[]; // all 4
  missing: ParamKey[]; // which are hidden (1-3)
}

export interface SeriesResult {
  series: Series;
  answers: Record<ParamKey, string | null>; // what user typed
  correct: ParamKey[];
  wrong: ParamKey[];
  skipped: ParamKey[]; // time ran out
}

// ── Value generators ──────────────────────────────────────────────────────────

function rInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pad(n: number, len: number) {
  return String(n).padStart(len, "0");
}

function genFrequency(): string {
  // VHF aviation: 118.000–136.975 MHz in 25kHz steps
  // Represented as 5-digit integer: 11800–13697 (we drop the decimal for input purposes)
  const whole = rInt(118, 136);
  const dec = [0, 25, 50, 75][rInt(0, 3)];
  return `${whole}${pad(dec, 3)}`; // e.g. "11825", "13600"
}

function genAltitude(): string {
  // Round to nearest 100ft, 500–15900
  return String(rInt(5, 159) * 100);
}

function genHeading(): string {
  return pad(rInt(1, 360), 3); // "001"–"360"
}

function genSpeed(): string {
  // Knots, realistic range 100–450, round to nearest 5
  return String(rInt(20, 90) * 5);
}

const PARAM_META: Record<ParamKey, { label: string; gen: () => string }> = {
  F: { label: "Frequency", gen: genFrequency },
  A: { label: "Altitude", gen: genAltitude },
  H: { label: "Heading", gen: genHeading },
  S: { label: "Speed", gen: genSpeed },
};

// ── Series generation ─────────────────────────────────────────────────────────

/** Difficulty 0–9 (series index). Returns number of missing params. */
function missingCount(difficulty: number): number {
  if (difficulty <= 2) return 1;
  if (difficulty <= 5) return 2;
  return 3;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateSeries(difficulty: number): Series {
  const keys: ParamKey[] = ["F", "A", "H", "S"];
  const params: Param[] = keys.map((key) => ({
    key,
    label: PARAM_META[key].label,
    value: PARAM_META[key].gen(),
  }));

  const n = missingCount(difficulty);
  const missing = shuffle(keys).slice(0, n) as ParamKey[];

  return { params, missing };
}

export const TOTAL_SERIES = 10;

// ── Validation ────────────────────────────────────────────────────────────────

/** Parse user input like "A3100", "H014", "f11825" → { key, value } or null */
export function parseInput(
  raw: string,
): { key: ParamKey; value: string } | null {
  const trimmed = raw.trim().toUpperCase();
  if (trimmed.length < 2) return null;
  const key = trimmed[0] as ParamKey;
  if (!["F", "A", "H", "S"].includes(key)) return null;
  const value = trimmed.slice(1);
  return { key, value };
}

/** Check answer against expected value. Lenient: strips leading zeros for comparison. */
export function checkAnswer(input: string, expected: string): boolean {
  return input.replace(/^0+/, "") === expected.replace(/^0+/, "");
}

export { PARAM_META };
