/* Borrower Copilot — UI controller. Rules live in rules.js / questions.js */

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

// ─── State ───────────────────────────────────────────────────────────────
let state = {};                 // borrower answers
let answered = new Set();       // question ids answered (including "skip"/"idk")
let currentQ = null;

// Personas — pre-computed answer bundles
const PERSONAS = {
  priya: {
    _label: "Priya, 29 · Bengaluru salaried",
    purpose: "wedding", amount: 8_00_000,
    incomeType: "salaried", income: 1_10_000,
    existingEmi: 14_000, expenses: 28_000, age: 29,
    scoreState: "known", score: 780,
    employerTier: "mnc_large", tenureYears: 5,
    utilization: 0.25, bouncesLast12: 0, emergencyMonths: 6,
    existingHighCostLoans: false, hasCollateral: false,
    coApplicantIncome: 0, dependents: 0, productive: false,
    incomeVariabilityPct: 0,
  },
  ravi: {
    _label: "Ravi, 42 · Mysuru self-employed",
    purpose: "business", amount: 15_00_000,
    incomeType: "se_itr", income: 60_000,           // mid of 40-80k, treated as mostly cash but ITR exists
    itrAnnual: 4_20_000, itrYears: 8,
    existingEmi: 0, expenses: 35_000, age: 42,
    scoreState: "no_score",
    incomeVariabilityPct: 0.35,
    bouncesLast12: 0, emergencyMonths: 4,
    existingHighCostLoans: false,
    hasCollateral: true, collateralValue: 45_00_000,
    coApplicantIncome: 18_000, dependents: 2, soleEarner: false,
    productive: true, expectedExtraIncome: 15_000,
  },
  anita: {
    _label: "Anita, 35 · Hubballi informal",
    purpose: "vehicle_2w", amount: 1_50_000,
    incomeType: "informal", income: 28_000,
    existingEmi: 4_500, expenses: 22_000, age: 35,
    scoreState: "unknown",
    incomeVariabilityPct: 0.4, utilization: null,
    bouncesLast12: 1, emergencyMonths: 0,
    existingHighCostLoans: true,
    hasCollateral: false, coApplicantIncome: 0,
    dependents: 3, soleEarner: true,
    productive: true, expectedExtraIncome: 6_000,
  },
};

const PERSONA_META = {
  priya: {
    avatarBg: "linear-gradient(135deg, #7C3AED, #4F46E5)",
    initial: "P",
    tag: "Salaried · Tech",
    tagBg: "rgba(124, 58, 237, 0.12)",
    tagColor: "#6D28D9",
  },
  ravi: {
    avatarBg: "linear-gradient(135deg, #059669, #10B981)",
    initial: "R",
    tag: "Self-Employed · ITR",
    tagBg: "rgba(5, 150, 105, 0.12)",
    tagColor: "#047857",
  },
  anita: {
    avatarBg: "linear-gradient(135deg, #D97706, #F59E0B)",
    initial: "A",
    tag: "Informal · Micro",
    tagBg: "rgba(217, 119, 6, 0.12)",
    tagColor: "#B45309",
  }
};

// ─── Persistence ─────────────────────────────────────────────────────────
const LS_KEY = "bc.session.v1";
function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ state, answered: [...answered] })); }
  catch(e){}
}
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const p = JSON.parse(raw);
    state = p.state || {}; answered = new Set(p.answered || []);
    recomputeWeight();
    return Object.keys(state).length > 0;
  } catch(e) { return false; }
}
function clearSession() {
  state = {}; answered = new Set();
  localStorage.removeItem(LS_KEY);
}

function recomputeWeight() {
  // Only ACTUAL answers credit confidence — skipped questions don't count.
  let w = 0;
  BC_Q.QUESTIONS.forEach(q => {
    if (!answered.has(q.id)) return;
    const v = state[q.id];
    const has = (q.kind === "bool") ? typeof v === "boolean"
              : (q.kind === "choice") ? typeof v === "string"
              : (v != null && !isNaN(v));
    if (has) w += (q.weight || 0);
  });
  state._answeredWeight = w;
}

// ─── Screen routing ──────────────────────────────────────────────────────
function show(name) {
  $$(".screen").forEach(s => s.classList.remove("active"));
  $("#screen-" + name)?.classList.add("active");
  window.scrollTo(0, 0);
}

