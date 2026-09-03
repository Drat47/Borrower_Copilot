/* =============================================================================
   Borrower Copilot — Rules Engine
   -----------------------------------------------------------------------------
   Pure functions. No DOM. Every threshold is a named constant with a
   WHY_ sibling explaining its source. RULES.md mirrors this file.
   ========================================================================== */

// ─── FOIR (Fixed-Obligation-to-Income) caps by income band ────────────────────
// FOIR = (all EMIs including new one) / net monthly income.
// Real lenders use tiers; higher income can carry a higher %.
const FOIR = {
  salaried:   [ { upto: 50_000, cap: 0.50 }, { upto: 1_00_000, cap: 0.55 }, { upto: Infinity, cap: 0.60 } ],
  se_itr:     [ { upto: 50_000, cap: 0.45 }, { upto: 1_00_000, cap: 0.50 }, { upto: Infinity, cap: 0.55 } ],
  se_cash:    [ { upto: Infinity, cap: 0.45 } ],
  informal:   [ { upto: Infinity, cap: 0.40 } ],
};
const WHY_FOIR = "Lenders cap total EMI as a % of net income. Salaried get higher caps because income is verifiable. Cash-income and gig workers get a lower cap because income is volatile.";

// ─── Income haircuts: what the lender will *count* as income ─────────────────
// A ₹40k cash-in-hand month is not treated as ₹40k of underwritable income.
const INCOME_HAIRCUT = {
  salaried: 1.00,   // full take-home counts
  se_itr:   1.00,   // ITR-declared, no haircut but capped by 3.5× annual
  se_cash:  0.60,   // 40% haircut for undeclared cash
  informal: 0.70,   // 30% haircut for gig / seasonal volatility
};
const WHY_HAIRCUT = "Cash and gig income get discounted because it is unverified and unstable. Salaried and ITR-declared income count in full.";

// ─── Product bands: rate, tenure, processing fee ─────────────────────────────
// Rates are annual % (reducing balance). PF as % of principal.
// Bands reflect 2026 Indian retail lending; verify at build time.
const PRODUCTS = {
  personal: {
    label: "Personal loan (unsecured)",
    tenureMonths: [24, 36, 48, 60],
    pfPct: [0.015, 0.025],   // 1.5–2.5%
    rateFloor: 10.5, rateCeil: 24.0,
  },
  lap: {
    label: "Loan against property (secured)",
    tenureMonths: [60, 84, 120, 180],
    pfPct: [0.005, 0.015],
    rateFloor: 9.0, rateCeil: 12.5,
  },
  business_unsec: {
    label: "Business loan (unsecured)",
    tenureMonths: [24, 36, 48],
    pfPct: [0.020, 0.030],
    rateFloor: 15.0, rateCeil: 26.0,
  },
  two_wheeler: {
    label: "Two-wheeler loan",
    tenureMonths: [24, 36, 48],
    pfPct: [0.015, 0.025],
    rateFloor: 10.5, rateCeil: 18.0,
  },
  gold: {
    label: "Gold loan",
    tenureMonths: [6, 12, 24, 36],
    pfPct: [0.005, 0.015],
    rateFloor: 9.0, rateCeil: 16.0,
  },
};
const WHY_PRODUCTS = "Bands taken from published NBFC/bank price lists for 2026; secured products price lower than unsecured because the lender has collateral to fall back on.";

