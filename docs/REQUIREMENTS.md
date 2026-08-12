# Requirement Ledger — VeriLabel (TTB Alcohol Label Verification Prototype)

This ledger is derived **line-by-line** from the assignment README
(`treasurytakehome-rgb/instructions`), including the stakeholder interviews.
Every feature in the prototype traces to at least one requirement below, or to
an explicitly recorded design decision in `docs/DECISIONS.md`.

Reviewed on: 2026-08-12.

Legend for status: `C` = Complete, `P` = Partial, `D` = Deferred/Out of scope,
`B` = Blocked.

## Product intent

- The product is an **assistant for TTB compliance agents**, not a replacement
  for their professional judgment. Agents keep final control of compliance
  decisions. (Context / Product intent)

## Functional requirements (FUNC)

- FUNC-001 — Single-label verification: user provides a label image and the
  expected application information, and the app verifies whether the label
  contains the required information and agrees with the application. (C)
- FUNC-002 — Batch verification of ~200–300 labels without manual per-label
  processing, using a client-side concurrency-limited queue. (C)
- FUNC-003 — Verify brand name presence/agreement with tolerant normalization
  (case, whitespace, punctuation), without transforming genuinely different
  names into matches. (C)
- FUNC-004 — Verify alcohol content / ABV numerically (e.g. `45% ABV` ==
  `45% Alc./Vol.`). (C)
- FUNC-005 — Verify proof where applicable, including internal consistency
  with ABV. (C)
- FUNC-006 — Verify net contents with unit normalization (e.g. `750 mL` ==
  `750 ml`). (C)
- FUNC-007 — Verify class/type designation with conservative normalization;
  return Needs Review when equivalence is uncertain. (C)
- FUNC-008 — Verify Government Health Warning Statement strictly: required
  wording, `GOVERNMENT WARNING` all-caps heading, bold heading, presence,
  readability, and separation from unrelated information (to the extent
  determinable from an image). (C)
- FUNC-009 — Verify country of origin for imports. (C)
- FUNC-010 — Verify producer/bottler name and address. (C)
- FUNC-011 — Support a human-review state rather than binary pass/fail for
  uncertain results. (C)
- FUNC-012 — Provide useful, actionable error handling for all listed failure
  modes. (C)
- FUNC-013 — CSV export of batch results. (C)
- FUNC-014 — Retry of a failed/single item. (C)

## Nonfunctional requirements (NFR)

- NFR-001 — No database; transient label processing only. (C)
- NFR-002 — No authentication, user accounts, or permissions. (C)
- NFR-003 — No microservices, message broker, distributed queue, or Kubernetes;
  modular monolith. (C)
- NFR-004 — API key stays server-side only; never sent to client JS. (C)
- NFR-005 — Do not log image base64 or credentials. (C)
- NFR-006 — Validate upload file type and size. (C)
- NFR-007 — Do not execute uploaded content. (C)
- NFR-008 — Sanitize/validate structured model responses (Zod schema). (C)
- NFR-009 — Reasonable request timeouts; no uncontrolled retry loops. (C)

## UX requirements (UX)

- UX-001 — "My mother could figure it out": a first-time user understands what
  to do without documentation. (C)
- UX-002 — Large obvious primary buttons; visible upload area. (C)
- UX-003 — Drag-and-drop plus normal file selection. (C)
- UX-004 — Clear instructions in plain English; no technical jargon in the
  normal workflow. (C)
- UX-005 — Progress indicators; UI never appears frozen. (C)
- UX-006 — Descriptive error messages that explain recovery. (C)
- UX-007 — Responsive layouts; mobile/narrow usable. (C)
- UX-008 — Accessibility: keyboard navigation, form labels, focus visibility,
  semantic HTML, contrast, screen-reader status, non-color-only status
  indicators. (C)
- UX-009 — Keep uploaded label preview visible while viewing results. (C)
- UX-010 — Avoid raw JSON, toast-only critical errors, excessive modals,
  excessive animation, unexplained confidence decimals. (C)

## Results UX (RSLT)

- RSLT-001 — Show a clear overall status followed by individual checks with
  Expected / Found / Result / reason. (C)
- RSLT-002 — Do not display bare PASS/FAIL without evidence. (C)
- RSLT-003 — Use terminology: Matches / Mismatch / Needs Review /
  Unable to Determine. (C)
- RSLT-004 — Avoid language implying legally binding approval; include an
  unobtrusive statement that the prototype assists human review. (C)

## Performance requirements (PERF)

- PERF-001 — Useful results in ~5 seconds for a normal single-label
  verification where provider latency permits. (C)