// ─── Landing ─────────────────────────────────────────────────────────────
function renderLanding() {
  $("#landing-personas").innerHTML = Object.entries(PERSONAS).map(([k, p]) => {
    const meta = PERSONA_META[k] || { avatarBg: "var(--brand-gradient)", initial: k[0].toUpperCase(), tag: "Borrower", tagBg: "var(--accent-soft)", tagColor: "var(--brand-purple)" };
    const parts = p._label.split(" · ");
    const nameAge = parts[0];
    const role = parts[1] || "";
    return `
      <button class="persona-btn" data-persona="${k}">
        <div class="persona-avatar" style="background: ${meta.avatarBg}">${meta.initial}</div>
        <div>
          <div>
            <span class="who">${nameAge}</span>
            <span class="where-tag" style="background:${meta.tagBg};color:${meta.tagColor}">${meta.tag}</span>
          </div>
          <div class="where">${role}</div>
        </div>
        <span class="go">Load <span class="arrow">→</span></span>
        <div class="ask">Wants <b>${BC.inr(p.amount)}</b> for ${labelPurpose(p.purpose)}</div>
      </button>
    `;
  }).join("");

  $$("[data-persona]").forEach(b => b.addEventListener("click", () => {
    const p = PERSONAS[b.dataset.persona];
    // load all fields as answered
    state = {};
    answered = new Set();
    Object.entries(p).forEach(([k, v]) => {
      if (k.startsWith("_")) return;
      state[k] = v; answered.add(k);
    });
    recomputeWeight();
    save();
    renderResults();
    show("results");
  }));
}

function labelPurpose(p) {
  return ({
    wedding:"a wedding", medical:"a medical need", consumption:"household spending",
    education:"education", vehicle_2w:"a two-wheeler", vehicle_4w:"a car",
    home:"a home", business:"business expansion", refinance:"refinancing",
    other:"other purpose",
  })[p] || p;
}

// ─── Question flow ───────────────────────────────────────────────────────
function askNext() {
  const q = BC_Q.nextQuestion(state, answered);
  if (!q) { renderResults(); show("results"); return; }
  currentQ = q;
  renderQuestion(q);
  show("question");
}

function renderQuestion(q) {
  const total = BC_Q.QUESTIONS.length;
  const done = answered.size;
  const rem = BC_Q.remainingCount(state, answered);
  const pct = Math.min(100, Math.round((done / (done + rem)) * 100));
  const conf = confLabel();

  $("#q-progress-fill").style.width = pct + "%";
  $("#q-count").textContent = `Question ${done + 1} · ${conf.label} confidence`;
  $("#q-label").textContent = q.label;
  $("#q-help").textContent = q.help || "";
  $("#q-tightens").textContent = q.tightens ? `Tightens: ${q.tightens}` : "";
  $("#q-tightens").style.display = q.tightens ? "inline-flex" : "none";

  const fieldEl = $("#q-field");
  fieldEl.innerHTML = renderField(q);
  wireField(q);

  // Buttons
  $("#q-back").style.visibility = answered.size > 0 ? "visible" : "hidden";
  $("#q-skip").textContent = q.tier === "must" ? "I don't know" : "Skip";
  $("#q-next").disabled = !hasValue(q);
}

function renderField(q) {
  const cur = state[q.id];
  if (q.kind === "choice") {
    return `<div class="choices">${
      q.options.map(o => `
        <button class="choice ${cur === o.v ? "selected" : ""}" data-v="${o.v}">
          <span>${o.l}</span><span class="mark">${cur === o.v ? "✓" : ""}</span>
        </button>
      `).join("")
    }</div>`;
  }
  if (q.kind === "bool") {
    return `<div class="boolrow">
      <button class="choice ${cur === true ? "selected" : ""}" data-v="true"><span>Yes</span><span class="mark">${cur === true ? "✓" : ""}</span></button>
      <button class="choice ${cur === false ? "selected" : ""}" data-v="false"><span>No</span><span class="mark">${cur === false ? "✓" : ""}</span></button>
    </div>`;
  }
  if (q.kind === "inr") {
    return `<div class="prefix">
      <span>₹</span>
      <input type="number" inputmode="numeric" min="0" step="1000" placeholder="${q.placeholder||""}" value="${cur ?? ""}" />
    </div>${hintFor(q)}`;
  }
  if (q.kind === "pct") {
    const val = cur != null ? (cur <= 1 ? cur * 100 : cur) : "";
    return `<div class="suffix">
      <input type="number" inputmode="decimal" min="${q.min||0}" max="${q.max||100}" step="${q.step||1}" placeholder="${q.placeholder||""}" value="${val}" />
      <span>%</span>
    </div>${hintFor(q)}`;
  }
  // number
  return `<input type="number" inputmode="numeric" min="${q.min ?? 0}" max="${q.max ?? 9999}" step="${q.step||1}" placeholder="${q.placeholder||""}" value="${cur ?? ""}" />${hintFor(q)}`;
}

