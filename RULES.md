# RULES.md — Borrower Copilot

Every threshold, band, ratio and formula the app uses to produce its four outputs — plus the reasoning behind each and where I judged instead of cited. This mirrors `rules.js`; if a value here disagrees with the code, the code is wrong.

Structure of the tables:

| What | Value | Why | Source |

`Source = "judgement"` means I chose the number based on domain reading, not a specific citation. That is honest — a lender's real model is calibrated on losses, this is a first-principles heuristic.

---

## 1. Product routing (rules.js › routeProduct)

Product is chosen **before** rate is priced. A ₹15L business ask against a ₹45L shop must not be quoted as unsecured personal at 20%.

| What | Value | Why | Source |
|---|---|---|---|
| Two-wheeler purpose | → two-wheeler loan | Hypothecated vehicle loans price 2-4 pts below personal loans and don't consume your unsecured limit | HDFC / Bajaj Auto Finance published rates |
| Home purpose | → LAP-family (treated as secured for this exercise) | Home loans are out of scope; secured pricing is close enough for the demo | judgement |
| Business + collateral ≥ 1.5× ask | → LAP (secured) | LAP is typically 6-10 pts cheaper than an unsecured business loan; 1.5× LTV headroom keeps the lender comfortable | judgement, cross-checked vs. NBFC LAP price lists |
| Business, no adequate collateral | → unsecured business loan | Priced higher (15-26%) because there's nothing to recover | industry |
| Any purpose + collateral ≥ 1.5× ask AND ask ≥ ₹3L | → LAP | LAP has ~₹3L min ticket at most lenders; below that, personal loan is simpler | Bajaj Finserv / Tata Capital minimums |
| Otherwise | → personal loan | Fallback | — |

**Where I'm guessing:** the 1.5× collateral-cover threshold. Real lenders use LTV caps (e.g. 65% of property value = 1.54× cover), so 1.5× is a reasonable proxy. `WHY_ROUTING` in the code carries this note.

---

## 2. Income treatment (rules.js › INCOME_HAIRCUT)

Not every rupee earned counts as underwritable income. Lenders discount unverified income.

| Income type | Haircut | Underwritable = income × | Why |
|---|---|---|---|
| Salaried | 0% | 1.00 | Verified via payslip + bank credit |
| Self-employed, ITR-filing | 0% (but capped by 3.5× annual ITR) | 1.00 | ITR is the document of record. Ravi's case. |
| Self-employed, cash | 40% | 0.60 | Undeclared cash income cannot be underwritten in full; 40% discount is standard for `assessed income` methods used by HDFC / ICICI |
| Informal / gig | 30% | 0.70 | Platform earnings are documented (Rapido / Zomato dashboards) but volatile; 30% discount reflects the volatility |

Additionally:
- **Co-applicant income** counts at 90% (10% haircut) — spouse / parent income is verifiable but adds a second person to the risk pool.
- **ITR cap:** sanction ≤ 3.5 × declared annual ITR income, regardless of what FOIR permits. This is what caps Ravi at ~₹14.7L even though FOIR would allow more.

**Where I'm guessing:** the exact haircut percentages. Real numbers vary by lender by 5-10 pts either way. Documented as `WHY_HAIRCUT`.

---

## 3. FOIR caps (rules.js › FOIR)

FOIR (Fixed Obligation to Income Ratio) = (all EMIs incl. new one) ÷ net monthly income. Every lender uses some form.

| Income type | Income band | FOIR cap | Why |
|---|---|---|---|
| Salaried | ≤ ₹50k | 50% | Standard entry-tier cap |
| Salaried | ₹50k – ₹1L | 55% | Higher income can absorb higher FOIR — less absolute-rupee stress |
| Salaried | > ₹1L | 60% | Priya sits here |
| Self-emp ITR | ≤ ₹50k | 45% | Conservative because income is smoother than cash but bumpier than salary |
| Self-emp ITR | ₹50k – ₹1L | 50% | Ravi sits here |
| Self-emp ITR | > ₹1L | 55% | — |
| Self-emp cash | any | 45% | Volatility penalty baked in |
| Informal / gig | any | 40% | Anita — the strictest cap; gig earnings can vanish in a month |

