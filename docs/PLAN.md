# Habit Garden: Build Plan

A local-first PWA for building habits. No backend, no accounts, no server-side data. Everything lives on the user's device, and export/import is the only way to move data between sessions or devices.

## 1. Stack

- React 18 + Vite + TypeScript
- `vite-plugin-pwa` (Workbox) for the manifest, service worker and offline support
- Dexie.js (IndexedDB) for storage
- Zustand for UI state; derived data via pure functions + memoized selectors
- `date-fns` for date math
- Framer Motion for animations
- Plain CSS modules or Tailwind (pick one, keep it consistent)
- Vitest + React Testing Library
- No runtime network calls. The app must work fully offline after first load.

## 2. Core principles

1. **Store only habits and entries.** Streaks, ticks, colors, XP, levels, plant stages and badges are all derived at read time. Never persist derived values.
2. **Dates are local `YYYY-MM-DD` strings**, never UTC timestamps, to avoid timezone and midnight bugs.
3. **All logic lives in pure, tested functions** in `src/core/`, with no React imports there.
4. **Mobile-first**, with a bottom tab bar on small screens and a sidebar or top nav on wide ones.
5. **Gentle tone.** Missed periods let plants wilt; nothing is ever deleted or "killed".

## 3. Data model

```ts
type Frequency = 'daily' | 'weekly' | 'monthly';

interface Habit {
  id: string;              // uuid
  name: string;
  unit: string;            // "pages", "minutes", "sessions"
  frequency: Frequency;
  minimum: number;         // per period; counts as "done"
  target: number;          // per period; user's average expectation
  stretch: number;         // per period; beyond expectation
  plant: string;           // plant species id (cosmetic)
  createdAt: string;       // YYYY-MM-DD
  archivedAt?: string;
}

interface Entry {
  id: string;
  habitId: string;
  date: string;            // YYYY-MM-DD, local
  volume: number;          // > 0; multiple entries per day are summed
  note?: string;
}

interface Settings {
  weekStartsOn: 0 | 1;     // 0 = Sunday, 1 = Monday
  calendarMode: 'per-habit' | 'combined';
  lastExportAt?: string;
  reminderDismissedAt?: string;
}
```

Validation: `0 < minimum <= target <= stretch`. Show inline errors in the habit form.

## 4. Core logic (`src/core/`)

Write these as pure functions with unit tests.

- `periods.ts`
  - `periodOf(date, frequency, weekStartsOn)` returns `{start, end, key}`
  - `periodsBetween(start, end, frequency, weekStartsOn)`
- `volume.ts`
  - `volumeForPeriod(entries, habitId, period)`
  - `tierForVolume(volume, habit)` returns `'none' | 'below' | 'minimum' | 'target' | 'stretch'`
    - none = 0, below = >0 and < minimum, minimum = >= minimum and < target, target = >= target and < stretch, stretch = >= stretch
- `status.ts`
  - `periodStatus(habit, period, today)` returns `'met' | 'missed' | 'pending'`
    - `pending` while the period is still open and the minimum is unmet. **Never mark ✗ until the period has ended.**
    - Periods before `habit.createdAt` are `'n/a'`.
- `streaks.ts`
  - `currentStreak(habit, entries, today)`: consecutive *met periods* ending at the latest closed period, or including the open period if already met. An open, unmet period does not break the streak.
  - `longestStreak(habit, entries, today)`
- `calendar.ts`
  - `completionDay(habit, entries, period)`: the date the running total first reached the minimum (for weekly/monthly ✓ placement)
  - `dayCell(habit, entries, date)`: tier for daily habits; for weekly/monthly returns tier of the day's own volume plus whether this day is the completion day
  - `combinedDay(habits, entries, date)`: `{ met, total, ratio }` over habits that apply that day (see section 6)
- `xp.ts`
  - Points per entry scaled by tier reached; level thresholds. Details in section 8.
- `plant.ts`
  - `plantStage(habit, entries, today)`: seed, sprout, bud, bloom, based on the met ratio of the last N periods (N = 7 days, 4 weeks, 3 months) and the current streak
- `backup.ts`
  - `exportData()`, `validateImport()`, `importData(mode)`

## 5. Screens