function hintFor(q) {
  return "";
}

function wireField(q) {
  const fieldEl = $("#q-field");
  if (q.kind === "choice") {
    fieldEl.querySelectorAll(".choice").forEach(b => {
      b.addEventListener("click", () => {
        state[q.id] = b.dataset.v;
        commitAndAdvance(q);
      });
    });
  } else if (q.kind === "bool") {
    fieldEl.querySelectorAll(".choice").forEach(b => {
      b.addEventListener("click", () => {
        state[q.id] = b.dataset.v === "true";
        commitAndAdvance(q);
      });
    });
  } else {
    const input = fieldEl.querySelector("input");
    if (!input) return;
    input.focus();
    input.addEventListener("input", () => {
      const v = input.value === "" ? undefined : Number(input.value);
      if (q.kind === "pct" && v != null) state[q.id] = v / 100;
      else state[q.id] = v;
      $("#q-next").disabled = state[q.id] == null || isNaN(state[q.id]);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !$("#q-next").disabled) {
        e.preventDefault();
        commitAndAdvance(q);
      }
    });
  }
}

function hasValue(q) {
  const v = state[q.id];
  if (q.kind === "choice") return typeof v === "string";
  if (q.kind === "bool") return typeof v === "boolean";
  return v != null && !isNaN(v);
}

function commitAndAdvance(q) {
  answered.add(q.id);
  recomputeWeight();
  save();
  askNext();
}

function skipCurrent() {
  const q = currentQ;
  if (!q) return;
  // don't set a value; just mark answered so we don't re-ask
  answered.add(q.id);
  recomputeWeight();
  save();
  askNext();
}

function goBack() {
  // pop last answered
  const arr = [...answered];
  if (!arr.length) return;
  const last = arr[arr.length - 1];
  answered.delete(last);
  // keep the value in state so the field shows what they had
  recomputeWeight();
  save();
  currentQ = BC_Q.QUESTIONS.find(q => q.id === last);
  renderQuestion(currentQ);
  show("question");
}

function confLabel() {
  const cov = (state._answeredWeight||0) / (BC_Q.QUESTION_WEIGHTS_TOTAL || 1);
  if (cov < 0.35) return { label: "Low", cov };
  if (cov < 0.70) return { label: "Medium", cov };
  return { label: "High", cov };
}

