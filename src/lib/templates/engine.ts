import type { AdTemplate, RenderedContent, TemplateVariable } from '../types';

/**
 * Deterministic template engine.
 *
 * Given a template and a rotation index, it always produces the same output.
 * The rotation index advances through all possible combinations of variable
 * values using modular arithmetic, ensuring every combination is used before
 * repeating.
 */
export function renderTemplate(template: AdTemplate, rotationIndex: number): RenderedContent {
  const variableValues: Record<string, string> = {};

  if (template.variables.length > 0) {
    // Calculate the total number of combinations
    const combo = getComboForIndex(template.variables, rotationIndex);

    for (const variable of template.variables) {
      const value = combo[variable.name];
      variableValues[variable.name] = formatValue(variable, value);
    }
  }

  // Replace {{variable}} placeholders in the template body
  let text = template.body;
  for (const [name, value] of Object.entries(variableValues)) {
    text = text.replaceAll(`{{${name}}}`, value);
  }

  return {
    text,
    templateId: template.id,
    variableValues,
    rotationIndex,
  };
}

/**
 * Maps a single index to a unique combination of variable values.
 * Uses modular arithmetic to cycle through all combinations deterministically.
 *
 * Example: variables with [3, 2, 4] possible values = 24 total combinations.
 * Index 0 → [0,0,0], Index 1 → [1,0,0], ..., Index 23 → [2,1,3]
 * Index 24 wraps to → [0,0,0] (same as index 0)
 */
function getComboForIndex(
  variables: TemplateVariable[],
  index: number
): Record<string, string> {
  const result: Record<string, string> = {};
  let remainder = index;

  for (const variable of variables) {
    const count = variable.values.length;
    if (count === 0) continue;
    const valueIndex = remainder % count;
    result[variable.name] = variable.values[valueIndex];
    remainder = Math.floor(remainder / count);
  }

  return result;
}

/**
 * Calculates total combinations for a set of variables.
 */
export function getTotalCombinations(variables: TemplateVariable[]): number {
  if (variables.length === 0) return 1;
  return variables.reduce((total, v) => total * Math.max(v.values.length, 1), 1);
}

/**
 * Formats a variable value according to its type and format string.
 */
function formatValue(variable: TemplateVariable, rawValue: string): string {
  if (variable.format) {
    return variable.format.replace('{{value}}', rawValue);
  }

  switch (variable.type) {
    case 'price':
      return `$${rawValue}`;
    default:
      return rawValue;
  }
}

/**
 * Selects which template and group to use for a given rotation index.
 * Distributes evenly across all template-group combinations.
 */
export function selectTemplateAndGroup(
  templateIds: string[],
  groupIds: string[],
  rotationIndex: number
): { templateIndex: number; groupIndex: number } {
  const totalPairs = templateIds.length * groupIds.length;
  const pairIndex = rotationIndex % totalPairs;

  return {
    templateIndex: pairIndex % templateIds.length,
    groupIndex: Math.floor(pairIndex / templateIds.length) % groupIds.length,
  };
}