1. **Home (Garden)**
   - Daily quote card (see section 7), styled as a garden stone or signpost
   - Garden grid: one plant per habit showing stage, the current streak, and progress toward minimum/target/stretch for the current period
   - Quick-add button on each plant (opens a numeric stepper with presets like +1, +5, +10 and custom input)
   - Backup nudge banner if there's been no export in 14+ days
2. **Calendar**
   - Toggle: **Per habit** | **Combined** (persisted in Settings)
   - Per-habit: habit picker + month grid
   - Combined: month grid with all habits
   - Prev/next month; tap a day to open a day sheet listing entries for that day, with add/edit/delete and backfill
3. **Habit detail**
   - Streak (current/longest), period history, volume chart for the last 12 periods, entry list, edit/archive
4. **Add/Edit habit**
   - Name, unit, frequency, three thresholds, plant picker
   - Plain-language helper text under each threshold
5. **Progress** (gamification)
   - Level, sunlight (XP), badges, garden stage
6. **Settings**
   - Week start day, calendar mode default, export, import, reset all data, about

Navigation: bottom tabs (Garden, Calendar, Progress, Settings). Habit detail and forms are routed pages or sheets. Use `react-router`.

## 6. Calendar rules (decided)

**Per-habit mode**
- Daily habit: day cell colored by `tierForVolume(dayVolume)`. ✓ if the minimum was met that day, ✗ if the day is past and unmet, blank for future days.
- Weekly/monthly habit:
  - The tick ✓ lands on the **completion day** (the day the period's running total first reached the minimum).
  - The whole week or month gets a **subtle period tint** (soft green when met; soft red/rose only once the period has ended unmet).
  - Other days in the period show their own volume color if they have entries, with no ✗ on them.
  - ✗ appears only after the period ends unmet, placed on the period's last day.
  - Open periods show a tiny progress hint (e.g. "1/3") in the tint's corner, optional.

**Combined mode**
- Each day shows a small ring or dot cluster representing the habits applicable that day.
- Day-level status: ✓ if all applicable habits were met, a partial mark `2/3` if some, ✗ if none and the day is past.
- "Applicable" means: daily habits always; weekly/monthly habits only on their completion day (✓ contribution) or on the last day of an unmet period (✗ contribution). Do not count non-completion days of weekly/monthly habits against the day.
- Cell background color = average tier across applicable habits, with a legend.
- Tapping a day opens a sheet breaking it down per habit.

Ticks are **implicit** and computed from entries. The user never manually ticks the calendar.

Color scale (5 levels, garden palette, with dark-mode variants and a colorblind-safe check): none (soil/neutral), below (pale green), minimum (green), target (flowering pink/yellow), stretch (golden bloom).

## 7. Daily quote

- Bundle `src/data/quotes.json`: `{ id, text, author, source, year? }`.
- Selection: `quotes[dayOfYear % quotes.length]` using the local date, so it changes at local midnight with no server.
- **Authenticity rules (important):**
  - Only include quotes that can be traced to a named primary source (e.g. Marcus Aurelius, *Meditations*; Seneca, *Letters to Lucilius*; Epictetus, *Enchiridion*).
  - Prefer public-domain translations.
  - Every entry needs `author` and `source`; drop anything that can't be attributed. Avoid the common misattributed internet quotes.
  - Target 365 entries. Ship an initial verified set first (50+ is fine) and expand; the selector handles any list length.
  - Add a script `scripts/validate-quotes.ts` that fails CI if any entry lacks author/source or is a duplicate.
  - Flag the list for human review before release.
- Show the source line under each quote.

## 8. Gamification (garden-themed)

- **Sunlight (XP)** per logged entry by tier reached for that day/period: below = 1, minimum = 10, target = 15, stretch = 25. Award for the *highest tier reached* once per period (recompute from entries; don't store).
- **Levels** from total sunlight on a gentle curve (e.g. level n needs `50 * n^1.5` total). Garden stages: Patch of soil, Seedbed, Greenhouse, Meadow, Orchard, Grove.
- **Plant stages** per habit: seed, sprout, bud, bloom (see `plantStage`). Wilting is a visual state when the latest closed period was missed, and it recovers with the next met period.
- **Badges**, derived from entries: first entry, 7/30/100-period streaks, first stretch, 10 stretches, all habits met in a day, comeback (met a period after a missed one).
- **Celebrations**: a small petal/sparkle animation when a threshold is crossed during entry (minimum, target, stretch). Respect `prefers-reduced-motion`.
- Optional (v2): streak freeze, seasonal garden themes.

## 9. Export / import

- Export: a single JSON file `habit-garden-YYYY-MM-DD.json`:
  ```json
  { "app": "habit-garden", "version": 1, "exportedAt": "...", "settings": {}, "habits": [], "entries": [] }
  ```
- Download via Blob + `<a download>`. On mobile, use the Web Share API with a file when available, falling back to download.
- Import: file picker, then validate the schema and version (use `zod`), then show a preview ("12 habits, 3,410 entries"), then the user chooses:
  - **Merge**: add missing habits/entries by id; on conflict keep the newer or ask.
  - **Replace**: wipe and load (confirm dialog).
- Reject malformed files with a clear error and never partially apply (do it in a single Dexie transaction).
- Include a `migrate(version)` hook for future schema changes.
- Call `navigator.storage.persist()` on first use; show the backup nudge. Browsers, especially iOS Safari, may evict storage, so export is the safety net.

## 10. PWA requirements

- Manifest: name, short_name, icons (192/512, maskable), theme/background colors, `display: standalone`, `start_url: /`.
- Service worker: precache the app shell, `registerType: 'autoUpdate'` with an "update available" toast.
- Fully offline; no external fonts or CDNs (self-host fonts).
- Lighthouse PWA and accessibility checks pass.
- Handle `visibilitychange` and date rollover: when the app resumes after midnight, refresh "today".

## 11. Project structure

```
src/
  core/            # pure logic + tests
  data/            # quotes.json, plants.ts, badges.ts
  db/              # Dexie schema, repositories
  store/           # zustand stores
  components/      # Plant, Calendar, DayCell, QuoteCard, EntrySheet...
  pages/           # Garden, Calendar, HabitDetail, HabitForm, Progress, Settings
  styles/
  main.tsx
scripts/validate-quotes.ts
```

## 12. Milestones

1. **Scaffold**: Vite + React + TS, PWA plugin, routing, theme tokens, Vitest.
2. **Core logic + tests**: periods, tiers, status, streaks, completion day (highest priority; test edge cases below).
3. **Data layer**: Dexie schema, habit/entry CRUD, hooks.
4. **Habit management**: form with validation, list, archive.
5. **Entry logging**: quick-add stepper, day sheet, backfill/edit.
6. **Garden home**: plants, progress, daily quote.
7. **Calendar**: per-habit mode, then combined mode, period tint.
8. **Gamification**: sunlight, levels, badges, celebrations.
9. **Export/import**: with validation, merge/replace, backup nudge.
10. **Polish**: responsive pass, dark mode, accessibility, reduced motion, icons, Lighthouse.
11. **Quotes content**: verified list + validation script.

Work milestone by milestone, committing after each, and run tests before moving on.

## 13. Edge cases to test

- Weekly habit: week boundaries with both `weekStartsOn` settings; entries on the boundary day.
- Month lengths, leap years, DST changes (should not matter with local date strings).
- Open period unmet must not break the streak or show ✗.
- Minimum reached across multiple entries on different days within a period (completion day is the day the cumulative total crosses it).
- Editing or deleting an entry changes the completion day, tier and streak consistently.
- Changing a habit's thresholds recomputes history (document this behavior; consider a confirmation note).
- Backfilled entries before `createdAt` (extend `createdAt` backward or reject; pick one and document).
- Import of a file from a newer version, a corrupted file, an empty file.
- App open across midnight.
- Habit with zero entries; a brand-new user with no habits (friendly empty state).

## 14. Acceptance criteria

- Works fully offline, installable on iOS and Android, with no network requests after load.
- Daily, weekly and monthly habits all produce correct streaks, ticks and tints.
- Calendar toggles between per-habit and combined, and the choice persists.
- Entry colors reflect the 5 volume tiers consistently on calendar and garden.
- The quote changes each local day and always shows a named source.
- Export followed by import in a fresh browser profile reproduces identical state.
- Layout is usable at 360px width and up; keyboard accessible; reduced-motion respected.