// ─── Results ─────────────────────────────────────────────────────────────
function renderResults() {
  const r = BC.compute(state);
  const c = confLabel();
  const confCls = c.label.toLowerCase();

  // Verdict
  const verdictBadges = {
    go: { icon: "✓", tag: "Go Ahead · Safe to Borrow" },
    less: { icon: "⚠️", tag: "Borrow Less · Trim Sanction" },
    dont: { icon: "🛑", tag: "Warning · Do Not Borrow" }
  };
  const vMeta = verdictBadges[r.verdict.code] || { icon: "⚖️", tag: "Verdict" };

  const vBox = $("#r-verdict");
  vBox.className = "verdict " + r.verdict.code;
  vBox.innerHTML = `
    <div class="label-row">
      <span class="badge-tag">${vMeta.icon} ${vMeta.tag}</span>
    </div>
    <h2 class="headline">${r.verdict.label}.</h2>
    ${r.verdict.reasons.map(x => `<p class="why">${x}</p>`).join("")}
  `;

  // O2 — Max amount
  const askedOverSafe = (state.amount || 0) > r.safeSanction * 1.05;
  const askedOverLender = (state.amount || 0) > r.lenderMaxSanction * 1.05;
  $("#r-max").innerHTML = `
    <div class="tag">💰 O2 — Maximum Amount</div>
    <div class="head">
      <h2>What you can borrow</h2>
      <span class="conf ${confCls}"><span class="dot"></span>${c.label} Confidence</span>
    </div>
    <div class="twonum">
      <div class="numblock">
        <div class="cap">Lender will likely sanction up to</div>
        <div class="val">${BC.inr(r.lenderMaxSanction)}</div>
        <div class="sub">at ${r.rateBand[0]}–${r.rateBand[1]}% over ${r.tenures[r.tenures.length-1]} months</div>
      </div>
      <div class="numblock take-this">
        <div class="cap">✓ You can safely carry</div>
        <div class="val">${BC.inr(r.safeSanction)}</div>
        <div class="sub">Use this safe number, not the lender's limit</div>
      </div>
    </div>
    <button class="why-toggle" data-toggle="why-max">Why these numbers →</button>
    <div class="why-list" id="why-max" style="display:none">
      <ul>${r.why.filter(w => ["route","income","eligibility","safe"].includes(w.tag)).map(w => `<li>${w.text}</li>`).join("")}</ul>
    </div>
  `;

  // O3 — Rate band
  const pfLo = (r.pf[0]*100).toFixed(1), pfHi = (r.pf[1]*100).toFixed(1);
  $("#r-rate").innerHTML = `
    <div class="tag">📈 O3 — Fair Interest Rate</div>
    <div class="head">
      <h2>Fair rate for your profile</h2>
      <span class="conf ${confCls}"><span class="dot"></span>${c.label} Confidence</span>
    </div>
    <div class="rate-band">
      <span class="lo">${r.rateBand[0]}</span>
      <span class="to">–</span>
      <span class="hi">${r.rateBand[1]}</span>
      <span class="pct">%</span>
    </div>
    <p style="color:var(--text-muted);font-size:.92rem;margin:0 0 .4rem">Annual reducing balance, before processing fee.</p>
    <div class="apr-line">All-in APR (mid rate + ~${((r.pf[0]+r.pf[1])/2*100).toFixed(1)}% processing fee, amortised over ${r.preferredTenure}mo): <b>~${r.apr}%</b></div>
    <p style="color:var(--text-muted);font-size:.85rem;margin-top:.6rem">Processing fee typically ${pfLo}–${pfHi}% for ${r.productLabel.toLowerCase()}. Ask the lender to <b>quote APR including fee</b>, not just headline rate.</p>
    <button class="why-toggle" data-toggle="why-rate">Why this band →</button>
    <div class="why-list" id="why-rate" style="display:none">
      <ul>${r.why.filter(w => ["rate","route"].includes(w.tag)).map(w => `<li>${w.text}</li>`).join("")}</ul>
    </div>
  `;

  // O4 — EMI ceiling + tenures
  const midRate = (r.rateBand[0] + r.rateBand[1]) / 2;
  const askAmt = state.amount || r.safeSanction;
  const tenureOpts = r.tenures.map(m => {
    const e = BC.emiOf(askAmt, midRate, m);
    return `<div class="t ${m === r.preferredTenure ? "pref" : ""}">
      <div class="m">${m} mo</div>
      <div class="e">${BC.inr(e)}</div>
    </div>`;
  }).join("");
  const stressCls = r.stress.breaches ? "" : "ok";
  const stressLine = r.stress.breaches
    ? `If your income drops 20% (to <span class="num">${BC.inr(r.stress.income)}</span>) AND rate rises 2 points (to <span class="num">${r.stress.rate}%</span>), the EMI <span class="num">${BC.inr(r.stress.emi)}</span> exceeds your disposable income. <b>You would default.</b>`
    : `Even if income drops 20% (to <span class="num">${BC.inr(r.stress.income)}</span>) AND rate rises 2 points (to <span class="num">${r.stress.rate}%</span>), you can still absorb the new EMI of <span class="num">${BC.inr(r.stress.emi)}</span>.`;
  $("#r-emi").innerHTML = `
    <div class="tag">🛡️ O4 — EMI Ceiling</div>
    <div class="head">
      <h2>Monthly EMI to agree to</h2>
      <span class="conf ${confCls}"><span class="dot"></span>${c.label} Confidence</span>
    </div>
    <div class="twonum">
      <div class="numblock take-this">
        <div class="cap">✓ Safe Monthly Ceiling</div>
        <div class="val">${BC.inr(r.safeEmi)}</div>
        <div class="sub">50% of your disposable income, adjusted for savings & variability</div>
      </div>
      <div class="numblock">
        <div class="cap">Lender FOIR cap allows</div>
        <div class="val">${BC.inr(r.lenderMaxEmi)}</div>
        <div class="sub">Don't accept it just because they offer it</div>
      </div>
    </div>
    <p style="font-size:.9rem;color:var(--text-muted);margin:.85rem 0 .4rem">Estimated EMI at ${round1(midRate)}% for ${BC.inr(askAmt)}, across tenures:</p>
    <div class="tenure-grid">${tenureOpts}</div>
    <div class="stress ${stressCls}">
      <div class="cap">Real-world Stress Test</div>
      <div class="txt">${stressLine}</div>
    </div>
    <button class="why-toggle" data-toggle="why-emi">Why this ceiling →</button>
    <div class="why-list" id="why-emi" style="display:none">
      <ul>${r.why.filter(w => ["safe","eligibility"].includes(w.tag)).map(w => `<li>${w.text}</li>`).join("")}</ul>
    </div>
  `;

  // Rule trace
  $("#r-trace").innerHTML = `
    <summary>See every rule that fired for you (${r.why.length} rules)</summary>
    <ol>${r.why.map(w => `<li><span class="tag">${w.tag}</span>${w.text}</li>`).join("")}</ol>
  `;

  // Bind "why" toggles
  $$("[data-toggle]").forEach(b => b.addEventListener("click", () => {
    const el = $("#" + b.dataset.toggle);
    const open = el.style.display !== "none";
    el.style.display = open ? "none" : "block";
    b.textContent = open ? b.textContent.replace("↓", "→") : b.textContent.replace("→", "↓");
  }));

  // Store result for negotiation card
  window._lastResult = r;
}