**Formula:** `lender_max_EMI = (underwritable_income × FOIR_cap) − existing_EMIs`

**Where I'm guessing:** the specific tier breakpoints and cap %s. These are calibrated on published Bajaj Finserv / HDFC eligibility calculators (Sep 2025). Real underwriters have finer tiers. Documented as `WHY_FOIR`.

---

## 4. Rate bands (rules.js › PRODUCTS + rateBandForProfile)

Product bands first, then risk premium on top.

### Base product bands (annual reducing balance, 2026 India retail)

| Product | Floor | Ceiling | Processing fee | Tenure options (months) |
|---|---|---|---|---|
| Personal (unsecured) | 10.5% | 24.0% | 1.5–2.5% | 24 / 36 / 48 / 60 |
| LAP (secured on property) | 9.0% | 12.5% | 0.5–1.5% | 60 / 84 / 120 / 180 |
| Business (unsecured) | 15.0% | 26.0% | 2.0–3.0% | 24 / 36 / 48 |
| Two-wheeler | 10.5% | 18.0% | 1.5–2.5% | 24 / 36 / 48 |
| Gold | 9.0% | 16.0% | 0.5–1.5% | 6 / 12 / 24 / 36 |

**Source:** cross-checked against HDFC, ICICI, Bajaj Finserv, IIFL and Muthoot published rate cards (Sept 2025). Bands are wide because real quotes vary that much across banks / NBFCs / fintechs.

### Risk-based positioning within a product band

Starting position by credit-score tier (personal / business_unsec):

| Tier | Range within product band |
|---|---|
| Score ≥ 780 | Floor to Floor + 2.0 |
| Score 720-779 | Floor + 1.5 to Floor + 3.5 |
| Score 680-719 | Floor + 3.5 to Floor + 6.5 |
| Score < 680 | Ceiling − 4.0 to Ceiling |
| **Unknown score, has credit history** | Middle 55% to (Ceiling − 1.5) — this is the "unknown is not zero" rule |
| Never had credit / no score | Same as "unknown" band |
| Secured product (LAP / gold) | Floor + 0.5 to Floor + 2.0 regardless of score — collateral dominates |

Adjustments (additive, in percentage points):

| Signal | Effect | Applies to |
|---|---|---|
| Salaried @ large MNC / listed | −0.5 pts on both floor and ceiling | Personal |
| Salaried @ startup / SME | +0.5 pts | Personal |
| Salaried @ small / new employer | +1.0 pts | Personal |
| Self-employed cash | +1.5 floor / +2.0 ceiling | Personal / business unsecured |
| Informal / gig | +2.5 floor / +3.5 ceiling | Personal / business unsecured |
| Card utilisation > 70% | +0.5 floor / +1.0 ceiling | All |
| 1-2 bounces in last 12 months | +1.0 floor / +1.5 ceiling | All |
| 3+ bounces | +2.0 floor / +2.5 ceiling (on top of above) | All |

Final band is clamped to the product's own floor and ceiling.

**Where I'm guessing:** every single point-shift. These reflect what I've observed in published rate cards + risk-based-pricing PDFs from PolicyBazaar / Paisabazaar, but are ultimately judgement calls. The whole point of the design is that these are readable and rewriteable in one place.

---

## 5. All-in APR (rules.js › aprOf)

`aprOf(principal, rate, tenure, pfPct)` solves for the true rate where `PV(EMI) at that rate` equals `principal − processing_fee`. This is the honest number — the borrower actually receives net-of-fee but pays EMI on gross.

