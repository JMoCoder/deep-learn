# Changelog

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Version numbers are grounded in what shipped on `main`; this file does not invent
release dates that were never tagged.

## [Unreleased]

### Security

- Local preview lockdown: compose publishes `127.0.0.1:43127` and `127.0.0.1:43128`
  only; server default host is loopback. `QUANTUM_API_TOKEN` (compose default
  `local-preview`, a weak loopback-only secret) gates every `/api/*` except
  `GET /api/health`. Nginx and the Vite dev proxy inject `X-Quantum-Token`;
  the browser never holds the token (no `VITE_*`). CORS allowlists
  `http://127.0.0.1:43127` and `http://localhost:43127`. Export paths must
  stay under the exports root after resolve/realpath.

### Added

- English primary `README.md` and a matching Chinese translation in `README.zh-CN.md`.
- MIT `LICENSE`.
- PWA Settings language switch (`zh` / `en`) for UI chrome. First visit follows the
  browser language (`en*` / `zh*`, else zh-CN); the choice is persisted in
  `localStorage` (`quantum.locale`). Agent replies still follow the user's input
  language; there is no model-locale override.

### Notes

- No server locale needed. Settings have no `locale` field. Health/persist errors and
  default topic titles are data or machine strings, not PWA chrome. Stub/coach copy
  follows the user's input language.

## [0.1.0]

First public slice on `main` (tip `97baa0fc7256415a822f148be344fab102ecb3f3`).

### Added

- Two cores: **Pi agent runtime** (`packages/server`) and **PWA** (`packages/web`).
- Shared contracts in `packages/shared` (`SessionRow`, `BoundaryCard`, outline, tools).
- Docker Compose acceptance path: PWA `localhost:43127`, API `localhost:43128`,
  volume `quantum-data`.
- Books: current topic, history, **create topic** (`POST /topics`).
- Learn: interview chips, boundary card, outline confirm with leaf-budget gate.
- Settings: model / proxy, heatmap placeholder.
- Scope-out refuse (slice 2.7): `scope_out` stored as the raw phrase; matching uses
  topic-word needles; coach and runtime refuse before GROUND / `append_note`; PWA
  shows a REFUSE chip and hides CiteRow / note cards on that turn.

### Security / product rules (unchanged)

- Local-only. No cloud. No telemetry.
- `scope_in` / `scope_out` never silently rewritten.
- Notes stay on the current topic.
