// ── Display value ──────────────────────────────────────────────────────────────
// Fractions are rendered by the template; we store top/bottom separately.
// key is a canonical string used for equality and deduplication.

export interface FVal {
  top: string; // "√3", "π", "−1", "0", "undef"
  bot: string | null; // "2", "6", … or null for integers / whole values
  key: string; // unique canonical identifier
}

function fv(top: string, bot: string | null, key?: string): FVal {
  return { top, bot, key: key ?? (bot ? `${top}/${bot}` : top) };
}

// ── Complete value pools ───────────────────────────────────────────────────────

// Trig result values (sin / cos / tan)
export const TRIG_VALS: FVal[] = [
  fv("0", null, "0"),
  fv("1", null, "1"),
  fv("−1", null, "-1"),
  fv("1", "2", "1/2"),
  fv("−1", "2", "-1/2"),
  fv("√2", "2", "√2/2"),
  fv("−√2", "2", "-√2/2"),
  fv("√3", "2", "√3/2"),
  fv("−√3", "2", "-√3/2"),
  fv("√3", "3", "√3/3"),
  fv("−√3", "3", "-√3/3"),
  fv("√3", null, "√3"),
  fv("−√3", null, "-√3"),
  fv("undef", null, "undef"),
];

// Radian values for all 17 standard angles
export const RAD_VALS: FVal[] = [
  fv("0", null, "0"),
  fv("π", "6", "π/6"),
  fv("π", "4", "π/4"),
  fv("π", "3", "π/3"),
  fv("π", "2", "π/2"),
  fv("2π", "3", "2π/3"),
  fv("3π", "4", "3π/4"),
  fv("5π", "6", "5π/6"),
  fv("π", null, "π"),
  fv("7π", "6", "7π/6"),
  fv("5π", "4", "5π/4"),
  fv("4π", "3", "4π/3"),
  fv("3π", "2", "3π/2"),
  fv("5π", "3", "5π/3"),
  fv("7π", "4", "7π/4"),
  fv("11π", "6", "11π/6"),
  fv("2π", null, "2π"),
];

// Degree values — displayed as plain numbers
export const DEG_VALS: FVal[] = [
  0,
  30,
  45,
  60,
  90,
  120,
  135,
  150,
  180,
  210,
  225,
  240,
  270,
  300,
  315,
  330,
  360,
].map((d) => fv(`${d}°`, null, `${d}°`));

// ── Unit circle data ───────────────────────────────────────────────────────────

interface AngleData {
  deg: number;
  sin: string; // key into TRIG_VALS
  cos: string;
  tan: string;
  rad: string; // key into RAD_VALS
}

const UNIT_CIRCLE: AngleData[] = [
  { deg: 0, sin: "0", cos: "1", tan: "0", rad: "0" },
  { deg: 30, sin: "1/2", cos: "√3/2", tan: "√3/3", rad: "π/6" },
  { deg: 45, sin: "√2/2", cos: "√2/2", tan: "1", rad: "π/4" },
  { deg: 60, sin: "√3/2", cos: "1/2", tan: "√3", rad: "π/3" },
  { deg: 90, sin: "1", cos: "0", tan: "undef", rad: "π/2" },
  { deg: 120, sin: "√3/2", cos: "-1/2", tan: "-√3", rad: "2π/3" },
  { deg: 135, sin: "√2/2", cos: "-√2/2", tan: "-1", rad: "3π/4" },
  { deg: 150, sin: "1/2", cos: "-√3/2", tan: "-√3/3", rad: "5π/6" },
  { deg: 180, sin: "0", cos: "-1", tan: "0", rad: "π" },
  { deg: 210, sin: "-1/2", cos: "-√3/2", tan: "√3/3", rad: "7π/6" },
  { deg: 225, sin: "-√2/2", cos: "-√2/2", tan: "1", rad: "5π/4" },
  { deg: 240, sin: "-√3/2", cos: "-1/2", tan: "√3", rad: "4π/3" },
  { deg: 270, sin: "-1", cos: "0", tan: "undef", rad: "3π/2" },
  { deg: 300, sin: "-√3/2", cos: "1/2", tan: "-√3", rad: "5π/3" },
  { deg: 315, sin: "-√2/2", cos: "√2/2", tan: "-1", rad: "7π/4" },
  { deg: 330, sin: "-1/2", cos: "√3/2", tan: "-√3/3", rad: "11π/6" },
  { deg: 360, sin: "0", cos: "1", tan: "0", rad: "2π" },
];

