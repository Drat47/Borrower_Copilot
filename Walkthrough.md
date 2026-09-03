# Walkthrough

*Deliverable 4. A written five-minute tour of what I built, why, what I would build next, and what I would cut.*

---

## What this is

A rules-based self-assessment for Indian borrowers. Answer 8-10 questions minimum (more optional, each earns its place), get four outputs plus a one-page card you can hand to a lender. Everything runs in the browser; no backend, no login, no data storage. The rules are in one file and read as English.

The four outputs, mapped to the brief:

- **O1 · Verdict** — Borrow / Borrow less / Don't. "Don't" is reachable and has priority ordering so the borrower gets the diagnostic reason, not just "safe EMI is small."
- **O2 · Amount** — Two numbers, labelled: what the lender will sanction, and what you can safely carry. The safe number is highlighted as "use this."
- **O3 · Rate** — A band (not a point), plus the all-in APR including a typical processing fee, with an explicit instruction: "ask the lender to quote APR, not headline."
- **O4 · EMI** — Monthly ceiling, tenure options with EMIs computed, plus a stress test (income −20%, rate +200bps) showing whether the loan still holds.

Plus the **Negotiation Card**: single screen (print-optimised), the borrower's actual position with four scripted asks to make of the lender.

---

## The three borrowers, in one line each

- **Priya** (salaried, 780 score) → "You can borrow." Personal loan at 10.5-12.1% (APR ~12.4%), ₹8L is well within her safe carrying of ₹13.1L. Lender will offer up to ₹23.75L; card explicitly tells her not to take it.
- **Ravi** (self-employed ITR, no score, ₹45L shop) → "Borrow less." Routes to LAP at 9.4-11.1% (APR ~10.5%) instead of unsecured business at 20%. ITR cap binds sanction at ₹14.7L, not FOIR. That routing decision alone saves him ~₹8-10 lakh over the life of the loan.
- **Anita** (informal, 1 bounce, high-cost app loans, no savings) → "Don't borrow this way." The diagnostic (debt-trap pattern) fires *before* the numeric gate, so she gets a reason she can act on — plus a constructive alternative (platform-lease scooter from Zomato / Ola).

Same rules, three different answers. That is the test.

---

## What good looks like — how the app hits each judging criterion

**Domain reasoning (30 pts).**
- Lender number vs. borrower number are separately computed (`lenderMaxSanction` from FOIR + underwritable income; `safeSanction` from disposable × 50% with adjustments). Priya's are ₹23.75L vs ₹13.1L — visibly different.
- "Don't borrow" fires for Anita via the diagnostic rule (bounce + app loans + no savings), which is priority 1 above the numeric gates, exactly so the reason is useful.
- Ravi is routed to LAP because he has collateral ≥ 1.5× ask. That is the whole point of the routing being a separate step before pricing.
- APR is computed by solving for the true rate given `principal − PF`; not a fake headline.

**Question design (20 pts).**
- Must-set is 8 questions (9 if score is known). If you answer only those, the app still produces all four outputs — with a "Low confidence" badge and wider bands.
- Every `more` question has an `askIf` predicate — a salaried IT worker never sees "years you've filed ITR." A gig worker never sees "employer tier."
- Every question is tagged with what it moves (`rate band`, `safe EMI`, `verdict`), shown as a small pill under the question. If a question doesn't tighten anything, it's cut.

**Explainability & the Card (20 pts).**
- Every output has "Why these numbers →" that expands to the exact rules that fired.
- The rule trace at the bottom of the results screen lists every one of the (typically 8-15) rules that produced the result, tagged by category.
- The Negotiation Card is single-page, print-optimised, reads as sentences a borrower can literally say out loud: "Quote me the APR including PF, not headline." "No pre-payment penalty on floating rate (RBI rule)."

**Product craft (15 pts).**
- Mobile-first single column. Ranges are always shown as ranges, never as fake single numbers. Confidence is High / Medium / Low on every output.
- Type system borrowed from the challenge document itself — Newsreader display, Source Sans body, IBM Plex Mono for numbers. Not by accident: signals we read carefully.
- Progress bar, back button, "I don't know" as a first-class option on every screen.

**Engineering (10 pts).**
- `rules.js` is the entire rules engine — pure functions, no DOM, every constant has a `WHY_` sibling.
- `questions.js` is the question bank — data-only, with `askIf` predicates.
- `app.js` is UI only.
- `RULES.md` mirrors `rules.js` in English.
- Session persists in localStorage; refresh keeps your place.

