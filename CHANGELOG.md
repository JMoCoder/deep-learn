# Changelog

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Version numbers are grounded in what shipped on `main`; this file does not invent
release dates that were never tagged.

## [Unreleased]

### Fixed

- Learning `generate_section` no longer treats scaffold/boundary echo (goal / prior /
  topic title) as a user offscope turn. On-topic first-leaf and advance writes succeed
  when `scope_out` only appears in those echoes; chat like「顺便把弦论也讲一遍」still
  REFUSE_OFFSCOPE with no `append_note`.

## [0.1.0] - 2026-09-10

Stable release on `main` tip `512acc9`. First public slice was tip
`97baa0fc7256415a822f148be344fab102ecb3f3`.

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
- English primary `README.md` and a matching Chinese translation in `README.zh-CN.md`.
- MIT `LICENSE`.
- PWA Settings language switch (`zh` / `en`) for UI chrome. First visit follows the
  browser language (`en*` / `zh*`, else zh-CN); the choice is persisted in
  `localStorage` (`quantum.locale`). Agent replies still follow the user's input
  language; there is no model-locale override.

### Changed

- Yellow pack (product freeze): live and stub share one gate/tool path
  (five-required, confirm/leaf-reduce, refuse+reflow). `toClientMessages`
  keeps learn-projection `strategy` / citations. Learner-visible copy is
  Deep Learn (packages / `QUANTUM_*` unchanged). Load-minutes / leaf-budget
  compose only through `@quantum/shared`.
- Docs v0.5 alignment (red 5): `backend-baseline-v0.5` follows `@quantum/shared`
  + factory (tool args, five-required gate, strategy closed set, `reason_code`).
  Two-cores L0/L1 mapped to the packer. Hand-click covers reject+reflow /
  citations / outline card and does not teach strategy enum names. Old
  `backend-baseline.md` superseded; core1/core2 research marked historical.
- Red-4 freeze: coach no longer confirms or leaf-reduces from chat; outline
  confirm / 重拟 go through Learn card gates + tools. Export POST only
  returns `ok:true` after a real file. Root `pnpm test` runs shared + server + web.
- Books note meta shows type copy and time only (hides `reason_code` digits).
- Phone drawers swipe-dismiss; Books notes use the Body pane background;
  favicon letter R→L; phone Books hero drops no-goal / status second line.
- Remove unused `books.noGoal` i18n keys.

### Fixed

- Dockerfile web stage: `chmod -R a+rX` on nginx html so copied static assets
  stay readable.
- Phone drawer swipe: iOS `touch-action: pan-y` and `pointercancel` harden so
  reverse-swipe dismiss is not dropped.

### Security

- Local preview lockdown: compose publishes `127.0.0.1:43127` and `127.0.0.1:43128`
  only; server default host is loopback. `QUANTUM_API_TOKEN` (compose default
  `local-preview`, a weak loopback-only secret) gates every `/api/*` except
  `GET /api/health`. Nginx and the Vite dev proxy inject `X-Quantum-Token`;
  the browser never holds the token (no `VITE_*`). CORS allowlists
  `http://127.0.0.1:43127` and `http://localhost:43127`. Export paths must
  stay under the exports root after resolve/realpath.

### Security / product rules (unchanged)

- Local-only. No cloud. No telemetry.
- `scope_in` / `scope_out` never silently rewritten.
- Notes stay on the current topic.

### Notes

- No server locale needed. Settings have no `locale` field. Health/persist errors and
  default topic titles are data or machine strings, not PWA chrome. Stub/coach copy
  follows the user's input language.