// ─── Rate band by credit-score tier × income type ────────────────────────────
// Returns [floor, ceiling] within the product's own band.
function rateBandForProfile(product, profile) {
  const p = PRODUCTS[product];
  const { score, incomeType, employerTier, utilization, bouncesLast12 } = profile;
  // Derive scoreKnown from scoreState so callers only need to answer one question.
  const scoreKnown = profile.scoreState === "known" && typeof score === "number";

  // Base band inside the product
  let lo, hi;
  if (product === "lap" || product === "gold") {
    // Secured — score matters less
    lo = p.rateFloor + 0.5;
    hi = p.rateFloor + 2.0;
  } else if (!scoreKnown) {
    // No score: lender treats as unknown risk, prices at upper half
    lo = p.rateFloor + (p.rateCeil - p.rateFloor) * 0.55;
    hi = p.rateCeil - 1.5;
  } else if (score >= 780) {
    lo = p.rateFloor;                lo = Math.max(lo, p.rateFloor);
    hi = p.rateFloor + 2.0;
  } else if (score >= 720) {
    lo = p.rateFloor + 1.5;
    hi = p.rateFloor + 3.5;
  } else if (score >= 680) {
    lo = p.rateFloor + 3.5;
    hi = p.rateFloor + 6.5;
  } else {
    lo = p.rateCeil - 4.0;
    hi = p.rateCeil;
  }

  // Employer tier bump (salaried only, unsecured)
  if (incomeType === "salaried" && product === "personal") {
    if (employerTier === "mnc_large") { lo -= 0.5; hi -= 0.5; }
    if (employerTier === "startup_sme") { lo += 0.5; hi += 0.5; }
    if (employerTier === "unlisted_small") { lo += 1.0; hi += 1.0; }
  }
  // Income-type penalty on unsecured
  if (product === "personal" || product === "business_unsec") {
    if (incomeType === "se_cash") { lo += 1.5; hi += 2.0; }
    if (incomeType === "informal") { lo += 2.5; hi += 3.5; }
  }
  // Utilization penalty (revolving cards >70%)
  if (utilization != null && utilization > 0.7) { lo += 0.5; hi += 1.0; }
  // Bounces penalty
  if (bouncesLast12 > 0) { lo += 1.0; hi += 1.5; }
  if (bouncesLast12 > 2) { lo += 2.0; hi += 2.5; }

  // Clamp to product band
  lo = clamp(lo, p.rateFloor, p.rateCeil);
  hi = clamp(hi, p.rateFloor, p.rateCeil);
  if (hi < lo) hi = lo + 0.5;
  return [round1(lo), round1(hi)];
}
const WHY_RATE = "Rate = product floor + risk premium. Score, employer stability, income type, card utilisation and bounces each shift the band. Secured products price near the product floor because the lender's downside is protected.";

// ─── Confidence widening: fewer answers → wider bands ────────────────────────
// Every question answered narrows the ± multiplier on numeric outputs.
// Silence never narrows — it only preserves the wide default.
function confidenceMeta(state) {
  const total = QUESTION_WEIGHTS_TOTAL;   // set after questions.js loads; fallback:
  const weight = state._answeredWeight || 0;
  const cov = Math.min(1, weight / (total || 100));
  // Band multiplier: at 0% coverage bands widen by ±35%; at 100% they narrow to ±5%
  const bandMult = 0.35 - cov * 0.30;
  let label;
  if (cov < 0.35) label = "Low";
  else if (cov < 0.7) label = "Medium";
  else label = "High";
  return { coverage: cov, bandMult, label };
}
const WHY_CONFIDENCE = "The app never narrows a range it has no basis to narrow. Bands widen with silence; only earned answers tighten them.";

// ─── PMT (EMI) formula — standard reducing-balance ───────────────────────────
function emiOf(principal, annualRatePct, months) {
  if (!principal || !months) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / months;
  return principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
}
function pvOfEmi(emi, annualRatePct, months) {
  if (!emi || !months) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return emi * months;
  return emi * (1 - Math.pow(1 + r, -months)) / r;
}
// All-in APR including processing fee amortised over tenure
function aprOf(principal, annualRatePct, months, pfPct) {
  const pf = principal * pfPct;
  const emi = emiOf(principal, annualRatePct, months);
  const net = principal - pf;                     // borrower actually gets this
  // Solve for rate where PV(emi) at unknown r = net (bisection)
  let lo = 0, hi = 100;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const pv = pvOfEmi(emi, mid, months);
    if (pv > net) lo = mid; else hi = mid;
  }
  return round1((lo + hi) / 2);
}

