# Decision Log — VeriLabel

Each entry records an important architecture or design decision, the reason,
the alternatives considered, and the tradeoff accepted. This demonstrates
engineering judgment without a giant architecture document.

## D-001 — Next.js modular monolith (single repo) rather than separate frontend/backend

- **Decision:** One full-stack Next.js (App Router) application containing both
  the UI and the server-side API routes.
- **Reason:** The assignment requires a deployed URL and a single repository.
  A monolith keeps UI + API in one deployable unit, minimizes moving parts for
  a prototype, and matches the "working simple solution" goal.
- **Alternatives:** Separate Next.js frontend + FastAPI/NestJS backend;
  microservices.
- **Tradeoff:** A monolith couples UI and API deploys, but that coupling is
  acceptable and even desirable for this scope.

## D-002 — AI provider abstraction (Ports and Adapters / Hexagonal around the provider)

- **Decision:** Define a `LabelAnalysisProvider` interface; implement
  OpenAI-compatible, Azure OpenAI, and Gemini adapters behind it.
- **Reason:** The provider/model must be configurable and replaceable without
  touching the domain layer (INF-003, AI-006). The federal network context
  (STAKE-005) and Azure-forward architecture (INF-002) make provider
  portability valuable.
- **Alternatives:** Hard-code one provider throughout the code.
- **Tradeoff:** A thin extra abstraction layer; justified because provider
  portability is a stated requirement.

## D-003 — No database for the prototype

- **Decision:** Labels are processed transiently; no persistent storage.
- **Reason:** The assignment explicitly says do not add a database merely
  because apps commonly have them (NFR-001). No requirement needs persistence.
- **Alternatives:** SQLite/Postgres for review history.
- **Tradeoff:** No review history; acceptable for a prototype and avoids PII
  retention concerns.

## D-004 — Hybrid model: AI extraction + deterministic comparison

- **Decision:** Stage A extracts structured fields with a fast vision model;
  Stage B performs deterministic verification in TypeScript.
- **Reason:** AI is best at reading imperfect images; deterministic code is
  best at exact government-warning and numeric ABV checks. This is the explicit
  product intent (AI-001, AI-002, AI-003).
- **Alternatives:** LLM-only verdict; pure OCR + rules.
- **Tradeoff:** More moving parts, but each stage does what it does best and
  results are auditable.

## D-005 — Client-side, concurrency-limited batch queue

- **Decision:** Batch processing runs in the browser with a configurable
  concurrency limit, issuing individual requests to the API routes.
- **Reason:** Avoids a giant server request with hundreds of images and avoids
  firing 300 simultaneous requests (PERF-004, BATCH). Results stream in as each
  item completes (PERF-005).
- **Alternatives:** Server-side job queue; message broker.
- **Tradeoff:** Re-processing a batch requires the browser (no persisted job),
  acceptable for a prototype. No enterprise queue needed (NFR-003).

## D-006 — Human-review state rather than binary pass/fail

- **Decision:** Results use Matches / Mismatch / Needs Review /
  Unable to Determine; agents keep final compliance decisions.
- **Reason:** Product intent; the government-warning and uncertain-field rules
  must not fabricate certainty (DOMAIN-005, DOMAIN-006, RSLT-003).
- **Alternatives:** Binary PASS/FAIL.
- **Tradeoff:** Slightly more complex result model, but it is more honest and
  matches the product.

## D-007 — Plain CSS with CSS custom properties for theming (no UI component library)

- **Decision:** A small, hand-written global stylesheet with CSS variables for
  light/dark theming instead of a component library or Tailwind.
- **Reason:** Dependency discipline (avoid large libraries to render buttons
  and cards); full control over an accessible, contrast-checked,
  "my-mother-could-figure-it-out" UI.
- **Alternatives:** Tailwind; MUI; Radix.
- **Tradeoff:** More hand-written CSS, but a tiny, dependable dependency set.

## D-008 — Application data entry = Hybrid (Option D)

- **Decision:** Manual form for single-label verification; CSV/structured
  manifest for batch verification.
- **Reason:** Chosen by the product owner at the Section 4 gate. Simple and
  reliable for single checks; deterministic and filename-mappable for batch.
- **Alternatives:** Option A (form only), Option B (file only), Option C
  (AI reads application document).
- **Tradeoff:** Two input paths to build, but each is the best fit for its flow.

## D-009 — Single structured vision request (no cascading models)

- **Decision:** One vision call extracts all fields; no second model verifies.
- **Reason:** Latency goal (PERF-001); cascading calls multiply latency and
  cost. Deterministic local verification follows extraction.
- **Alternatives:** Extract-then-verify with two models.
- **Tradeoff:** The vision model must be instructed to be conservative and
  report uncertainty; deterministic rules handle the rest.