const API_URL = "https://backend.impactacademy.site";

/* =========================
   AUTHENTICATE USER
========================= */

async function AuthenticateUser() {
  try {
    const response = await fetch(`${API_URL}/api/auth/validate-session`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      localStorage.removeItem("impactech_user");
      localStorage.removeItem("impactech_token");
      return { success: false, user: null };
    }

    if (data.user) {
      localStorage.setItem("impactech_user", JSON.stringify(data.user));
    }

    return { success: true, user: data.user };

  } catch (error) {
    console.error("AuthenticateUser error:", error);
    return { success: false, user: null };
  }
}

/* =========================
   PAGE LOAD
========================= */

document.addEventListener("DOMContentLoaded", async function () {
  const auth = await AuthenticateUser();

  if (!auth.success) {
    window.location.href = "../../signin";
    return;
  }

  console.log("Authenticated user:", auth.user);
  initEarningsPage(auth.user);
});

/* =========================
   INIT
========================= */

function initEarningsPage(user) {
  /* Show profile image if available, otherwise show first name letter */
  const profileEl = document.getElementById("profileInitial");
  if (profileEl) {
    const imgSrc = user?.profileImage || user?.photoURL || user?.avatar || null;
    const initial = (user?.fullname || user?.firstName || "U").charAt(0).toUpperCase();

    if (imgSrc) {
      profileEl.classList.add("has-image");
      profileEl.innerHTML = `<img
        src="${imgSrc}"
        alt="${initial}"
        onerror="this.parentElement.classList.remove('has-image');this.parentElement.innerHTML='<span>${initial}</span>';"
      />`;
    } else {
      profileEl.innerHTML = `<span>${initial}</span>`;
    }
  }

  /* Apply loading skeletons before data arrives */
  initSkeletons();

  /* Fire all data fetches in parallel */
  Promise.all([
    fetchSummary(),
    fetchStats(),
    fetchChart("6m"),
    fetchTransactions(),
    fetchPaymentMethods()
  ]).then(() => {
    /* Pre-load other chart periods in background */
    fetchChart("3m");
    fetchChart("12m");
  });
}

/* =========================
   STATE
========================= */

const earningsData = {
  totalEarned:      null,
  pending:          null,
  thisMonth:        null,
  withdrawn:        null,
  availableBalance: null,
  nextPayoutDate:   null,

  contractsDone: null,
  avgRating:     null,
  avgPayPerJob:  null,
  platformFee:   null,
  totalPayouts:  null,

  goalCurrent: null,
  goalTarget:  null,

  chart: {
    "6m":  { income: [], contracts: [], payouts: [], labels: [] },
    "12m": { income: [], contracts: [], payouts: [], labels: [] },
    "3m":  { income: [], contracts: [], payouts: [], labels: [] }
  },

  transactions:   [],
  paymentMethods: []
};

/* =========================
   HELPERS
========================= */