// ─── Utilities ───────────────────────────────────────────────────────────────
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function round1(x) { return Math.round(x * 10) / 10; }
function roundK(x) {   // round to nearest ₹5,000
  if (x < 10_000) return Math.round(x / 1000) * 1000;
  return Math.round(x / 5000) * 5000;
}
function inr(x) {
  if (x == null || isNaN(x)) return "—";
  const n = Math.round(x);
  // Indian digit grouping
  const s = n.toString();
  if (s.length <= 3) return "₹" + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return "₹" + rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
}

// ─── Product routing ─────────────────────────────────────────────────────────
function routeProduct(state) {
  const { purpose, hasCollateral, collateralValue, amount } = state;
  const reasons = [];

  if (purpose === "vehicle_2w") {
    reasons.push("Two-wheeler purchase → dedicated two-wheeler loan is cheaper and hypothecates the vehicle.");
    return { product: "two_wheeler", reasons };
  }
  if (purpose === "home") {
    reasons.push("Home purchase → home loan (out of scope here; treated as LAP-like).");
    return { product: "lap", reasons };
  }
  if (purpose === "business" && hasCollateral && collateralValue >= amount * 1.5) {
    reasons.push(`Business purpose + collateral worth ${inr(collateralValue)} (≥1.5× ask) → LAP is 6–10 percentage points cheaper than an unsecured business loan.`);
    return { product: "lap", reasons };
  }
  if (purpose === "business") {
    reasons.push("Business purpose, no adequate collateral → unsecured business loan.");
    return { product: "business_unsec", reasons };
  }
  if (hasCollateral && collateralValue >= amount * 1.5 && amount >= 3_00_000) {
    reasons.push(`Collateral available (${inr(collateralValue)}) and ask is large → LAP saves 4–8 percentage points vs. a personal loan.`);
    return { product: "lap", reasons };
  }
  reasons.push("Consumption / non-collateralised purpose → personal loan.");
  return { product: "personal", reasons };
}
const WHY_ROUTING = "Product routing precedes pricing. A ₹15L business ask against a ₹45L shop must not be quoted as an unsecured personal loan at 20%. Collateral routes to LAP; vehicle purchases to hypothecation loans.";

