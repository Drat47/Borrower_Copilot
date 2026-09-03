/* =============================================================================
   Question bank — must-set + adaptive follow-ups.
   Each question has:
     id           state key it writes to
     label        the actual question shown
     help         one-line "why we're asking" tooltip
     kind         input widget: number | select | choice | inr | pct | bool
     options      for select/choice
     tightens     which output(s) it moves — used for the "tightens X" hint
     askIf(s)     predicate on current state — skips inapplicable questions
     weight       contribution to confidence coverage
     tier         'must' | 'more'
     placeholder  for number inputs
     unit         suffix
   ========================================================================== */

const QUESTIONS = [
  // ─── MUST (8) ────────────────────────────────────────────────────────────
  {
    id: "purpose", tier: "must", kind: "choice", weight: 12,
    label: "What is the loan for?",
    help: "Purpose changes the product (personal / LAP / vehicle / business) and the verdict rules.",
    tightens: "product routing & verdict",
    options: [
      { v: "wedding",     l: "Wedding" },
      { v: "medical",     l: "Medical emergency" },
      { v: "consumption", l: "Household / consumption" },
      { v: "education",   l: "Education" },
      { v: "vehicle_2w",  l: "Two-wheeler purchase" },
      { v: "vehicle_4w",  l: "Car purchase" },
      { v: "home",        l: "Home purchase / renovation" },
      { v: "business",    l: "Business — stock, equipment, expansion" },
      { v: "refinance",   l: "Refinance / consolidate existing loans" },
      { v: "other",       l: "Other" },
    ],
  },
  {
    id: "amount", tier: "must", kind: "inr", weight: 8,
    label: "How much do you want to borrow?",
    help: "Anchors the ask so we can say borrow / borrow less / don't.",
    tightens: "verdict",
    placeholder: "e.g. 5,00,000",
  },
  {
    id: "incomeType", tier: "must", kind: "choice", weight: 12,
    label: "How do you earn?",
    help: "Salaried, ITR-filing self-employed, cash-earning self-employed and gig workers get very different treatment.",
    tightens: "rate band, FOIR cap, income haircut",
    options: [
      { v: "salaried", l: "Salaried (payslip + bank credit)" },
      { v: "se_itr",   l: "Self-employed, I file ITR" },
      { v: "se_cash",  l: "Self-employed, mostly cash income" },
      { v: "informal", l: "Gig / platform / informal daily earnings" },
    ],
  },
  {
    id: "income", tier: "must", kind: "inr", weight: 10,
    label: "Your net monthly income (₹)",
    help: "Take-home for salaried, or a typical month's earnings for others. Be honest — we don't upload it anywhere.",
    tightens: "eligibility, safe EMI",
    placeholder: "e.g. 60,000",
  },
  {
    id: "existingEmi", tier: "must", kind: "inr", weight: 8,
    label: "Total of all EMIs you already pay per month (₹)",
    help: "Directly reduces how much new EMI a lender or you can safely add.",
    tightens: "eligibility, safe EMI",
    placeholder: "0 if none",
  },
  {
    id: "expenses", tier: "must", kind: "inr", weight: 6,
    label: "Household expenses per month (₹)",
    help: "Rent, food, school fees, utilities, transport, help. Not existing EMIs.",
    tightens: "safe EMI",
    placeholder: "e.g. 25,000",
  },
  {
    id: "age", tier: "must", kind: "number", weight: 4,
    label: "Your age",
    help: "Caps tenure — most lenders want the loan closed before 60 (salaried) or 65 (self-employed).",
    tightens: "tenure, EMI",
    placeholder: "e.g. 32",
    min: 18, max: 75,
  },
  {
    id: "scoreState", tier: "must", kind: "choice", weight: 10,
    label: "Do you know your credit score?",
    help: "Unknown is not zero — we model it as unknown and price to the upper half of the band.",
    tightens: "rate band",
    options: [
      { v: "known",   l: "Yes, I know it" },
      { v: "no_score",l: "I've never had a formal loan / card" },
      { v: "unknown", l: "I've had credit but don't know my score" },
    ],
  },
  {
    id: "score", tier: "must", kind: "number", weight: 8,
    askIf: s => s.scoreState === "known",
    label: "Your credit score (CIBIL / Experian)",
    help: "Actual number lets us price to the correct tier.",
    tightens: "rate band",
    placeholder: "300 – 900",
    min: 300, max: 900,
  },

  // ─── ADDITIONAL (each moves a number) ────────────────────────────────────
  {
    id: "employerTier", tier: "more", kind: "choice", weight: 5,
    askIf: s => s.incomeType === "salaried",
    label: "What kind of employer?",
    help: "Employer tier shifts the personal-loan rate band by up to ±1%.",
    tightens: "rate band",
    options: [
      { v: "mnc_large",    l: "MNC or large listed company" },
      { v: "midsize",      l: "Mid-size Indian company" },
      { v: "startup_sme",  l: "Startup / SME" },
      { v: "unlisted_small", l: "Small / unlisted / new employer" },
    ],
  },
  {
    id: "tenureYears", tier: "more", kind: "number", weight: 4,
    askIf: s => s.incomeType === "salaried",
    label: "How many years in your current job?",
    help: "Tenure <1 year is a red flag; 3+ years unlocks the best rates.",
    tightens: "rate band, confidence",
    placeholder: "e.g. 4",
    min: 0, max: 45,
  },
  {
    id: "itrAnnual", tier: "more", kind: "inr", weight: 6,
    askIf: s => s.incomeType === "se_itr",
    label: "Annual income declared in your last ITR (₹/year)",
    help: "Lender sanction is capped at ~3.5× ITR-declared annual income.",
    tightens: "eligibility",
    placeholder: "e.g. 6,00,000",
  },
  {
    id: "itrYears", tier: "more", kind: "number", weight: 3,
    askIf: s => s.incomeType === "se_itr",
    label: "Years you have filed ITR",
    help: "2+ years of ITRs is typically required for unsecured business/personal loans.",
    tightens: "eligibility, verdict",
    min: 0, max: 40,
  },
  {
    id: "incomeVariabilityPct", tier: "more", kind: "pct", weight: 4,
    askIf: s => s.incomeType === "se_cash" || s.incomeType === "informal" || s.incomeType === "se_itr",
    label: "How much does your monthly income vary? (%)",
    help: "If income swings ±30%+ month to month, safe EMI is reduced 15%.",
    tightens: "safe EMI",
    placeholder: "e.g. 25 for ±25%",
    min: 0, max: 100,
  },
  {
    id: "utilization", tier: "more", kind: "pct", weight: 3,
    askIf: s => s.scoreState === "known" || s.scoreState === "unknown",
    label: "How much of your credit-card limit are you currently using? (%)",
    help: "Utilisation over 70% hurts your score and adds ~1% to the rate band.",
    tightens: "rate band",
    placeholder: "0 if no cards",
    min: 0, max: 100,
  },
  {
    id: "bouncesLast12", tier: "more", kind: "number", weight: 5,
    label: "EMI or cheque bounces in the last 12 months",
    help: "Even one bounce widens the rate band; 3+ can trigger a 'don't borrow' verdict when combined with other stress signals.",
    tightens: "rate band, verdict",
    placeholder: "0 if none",
    min: 0, max: 20,
  },
  {
    id: "emergencyMonths", tier: "more", kind: "number", weight: 5,
    label: "Emergency savings — how many months of expenses could you cover?",
    help: "Below 3 months, safe EMI is trimmed 25%. Below 1 month + a bounce = 'don't borrow'.",
    tightens: "safe EMI, verdict",
    placeholder: "0 if none",
    min: 0, max: 60,
  },
  {
    id: "existingHighCostLoans", tier: "more", kind: "bool", weight: 4,
    label: "Do you have any app / instant loans at 25%+ interest right now?",
    help: "Signals a debt-trap risk — combined with a bounce, triggers 'don't borrow this way'.",
    tightens: "verdict",
  },
  {
    id: "hasCollateral", tier: "more", kind: "bool", weight: 6,
    label: "Do you own property or gold you'd be willing to pledge?",
    help: "Collateral routes you to LAP or gold loans, which are 4–10 percentage points cheaper.",
    tightens: "product, rate band",
  },
  {
    id: "collateralValue", tier: "more", kind: "inr", weight: 4,
    askIf: s => s.hasCollateral,
    label: "Approximate market value of what you'd pledge (₹)",
    help: "Lenders lend up to 65% of property value, 75% of gold.",
    tightens: "eligibility (if secured)",
  },
  {
    id: "coApplicantIncome", tier: "more", kind: "inr", weight: 4,
    label: "Co-applicant's monthly income, if any (₹)",
    help: "Spouse or parent income adds to underwritable income (10% haircut). 0 if solo.",
    tightens: "eligibility",
    placeholder: "0 if solo",
  },
  {
    id: "dependents", tier: "more", kind: "number", weight: 3,
    label: "How many dependents rely on your income?",
    help: "Sole earner with 2+ dependents → safe EMI reduced 15%.",
    tightens: "safe EMI",
    placeholder: "e.g. 2",
    min: 0, max: 12,
  },
  {
    id: "soleEarner", tier: "more", kind: "bool", weight: 2,
    askIf: s => s.dependents >= 1,
    label: "Are you the only earner in your household?",
    tightens: "safe EMI",
  },
  {
    id: "productive", tier: "more", kind: "bool", weight: 3,
    askIf: s => s.purpose === "business" || s.purpose === "vehicle_2w" || s.purpose === "vehicle_4w",
    label: "Will this loan directly increase your income?",
    help: "Productive loans get more lenient verdicts because the EMI is partly self-funded by new earnings.",
    tightens: "verdict",
  },
  {
    id: "expectedExtraIncome", tier: "more", kind: "inr", weight: 3,
    askIf: s => s.productive === true,
    label: "How much extra monthly income do you realistically expect? (₹)",
    help: "Conservatively counted (50% haircut) toward safe EMI for productive loans.",
    tightens: "safe EMI, verdict",
    placeholder: "e.g. 8,000",
  },
  {
    id: "lenderQuoteRate", tier: "more", kind: "pct", weight: 2,
    label: "Has any lender already given you a quote? Rate they offered (%)",
    help: "We'll show it against our fair band on your Negotiation Card.",
    tightens: "negotiation card",
    placeholder: "leave blank if none",
    min: 0, max: 50, step: 0.1,
  },
];

// total weight, used by confidenceMeta
const QUESTION_WEIGHTS_TOTAL = QUESTIONS.reduce((s, q) => s + (q.weight || 0), 0);

// Returns the next question to ask, or null if none applicable & unanswered
function nextQuestion(state, answered) {
  // must-set first
  for (const q of QUESTIONS) {
    if (q.tier !== "must") continue;
    if (answered.has(q.id)) continue;
    if (q.askIf && !q.askIf(state)) continue;
    return q;
  }
  // then more
  for (const q of QUESTIONS) {
    if (q.tier !== "more") continue;
    if (answered.has(q.id)) continue;
    if (q.askIf && !q.askIf(state)) continue;
    return q;
  }
  return null;
}

// How many questions still applicable & unanswered
function remainingCount(state, answered) {
  return QUESTIONS.filter(q =>
    !answered.has(q.id) && (!q.askIf || q.askIf(state))
  ).length;
}

window.BC_Q = { QUESTIONS, QUESTION_WEIGHTS_TOTAL, nextQuestion, remainingCount };