// ── Question types ────────────────────────────────────────────────────────────

export type QType = "sin" | "cos" | "tan" | "degToRad" | "radToDeg";

export interface Question {
  type: QType;
  deg: number;
  /** The prompt rendered in the card */
  prompt: FVal;
  /** Correct answer */
  answer: FVal;
  /** 4 choices including the correct one, shuffled */
  choices: FVal[];
}

export interface QuizResult {
  question: Question;
  chosen: FVal | null; // null = timed out
  correct: boolean;
  rt: number | null; // ms from question shown to answer
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function byKey<T extends FVal>(pool: T[], key: string): T {
  const v = pool.find((v) => v.key === key);
  if (!v) throw new Error(`FVal not found: ${key}`);
  return v;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickWrong(pool: FVal[], correctKey: string, n: number): FVal[] {
  const candidates = shuffle(pool.filter((v) => v.key !== correctKey));
  return candidates.slice(0, n);
}

// Build a single question
function makeQuestion(data: AngleData, type: QType): Question {
  const degLabel = fv(`${data.deg}°`, null, `${data.deg}°`);
  const radFval = byKey(RAD_VALS, data.rad);

  let prompt: FVal;
  let answer: FVal;
  let pool: FVal[];

  switch (type) {
    case "sin":
      prompt = fv(`sin(${data.deg}°)`, null, `sin(${data.deg}°)`);
      answer = byKey(TRIG_VALS, data.sin);
      pool = TRIG_VALS;
      break;
    case "cos":
      prompt = fv(`cos(${data.deg}°)`, null, `cos(${data.deg}°)`);
      answer = byKey(TRIG_VALS, data.cos);
      pool = TRIG_VALS;
      break;
    case "tan":
      prompt = fv(`tan(${data.deg}°)`, null, `tan(${data.deg}°)`);
      answer = byKey(TRIG_VALS, data.tan);
      pool = TRIG_VALS;
      break;
    case "degToRad":
      prompt = fv(`${data.deg}°  →  rad`, null, `degToRad(${data.deg})`);
      answer = radFval;
      pool = RAD_VALS;
      break;
    case "radToDeg":
      prompt = fv(
        `${radFval.top}${radFval.bot ? `/${radFval.bot}` : ""}  →  °`,
        null,
        `radToDeg(${data.deg})`,
      );
      answer = degLabel;
      pool = DEG_VALS;
      break;
  }

  const wrong = pickWrong(pool, answer.key, 3);
  const choices = shuffle([answer, ...wrong]);
  return { type, deg: data.deg, prompt, answer, choices };
}

// ── Public API ────────────────────────────────────────────────────────────────

export const TOTAL_QUESTIONS = 10;
export const QUESTION_SECS = 8;

export function generateQuiz(): Question[] {
  // Weight: more sin/cos, some tan, some conversions
  const types: QType[] = ["sin", "cos", "tan", "degToRad", "radToDeg"];
  const weights = [3, 3, 2, 1, 1]; // relative frequency

  // Build weighted type pool
  const typePool: QType[] = types.flatMap((t, i) => Array(weights[i]).fill(t));

  // Exclude 0° and 360° for trig (trivial) but keep for conversions
  const trigAngles = UNIT_CIRCLE.filter((a) => a.deg > 0 && a.deg < 360);
  const allAngles = UNIT_CIRCLE;

  const questions: Question[] = [];
  const usedKeys = new Set<string>();

  let attempts = 0;
  while (questions.length < TOTAL_QUESTIONS && attempts < 200) {
    attempts++;
    const type = typePool[Math.floor(Math.random() * typePool.length)];
    const pool = (type === "sin" || type === "cos" || type === "tan")
      ? trigAngles
      : allAngles;
    const data = pool[Math.floor(Math.random() * pool.length)];
    const key = `${type}-${data.deg}`;
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);
    questions.push(makeQuestion(data, type));
  }

  return questions;
}

export function scoreQuiz(results: QuizResult[]): number {
  return results.reduce((sum, r) => {
    if (!r.correct) return sum;
    // Base 500 + speed bonus up to 500
    const speed = r.rt !== null
      ? Math.max(0, Math.round(500 * (1 - r.rt / (QUESTION_SECS * 1000))))
      : 0;
    return sum + 500 + speed;
  }, 0);
}
