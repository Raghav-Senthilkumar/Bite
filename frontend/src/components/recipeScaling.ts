import type { Ingredient } from '../api';

const fractionValues: Record<string, number> = {
  '⅛': 1 / 8,
  '¼': 1 / 4,
  '⅓': 1 / 3,
  '⅜': 3 / 8,
  '½': 1 / 2,
  '⅝': 5 / 8,
  '⅔': 2 / 3,
  '¾': 3 / 4,
  '⅞': 7 / 8,
};

const fractionGlyphs = Object.entries(fractionValues);
const amountToken = String.raw`(?:\d+[ -]\d+/\d+|\d+\s*[⅛¼⅓⅜½⅝⅔¾⅞]|\d+/\d+|\d+(?:\.\d+)?|[⅛¼⅓⅜½⅝⅔¾⅞])`;
const leadingAmount = new RegExp(
  String.raw`^(\s*(?:(?:about|around|approximately|approx\.?|roughly|~)\s*)?)(${amountToken})(?:(\s*(?:-|–|—|to|or)\s*)(${amountToken}))?(?=\s|$|[a-zA-Z(])`,
  'i',
);

function parseAmount(value: string): number | null {
  const mixedFraction = value.match(/^(\d+)[ -](\d+)\/(\d+)$/);
  if (mixedFraction) {
    const amount = Number(mixedFraction[1]) + Number(mixedFraction[2]) / Number(mixedFraction[3]);
    return Number.isFinite(amount) ? amount : null;
  }

  const mixedGlyph = value.match(/^(\d+)\s*([⅛¼⅓⅜½⅝⅔¾⅞])$/);
  if (mixedGlyph) return Number(mixedGlyph[1]) + fractionValues[mixedGlyph[2]];

  const fraction = value.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const amount = Number(fraction[1]) / Number(fraction[2]);
    return Number.isFinite(amount) ? amount : null;
  }
  if (value in fractionValues) return fractionValues[value];

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatQuantity(value: number): string {
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 0.005) return String(rounded);

  const whole = Math.floor(value);
  const remainder = value - whole;
  const fraction = fractionGlyphs.find(([, amount]) => Math.abs(remainder - amount) < 0.005);
  if (fraction) return `${whole || ''}${fraction[0]}`;

  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value);
}

function pluralUnit(unit: string, amount: number): string {
  if (amount <= 1 || /^(?:g|kg|mg|ml|l|oz|lb|tsp|tbsp)$/i.test(unit)) return unit;
  if (/[^aeiou]y$/i.test(unit)) return `${unit.slice(0, -1)}ies`;
  if (/leaf$/i.test(unit)) return `${unit.slice(0, -1)}ves`;
  if (/(?:s|x|z|ch|sh)$/i.test(unit)) return `${unit}es`;
  return `${unit}s`;
}

export function scaledIngredient(
  ingredient: Ingredient,
  multiplier: number,
): { text: string; original?: string } {
  const raw = ingredient.raw?.trim() ?? '';
  const name = ingredient.name?.trim() || 'Ingredient';
  if (multiplier === 1) return { text: raw || name };

  const match = raw.match(leadingAmount);
  if (match) {
    const first = parseAmount(match[2]);
    const second = match[4] ? parseAmount(match[4]) : null;
    if (first !== null && (!match[4] || second !== null)) {
      const firstScaled = first * multiplier;
      const amount = `${formatQuantity(firstScaled)}${match[3] && second !== null
        ? `${match[3]}${formatQuantity(second * multiplier)}`
        : ''}`;
      let rest = raw.slice(match[0].length);
      const unitMatch = rest.match(/^(\s+)([a-zA-Z]+)\b/);
      if (ingredient.unit && unitMatch) {
        const singular = ingredient.unit.toLowerCase();
        const plural = pluralUnit(singular, 2);
        if ([singular, plural].includes(unitMatch[2].toLowerCase())) {
          const quantity = second === null ? firstScaled : second * multiplier;
          rest = `${unitMatch[1]}${pluralUnit(ingredient.unit, quantity)}${rest.slice(unitMatch[0].length)}`;
        }
      }
      return { text: `${match[1]}${amount}${rest}` };
    }
  }

  if (ingredient.quantity !== null && Number.isFinite(ingredient.quantity)) {
    const amount = ingredient.quantity * multiplier;
    const unit = ingredient.unit ? ` ${pluralUnit(ingredient.unit, amount)}` : '';
    return {
      text: `${formatQuantity(amount)}${unit} ${name}`,
      original: raw && raw !== name ? raw : undefined,
    };
  }

  return { text: raw || name };
}