function fmt(val) {
  if (val === null || val === undefined) return "—";
  return "$" + Number(val).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove("skeleton");
    el.textContent = val;
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

async function apiFetch(path, opts) {
  opts = opts || {};
  const res = await fetch(API_URL + path, {
    credentials: "include",
    headers: Object.assign({ "Content-Type": "application/json" }, opts.headers || {}),
    method: opts.method || "GET",
    body: opts.body || undefined
  });
  return res.json();
}

/* =========================
   SKELETON INIT
========================= */

function initSkeletons() {
  /* Hero stat values */
  ["statTotalEarned", "statPending", "statThisMonth", "statWithdrawn"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.classList.add("skeleton"); el.textContent = "$0,000"; }
  });

  /* Balance */
  var balEl = document.getElementById("availableBalance");
  if (balEl) { balEl.classList.add("skeleton"); balEl.textContent = "$0,000"; }
  var drawerBal = document.getElementById("drawerAvailableAmt");
  if (drawerBal) { drawerBal.classList.add("skeleton"); drawerBal.textContent = "$0,000"; }
  var ndEl = document.getElementById("nextPayoutDate");
  if (ndEl) { ndEl.classList.add("skeleton"); ndEl.textContent = "Next payout: —"; }

  /* Quick stats */
  ["statContracts", "statRating", "statAvgPay", "statFee", "statTotalPayouts"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.classList.add("skeleton"); el.textContent = "—"; }
  });

  /* Goal */
  var goalLabel = document.getElementById("goalProgressLabel");
  if (goalLabel) { goalLabel.classList.add("skeleton"); goalLabel.textContent = "$0 / $0"; }
  var goalPctEl = document.getElementById("goalPct");
  if (goalPctEl) { goalPctEl.classList.add("skeleton"); goalPctEl.textContent = "0% reached"; }
  var goalBarEl = document.getElementById("goalBar");
  if (goalBarEl) { goalBarEl.classList.add("skeleton-bar-pulse"); goalBarEl.style.width = "45%"; }

  /* Chart summary */
  ["sumThisMonth", "sumAvgMonth", "sumBestMonth", "sumThisMonthTrend", "sumBestMonthLabel"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.classList.add("skeleton"); el.textContent = "$0,000"; }
  });

  /* Chart container — placeholder bars */
  var chartEl = document.getElementById("chartContainer");
  if (chartEl) {
    var heights = [38, 62, 48, 78, 55, 68];
    chartEl.innerHTML =
      "<div class=\"chart-skeleton\">" +
      heights.map(function (h, i) {
        return "<div class=\"chart-skeleton-bar\" style=\"height:" + h + "%;animation-delay:" + (i * 0.1) + "s\"></div>";
      }).join("") +
      "</div>";
  }

  /* Transaction list — placeholder rows */
  var txnEl = document.getElementById("txnList");
  if (txnEl) {
    var rows = "";
    for (var i = 0; i < 4; i++) {
      rows +=
        "<div class=\"txn-skeleton-row\">" +
          "<div class=\"txn-skeleton-avatar\"></div>" +
          "<div class=\"txn-skeleton-lines\">" +
            "<span class=\"skeleton-line title\"></span>" +
            "<span class=\"skeleton-line short\" style=\"margin-top:6px\"></span>" +
          "</div>" +
          "<div class=\"txn-skeleton-right\">" +
            "<span class=\"skeleton-line\" style=\"width:64px;height:18px\"></span>" +
            "<span class=\"skeleton-line short\" style=\"width:48px;margin-top:6px\"></span>" +
          "</div>" +
        "</div>";
    }
    txnEl.innerHTML = rows;
  }

  /* Payment methods — placeholder items */
  var pmEl = document.getElementById("paymentMethodsList");
  if (pmEl) {
    var pmRows = "";
    for (var j = 0; j < 2; j++) {
      pmRows +=
        "<div class=\"pm-skeleton\">" +
          "<div class=\"pm-skeleton-icon\"></div>" +
          "<div style=\"flex:1;display:flex;flex-direction:column;gap:8px\">" +
            "<span class=\"skeleton-line medium\"></span>" +
            "<span class=\"skeleton-line short\"></span>" +
          "</div>" +
        "</div>";
    }
    pmEl.innerHTML = pmRows;
  }
}

/* =========================
   RENDER: HERO STATS
========================= */

function renderHeroStats() {
  setText("statTotalEarned", fmt(earningsData.totalEarned));
  setText("statPending",     fmt(earningsData.pending));
  setText("statThisMonth",   fmt(earningsData.thisMonth));
  setText("statWithdrawn",   fmt(earningsData.withdrawn));
}

/* =========================
   RENDER: BALANCE
========================= */

