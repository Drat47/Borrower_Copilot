# Handoff: Borrower Copilot

## Overview

Borrower Copilot is a rules-based self-assessment for Indian retail borrowers. A borrower answers 8–10 core questions (plus optional follow-ups), and the app produces four outputs — a verdict (borrow / borrow less / don't), the maximum amount (lender-side vs. borrower-side), a fair rate band with all-in APR, and an EMI ceiling with a stress test — plus a one-page **Negotiation Card** they can print and hand to a lender.

Built as the take-home for Lokta's "Borrower Copilot" challenge (Sept 2026). No backend, no login, no data storage — everything runs client-side from what the borrower types.

## About the Design Files

The files in this bundle are **design references created as static HTML + vanilla JS**. They are working prototypes showing the intended look, adaptive flow, and rules engine — but they are **not production code to ship as-is**.

The task for the implementing developer is to **recreate these designs in the target codebase's existing environment** (React, Next.js, React Native, SwiftUI, etc.) using its established patterns, component library, and state management. Two pieces are worth preserving mostly intact when porting:

1. **`rules.js`** — the rules engine is pure, DOM-free JavaScript. It can be lifted with minimal changes into a `lib/` or `services/` folder in any JS/TS codebase, or ported line-for-line to Swift/Kotlin. Every threshold has a `WHY_` docstring; the accompanying `RULES.md` mirrors it in English.
2. **`questions.js`** — the question bank is a plain data array with `askIf` predicates. Also portable as-is.

The UI (`app.js`, `styles.css`, HTML files) is prototype-grade and should be **re-implemented** in the target framework using its component patterns, not copied.

If no target codebase exists yet, recommended stack:
- **Web:** Next.js (App Router) + Tailwind + Radix UI primitives + React Hook Form. Ship `rules.js` as a TS module.
- **Mobile:** React Native + Expo (single codebase for iOS + Android). Same rules module.

## Fidelity

**High-fidelity (hifi).** Final colors, typography, spacing, copy, and interactions are all decided. The prototype is designed at ~440px wide (mobile-first) and scales up gracefully to desktop with a max content width of 44rem. Every number shown in the results is live-computed by the rules engine — not placeholder.

The visual system was deliberately matched to Lokta's own challenge document (Newsreader serif + Source Sans + IBM Plex Mono, plum accent on off-white) to signal editorial care. If your product has a different established visual system, apply that instead — the layout, information hierarchy, and copy are what matter to preserve.

## Screens / Views

The app is a single-page application with 4 primary screens, switched via a `.screen.active` class. Each screen is inside `<section id="screen-<name>" class="screen">`.

---

### 1. Landing (`#screen-landing`)

**Purpose:** Orient a new user in ~10 seconds. Let evaluators load a pre-filled persona to jump straight to the outputs.

**Layout:**
- Single column, max-width 44rem, centered, top-aligned
- Top bar: brand (`Borrower Copilot` + plum dot) on left, nav links (Home · Run-throughs · Rules) on right, thin bottom rule
- Hero block: eyebrow ("SELF-ASSESSMENT · 2 MINUTES"), display headline (H1, ~2.9rem serif with italicized *fair* in plum), thesis paragraph (1.2rem serif, ~36rem max-width, key phrases bold in plum)
- Four-output preview grid: 2-column on desktop, single column ≤520px. Each cell has bg `--bg2`, left border 2px plum, tiny label + one-line description
- Section "Try it with one of these borrowers": three vertically stacked persona cards
- Section "Or answer for yourself": short paragraph + primary CTA button
- Footnote in muted italic serif at bottom

**Components:**

**Brand mark:**
- "Borrower" in `Newsreader` 500, ink color
- "Copilot" in `Newsreader` italic 500, plum (`#4B2440`)
- 0.4rem × 0.4rem plum dot, 0.55rem to right of "Copilot"

**Persona card (× 3):**
- Padding `.9rem 1.05rem`
- 1px `#E2D9DE` border, transitions to plum border + `#EFE3EA` bg on hover
- CSS grid: 1fr auto (name left, "LOAD →" right)
- Row 1: name (Newsreader 500, 1.15rem) + "LOAD →" (font-mono, 0.8rem, plum, letter-spacing .06em, uppercase)
- Row 2: location · income type in mono uppercase, 0.78rem, muted color
- Row 3 (full width): "Wants **₹8,00,000** — a wedding" in body 0.9rem, amount bold in plum

**Primary button (`.btn.primary`):**
- Padding `.75rem 1.15rem`
- Bg plum, text `--accent-ink` (`#FBF9FA`), font 600 0.95rem
- No border radius (deliberate — matches editorial aesthetic)
- Hover: bg + border shift to `--ink`
- `white-space: nowrap` (fixes label wrap)
- Right arrow character in mono font

**Exact copy:**
- Eyebrow: `SELF-ASSESSMENT · 2 MINUTES`
- H1: `Walk in knowing what a *fair* loan looks like for you.` (italics on "fair" in plum)
- Thesis: `Four honest answers before you sign anything: **should I borrow, how much can I actually carry, what rate is fair for me, and what EMI should I refuse to cross** — plus a card you can hold up to the lender.`
- Persona section header: `Try it with one of these borrowers`
- Persona section sub: `These are the three profiles from the brief. Click one to see the full flow pre-answered and jump straight to the outputs.`
- Blank section header: `Or answer for yourself`
- Blank section sub: `About 8–10 core questions, then a few more if they'll tighten your numbers. Skip anything — the ranges just widen.`
- CTA: `Start blank →`
- Footnote: `No login. No bureau pull. No data leaves your device.`

---

### 2. Question flow (`#screen-question`)

**Purpose:** Ask one question at a time; make the adaptive logic visible; let users skip anything.

**Layout:**
- Header row: `1 · Low confidence` (mono, muted) on left, progress bar (max 12rem, 2px tall, plum fill on `--rule` track) in middle, `Restart` link on right
- Question card:
  - **Question label** (H1 with class `.qlabel`): Newsreader 500, 1.55rem, line-height 1.2
  - **Help text** (below): 0.93rem muted, ~36rem max
  - **"Tightens: X" pill:** inline-block, plum text on `--accent-soft` bg, uppercase, 0.72rem, letter-spacing .12em, padding `.3rem .55rem` — this is the visible-adaptivity element
  - **Field** (input, choice, or bool — see below)
- Action row (bottom, above thin top border):
  - Left: `← Back` (ghost btn) + `Skip` / `I don't know` link
  - Right: `Continue →` (primary btn, disabled until answer given)
- Footnote below: `Press [Enter] to continue. Every answer either narrows a range or opens a follow-up — nothing is asked for its own sake.` (with styled `<kbd>` for Enter)

**Field variants:**

- **Choice** (single-select from list): stacked buttons, full width, `.choice` class, 1px `--rule` border, hover/selected states use plum border + `--accent-soft` bg, mono checkmark on right when selected
- **Bool** (Yes/No): two `.choice` buttons side by side, `flex: 1` each
- **INR amount:** input with `₹` prefix in bordered gray box; font-mono 1.15rem in the input; ink-colored 2px bottom border; focus turns border plum
- **Percent:** input with `%` suffix in bordered gray box
- **Number:** plain number input with same border style

**Behavior:**
- On choice/bool tap: auto-advance
- On number/text: Enter to advance (Continue button also works)
- Back button: pops last answered question, keeps their value pre-filled
- Skip: marks question as "asked but not answered," does NOT credit confidence weight
- Field auto-focuses on load

---

### 3. Results (`#screen-results`)

**Purpose:** Show all four outputs at once, with confidence and "why" for each.

**Layout:**
- Header: `Your four outputs` (mono, muted) + `Start over` link on right
- H1: `Here is what a *fair* deal looks like for you.` (italics on "fair" in plum)
- **Verdict block** (color-coded card, full width):
  - Class `.verdict` + one of `.dont` / `.less` / `.go`
  - Left border 4px, bg soft variant, headline color matches (danger red / warn orange / good green)
  - `VERDICT` eyebrow → headline (1.6rem serif) → reasoning paragraph(s)
- **Three output blocks** (`.output`), separated by thin rules:
  - Each has: eyebrow tag (`O2 — MAXIMUM AMOUNT`) → H2 (1.35rem serif) → confidence badge on right
  - Confidence badge: colored dot + "HIGH" / "MEDIUM" / "LOW" in mono uppercase
- **O2 (Amount):** two-number grid (`.twonum`), 2 columns on desktop, 1 on ≤520px. Left = lender number in gray. Right = safe number in `--accent-soft` with plum left border and `✓` prefix.
- **O3 (Rate):** giant band display — `10.5 – 12.1 %` where numbers are 2.3rem plum mono, "–" and "%" are muted smaller. Below: annotation, then all-in APR line in mono, then processing-fee note.
- **O4 (EMI):** same two-number pattern as O2, THEN a tenure grid (auto-fit min 6rem cells, each showing "48MO / ₹24,217") with the preferred tenure highlighted in plum, THEN a stress-test block (colored good/warn based on whether it breaches).
- Under each output: **"Why these numbers →"** button that toggles a rule-list panel below it
- Bottom actions: `Answer a few more to tighten →` (ghost) + `See Negotiation Card →` (primary)
- **Rule trace:** collapsible `<details>` at bottom, `SEE EVERY RULE THAT FIRED FOR YOU (N)` in mono uppercase; when open, ordered list of every rule with category tag

---

### 4. Negotiation Card (`#screen-card`)

**Purpose:** Single printable page the borrower physically shows to a lender.

**Layout:**
- Header: `Negotiation Card` label + `← Back to results` link
- Intro paragraph: `Hand this to the lender. Every line ties back to an answer you gave. If they push back, ask them to justify their number against yours.`
- **Card wrapper:** `--bg2` background, 1rem padding
- **Card itself (`.negcard`):**
  - White bg, `--rule` border, subtle bottom shadow (`0 1px 0 --rule`), padding 1.75rem 1.6rem
  - Header row (flex space-between, ink-colored 1px bottom border): brand mark + date in mono muted
  - H2: `My negotiating position`
  - Profile line: `29 years old · salaried · ~₹1,10,000/month net · credit score 780 · existing EMIs ₹14,000/mo` (muted body 0.85rem)
  - **Data rows** (`.row`): CSS grid 8.5rem 1fr, thin rules between. Left = uppercase mono label (PRODUCT / AMOUNT / FAIR RATE / TENURE / EMI CEILING / PROCESSING FEE / CONFIDENCE). Right = mono value with bolded key numbers in plum + gray body-font sub-line explaining
  - **Quote gap block** (if borrower pasted a lender quote): warn-orange soft bg, left border warn, calls out the delta
  - **Ask list** (`.ask-list`): 4 numbered "asks" — plum "Ask N:" prefix (nowrap, bold), body text after. Padded rows with thin rules.
  - Footer: dashed top border, italic serif in muted color: `Generated by Borrower Copilot. Every number above is traceable to my answers.`
- Below card: Back + Print/Save-as-PDF buttons

**Print styling:** `@media print` hides all chrome (topbar, nav, buttons, trace, question actions), removes card wrapper background/border, sets A4 page with 1.6cm margins.

---

## Interactions & Behavior

**Screen transitions:**
- Instant swap via `.active` class toggle; scroll to top
- No animation on screen change (deliberate — content is dense)

**Question flow logic (from `rules.js` + `questions.js`):**
- `nextQuestion(state, answered)` returns the next applicable, unanswered question
- Must-set questions asked first (in defined order), then `more` questions
- Every `more` question has an `askIf(state)` predicate — e.g. `s => s.incomeType === "salaried"` — so a gig worker never sees "employer tier"
- Progress bar shows `done / (done + remaining)` where `remaining` counts applicable questions only

**Skip vs. answer:**
- Both add to `answered` set (so question doesn't re-appear)
- Only actual answers credit `_answeredWeight` for confidence calculation
- Confidence tiers: <35% coverage = Low, 35-70% = Medium, >70% = High
- At low confidence, rate band widens by an extra ~15% of midpoint

**Persistence:**
- Full session (`state` + `answered` array) written to `localStorage` key `bc.session.v1` on every commit
- Cleared on "Start over"
- Loaded on init (currently not auto-jumped-to; user re-chooses)

**Number formatting:**
- All ₹ values use Indian digit grouping via custom `inr()` function (e.g. `₹19,75,000` not `₹1,975,000`)
- Amounts rounded to nearest ₹5,000 for display; smaller amounts to nearest ₹1,000
- Rates rounded to 1 decimal

**Compute pipeline (called on every results render):**
1. Route to product (`routeProduct(state)`)
2. Rate band (`rateBandForProfile(product, state)`) → widened by confidence
3. Underwritable income = raw income × haircut(incomeType), plus 90% of co-applicant
4. FOIR-capped lender EMI, then PV to sanction at longest tenure
5. ITR cap enforced if applicable
6. Safe carrying EMI = 50% of disposable, then multiplicative penalties (savings, variability, sole earner), then productive-loan boost
7. Stress test at income −20%, rate +200bps
8. Verdict decision with priority ordering (diagnostic → hard-no → borrow-less → go)

**Hover / focus states:**
- All buttons: 150ms transition on bg + color
- Choice cards: hover shifts to plum border + `--accent-soft` bg
- Focus visible: 2px plum outline, 2px offset

**Stress test:**
- Fixed scenario (income −20%, rate +200bps applied simultaneously)
- Rendered green if disposable still exceeds stressed EMI; warn-orange if it breaches

---

## State Management

**Global state (in `app.js`):**

```js
let state = {};              // borrower answers keyed by question id
let answered = new Set();    // question ids that have been shown & moved past
let currentQ = null;         // the question currently displayed
```

**State shape (typical after Priya persona loads):**

```js
{
  purpose: "wedding",              // string enum
  amount: 800000,                  // number (rupees)
  incomeType: "salaried",          // enum
  income: 110000,
  existingEmi: 14000,
  expenses: 28000,
  age: 29,
  scoreState: "known",             // enum: known | no_score | unknown
  score: 780,                      // number, only if scoreState === "known"
  employerTier: "mnc_large",       // enum, only if salaried
  tenureYears: 5,
  utilization: 0.25,               // fraction 0-1
  bouncesLast12: 0,
  emergencyMonths: 6,
  existingHighCostLoans: false,    // boolean
  hasCollateral: false,
  coApplicantIncome: 0,
  dependents: 0,
  productive: false,
  incomeVariabilityPct: 0,
  _answeredWeight: 82              // internal, used for confidence
}
```

**State transitions:**
- `commitAndAdvance(q)` → add to answered, recompute weight, save, ask next
- `skipCurrent()` → add to answered (no state write), recompute weight (0 credit), save, ask next
- `goBack()` → remove last from answered (state.value stays for prefill), rerender question

**No data fetching.** Everything is deterministic pure function of local state. If you extend with a bureau pull (Section 11 of RULES.md), that's the only network call anywhere.

---

## Design Tokens

Defined as CSS custom properties on `:root`. Both light and dark are supported (dark auto via `prefers-color-scheme`, or forced via `[data-theme]`).

### Colors — light (default)

| Token | Hex | Purpose |
|---|---|---|
| `--bg` | `#FBF9FA` | Page background, primary card bg |
| `--bg2` | `#F3EEF1` | Secondary card bg, muted panel |
| `--ink` | `#221A20` | Primary text |
| `--muted` | `#6E6069` | Secondary text, meta info |
| `--rule` | `#E2D9DE` | Borders, dividers |
| `--accent` | `#4B2440` | Plum — primary action, key numbers, brand |
| `--accent-ink` | `#FBF9FA` | Text on accent bg |
| `--accent-soft` | `#EFE3EA` | Soft accent bg (verdict/tightens pill/take-this) |
| `--warn` | `#8A4B12` | Warning border/text |
| `--warn-soft` | `#F5E7D5` | Warning bg (borrow-less verdict) |
| `--good` | `#3B5A2A` | Success border/text |
| `--good-soft` | `#E3ECD8` | Success bg (borrow verdict) |
| `--danger` | `#7A2020` | Danger border/text |
| `--danger-soft` | `#F1DADA` | Danger bg (don't-borrow verdict) |

### Colors — dark

| Token | Hex |
|---|---|
| `--bg` | `#17121A` |
| `--bg2` | `#1F1822` |
| `--ink` | `#EEE6EA` |
| `--muted` | `#A99DA5` |
| `--rule` | `#33293A` |
| `--accent` | `#CFA5C1` |
| `--accent-ink` | `#17121A` |
| `--accent-soft` | `#2A1F2C` |
| `--warn` | `#E0A265` |

### Typography

| Token | Stack | Used for |
|---|---|---|
| `--display` | `"Newsreader", Georgia, "Times New Roman", serif` | H1, H2, question labels, card headings, thesis |
| `--body` | `"Source Sans 3", "Segoe UI", Helvetica, Arial, sans-serif` | Body text, labels, help |
| `--mono` | `"IBM Plex Mono", Menlo, Consolas, monospace` | All numbers, tags/eyebrows, code |

Google Fonts URL:
```
https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Source+Sans+3:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap
```

### Type scale (all sizes as they appear)

| Element | Font | Size | Weight | Line-height | Notes |
|---|---|---|---|---|---|
| H1 (hero) | display | `clamp(2rem, 5.5vw, 2.9rem)` | 500 | 1.05 | letter-spacing -.015em, text-wrap balance |
| H1 (results/qflow) | display | 1.55rem (qlabel) / 2.9rem (results) | 500 | 1.2 | |
| H2 (section) | display | 1.7rem | 500 | 1.15 | |
| H2 (output) | display | 1.35rem | 500 | | |
| Verdict headline | display | 1.6rem | 500 | 1.15 | Color matches verdict class |
| Thesis / lede | display | 1.2rem | 400 | 1.4 | |
| H3 / eyebrow / tag | body | 0.72rem | 600 | | letter-spacing .14em, uppercase, muted |
| Body | body | 17px (base) | 400 | 1.55 | |
| Help text | body | 0.93rem | 400 | 1.55 | muted |
| Choice label | body | 1rem | 400 | | |
| Numeric display (band) | mono | 2.3rem | 500 | | accent color |
| Numeric large (numblock val) | mono | 1.5rem | 500 | | |
| Numeric med | mono | 1.15rem | 500 | | |
| Numeric small (mono line) | mono | 0.85rem | 400 | | tabular-nums |
| Footnote | display | 0.8rem (or 1.15rem in footer) | 400 italic | | muted |

### Spacing (approximate scale in use)

The design uses fluid rem-based spacing rather than a strict token scale. Common values:
- Padding inside cards: `.85rem 1rem` (small), `1.25rem 1.35rem` (medium), `1.75rem 1.6rem` (large — card)
- Gaps: `.5rem` (tight), `1rem` (default), `1.5rem` (loose), `2rem` (section)
- Section spacing: `margin-top: 2.25rem`
- App max-width: `44rem` (main), `82rem` (Run-throughs page)
- Field max-width: `32rem`
- Paragraph max-width: `38-40rem`

### Border radius

**Zero.** The design uses square edges deliberately (editorial aesthetic). Only the confidence dot and skiplink underline offset use rounded values (dot is a circle).

### Shadows

Minimal. Only the negotiation card uses `box-shadow: 0 1px 0 var(--rule)`.

### Borders

Consistent 1px `--rule` for cards. 2px `--ink` for input bottom borders (turns plum on focus). 4px left border on verdict blocks (color per verdict type). 3px left border on take-this numblock and stress block.

---

## Assets

**No image or icon assets.** The design is entirely typographic — no logos, illustrations, or icons. This is intentional (matches Lokta's own document aesthetic and keeps the app trust-signalling / not "slick fintech").

**Fonts** loaded from Google Fonts (URL above). If your build has a font-hosting strategy (self-host, next/font, etc.), use it.

**No SVG or icon library.** The arrows in buttons are unicode characters (`→` `←` `✓` `·`). If you want to swap in an icon library (Lucide, Heroicons), the semantic mapping is:
- `→` `←` → arrow-right / arrow-left
- `✓` → check
- `·` → dot / bullet (used as ask-list marker)

---

## Files

All source files are in the parent project (Genspark Design). This handoff bundle includes copies of everything the developer needs:

| File | Role | Port priority |
|---|---|---|
| `index.html` | Landing + question + results + card screens | **Re-implement** in target framework |
| `Run-throughs.html` | Priya/Ravi/Anita side-by-side demo | Optional — evaluator page only |
| `styles.css` | Full visual system | Port tokens to your system, re-implement layouts |
| `app.js` | UI controller (screen routing, form handling, render fns) | **Re-implement** in target framework |
| **`rules.js`** | **Rules engine — pure functions** | **Port mostly as-is** (highest value) |
| **`questions.js`** | **Question bank with `askIf` predicates** | **Port as-is** to a `questions.ts` module |
| `RULES.md` | English mirror of every rule/threshold/band | Ship in repo `docs/` — cross-team reference |
| `Walkthrough.md` | 5-min written tour | Ship in repo `docs/` — onboarding reference |
| `README.md` (project) | How to run the prototype | Optional |

### Suggested target-repo structure

```
src/
├─ lib/
│  ├─ rules.ts              ← ported from rules.js (typed)
│  ├─ questions.ts          ← ported from questions.js (typed)
│  └─ inr.ts                ← the ₹ formatter helper
├─ features/
│  └─ borrower-copilot/
│     ├─ Landing.tsx
│     ├─ QuestionFlow.tsx
│     ├─ Results.tsx
│     ├─ NegotiationCard.tsx
│     └─ hooks/
│        ├─ useCopilotState.ts     ← the state + answered + persistence
│        └─ useCurrentQuestion.ts  ← next-question logic
docs/
├─ RULES.md
└─ Walkthrough.md
```

### Testing priorities

The three personas in `PERSONAS` (in `app.js`) double as regression fixtures. Any port should preserve these outputs:

| Persona | Verdict | Product | Rate band | APR | Safe carry | Safe EMI |
|---|---|---|---|---|---|---|
| Priya | You can borrow | Personal | 10.5–12.1% | ~12.4% | ₹13.1L | ₹35k |
| Ravi | Borrow less | LAP (secured) | 9.4–11.1% | ~10.5% | ₹13.55L | ₹20k |
| Anita | Don't borrow this way | Two-wheeler | 15.3–18% | ~18.1% | ₹95k | ₹3k |

If any of those change, a rule got miswired in the port.

### Non-obvious details worth preserving

1. **Verdict priority ordering matters.** The debt-trap check (bounce + high-cost loans + no savings) must fire *before* the numeric gates, so Anita gets a diagnostic reason instead of "safe EMI too small." See `decideVerdict` in `rules.js`.
2. **Confidence widens with silence, never narrows.** The rate band's half-width includes an additive term proportional to `bandMult * midpoint`. Don't refactor this into a multiplier — it must remain additive so it can't narrow the band below the base tier width.
3. **Underwritable income ≠ stated income.** Every non-salaried income path applies a haircut (cash 40%, gig 30%). Co-applicant income takes a 10% haircut. These are the numbers that go into FOIR — not the raw stated income.
4. **ITR cap can bind before FOIR does.** For self-employed-ITR, sanction is min(FOIR-derived, 3.5× ITR annual). This is what caps Ravi at ~₹14.7L.
5. **Two number formatting quirks:** Indian digit grouping (₹19,75,000 not ₹1,975,000) and the "round to nearest ₹5,000" for display. Both in `inr()` and `roundK()` in `rules.js`.
