# TTB Labeling Research — VeriLabel

**Guidance reviewed on:** 2026-08-12

**Primary sources:**
- WTTB.gov — Wine Labeling: Health Warning Statement
- TTB.gov — Distilled Spirits Labeling: Health Warning Statement
- TTB.gov — Malt Beverage Labeling: Health Warning Statement
- 27 CFR Part 16 — Alcoholic Beverage Health Warning Statement
- 27 U.S.C. § 215 (Alcoholic Beverage Labeling Act of 1988)

## Government Health Warning Statement — exact required wording

> GOVERNMENT WARNING: (1) According to the Surgeon General, women should not
> drink alcoholic beverages during pregnancy because of the risk of birth
> defects. (2) Consumption of alcoholic beverages impairs your ability to drive
> a car or operate machinery, and may cause health problems.

Applies to **all** alcohol beverages for sale/distribution in the US containing
not less than **0.5% alcohol by volume**, regardless of beverage type.

## Formatting requirements the prototype verifies (to the extent determinable from an image)

1. **Wording** — the statement must match the required wording (word-for-word,
   modulo unavoidable OCR/extraction error). Tolerant normalization must NOT
   smooth away meaningful differences.
2. **Heading** — the words `GOVERNMENT WARNING` must be present.
3. **Heading capitalization** — `GOVERNMENT WARNING` must be in **capital
   letters**.
4. **Heading bold** — `GOVERNMENT WARNING` must be in **bold type**; the
   remainder of the statement may NOT be bold.
5. **Continuous paragraph** — the statement appears as a continuous paragraph
   (not broken up). The prototype checks "appears separate from other info".
6. **Separation** — the statement must appear **separate and apart from all
   other information**.
7. **Legibility** — must be in readily legible print under ordinary conditions
   on a contrasting background.

## Rules the prototype intentionally does NOT verify

- **Type size in millimeters** (1 / 2 / 3 mm based on container volume):
  measuring physical font size from an arbitrary photograph requires scale
  information the image does not reliably contain. Where a type size cannot be
  determined, the prototype returns **Needs Review** rather than guessing
  (per the assignment instruction). We do capture a legibility judgment from
  the vision model.
- **Maximum characters per inch** matching the type size: same scale problem.
- **Exact permitted placement** (front/back/side): the prototype notes where the
  warning was found but does not enforce a specific face.
- **Contrast ratio** (contrasting background): the vision model gives a
  legibility judgment; we do not measure luminance contrast precisely.
- **Beverage-specific additional claims** and other mandatory informational
  fields beyond the demonstrated scope.

## Rules outside scope entirely

- Full COLA integration and a complete TTB regulatory engine (see
  `docs/REQUIREMENTS.md` FUTURE/OUT).

## Design intent

These domain rules are structured so additional TTB rules can be added later
without reworking the comparison pipeline (see `src/domain/label-verification/rules/`).
The seven checks above map 1:1 to the government-warning result of the UI.