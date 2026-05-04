# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Run

```bash
npm run dev      # node server.mjs — same as `npm start`
```

Then open http://127.0.0.1:4321. Override with `PORT` / `HOST` env vars. On Render, `RENDER=1` makes the server bind `0.0.0.0`.

There is no build step, no bundler, no test suite, and **no npm dependencies** — `package.json` has zero `dependencies`. Requires Node `>=22 <25` (pinned to `22.22.0` on Render via `render.yaml`).

The demo UI and all in-code text is **Arabic, RTL** (`<html lang="ar" dir="rtl">`). Keep new user-facing strings in Arabic to match.

## OpenAI integration

Optional. Set these env vars (locally via shell, on Render via the dashboard — `render.yaml` declares `OPENAI_API_KEY` with `sync: false`):

- `OPENAI_API_KEY` — when absent, `/api/ai/ask` returns the `openAiConnectionFailure()` stub (`answer: "فشل في الاتصال"`). There is **no local rule-based fallback** anymore (see commits `4cf8f06`, `cda423f`).
- `OPENAI_MODEL` — default `gpt-5.1` (`defaultOpenAiModel` in `server.mjs`).
- `OPENAI_TIMEOUT_MS` — default `45000`, clamped to `[5000, 60000]` and floored at the default.

Both LLM call sites (`openAiBodyAnalyst`, `classifyImagingWithOpenAi`) hit `https://api.openai.com/v1/responses` (the Responses API, not Chat Completions) with `input_text` + `input_image` parts and expect strict JSON back. The system prompt for the assistant is intentionally constrained: ≤450 chars, 3–5 short Arabic lines, must include a line starting `اقتراح علاجي آمن:`, must never prescribe — `ensureSafeTreatmentSuggestion()` enforces the suggestion line and `compactAiAnswer()` enforces the length. Don't loosen these without understanding the safety framing in the README disclaimer.

For imaging classification, results from OpenAI are merged with a deterministic local visual-hint scorer (`inferImagingFromImageHints`); `shouldPreferImageHint()` decides which to trust per study.

## Architecture

This is a two-file project: **`server.mjs`** (one Node http server, ~1250 lines) and **`public/app.js`** (one Three.js client, ~3170 lines).

### Server (`server.mjs`)

Plain `node:http` server with hand-rolled JSON body reader, static-file server (security-checked path under `publicDir`), and these endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`  | `/api/twin` | Full snapshot — `buildTwinState()` |
| `GET`  | `/api/scenarios` / `/api/interventions` | Raw catalog dicts |
| `POST` | `/api/twin/simulate` | `{scenario}` — switch active scenario, reset intervention to `observe` |
| `POST` | `/api/twin/intervene` | `{intervention}` — apply intervention modifiers |
| `POST` | `/api/imaging/upload` | `{fileName, fileType, fileSize, imageData(base64), imageHints}` — register imaging study (kept to last 6) |
| `POST` | `/api/imaging/clear` | wipe imaging studies |
| `POST` | `/api/ai/ask` | `{question}` — calls OpenAI; care-pathway text is appended by `withCarePathwayIfRequested()` when the question matches treatment keywords |

State lives in **module-level `let` variables** (`activeScenario`, `activeIntervention`, `imagingStudies`, …). There is no DB, no session, no per-user state — everything is global to the running process. The dashboard polls `/api/twin` repeatedly to get fresh oscillating values.

Sensor values are not stored; they are **regenerated on every `buildTwinState()` call** by `oscillate(template, now)`, which composes:

1. `template.base` + sinusoidal wave from `Math.sin(t / 3800 + phase)`,
2. plus the active scenario's `modifiers[metric]`,
3. plus the active intervention's `modifiers[metric]`,
4. plus a few hardcoded scenario-specific bumps (e.g. `dDimer` spikes during `colorectal_cancer`),
5. clamped per-metric to physiological-ish ranges.

To **add a sensor**: add a row to `sensorTemplates`, add corresponding `modifiers` entries to any scenarios/interventions that should move it, and surface it in `buildOpenAiContext()`'s `keySensorIds` list if the LLM should see it. To **add a scenario or intervention**: add a key to `scenarios` / `interventions`; the API will auto-validate against `Object.keys(...)`. The scenario `disease` field drives lesion generation in `buildLesions()`, and several `buildPrediction()` / `buildRecommendations()` branches key off it directly.

### Client (`public/app.js`)

Vanilla ES module. Three.js is **vendored** under `public/vendor/` (note the import map in `index.html`: `three` → `/vendor/three.module.js`, `three/addons/` → `/vendor/`). Do not add an `npm install three` — the import map will silently keep using the vendored copy.

Scene assembly is driven by `public/anatomy-manifest.json`:

- Coordinate convention is documented in `_notes`: +X = patient's left, Y up, +Z anterior. Units = meters.
- Preferred path is `integratedAnatomy` (separate per-organ GLBs in `public/models/anatomy-parts/`, all sharing one world coordinate system — load at origin, they reassemble). Fallback path is the legacy `bodyShell` + per-organ GLBs in `public/models/organs/` and `public/models/body/`.
- Each organ entry has `position`, `fit` (bounding-box-fit dimensions), `rotation`, optional `mirrorX`, and a `material` block. `fitMode: "stretch"` is used for the body shell to wrap visibly around the inner organs.

`createLayerGroups()` splits the scene into named THREE.Groups (`skin`, `organs`, `vessels`, `sensors`, `labels`, `effects`); the layer toggles in `index.html` flip `.visible` on each group. There is also a cutaway shader (`installSkinCutawayShader`) for the skin and a teaching-mode scaler.

Login is **demo-only and client-side**: hardcoded credentials live in `DEMO_AUTH` at the top of `app.js` (`salshehri58` / `102030`) and gate the `.app-shell` via a `localStorage` flag. There is no server-side auth — the API endpoints are open.

Dev key bindings (registered in `public/anatomy-debug.js`): **D** boxes, **A** axes, **T** tweak panel, **E** export manifest JSON. Disabled while typing in inputs/textareas.

### Disclaimer

The README is explicit: this is a **research/demo digital twin**, not a medical device. The Arabic safety phrasing in `recommendations`, lesion labels, and the AI system prompt is load-bearing — preserve the "ليس جهازًا طبيًا" / "اقتراح علاجي آمن" / "راجع الطبيب" framing in any text changes.
