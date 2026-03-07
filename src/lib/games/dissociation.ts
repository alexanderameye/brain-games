export type Fill = "empty" | "filled";
export type Color = "blue" | "orange";
export type ShapeType = "square" | "triangle";
export type Direction = "left" | "right";
export type Discriminator = "fill" | "color";
export type SubCriterion = "color" | "fill" | "type";

export interface Shape {
  type: ShapeType;
  fill: Fill;
  color: Color;
}

export interface SubRule {
  criterion: SubCriterion;
  left: string;
  right: string;
}

/** The discriminator splits shapes into two groups (A/B).
 *  disc=fill  → groupA = empty shapes,  groupB = filled shapes
 *  disc=color → groupA = blue shapes,   groupB = orange shapes
 *  Each group has its own independent sub-rule (criterion ≠ discriminator).
 */
export interface Rules {
  discriminator: Discriminator;
  groupA: SubRule;
  groupB: SubRule;
}

export interface Trial {
  shape: Shape;
  dir: Direction | null;
  correct: boolean;
  rt: number | null;
}

export interface RunResult {
  correct: number;
  total: number;
  accuracy: number;
  avgRt: number | null;
  score: number;
  date: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSubRule(criterion: SubCriterion): SubRule {
  const flip = Math.random() < 0.5;
  switch (criterion) {
    case "color":
      return {
        criterion,
        left: flip ? "orange" : "blue",
        right: flip ? "blue" : "orange",
      };
    case "fill":
      return {
        criterion,
        left: flip ? "filled" : "empty",
        right: flip ? "empty" : "filled",
      };
    case "type":
      return {
        criterion,
        left: flip ? "triangle" : "square",
        right: flip ? "square" : "triangle",
      };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateRules(): Rules {
  const discriminator: Discriminator = Math.random() < 0.5 ? "fill" : "color";
  // The two available sub-criteria (everything except the discriminator itself).
  // We assign one to each group so they always judge by *different* properties.
  const available: SubCriterion[] = discriminator === "fill"
    ? ["color", "type"]
    : ["fill", "type"];
  if (Math.random() < 0.5) available.reverse(); // shuffle which group gets which
  return {
    discriminator,
    groupA: makeSubRule(available[0]),
    groupB: makeSubRule(available[1]),
  };
}

export function generateShapes(): Shape[] {
  return Array.from({ length: 30 }, () => ({
    type: Math.random() < 0.5 ? "square" : "triangle",
    fill: Math.random() < 0.5 ? "empty" : "filled",
    color: Math.random() < 0.5 ? "blue" : "orange",
  }));
}

export function correctAnswer(shape: Shape, rules: Rules): Direction {
  const isGroupA = rules.discriminator === "fill"
    ? shape.fill === "empty"
    : shape.color === "blue";
  const rule = isGroupA ? rules.groupA : rules.groupB;
  const value = rule.criterion === "color"
    ? shape.color
    : rule.criterion === "fill"
    ? shape.fill
    : shape.type;
  return value === rule.left ? "left" : "right";
}

/** Human-readable label for the discriminator condition of a group. */
export function groupLabel(rules: Rules, group: "A" | "B"): string {
  if (rules.discriminator === "fill") {
    return group === "A" ? "Empty" : "Filled";
  }
  return group === "A" ? "Blue" : "Orange";
}

/** Human-readable label for one side of a sub-rule. */
export function subRuleLabel(rule: SubRule, side: "left" | "right"): string {
  const val = rule[side];
  if (rule.criterion === "color") {
    return val === "blue" ? "blue" : "orange";
  }
  if (rule.criterion === "fill") {
    return val === "empty" ? "empty" : "filled";
  }
  return val === "square" ? "square" : "triangle";
}