function renderBalance() {
  setText("availableBalance",   fmt(earningsData.availableBalance));
  setText("drawerAvailableAmt", fmt(earningsData.availableBalance));

  const nd = earningsData.nextPayoutDate;
  setText("nextPayoutDate", nd ? "Next payout: " + nd : "—");

  /* Quick amount buttons */
  const balance = earningsData.availableBalance;
  const wrap    = document.getElementById("quickAmounts");
  if (!wrap) return;

  if (!balance || balance <= 0) {
    wrap.innerHTML = "";
    return;
  }

  const presets = [25, 50, 100, 250].filter(function (v) { return v < balance; });
  const btns = presets.map(function (v) {
    return `<button class="quick-amount-btn" onclick="setPayoutAmount(${v})">$${v}</button>`;
  }).join("");

  wrap.innerHTML = btns +
    `<button class="quick-amount-btn" onclick="setPayoutAmount(${balance})">Max</button>`;
}

function setPayoutAmount(v) {
  var inp = document.getElementById("payoutAmount");
  if (inp) inp.value = v;
  updateSummary(v);
}

/* =========================
   RENDER: QUICK STATS
========================= */

function renderQuickStats() {
  setText("statContracts",    earningsData.contractsDone  !== null ? earningsData.contractsDone    : "—");
  setText("statRating",       earningsData.avgRating      !== null ? earningsData.avgRating + " ★"  : "—");
  setText("statAvgPay",       fmt(earningsData.avgPayPerJob));
  setText("statFee",          earningsData.platformFee    !== null ? earningsData.platformFee + "%" : "—");
  setText("statTotalPayouts", earningsData.totalPayouts   !== null ? earningsData.totalPayouts      : "—");

  var feeEl    = document.getElementById("statFee");
  var ratingEl = document.getElementById("statRating");
  if (feeEl    && earningsData.platformFee !== null) feeEl.style.color    = "#dc2626";
  if (ratingEl && earningsData.avgRating   !== null) ratingEl.style.color = "#f59e0b";
}

/* =========================
   RENDER: MONTHLY GOAL
========================= */

function renderGoal() {
  var cur = earningsData.goalCurrent;
  var tgt = earningsData.goalTarget;

  setText(
    "goalProgressLabel",
    cur !== null && tgt !== null ? fmt(cur) + " / " + fmt(tgt) : "— / —"
  );

  if (cur !== null && tgt !== null && tgt > 0) {
    var pct = Math.min(Math.round((cur / tgt) * 100), 100);
    setText("goalPct", pct + "% reached");

    setTimeout(function () {
      var bar = document.getElementById("goalBar");
      if (bar) {
        bar.classList.remove("skeleton-bar-pulse");
        bar.style.width = pct + "%";
      }
    }, 300);

    var badgeWrap = document.getElementById("goalBadges");
    if (!badgeWrap) return;

    if (pct >= 100) {
      badgeWrap.innerHTML =
        `<span class="earn-badge green"><i class="fa-solid fa-circle-check"></i> Goal Reached!</span>`;
    } else if (pct >= 50) {
      badgeWrap.innerHTML =
        `<span class="earn-badge gold"><i class="fa-solid fa-fire"></i> On Track</span>
         <span class="earn-badge blue"><i class="fa-solid fa-calendar"></i> Keep going</span>`;
    } else {
      badgeWrap.innerHTML =
        `<span class="earn-badge blue"><i class="fa-solid fa-calendar"></i> In Progress</span>`;
    }
  } else {
    setText("goalPct", "—");
  }
}

/* =========================
   RENDER: PAYMENT METHODS
========================= */

var METHOD_META = {
  paypal: { icon: "paypal", faClass: "fa-brands fa-paypal",          label: "PayPal" },
  bank:   { icon: "bank",   faClass: "fa-solid fa-building-columns", label: "Bank Transfer" },
  crypto: { icon: "crypto", faClass: "fa-brands fa-bitcoin",         label: "Crypto (USDT)" }
};