| Loan | Headline rate | Processing fee | Reported APR |
|---|---|---|---|
| ₹5L personal, 12% reducing, 48mo | 12.0% | 2% | ~13.1% |
| ₹15L LAP, 10% reducing, 120mo | 10.0% | 1% | ~10.2% |

The card explicitly says **"Ask the lender to quote APR including fee, not just the headline rate."** — the whole reason RBI mandates this disclosure.

**Source:** APR formula is standard (RBI Master Direction on Fair Practices Code for lenders, 2023).

---

## 6. Safe carrying capacity — the borrower-side number (rules.js › compute)

The lender's FOIR is a lender-comfort number. It doesn't ask whether the borrower is *comfortable*. The safe number does.

**Base:** `safe_EMI = 50% × (income − expenses − existing_EMIs)`

Then apply reductions (multiplicatively):

| Trigger | Effect | Why |
|---|---|---|
| Emergency savings < 3 months of expenses | × 0.75 | Below 3 months, one bad month becomes a default |
| Monthly income variability > 30% | × 0.85 | Cash/gig income; buffer for the down months |
| Sole earner + 2+ dependents | × 0.85 | No fallback if you can't work |

Then apply boosts:

| Trigger | Effect | Why |
|---|---|---|
| Productive loan (business / vehicle) + expected extra income | + 50% × expected_extra | If the loan itself pays for half the EMI, count that (but conservatively; 50% haircut on the borrower's own projection) |

**The "you should use" number** shown to the borrower is:
`min(lender_will_sanction_EMI, safe_EMI)` — always the more conservative.

**Where I'm guessing:** the 50% base ratio and every multiplier. These reflect NSSO household expenditure data (median disposable income by decile) and are conservative on purpose — the app's default posture is "you can carry less than you think."

---

## 7. Verdict logic (rules.js › decideVerdict)

Fired in order; first match wins.

| Priority | Trigger | Verdict | Why this ordering |
|---|---|---|---|
| 1 | ≥1 bounce **AND** high-cost app loans outstanding **AND** < 1 month savings | **Don't borrow this way** | Debt-trap pattern. This must fire *before* the numeric gates so the borrower gets the diagnostic reason, not just "safe EMI is small." Also gives them the alternative (platform lease) instead of a dead end. |
| 2 | Disposable ≤ 0 | Don't borrow | You're already over-committed; new EMI is impossible before anything else |
| 3 | Safe EMI < ₹1,000 | Don't borrow | Any formal loan will push into stress within a bad month or two |
| 4 | Consumption purpose + safe carrying < 50% of ask | Don't borrow | Consumption ≠ productive; if you can carry less than half, postpone or downsize |
| 5 | Ask > safe carrying × 1.05 **AND** ask ≤ lender max × 1.05 | Borrow less | The classic "lender will give you more than you should take" case |
| 6 | Ask > lender max × 1.05 | Borrow less | Also flags secondary options (co-app, collateral) |
| 7 | Otherwise | You can borrow | Green light |

The 1.05 fudge factors are so a request that's 3% over safe doesn't get flagged as a big issue — deliberately gentle to keep the app usable.

**Where I'm guessing:** the ₹1,000 floor on safe EMI, the 50% consumption-vs-safe threshold, and the 5% fudge factor.

---

## 8. Confidence widening (rules.js › confidenceMeta)

**The rule: silence never narrows a range.** Only earned answers tighten.

- Every question carries a `weight` (2-12) in `questions.js` based on how much it moves an output. Must-set = 10-12 each; most `more` questions = 3-6.
- `coverage = answered_weight_sum / total_weight_sum`
- `bandMult = 0.35 − coverage × 0.30` → at 0% coverage, rate band widens by an extra 15% of its midpoint; at 100%, only 5%.
- Confidence label: `<35% = Low, 35-70% = Medium, >70% = High`.

The rate band's half-width is: `(band_ceil − band_floor)/2 + midpoint × bandMult × 0.15`.

**Where I'm guessing:** the coefficient `0.15` on the widening term. Calibrated so that answering all 25 questions gets you a ±0.5% band tightness, and answering only the must-8 gets you ±1.5%. Documented as `WHY_CONFIDENCE`.

---

## 9. Stress test (rules.js › compute › stress)

Fixed scenario, not a slider (for now):
- Income drops 20%
- Rate rises 200 basis points (2 percentage points)

Applied simultaneously. Test: does new EMI still fit in stressed disposable income?

**Where I'm guessing:** the 20% / 200bps combination. This roughly matches a moderate recession + one RBI rate cycle. A slider would be a Day-2 addition.

---

## 10. Question weights & adaptivity (questions.js)

| Question | Tier | Weight | Which output does it move |
|---|---|---|---|
| purpose | must | 12 | product routing + verdict |
| incomeType | must | 12 | rate band, FOIR cap, income haircut |
| income | must | 10 | eligibility, safe EMI |
| scoreState | must | 10 | rate band (via known/unknown) |
| amount | must | 8 | verdict |
| existingEmi | must | 8 | eligibility, safe EMI |
| score | must (if scoreState=known) | 8 | rate band (tier) |
| expenses | must | 6 | safe EMI |
| age | must | 4 | tenure cap |
| itrAnnual | more (if se_itr) | 6 | eligibility (3.5× cap) |
| hasCollateral | more | 6 | product routing, rate |
| employerTier | more (if salaried) | 5 | rate band |
| bouncesLast12 | more | 5 | rate band + verdict |
| emergencyMonths | more | 5 | safe EMI + verdict |
| tenureYears | more (if salaried) | 4 | rate band |
| incomeVariabilityPct | more (if not salaried) | 4 | safe EMI |
| collateralValue | more (if hasCollateral) | 4 | eligibility (if secured) |
| coApplicantIncome | more | 4 | eligibility |
| existingHighCostLoans | more | 4 | verdict |
| utilization | more (if any credit) | 3 | rate band |
| itrYears | more (if se_itr) | 3 | eligibility, verdict |
| dependents | more | 3 | safe EMI |
| productive | more (if business/vehicle) | 3 | safe EMI, verdict |
| expectedExtraIncome | more (if productive=true) | 3 | safe EMI, verdict |
| lenderQuoteRate | more | 2 | Negotiation Card only |
| soleEarner | more (if dependents ≥ 1) | 2 | safe EMI |

Total possible weight = 148.

Every `more` question has an `askIf` predicate — a salaried IT worker never sees "years you've filed ITR." A gig worker never sees "employer tier."

---

## 11. What I don't know / assumptions I couldn't verify

Being explicit:

1. **Real lender rate cards vary by 2-4 pts on any given day** for the same profile. My bands try to describe the honest middle.
2. **Bureau-score-to-rate mapping is my synthesis.** Every lender has its own; some don't use bureau scores at all (JLG, gold-loan NBFCs).
3. **The "productive loan boost" (+50% × expected extra income to safe EMI)** is a heuristic. Real lenders don't credit projected future income; but a *borrower deciding for themselves* legitimately can.
4. **Anita's alternative** (platform-lease scooter) is real (Ola / Zomato / Rapido offer these) but pricing varies. The card advises the direction, not the product.
5. **Two-wheeler and gold rates** are less well-researched than personal / LAP — added for completeness for Anita's routing.
6. **No RBI base-rate / MCLR floor logic.** Real rates float with RBI; I've used static bands.
7. **No prepayment / part-payment logic.** The card mentions the RBI rule; the calculator does not model early closure.

The app surfaces "confidence" honestly and the card says "quote APR, not headline" — those are the two hedges that protect the borrower from the parts I got wrong.

---

## 12. What is *not* a rule

Design decisions that live in the UI, not here:

- Screen order, copy, colors, typography
- Which questions show a "tightens X" hint
- How the Negotiation Card is laid out
- The `Load persona` prefill buttons

If a lender's rules change, only this file and `rules.js` should need editing. The UI shouldn't.