// ─── The main compute ───────────────────────────────────────────────────────
function compute(state) {
  const why = [];   // trace: every rule that fired
  const conf = confidenceMeta(state);

  // 1. Route to product
  const { product, reasons: routeReasons } = routeProduct(state);
  routeReasons.forEach(r => why.push({ tag: "route", text: r }));

  // 2. Rate band
  const [rLo, rHi] = rateBandForProfile(product, state);
  // Widen by confidence
  const rMid = (rLo + rHi) / 2;
  const rHalf = (rHi - rLo) / 2 + rMid * conf.bandMult * 0.15;
  const rateBand = [round1(Math.max(PRODUCTS[product].rateFloor, rMid - rHalf)),
                    round1(Math.min(PRODUCTS[product].rateCeil, rMid + rHalf))];
  why.push({ tag: "rate", text: `Base band ${rLo}–${rHi}% for ${PRODUCTS[product].label.toLowerCase()} at this profile; widened for ${conf.label.toLowerCase()} confidence.` });

  // 3. Underwritable income (haircut applied)
  const rawIncome = state.income || 0;
  const haircut = INCOME_HAIRCUT[state.incomeType] || 0.7;
  let underwritable = rawIncome * haircut;

  // ITR cap for self-employed-ITR: sanction ≤ 3.5× declared annual
  const itrCapAnnual = state.incomeType === "se_itr" && state.itrAnnual
    ? state.itrAnnual * 3.5 : null;

  // Co-applicant income
  if (state.coApplicantIncome > 0) {
    underwritable += state.coApplicantIncome * 0.9;  // 10% haircut
    why.push({ tag: "income", text: `Co-applicant adds ${inr(state.coApplicantIncome * 0.9)} of underwritable income (10% haircut).` });
  }
  if (haircut < 1) {
    why.push({ tag: "income", text: `Stated income ${inr(rawIncome)} discounted ${Math.round((1-haircut)*100)}% to ${inr(rawIncome * haircut)} because it is ${state.incomeType === "se_cash" ? "cash / undeclared" : "gig-platform variable"}.` });
  }

  // 4. FOIR-based lender EMI
  const foirTable = FOIR[state.incomeType] || FOIR.informal;
  const foirCap = foirTable.find(b => underwritable <= b.upto).cap;
  const existingEmi = state.existingEmi || 0;
  const lenderMaxEmi = Math.max(0, underwritable * foirCap - existingEmi);
  why.push({ tag: "eligibility", text: `Lender FOIR cap ${Math.round(foirCap*100)}% × underwritable income ${inr(underwritable)} = ${inr(underwritable*foirCap)}. Existing EMIs ${inr(existingEmi)} deducted → lender allows up to ${inr(lenderMaxEmi)}/month.` });

  // 5. Safe carrying (borrower side)
  const disposable = rawIncome - (state.expenses || 0) - existingEmi;
  let safeEmi = Math.max(0, disposable * 0.50);   // never commit >50% of disposable
  const safeReasons = [`Disposable after rent/expenses/EMIs = ${inr(disposable)}; safe rule of thumb caps new EMI at 50% of disposable = ${inr(disposable*0.5)}.`];

  if (state.emergencyMonths != null && state.emergencyMonths < 3) {
    safeEmi *= 0.75;
    safeReasons.push(`Emergency savings <3 months → safe EMI reduced 25%.`);
  }
  if (state.incomeVariabilityPct != null && state.incomeVariabilityPct > 0.30) {
    safeEmi *= 0.85;
    safeReasons.push(`Income varies >30% month-to-month → safe EMI reduced 15%.`);
  }
  if (state.dependents >= 2 && state.soleEarner) {
    safeEmi *= 0.85;
    safeReasons.push(`Sole earner with dependents → safe EMI reduced 15%.`);
  }
  // Productive loans: 50% haircut on expected extra income boosts safe EMI
  if (state.productive === true && state.expectedExtraIncome > 0) {
    const boost = state.expectedExtraIncome * 0.5;
    safeEmi += boost;
    safeReasons.push(`Productive loan expected to add ${inr(state.expectedExtraIncome)}/month; 50% (${inr(boost)}) counted toward safe EMI.`);
  }
  safeReasons.forEach(r => why.push({ tag: "safe", text: r }));

  // 6. Sanction amount at midpoint rate & longest sensible tenure
  const tenures = PRODUCTS[product].tenureMonths;
  const midRate = (rateBand[0] + rateBand[1]) / 2;
  const preferredTenure = tenures[Math.floor(tenures.length / 2)];   // middle option
  let lenderMaxSanction = pvOfEmi(lenderMaxEmi, midRate, tenures[tenures.length - 1]);
  let safeSanction     = pvOfEmi(safeEmi,     midRate, preferredTenure);

  // ITR cap
  if (itrCapAnnual != null && lenderMaxSanction > itrCapAnnual) {
    lenderMaxSanction = itrCapAnnual;
    why.push({ tag: "eligibility", text: `Self-employed cap: sanction limited to 3.5× ITR-declared annual income = ${inr(itrCapAnnual)}.` });
  }

  // 7. All-in APR at midpoint rate
  const [pfLo, pfHi] = PRODUCTS[product].pfPct;
  const apr = aprOf(state.amount || safeSanction, midRate, preferredTenure, (pfLo+pfHi)/2);

  // 8. Verdict
  const verdict = decideVerdict(state, { safeEmi, lenderMaxEmi, safeSanction, lenderMaxSanction, disposable, product });
  verdict.reasons.forEach(r => why.push({ tag: "verdict", text: r }));

  // 9. Stress test
  const stressIncome = rawIncome * 0.80;
  const stressUnderwritable = stressIncome * haircut;
  const stressDisposable = stressIncome - (state.expenses||0) - existingEmi;
  const stressRate = midRate + 2.0;
  const askedEmi = emiOf(state.amount || safeSanction, midRate, preferredTenure);
  const stressEmi = emiOf(state.amount || safeSanction, stressRate, preferredTenure);
  const stressFoir = existingEmi && stressUnderwritable ? (existingEmi + stressEmi) / stressUnderwritable : null;

  return {
    product, productLabel: PRODUCTS[product].label,
    verdict,
    rateBand,
    apr,
    tenures,
    preferredTenure,
    lenderMaxEmi: roundK(lenderMaxEmi),
    safeEmi: roundK(safeEmi),
    lenderMaxSanction: roundK(lenderMaxSanction),
    safeSanction: roundK(safeSanction),
    askedEmi: roundK(askedEmi),
    stress: {
      income: roundK(stressIncome),
      disposable: roundK(stressDisposable),
      emi: roundK(stressEmi),
      rate: round1(stressRate),
      foir: stressFoir ? Math.round(stressFoir*100) : null,
      breaches: stressDisposable < stressEmi,
    },
    confidence: conf,
    why,
    pf: [pfLo, pfHi],
  };
}