function renderPaymentMethods() {
  var list       = earningsData.paymentMethods;
  var listEl     = document.getElementById("paymentMethodsList");
  var drawerEl   = document.getElementById("drawerMethodsList");

  if (!list.length) {
    if (listEl)   listEl.innerHTML   =
      `<div style="padding:16px 0;color:var(--muted);font-size:13px;font-weight:800;text-align:center;">
         No payment methods added yet.
       </div>`;
    if (drawerEl) drawerEl.innerHTML =
      `<div style="padding:14px;background:var(--light);border-radius:14px;color:var(--muted);font-size:13px;font-weight:800;text-align:center;">
         No payment methods. Add one first.
       </div>`;
    return;
  }

  if (listEl) {
    listEl.innerHTML = list.map(function (m) {
      var meta = METHOD_META[m.type] || { icon: "bank", faClass: "fa-solid fa-credit-card", label: m.type };
      return `
        <div class="payment-method${m.isDefault ? " active" : ""}">
          <div class="pm-icon ${meta.icon}"><i class="${meta.faClass}"></i></div>
          <div class="pm-info">
            <strong>${meta.label}</strong>
            <small>${escHtml(m.detail || "—")}</small>
          </div>
          ${m.isDefault ? '<div class="pm-check"><i class="fa-solid fa-check"></i></div>' : ""}
        </div>`;
    }).join("");
  }

  if (drawerEl) {
    drawerEl.innerHTML = list.map(function (m, i) {
      var meta  = METHOD_META[m.type] || { icon: "bank", faClass: "fa-solid fa-credit-card", label: m.type };
      var color = m.type === "paypal" ? "#003087" : m.type === "bank" ? "#16a34a" : "#b45309";
      return `
        <label class="payout-method-option${i === 0 ? " selected" : ""}"
               onclick="selectDrawerMethod(this)">
          <input type="radio" name="payoutMethod" value="${escHtml(m.id)}" ${i === 0 ? "checked" : ""} />
          <i class="${meta.faClass} method-icon" style="color:${color};"></i>
          <div>
            <strong>${meta.label}</strong>
            <small>${escHtml(m.detail || "—")}</small>
          </div>
        </label>`;
    }).join("");
  }
}

function selectDrawerMethod(el) {
  document.querySelectorAll(".payout-method-option").forEach(function (o) {
    o.classList.remove("selected");
  });
  el.classList.add("selected");
}

/* =========================
   RENDER: CHART
========================= */

var activeChartTab = "income";

function setChartTab(btn, tab) {
  document.querySelectorAll(".chart-tab").forEach(function (b) {
    b.classList.remove("active");
  });
  btn.classList.add("active");
  activeChartTab = tab;
  renderChart(document.getElementById("chartPeriod").value);
}

function renderChart(period) {
  var container = document.getElementById("chartContainer");
  var dataset   = earningsData.chart[period];

  if (!dataset || !dataset.labels.length) {
    container.innerHTML =
      `<div class="chart-empty">
         <i class="fa-solid fa-chart-column"></i>
         <p>No earnings data available yet.</p>
       </div>`;
    setText("sumThisMonth",     "—");
    setText("sumAvgMonth",      "—");
    setText("sumBestMonth",     "—");
    setText("sumThisMonthTrend","—");
    setText("sumBestMonthLabel","—");
    return;
  }

  var values = dataset[activeChartTab] && dataset[activeChartTab].length
    ? dataset[activeChartTab]
    : dataset.income;
  var labels = dataset.labels;
  var max    = Math.max.apply(null, values.concat([1]));
  var maxIdx = values.indexOf(Math.max.apply(null, values));

  container.innerHTML =
    `<div class="chart-bars">` +
    values.map(function (v, i) {
      var pct  = (v / (max * 1.18)) * 100;
      var best = i === maxIdx;
      return `
        <div class="chart-bar-wrap">
          <div style="position:relative;width:100%;flex:1;display:flex;align-items:flex-end;">
            <div class="bar-tooltip">${fmt(v)}</div>
            <div class="chart-bar${best ? " highlight" : ""}"
                 style="width:100%;height:0%"
                 data-h="${pct.toFixed(1)}"></div>
          </div>
          <span class="chart-label">${labels[i]}</span>
        </div>`;
    }).join("") +
    `</div>`;

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      container.querySelectorAll(".chart-bar").forEach(function (b) {
        b.style.height = b.dataset.h + "%";
      });
    });
  });

  /* Summary row */
  var thisMonthVal = values[values.length - 1];
  var prevMonthVal = values[values.length - 2];
  var avg          = Math.round(values.reduce(function (a, b) { return a + b; }, 0) / values.length);
  var bestVal      = Math.max.apply(null, values);
  var bestLabel    = labels[values.indexOf(bestVal)];

  setText("sumThisMonth",     fmt(thisMonthVal));
  setText("sumAvgMonth",      fmt(avg));
  setText("sumBestMonth",     fmt(bestVal));
  setText("sumBestMonthLabel",bestLabel || "—");

  if (prevMonthVal != null && prevMonthVal > 0) {
    var diff    = Math.round(((thisMonthVal - prevMonthVal) / prevMonthVal) * 100);
    var trendEl = document.getElementById("sumThisMonthTrend");
    if (trendEl) {
      trendEl.className = diff >= 0 ? "trend-up" : "trend-neutral";
      trendEl.innerHTML =
        `<i class="fa-solid fa-arrow-trend-${diff >= 0 ? "up" : "down"}"></i> ` +
        (diff >= 0 ? "+" : "") + diff + "% vs last";
    }
  }
}