**Honesty about limits (5 pts).**
- Section 11 of RULES.md lists every place I don't actually know the number.
- The app shows "Low confidence" when only the must-set is answered.
- The card's "quote me APR, not headline" ask is itself a hedge — if my rate band is wrong by 1-2 points, the APR check protects the borrower anyway.

---

## What I'd build next (in order)

1. **A tunable stress-test slider on the results screen.** Right now the stress case is fixed at income −20% / rate +200bps. Let the borrower drag it: "What if I lose my job for 3 months?" "What if I get married and expenses go up 30%?" Same computation, more agency.

2. **A "consolidation" mode for Anita-like cases.** Instead of "don't borrow," compute: if she took a ₹35k personal loan at 18% to pay off her three 30%+ app loans, does the arithmetic work? Frequently yes. The app currently ducks this by saying no; the more useful answer is a specific yes-if.

3. **Real-time comparison with a live lender quote.** The card already has a `lenderQuoteRate` slot. Extend: paste the sanction letter's headline rate, PF, tenure, insurance add-on — and the app tells you exactly how much you'd overpay vs. its fair number, in rupees, over the life of the loan.

4. **Vernacular language toggle.** Hindi first, then Kannada, Tamil, Bengali, Marathi. The vocabulary is small (~150 strings) and the audience needs it far more than the English-comfortable person we're demoing to.

5. **Persistence of the card as a shareable URL.** Right now the card is print-only. A `?state=<compressed-JSON>` link would let a borrower text it to a family member for a second opinion. No server needed.

6. **A "before you go" primer** — one screen explaining what FOIR is, what APR is, and why the lender's number and yours can differ. Read it once, ever. Currently the app assumes vocabulary the target user doesn't have.

7. **Integration with account-aggregator (AA) API** for the volunteer case where a borrower is willing to share bank statements. That would replace the "trust me on my income" flow with actual salary credits + EMI debits detected automatically. Huge confidence bump.

---

## What I would cut

- **The 25th and 26th questions.** `dependents` and `soleEarner` each only move the safe EMI by 15%. In practice you get almost the same answer without them. I kept them because the brief said "each question earns its place," and these do — barely — but they're first on the chopping block if we want fewer questions.
- **The rule-trace collapsible.** It's for evaluators, not borrowers. In production, hide it behind a "developer mode" flag or remove entirely; the borrower already has "Why these numbers →" on each output.
- **Multi-file JSON config.** I considered pulling every threshold into a JSON file loaded at runtime. That's more "enterprise" but harder to reason about. Keeping them as named constants with docstring comments in `rules.js` reads better and version-controls better. If I wrote this again for real, same choice.
- **A landing hero image.** Considered adding one; the type-first, editorial approach reads more serious and matches Lokta's own document. Kept it text.

---

## What I got wrong or am unsure about

- **The rate bands are heuristic.** I cross-checked against published NBFC / bank price cards for Sept 2025 but real underwritten rates on any given day for the same profile can be ±3 points wide. Section 4 of RULES.md is honest about this.
- **The verdict for Anita is directive** ("Don't borrow this way"). Reasonable people could argue the platform-lease alternative is over-specific — I'd rather over-specify and be corrected than hedge into uselessness.
- **The productive-loan boost (safe EMI += 50% × expected extra income)** is not a real underwriter's rule. Underwriters don't credit projected future income. But a borrower deciding for themselves legitimately can — with a haircut. I chose 50%. Half of that would be more conservative and probably better defended.
- **Two-wheeler and gold rate bands** are the least-well-researched. Added mostly for Anita's routing; if the reviewer probes here, the honest answer is "I calibrated less."

---

## How to defend / change any rule live

Everything scoring uses is in exactly two files:

- `rules.js` — 300 lines, all named constants with `WHY_` docstrings and pure functions
- `questions.js` — the question bank, 27 entries, each with `weight` and `askIf`

Change a threshold there, refresh, watch every output update. RULES.md is the human-readable mirror. The UI never encodes a number.

In the follow-up, if you say "change the FOIR cap for informal workers from 40% to 35%," I edit one number in `rules.js`, refresh, and Anita's already-thin lender-max drops further. If you say "add a rule that no unsecured personal loan should exceed 10× monthly income," it's a two-line clamp inside `decideVerdict`. That's the whole point.