function round1(x) { return Math.round(x * 10) / 10; }

// ─── Negotiation card ────────────────────────────────────────────────────
function renderCard() {
  const r = window._lastResult || BC.compute(state);
  const c = confLabel();
  const date = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
  const midRate = (r.rateBand[0] + r.rateBand[1]) / 2;
  const askAmt = Math.min(state.amount || r.safeSanction, r.safeSanction);
  const emiAtSafe = BC.emiOf(askAmt, midRate, r.preferredTenure);

  const profile = describeProfile(state);
  const quoteLine = (state.lenderQuoteRate && state.lenderQuoteRate > 0)
    ? `<div class="quote-gap">Lender quoted <b>${state.lenderQuoteRate}%</b>. Fair band for your profile is <b>${r.rateBand[0]}–${r.rateBand[1]}%</b>. That is <b>${round1(state.lenderQuoteRate - r.rateBand[1])} percentage points above fair</b> — worth ~${BC.inr(overpayOver(askAmt, state.lenderQuoteRate, r.rateBand[1], r.preferredTenure))} across the life of the loan.</div>`
    : "";

  $("#negcard").innerHTML = `
    <header>
      <div class="brand">Borrower <em style="font-family:var(--display);font-style:italic;background:var(--brand-gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Copilot</em></div>
      <div class="date">${date}</div>
    </header>
    <h2>My Negotiating Position</h2>
    <p class="profile">${profile}</p>

    <div class="row"><div class="k">Product</div><div class="v"><b>${r.productLabel}</b><span class="small">${r.why.find(w=>w.tag==="route")?.text || ""}</span></div></div>
    <div class="row"><div class="k">Amount</div><div class="v"><b>${BC.inr(askAmt)}</b><span class="small">${(state.amount||0) > askAmt ? `I originally wanted ${BC.inr(state.amount)}, but ${BC.inr(askAmt)} is what I can safely service.` : "This is within both lender eligibility and my safe carrying capacity."}</span></div></div>
    <div class="row"><div class="k">Fair rate</div><div class="v"><b>${r.rateBand[0]}–${r.rateBand[1]}%</b> (reducing)<span class="small">All-in APR incl. processing fee: <b style="color:var(--brand-purple)">~${r.apr}%</b>. Quote me APR, not headline.</span></div></div>
    <div class="row"><div class="k">Tenure</div><div class="v"><b>${r.preferredTenure} months</b><span class="small">Longer tenure = lower EMI but more interest. I want the shortest I can carry.</span></div></div>
    <div class="row"><div class="k">EMI ceiling</div><div class="v"><b>${BC.inr(emiAtSafe)}/month</b> at mid-rate<span class="small">I will not agree to an EMI above ${BC.inr(r.safeEmi)}/month regardless of what the lender approves.</span></div></div>
    <div class="row"><div class="k">Processing fee</div><div class="v"><b>${(r.pf[0]*100).toFixed(1)}–${(r.pf[1]*100).toFixed(1)}%</b><span class="small">Negotiable. Ask for it to be waived or capped, especially if you accept the lender's insurance.</span></div></div>
    <div class="row"><div class="k">Confidence</div><div class="v"><b>${c.label}</b><span class="small">${c.label === "Low" ? "Some inputs were skipped. Rates may move ±1% either way as I share documents." : c.label === "Medium" ? "Most inputs verified. Bands should hold within ±0.5%." : "Full profile shared. Bands are tight."}</span></div></div>

    ${quoteLine}

    <ul class="ask-list">
      <li><b>Ask 1:</b> Quote me the all-in APR including processing fee and any insurance, not just the reducing-balance rate.</li>
      <li><b>Ask 2:</b> Waive or cap processing fee at 1%.</li>
      <li><b>Ask 3:</b> No pre-payment penalty on floating-rate loans (RBI rule for individuals).</li>
      <li><b>Ask 4:</b> Confirm my EMI stays at or below ${BC.inr(emiAtSafe)}/month at the offered rate & tenure.</li>
    </ul>

    <footer>Generated by Borrower Copilot. Every number above is traceable to my verified self-assessment.</footer>
  `;
}