/* =========================
   RENDER: TRANSACTIONS
========================= */

var currentTxnFilter = "all";
var currentTxnSort   = "newest";

var TXN_ICON_MAP = {
  paid:    "fa-circle-check",
  pending: "fa-hourglass-half",
  bonus:   "fa-gift",
  payout:  "fa-arrow-up-from-bracket",
  refund:  "fa-rotate-left"
};

function filterTxn(btn, filter) {
  document.querySelectorAll(".txn-filter-btn").forEach(function (b) {
    b.classList.remove("active");
  });
  btn.classList.add("active");
  currentTxnFilter = filter;
  fetchTransactions();
}

function sortTxn(val) {
  currentTxnSort = val;
  fetchTransactions();
}

function renderTxns() {
  var container = document.getElementById("txnList");
  var list      = earningsData.transactions;

  if (!list.length) {
    container.innerHTML =
      `<div class="txn-empty">
         <div class="txn-empty-icon"><i class="fa-solid fa-receipt"></i></div>
         <h3>No transactions yet</h3>
         <p>Your payment history will appear here once you complete contracts and receive payouts.</p>
       </div>`;
    setText("txnSubtitle", "0 transactions");
    return;
  }

  setText("txnSubtitle", list.length + " transaction" + (list.length !== 1 ? "s" : ""));

  var STATUS_CLASS = { paid: "paid", pending: "pending", processing: "processing" };
  var STATUS_ICON  = { paid: "fa-check", pending: "fa-clock", processing: "fa-spinner fa-spin" };

  container.innerHTML = list.map(function (t, i) {
    return `
      <div class="txn-row" style="animation-delay:${i * 0.04}s">
        <div class="txn-icon ${t.iconType || "paid"}">
          <i class="fa-solid ${TXN_ICON_MAP[t.iconType] || "fa-dollar-sign"}"></i>
        </div>
        <div class="txn-info">
          <h4>${escHtml(t.label)}</h4>
          <p>
            <i class="fa-solid fa-${t.type === "debit" ? "arrow-up-from-bracket" : "user"}"></i>
            ${escHtml(t.client)}
            &nbsp;·&nbsp;
            <i class="fa-regular fa-calendar"></i>
            ${escHtml(t.dateLabel)}
          </p>
        </div>
        <div class="txn-right">
          <div class="txn-amount ${t.type}">
            ${t.type === "credit" ? "+" : "-"}${fmt(Math.abs(t.amountRaw))}
          </div>
          <div class="txn-status-badge ${STATUS_CLASS[t.status] || "paid"}">
            <i class="fa-solid ${STATUS_ICON[t.status] || "fa-check"}"></i>
            ${capitalize(t.status)}
          </div>
        </div>
      </div>`;
  }).join("");
}

