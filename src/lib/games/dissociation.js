// Pure game logic — no Svelte imports here, so it's easy to test.

export function generateRules() {
  const emptyByColor = Math.random() < 0.5;
  const flipEmpty = Math.random() < 0.5;
  const flipFilled = Math.random() < 0.5;

  const emptyRule = emptyByColor
    ? {
      criterion: "color",
      left: flipEmpty ? "orange" : "blue",
      right: flipEmpty ? "blue" : "orange",
    }
    : {
      criterion: "type",
      left: flipEmpty ? "triangle" : "square",
      right: flipEmpty ? "square" : "triangle",
    };

  const filledRule = emptyByColor
    ? {
      criterion: "type",
      left: flipFilled ? "triangle" : "square",
      right: flipFilled ? "square" : "triangle",
    }
    : {
      criterion: "color",
      left: flipFilled ? "orange" : "blue",
      right: flipFilled ? "blue" : "orange",
    };

  return { empty: emptyRule, filled: filledRule };
}

export function generateShapes() {
  return Array.from({ length: 30 }, () => ({
    type: Math.random() < 0.5 ? "square" : "triangle",
    fill: Math.random() < 0.5 ? "empty" : "filled",
    color: Math.random() < 0.5 ? "blue" : "orange",
  }));
}

export function correctAnswer(shape, rules) {
  const rule = shape.fill === "empty" ? rules.empty : rules.filled;
  const value = rule.criterion === "color" ? shape.color : shape.type;
  return value === rule.left ? "left" : "right";
}

export function ruleLabel(rule, side) {
  const val = rule[side];
  if (rule.criterion === "color") {
    return val === "blue" ? "🔵 blue" : "🟠 orange";
  }
  return val === "square" ? "■ square" : "▲ triangle";
}
