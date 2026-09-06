# Quantum IA — Agent v1.3.2

Locked information architecture for the first PWA slice (chrome aligned with internal prototype **v0.3.4**). Native clients come later; this document is the product contract for `packages/web`.

## Product shape

Quantum is an **agent session + tools + persistence** product, not a CRUD notebook.

- One `current_topic_id` at a time.
- Notes are written **only** by the agent via `append_note` in the tool loop.
- There is **no** user「记一笔」control anywhere.
- Learning content is **projected** into the 学习 tab. The session lives in a drawer, never as an inline entry in the content body.

## Bottom tabs

| Tab | Name | Role |
| --- | --- | --- |
| Learn | **学习** | Current topic content projection |
| Books | **书籍** | Current-topic hero + body + notes; topic history |
| Me | **我的** | Settings (model proxy) + heatmap placeholder |

The word **书籍** is a **tab label only**. It is not a page title on the books surface.

## 学习

Content canvas for the active topic only.

### Top bar

- **Center**: `主题·章节` (topic title · current section title). Truncate; do not wrap into a second toolbar.
- **Left control**: opens the **outline drawer** (from the **left**).
- **Right control**: opens the **agent session drawer** (from the **right**).

### Invariants

- No session composer, transcript, or「打开对话」affordance inside the content body.
- Empty body copy points the learner to the right-side session, not to a notes form.
- Outline navigation updates the projected section and the packed agent context (TutorContext L2).

## 书籍 (v1.3.2)

The books surface is a **current-topic hero**, not a library title page.

### Top bar = current topic hero only

- **No** page title「书籍」in the top bar or as an H1.
- The top chrome is a **hero card** of `current_topic_id`: title, phase (and export substate if not idle), optional goal line from the boundary snapshot.
- Empty current topic: hero reads as「还没有当前主题」and points at the right-hand drawer — still no「书籍」heading.
- Right control on the hero opens the **topic switcher drawer**.

### Body

- Current topic section excerpt / notes only.
- Notes list is read-only `append_note` output. No composer.

### Topic switcher

- Opens from the **RIGHT**.
- **First card**: 新建主题. Creates a topic, sets `current_topic_id`, starts `boundary_interview`.
- **History cards**: 切换 + 导出.
- 导出 opens a modal: `md | html | epub`. The modal asks the session to run tool `export_topic({ format })` — it does not export in the browser.

## 我的

- **Settings → model proxy only** for credentials: provider, model id, optional base URL, API key.
- Keys are stored server-side. They must never appear in chat, SSE payloads, logs, or tool arguments.
- **Heatmap**: visual placeholder for future spaced-review cadence. v0 may tick cells from coarse learning activity; this is not a finished memory-science feature.

## Drawers (summary)

| Surface | Side | Content |
| --- | --- | --- |
| 学习 · outline | Left | Tree of the current topic |
| 学习 · session | Right | Agent transcript + composer |
| 书籍 · topics | Right | 新建主题 + history |

## Phases (UX-visible)

`idle → boundary_interview → outline_draft → learning`

Export is a **substate** of `learning` (`exporting` / `ready`), not a fourth primary phase.

## Out of scope for v1 chrome

- Native shells
- Multi-topic split view
- User-authored notes UI
- Session entry embedded in the section body
- Fake “mastery %” or invented pedagogy presented as science
