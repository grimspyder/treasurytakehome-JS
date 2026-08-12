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
 * Fold accented characters to their ASCII equivalents so that "Bacardí",
 * "Bacardi", and "Bacardi" all compare as equal. Most reviewers type in basic
 * American English characters, and brand names with diacritics (e.g. "José
 * Cuervo") are commonly spelled without them in applications and searches.
 * Uses Unicode normalization (NFD) to split accents from base letters, then
 * removes the combining marks.
 */
export function normalizeDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalize common punctuation for brand-name comparison only. This handles
 * typographic variants of the same name (apostrophes, hyphens, ampersands)
 * while requiring the remaining letters/digits to match exactly.
 */
const PUNCTUATION_NORMALIZATION_PATTERN = /['’`"“”\-–—_.&,()]/g;

export function normalizeBrandName(value: string): string {
  return normalizeDiacritics(normalizeCaseInsensitive(value))
    // Remove an ampersand together with any surrounding spaces, so "Smith &
    // Wesson" and "Smith&Wesson" both become "smithwesson".
    .replace(/\s*&\s*/g, "")
    // Treat hyphens as word separators equal to a space, so "Old-Tom" and
    // "Old Tom" both become "old tom".
    .replace(/[-–—]/g, " ")
    .replace(PUNCTUATION_NORMALIZATION_PATTERN, "")
    // Removing punctuation can leave double spaces; collapse them.
    .replace(/\s+/g, " ")
    .trim();
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
  const [, valuePart, unitPart] = match;
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
  const cleaned = value.replace(/,/g, ".").trim().toLowerCase();
  if (!cleaned) {
    return null;
  }
  const percentageMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)/);
  if (percentageMatch) {
    return Number(percentageMatch[1]);
  }
  const proofMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*proof/);
  if (proofMatch) {
    return Number(proofMatch[1]) / 2;
  }
  // A bare number in the alcohol-content field is a valid ABV percentage.
  const bareNumberMatch = cleaned.match(/^(\d+(?:\.\d+)?)$/);
  if (bareNumberMatch) {
    return Number(bareNumberMatch[1]);
  }
  return null;
}

/**
 * Extract a proof number from strings such as "90 Proof", "80°", or a bare
 * number like "80" (when the caller already knows the value is a proof).
 * Returns null when no number can be found.
 */
export function extractProof(value: string): number | null {
  const cleaned = value.replace(/,/g, ".").trim().toLowerCase();
  if (!cleaned) {
    return null;
  }
  const proofMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*proof/);
  if (proofMatch) {
    return Number(proofMatch[1]);
  }
  const degreeMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:°|degrees?)/);
  if (degreeMatch) {
    return Number(degreeMatch[1]);
  }
  // A bare number in the proof field is a valid proof value.
  const bareNumberMatch = cleaned.match(/^(\d+(?:\.\d+)?)$/);
  if (bareNumberMatch) {
    return Number(bareNumberMatch[1]);
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

/**
 * Normalize an address for comparison. Case-fold and remove ALL whitespace so
 * that spacing differences ("NewProvidence" vs "New Providence") do not cause a
 * false mismatch, while the actual letters and their order must still match.
 * This is safe for addresses: it never collapses genuinely different text, it
 * only ignores how words are spaced.
 */
export function normalizeAddress(value: string): string {
  return normalizeCaseInsensitive(value).replace(/\s+/g, "");
}