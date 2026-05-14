# UI/UX Direction

_Last updated: 2026-05-14_

## Design System Tokens (Tailwind)

| Token | Usage |
|-------|-------|
| `bg-surface` … `bg-surface-5` | Layered dark backgrounds (lightest = surface-5) |
| `brand-300/400/500` | Brand purple — text, interactive, gradient |
| `gradient-brand` | CTA buttons, active accents |
| `gradient-card` | Elevated card backgrounds |
| `.card`, `.card-hover` | All elevated surfaces — never ad hoc bg |
| `.btn-primary` | Primary CTA (gradient + glow) |
| `.btn-ghost` | Secondary actions (bordered, transparent) |
| `.btn-danger` | Destructive actions (rose gradient) |
| `.input`, `.input-mono` | All form inputs |
| `<TagChip tag={t} />` | All tag/badge rendering |

## Font Stack

- Sans: Inter → system-ui
- Mono: JetBrains Mono → ui-monospace

## Motion

| Animation | Use |
|-----------|-----|
| `animate-slide-up` | Page/section entrance |
| `animate-fade-in` | Overlay/panel entrance |
| `animate-status-pop` | Status badge appearance |
| `animate-spin` | Running spinner |
| `shadow-glow-sm` / `shadow-glow` | Focus / active brand glow |

## Page Patterns

### Dashboard
- 3-col card grid (sm: 2-col, lg: 3-col)
- Filter bar: project select + tag/name input + Run button inline
- Test card: title, tags, projects, file path, last-run badge
- Discovery errors: amber warning banner (non-blocking)

### History
- Stat cards row (pass rate donut, total, failures, avg duration)
- Filter chips (all / completed / failed / running)
- Run cards: status pill, timestamp, args code block, duration, exit code, ID
- "Load more" pagination — 20/page

### RunDetails
- Three view tabs: Evidence | Live (Manager) | Developer (terminal)
- Status badge + exit code chip in header
- Evidence tab: `<RunReport>` wrapped in `<ErrorBoundary>`
- Live tab: `<ManagerTimeline>` step checklist
- Developer tab: `<Terminal>` dark mono log stream

### NewTest (AI Builder)
- Single-column, max-w-2xl
- URL input → steps textarea → tag presets → visual regression checkbox → Generate
- Code preview block (read-only mono) after generation

### Settings
- Fieldset cards per group (primary env vars, other vars)
- Password-toggle for sensitive fields
- Save feedback (success/error inline)

## Open UX Decisions

| ID | Question | Leaning |
|----|----------|---------|
| UX-01 | RunDetails: auto-switch to Evidence tab when run completes | Yes — already partially done (hasAutoSwitched ref) |
| UX-02 | Dashboard: click test card to run just that file | Yes — run `file` param |
| UX-03 | History: search/filter by args substring | Medium priority |
| UX-04 | Donut component: actual count-up animation | Use `useLayoutEffect` + rAF |
| UX-05 | Mobile layout audit | Nav wrapping + card grid needs breakpoint check |

## Known Visual Debt

- `animate-count-up` CSS class on stat cards doesn't actually animate numbers (CSS-only entrance)
- `Donut.tsx` rAF timing may miss first-frame CSS transition (TD-17)
- No skip-to-content link for keyboard/a11y
