/**
 * Normalization helpers used by the deterministic verification rules.
 *
 * The goal is to treat semantically equivalent formatting as equal without
 * letting genuinely different text compare as equal. Each helper is small and
 * deliberately conservative.
 */

/** Collapse repeated whitespace and trim. */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Case-fold, trim, and collapse whitespace. Used for fields where case does
 * not carry meaning (brand names, producer names).
 */
export function normalizeCaseInsensitive(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

/**
 * Normalize common punctuation for brand-name comparison only. This handles
 * typographic variants of the same name (apostrophes, hyphens, ampersands)
 * while requiring the remaining letters/digits to match exactly.
 */
const PUNCTUATION_NORMALIZATION_PATTERN = /['’`"“”\-–—_.&,()]/g;

export function normalizeBrandName(value: string): string {
  return normalizeCaseInsensitive(value).replace(
    PUNCTUATION_NORMALIZATION_PATTERN,
    ""
  );
}

/**
 * Normalize units for net contents comparison. Recognizes common
 * abbreviations and case variants for metric and US customary volumes used on
 * alcohol labels. Purposefully conservative: unknown units are left as-is so a
 * mismatch is reported rather than guessed away.
 */
const UNIT_ALIASES: Record<string, string> = {
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  "ml.": "ml",
  "millilitre": "ml",
  "millilitres": "ml",
  l: "l",
  liter: "l",
  liters: "l",
  "l.": "l",
  "litre": "l",
  "litres": "l",
  "cl": "cl",
  "centiliter": "cl",
  "centiliters": "cl",
  "centilitre": "cl",
  "centilitres": "cl",
  fl: "fl oz",
  "fl oz": "fl oz",
  "fl. oz.": "fl oz",
  "fluid ounce": "fl oz",
  "fluid ounces": "fl oz",
  "oz": "fl oz",
  "oz.": "fl oz",
  "ounce": "fl oz",
  "ounces": "fl oz",
  pt: "pt",
  pint: "pt",
  pints: "pt",
  qt: "qt",
  quart: "qt",
  quarts: "qt",
  gal: "gal",
  gallon: "gal",
  gallons: "gal",
};

const UNIT_VALUE_PATTERN = /^([\d.,\s]+)\s*([a-zA-Z.\s/]+)$/;

export function normalizeNetContents(value: string): string {
  const cleaned = normalizeWhitespace(value).replace(/\s+/g, " ");
  const match = cleaned.match(UNIT_VALUE_PATTERN);
  if (!match) {
    return cleaned.toLowerCase();
  }
  const [_, valuePart, unitPart] = match;
  const unitKey = unitPart.trim().toLowerCase();
  const normalizedUnit = UNIT_ALIASES[unitKey] ?? unitKey;
  return `${valuePart.trim()} ${normalizedUnit}`;
}

/**
 * Extract a numeric alcohol-by-volume percentage from strings such as
 * "45% Alc./Vol.", "45% ABV", "90 Proof", or "8.5% ALC. BY VOL.".
 * Returns null when no percentage can be found.
 */
export function extractAbvPercentage(value: string): number | null {
  const cleaned = value.replace(/,/g, ".").toLowerCase();
  const percentageMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)/);
  if (percentageMatch) {
    return Number(percentageMatch[1]);
  }
  const proofMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*proof/);
  if (proofMatch) {
    return Number(proofMatch[1]) / 2;
  }
  return null;
}

/** Extract a proof number from strings such as "90 Proof" or "80°". Returns null when absent. */
export function extractProof(value: string): number | null {
  const cleaned = value.replace(/,/g, ".").toLowerCase();
  const proofMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*proof/);
  if (proofMatch) {
    return Number(proofMatch[1]);
  }
  const degreeMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:°|degrees?)/);
  if (degreeMatch) {
    return Number(degreeMatch[1]);
  }
  return null;
}

/** Normalize a class/type designation conservatively (case + whitespace only). */
export function normalizeClassOrType(value: string): string {
  return normalizeCaseInsensitive(value);
}

/** Normalize a producer/bottler name (case + whitespace, brand punctuation). */
export function normalizeProducerName(value: string): string {
  return normalizeBrandName(value);
}

/** Normalize a country of origin (case + whitespace). */
export function normalizeCountry(value: string): string {
  return normalizeCaseInsensitive(value);
}

/** Normalize an address (case + whitespace, collapse repeated spaces). */
export function normalizeAddress(value: string): string {
  return normalizeCaseInsensitive(value);
}