function describeProfile(s) {
  const bits = [];
  if (s.age) bits.push(`${s.age} years old`);
  const inc = ({ salaried:"salaried", se_itr:"self-employed with ITR", se_cash:"self-employed (cash)", informal:"gig / informal income" })[s.incomeType];
  if (inc) bits.push(inc);
  if (s.income) bits.push(`~${BC.inr(s.income)}/month net`);
  if (s.scoreState === "known") bits.push(`credit score ${s.score}`);
  else if (s.scoreState === "no_score") bits.push("no formal credit history");
  else if (s.scoreState === "unknown") bits.push("score unknown");
  if (s.existingEmi > 0) bits.push(`existing EMIs ${BC.inr(s.existingEmi)}/mo`);
  if (s.hasCollateral && s.collateralValue) bits.push(`collateral ${BC.inr(s.collateralValue)}`);
  return bits.join(" · ");
}

function overpayOver(principal, rateHigh, rateLow, months) {
  const eHigh = BC.emiOf(principal, rateHigh, months);
  const eLow  = BC.emiOf(principal, rateLow,  months);
  return (eHigh - eLow) * months;
}

// ─── Init ────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderLanding();

  // Top nav
  $("#nav-restart").addEventListener("click", (e) => { e.preventDefault(); clearSession(); show("landing"); });
  $$("[data-goto]").forEach(b => b.addEventListener("click", (e) => {
    e.preventDefault();
    const t = b.dataset.goto;
    if (t === "start") { clearSession(); askNext(); }
    else if (t === "results") { renderResults(); show("results"); }
    else if (t === "card") { renderCard(); show("card"); }
    else if (t === "landing") { show("landing"); }
  }));

  $("#q-back").addEventListener("click", goBack);
  $("#q-skip").addEventListener("click", skipCurrent);
  $("#q-next").addEventListener("click", () => commitAndAdvance(currentQ));

  $("#r-to-card").addEventListener("click", () => { renderCard(); show("card"); });
  $("#r-restart").addEventListener("click", () => { clearSession(); show("landing"); });
  $("#r-more-qs").addEventListener("click", () => { askNext(); });

  $$("#card-back, #card-back-btn").forEach(b => b.addEventListener("click", () => show("results")));
  $("#card-print").addEventListener("click", () => window.print());

  // Restore session
  if (load() && answered.size > 0) {
    // keep state available
  }

  show("landing");
});