function decideVerdict(state, m) {
  const reasons = [];
  const requested = state.amount || 0;

  // Hard "don't" — check the diagnostic (debt-trap) scenario first, so we lead
  // with the reason that most helps the borrower understand what to do next.
  if (state.bouncesLast12 >= 1 && state.existingHighCostLoans && state.emergencyMonths != null && state.emergencyMonths < 1) {
    reasons.push(`Recent EMI bounce + high-cost app loans outstanding + under a month of emergency savings. A new formal loan compounds the trap — the priority is to consolidate existing dues (or seek non-loan help: employer advance, community credit, government scheme) before adding any new EMI.`);
    reasons.push(`If a scooter is essential for income, look at leasing / EMI-on-vehicle-price schemes from the platform (Ola, Zomato, Rapido offer these) — the vehicle stays with them, monthly outflow is lower, and there is no debt on your file.`);
    return { code: "dont", label: "Don't borrow this way", reasons };
  }
  if (m.disposable <= 0) {
    reasons.push(`Income minus expenses and existing EMIs is ${inr(m.disposable)}. There is no room for a new EMI without cutting elsewhere first.`);
    return { code: "dont", label: "Don't borrow", reasons };
  }
  if (m.safeEmi < 1000) {
    reasons.push(`Safe carrying capacity is under ${inr(1000)}/month. Any formal loan will push you into stress within a bad month or two.`);
    return { code: "dont", label: "Don't borrow", reasons };
  }
  if (state.purpose === "consumption" && m.safeSanction < requested * 0.5) {
    reasons.push(`This is a consumption loan and the safe amount you can carry (${inr(m.safeSanction)}) is less than half of what you want. Postpone or downsize.`);
    return { code: "dont", label: "Don't borrow", reasons };
  }

  // Borrow less
  if (requested > m.safeSanction * 1.05 && requested <= m.lenderMaxSanction * 1.05) {
    reasons.push(`A lender will likely sanction up to ${inr(m.lenderMaxSanction)}, but you can only safely carry ${inr(m.safeSanction)}. Take the smaller number.`);
    return { code: "less", label: "Borrow less", reasons };
  }
  if (requested > m.lenderMaxSanction * 1.05) {
    reasons.push(`Your ask (${inr(requested)}) is above what a lender will sanction (${inr(m.lenderMaxSanction)}) AND above what you can safely carry (${inr(m.safeSanction)}). Reduce the ask, add a co-applicant, or use collateral.`);
    return { code: "less", label: "Borrow less", reasons };
  }

  // Green light
  reasons.push(`Ask of ${inr(requested)} is within both the lender's likely sanction (${inr(m.lenderMaxSanction)}) and your safe carrying capacity (${inr(m.safeSanction)}).`);
  return { code: "go", label: "You can borrow", reasons };
}

// Expose to browser
window.BC = {
  compute, emiOf, pvOfEmi, aprOf, inr, PRODUCTS, FOIR, INCOME_HAIRCUT,
  WHY_FOIR, WHY_HAIRCUT, WHY_PRODUCTS, WHY_RATE, WHY_CONFIDENCE, WHY_ROUTING,
};