/* =========================
   PAYOUT DRAWER
========================= */

var payoutModal  = null;
var payoutDrawer = null;

function openPayout() {
  if (!payoutModal || !payoutDrawer) return;
  payoutModal.classList.add("open");
  setTimeout(function () { payoutDrawer.classList.add("open"); }, 10);
  var inp = document.getElementById("payoutAmount");
  if (inp) inp.value = "";
  updateSummary(0);
}

function closePayout() {
  if (!payoutModal || !payoutDrawer) return;
  payoutDrawer.classList.remove("open");
  setTimeout(function () { payoutModal.classList.remove("open"); }, 350);
}

function updateSummary(v) {
  setText("summaryAmount",  v > 0 ? fmt(v) : "$0.00");
  setText("summaryReceive", v > 0 ? fmt(v) : "$0.00");
}

/* =========================
   TOAST
========================= */

function showToast(msg, type) {
  var t = document.createElement("div");
  t.className = "toast " + (type === "error" ? "error" : "success");
  t.innerHTML =
    `<i class="fa-solid fa-${type === "error" ? "circle-exclamation" : "circle-check"}"></i> ${msg}`;
  document.body.appendChild(t);
  setTimeout(function () {
    t.style.opacity = "0";
    setTimeout(function () { t.remove(); }, 300);
  }, 3200);
}

/* =========================
   API: FETCH SUMMARY
========================= */

async function fetchSummary() {
  try {
    const data = await apiFetch("/api/freelancer/earnings/summary");
    if (!data.success) return;
    const s = data.summary;
    earningsData.totalEarned      = s.totalEarned;
    earningsData.pending          = s.pending;
    earningsData.thisMonth        = s.thisMonth;
    earningsData.withdrawn        = s.withdrawn;
    earningsData.availableBalance = s.availableBalance;
    earningsData.nextPayoutDate   = s.nextPayoutDate;
    renderHeroStats();
    renderBalance();
  } catch (err) {
    console.error("fetchSummary error:", err);
  }
}

/* =========================
   API: FETCH STATS
========================= */

async function fetchStats() {
  try {
    const data = await apiFetch("/api/freelancer/earnings/stats");
    if (!data.success) return;
    const s = data.stats;
    earningsData.contractsDone = s.contractsDone;
    earningsData.avgRating     = s.avgRating;
    earningsData.avgPayPerJob  = s.avgPayPerJob;
    earningsData.platformFee   = s.platformFee;
    earningsData.totalPayouts  = s.totalPayouts;
    earningsData.goalCurrent   = s.goalCurrent;
    earningsData.goalTarget    = s.goalTarget;
    renderQuickStats();
    renderGoal();
  } catch (err) {
    console.error("fetchStats error:", err);
  }
}

/* =========================
   API: FETCH CHART
========================= */

async function fetchChart(period) {
  try {
    const data = await apiFetch("/api/freelancer/earnings/chart?period=" + period);
    if (!data.success) return;
    earningsData.chart[period] = {
      income:    data.income    || [],
      contracts: data.contracts || [],
      payouts:   data.payouts   || [],
      labels:    data.labels    || []
    };
    const select = document.getElementById("chartPeriod");
    if (select && select.value === period) {
      renderChart(period);
    }
  } catch (err) {
    console.error("fetchChart error:", err);
  }
}

/* =========================
   API: FETCH TRANSACTIONS
========================= */

async function fetchTransactions() {
  try {
    setText("txnSubtitle", "Loading…");
    const data = await apiFetch(
      "/api/freelancer/earnings/transactions" +
      "?filter=" + currentTxnFilter +
      "&sort="   + currentTxnSort   +
      "&limit=100"
    );
    if (!data.success) {
      setText("txnSubtitle", "Failed to load");
      return;
    }
    earningsData.transactions = data.transactions || [];
    renderTxns();
  } catch (err) {
    console.error("fetchTransactions error:", err);
    setText("txnSubtitle", "Failed to load");
  }
}