- PERF-002 — Instrument and measure separately: image preparation, server
  request, AI inference, validation, total user-perceived duration. (C)
- PERF-003 — Resize overly large images; send only necessary info; single
  structured vision request (no cascading model calls). (C)
- PERF-004 — Concurrency-limited batch queue; do not fire 300 simultaneous
  requests. (C)
- PERF-005 — Results stream into the UI as individual labels finish. (C)

## Security considerations (SEC)

- SEC-001 — AI keys server-side only. (C)
- SEC-002 — Never commit secrets; `.env.*` ignored; provide `.env.example`. (C)
- SEC-003 — Document what the external AI service receives during processing. (C)
- SEC-004 — Validate and sanitize model output. (C)

## Infrastructure considerations (INF)

- INF-001 — Full-stack Next.js (App Router) in a single repository. (C)
- INF-002 — Deployment configuration suitable for Vercel, adaptable to Azure
  later. (C)
- INF-003 — Provider abstraction (Ports and Adapters) around the AI provider so
  it can be replaced (OpenAI / Azure OpenAI / Gemini / OpenAI-compatible). (C)

## Domain / business rules (DOMAIN)

- DOMAIN-001 — Brand name: tolerant but not overly fuzzy matching. (C)
- DOMAIN-002 — ABV: numeric comparison, not string comparison. (C)
- DOMAIN-003 — Proof: parse and check internal consistency with ABV. (C)
- DOMAIN-004 — Government warning: strict; do not fuzzy-match meaningful wording
  differences. (C)
- DOMAIN-005 — Do not claim physical font-size measurement from an arbitrary
  photograph without scale info; return Needs Review instead. (C)
- DOMAIN-006 — If a requirement cannot be reliably determined from the image,
  return Needs Review and explain why. (C)
- DOMAIN-007 — Tolerant normalization for net contents units. (C)
- DOMAIN-008 — Class/type: conservative normalization; Needs Review when
  uncertain. (C)

## Stakeholder preferences (STAKE)

- STAKE-001 — Fast results (~5s); the previous vendor pilot failed at 30–40s. (C)
- STAKE-002 — Simple enough for nontechnical/older staff. (C)
- STAKE-003 — Batch uploads for large importers (200–300 labels). (C)
- STAKE-004 — Handle poorly shot images (angles, glare, bad lighting) via the
  vision model; report image quality. (C)
- STAKE-005 — Network blocks many outbound domains; keep cloud API surface
  minimal and configurable. (C)

## Possible future requirements (FUTURE)

- FUTURE-001 — Full COLA integration (explicitly out of scope for this
  prototype). (D)
- FUTURE-002 — Complete TTB regulatory engine beyond demonstrated rules. (D)
- FUTURE-003 — Persistent storage of reviews. (D)
- FUTURE-004 — Physical font-size measurement with scale calibration. (D)

## Explicitly out of scope

- OUT-001 — COLA integration. (D)
- OUT-002 — Full regulatory-compliance platform. (D)
- OUT-003 — Authentication / user accounts / permissions. (D)
- OUT-004 — Database persistence. (D)
- OUT-005 — Enterprise queue / distributed infrastructure. (D)

## Ambiguous requirements (AMBIG)

- AMBIG-001 — How application data enters the prototype. **RESOLVED (2026-08-12):
  Option D — Hybrid** (manual form for single verification + CSV/structured
  manifest for batch). (C)
- AMBIG-002 — Visual style / product name. **RESOLVED (2026-08-12): VeriLabel,
  modern SaaS, light + dark mode, accessible.** (C)

## AI requirements (AI)

- AI-001 — Use AI where it adds value; use deterministic rules where
  deterministic rules are more appropriate (hybrid model). (C)
- AI-002 — Stage A: fast vision model extracts structured fields + visual
  evidence, validated by Zod. (C)
- AI-003 — Stage B: deterministic domain verification in TypeScript. (C)
- AI-004 — One structured vision request; avoid cascading model calls. (C)
- AI-005 — Never send API key to client. (C)
- AI-006 — Provider/model selection configurable via environment variables. (C)
- AI-007 — Do not blindly trust model output. (C)

## Delivery requirements (DELIVERY)

- DELIVERY-001 — Source code repository with README (setup, run, approach,
  assumptions). (C)
- DELIVERY-002 — Deployed application URL. (C)
- DELIVERY-003 — Documentation of approach, tools, assumptions. (C)
- DELIVERY-004 — Testing + deployment configuration. (C)
- DELIVERY-005 — Sample/label fixtures for development. (C)