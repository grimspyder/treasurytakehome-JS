# VeriLabel — AI-Powered Alcohol Label Verification

**Deployed at: https://verilabel-rho.vercel.app**

VeriLabel helps TTB-style compliance reviewers quickly check that the information
on a beverage label matches the corresponding application. Upload a photo of a
label (or a whole batch), and VeriLabel uses a fast vision model to read the
label, then **deterministic rules** compare it against what the application says.

> **This prototype assists human review and does not replace official TTB
> compliance determination.**

---

## User workflow (single label)

1. Enter the **expected application information** (brand, class/type, ABV,
   proof, net contents, bottler, country).
2. **Upload a photo** of the label (drag-and-drop or click).
3. Click **Verify Label**.
4. Review the results: an overall verdict, then each field showing
   **Expected / Found / Result**, with the label image kept in view.

## User workflow (batch)

1. Upload **many label photos** at once.
2. Optionally add a **CSV manifest** mapping each image to its expected
   application data (see below).
3. Click **Verify batch**. A concurrency-limited queue (default 3, configurable)
   verifies each one, streaming results in as they finish.
4. One failed label never stops the batch — failed items show a **Retry** button.
5. **Export results (CSV)** when done.

### CSV manifest format

Columns are matched by header name. A `file` (or `filename`) column is required;
recognized data columns: `brand`, `type`/`class/type`, `abv`, `proof`,
`net contents`, `bottler`/`producer`, `address`, `country`.

```csv
file,brand,abv,net contents
bourbon.png,Old Tom Distillery,45% ABV,750 mL
```

Labels without a manifest row are verified against required-present fields only.

---

## Technology choices

- **Next.js (App Router) + TypeScript + React** — one full-stack repository
  ships the UI and the server-side API routes together, deployable to Vercel
  (and adaptable to Azure later). This matches the stakeholder's request for a
  single deployed prototype.
- **Modular monolith** — feature-oriented structure with clear domain boundaries,
  no microservices or message brokers. See `docs/DECISIONS.md` D-001.
- **Hybrid AI + deterministic validation** — a vision model extracts structured
  fields; plain TypeScript rules compare them. AI is used where reading an image
  is hard; deterministic code handles exact checks (government warning wording,
  numeric ABV). See `docs/TTB-RESEARCH.md` and `docs/DECISIONS.md` D-004.
- **Ports and Adapters around the AI provider** — `LabelAnalysisProvider`
  interface with OpenAI-compatible, Azure OpenAI, and Gemini adapters, so the
  model/provider is configurable and swappable.

---

## AI provider configuration

The provider is configured entirely by server-side environment variables. The
API key is **never** sent to the browser.

| Variable | Purpose | Example |
|---|---|---|
| `AI_PROVIDER` | Provider: `openai-compatible`, `azure-openai`, or `gemini` | `openai-compatible` |
| `AI_BASE_URL` | Endpoint base URL | `https://api.openai.com/v1` |
| `AI_API_KEY` | API key (vision-capable model) | `sk-...` |
| `AI_MODEL` | Model name | `gpt-4o-mini` |
| `AI_TIMEOUT_MS` | Timeout per call (ms) | `30000` |

Copy `.env.example` to `.env.local` and fill in your key. `.env.local` is
gitignored and never committed.

---

## Local setup

```bash
# install
npm install

# configure environment
cp .env.example .env.local   # then edit .env.local with your API key

# run development server
npm run dev                  # http://localhost:3000

# test
npm test

# build for production
npm run build
npm start
```

---

## Architecture

```
src/
  app/                       # Next.js App Router (pages + API routes)
    api/verify/route.ts      # POST /api/verify — single-label verification
    page.tsx                 # single + batch workflow UI
  domain/
    label-verification/
      models/types.ts        # domain types
      normalization/         # tolerant/numeric normalization
      rules/                 # field + government-warning rules
      services/verify-label.ts  # deterministic Stage B orchestrator
  features/
    label-verification/
      server/verify-single-label.ts  # image→AI→verify pipeline
      components/            # single-label UI
    batch-verification/
      components/            # batch UI, CSV export
      utils/concurrency.ts   # concurrency-limited queue
  server/
    ai/
      providers/             # interface + OpenAI/Azure/Gemini adapters
      schemas/               # Zod validation of model output
      extraction-prompt.ts   # shared prompt/parse
    image-prep/              # sharp resize/validate
```

The verification pipeline is: **image prep → AI extraction → Zod validation →
deterministic comparison → human-readable summary**, with timings captured for
each stage.

---

## Performance

The assignment targets ~5 seconds for a normal single-label verification where
provider latency permits. The AI inference portion dominates. With `gpt-4o-mini`
we observed ~4.8–5.7 s for AI inference on a test label; image preparation and
validation each cost ~1–6 ms. Large images are resized server-side to keep the
request small without destroying readable label text.

We do **not** guarantee third-party model latency; see `docs/REQUIREMENTS.md`
PERF-001 note.

---

## Testing

```bash
npm test
```

Unit tests cover the deterministic rules that could cause an incorrect verdict:
brand normalization, numeric ABV/proof parsing, net-contents normalization, and
government-warning scenarios (match, mismatch, truncation→needs-review,
poor-image→needs-review).

---

## Deployment

- **Vercel** is the intended target. `next build` produces a standard production
  build.
- **Azure-forward**: the `azure-openai` provider adapter and the `AI_PROVIDER`
  env switch mean the same code can point at Azure OpenAI or be moved to Azure
  Static Web Apps / App Service without rewriting the domain layer.
- Set the `AI_*` environment variables in your hosting platform; do **not**
  commit `.env.local`.

---

## Assumptions

- Application data enters via a manual form for single labels and a CSV
  manifest for batches (the Section 4 decision, option D). This was explicitly
  chosen as the best prototype compromise.
- The government-warning type-size (mm) cannot be reliably measured from an
  arbitrary photograph with no scale reference; the prototype reports legibility
  and defers size to human review. See `docs/TTB-RESEARCH.md`.

## Tradeoffs

- No persistent database; results are session-only (avoids PII retention, keeps
  the prototype simple).
- No authentication; this is a tool for an internal review team, not a
  public-facing service.
- Batch processing runs in the browser (concurrency-limited); re-processing a
  batch requires re-uploading. We deliberately avoided an enterprise queue.

## Limitations

- Vision-model extraction can truncate a long government warning; the system
  treats a partial-but-matching warning as **Needs Review**, not a hard mismatch
  (we can't prove a real violation from a truncation).
- Visual-evidence booleans (heading bold, separation, legibility) may be
  `unable-to-determine` if the model does not report them; those surface for
  human review rather than being guessed.
- The app assists, and does not replace, a compliance officer's review.

## Future improvements

- Type-size / contrast checks with a scale reference.
- Persistent review history (opt-in).
- A downloadable per-label report.