/* =========================
   API: FETCH PAYMENT METHODS
========================= */

async function fetchPaymentMethods() {
  try {
    const data = await apiFetch("/api/freelancer/earnings/payment-methods");
    if (!data.success) return;
    earningsData.paymentMethods = data.paymentMethods || [];
    renderPaymentMethods();
  } catch (err) {
    console.error("fetchPaymentMethods error:", err);
  }
}

/* =========================
   API: REQUEST PAYOUT
========================= */

async function submitPayout() {
  const v        = parseFloat(document.getElementById("payoutAmount").value) || 0;
  const balance  = earningsData.availableBalance;
  const selected = document.querySelector("input[name=\"payoutMethod\"]:checked");
  const btn      = document.getElementById("submitPayoutBtn");

  if (v <= 0) {
    showToast("Please enter a valid amount.", "error");
    return;
  }
  if (balance !== null && v > balance) {
    showToast("Amount exceeds available balance.", "error");
    return;
  }
  if (!selected) {
    showToast("Please select a payment method.", "error");
    return;
  }

  btn.disabled  = true;
  btn.innerHTML = "<i class=\"fa-solid fa-spinner fa-spin\"></i> Submitting…";

  try {
    const data = await apiFetch("/api/freelancer/earnings/request-payout", {
      method: "POST",
      body: JSON.stringify({ amount: v, methodId: selected.value })
    });

    if (!data.success) {
      showToast(data.message || "Payout failed.", "error");
      return;
    }

    earningsData.availableBalance = data.newBalance;
    renderBalance();
    closePayout();
    showToast("Payout request submitted!", "success");

    setTimeout(fetchTransactions, 800);

  } catch (err) {
    showToast("Network error. Please try again.", "error");
  } finally {
    btn.disabled  = false;
    btn.innerHTML = "<i class=\"fa-solid fa-paper-plane\"></i> Confirm Payout";
  }
}

/* =========================
   WIRE UP DOM EVENTS
   (runs after DOMContentLoaded — called from initEarningsPage)
========================= */

function wireEvents() {
  payoutModal  = document.getElementById("payoutModal");
  payoutDrawer = document.getElementById("payoutDrawer");

  /* Open / close payout */
  var openBtn  = document.getElementById("openPayoutBtn");
  var openBtn2 = document.getElementById("openPayoutBtn2");
  var closeBtn = document.getElementById("closePayoutBtn");
  var cancelBtn= document.getElementById("cancelPayoutBtn");
  var submitBtn= document.getElementById("submitPayoutBtn");

  if (openBtn)   openBtn.addEventListener("click",  openPayout);
  if (openBtn2)  openBtn2.addEventListener("click", openPayout);
  if (closeBtn)  closeBtn.addEventListener("click", closePayout);
  if (cancelBtn) cancelBtn.addEventListener("click", closePayout);
  if (submitBtn) submitBtn.addEventListener("click", submitPayout);

  if (payoutModal) {
    payoutModal.addEventListener("click", function (e) {
      if (e.target === payoutModal) closePayout();
    });
  }

  /* Amount input → live summary update */
  var amountInp = document.getElementById("payoutAmount");
  if (amountInp) {
    amountInp.addEventListener("input", function () {
      updateSummary(parseFloat(this.value) || 0);
    });
  }

  /* Chart period select */
  var periodSelect = document.getElementById("chartPeriod");
  if (periodSelect) {
    periodSelect.addEventListener("change", function () {
      var period = this.value;
      if (earningsData.chart[period].labels.length) {
        renderChart(period);
      } else {
        fetchChart(period);
      }
    });
  }
}

/* Override initEarningsPage so it also wires events */
var _baseInit = initEarningsPage;
initEarningsPage = function (user) {
  wireEvents();
  _baseInit(user);
};
