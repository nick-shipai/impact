const API_URL = "https://backend.impactacademy.site";

/* =========================
   STATE
========================= */

let allProposals = [];
let filteredProposals = [];
let activeDrawerProposal = null;

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
  injectDrawer();
  injectToastContainer();

  const auth = await AuthenticateUser();

  if (!auth.success) {
    window.location.href = "../../../signin/";
    return;
  }

  var userType = (auth.user?.accountType || "").toLowerCase().trim();
  if (userType !== "freelancer") {
    window.location.href = "/404.html";
    return;
  }

  initMyProposals(auth.user);
  bindFilterEvents();
});

/* =========================
   INIT MY PROPOSALS
========================= */

async function initMyProposals(user) {
  try {
    showSkeletonState();

    const response = await fetch(`${API_URL}/api/freelancer/my-proposals`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to load proposals");
    }

    allProposals = data.proposals || [];

    renderProposalStats(data);
    applyFiltersAndRender();

  } catch (error) {
    console.error("LOAD MY PROPOSALS ERROR:", error);
    showErrorState(error.message || "Failed to load proposals");
  }
}

/* =========================
   RENDER STATS
========================= */

function renderProposalStats(data) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set("totalProposals",   data.totalProposals || 0);
  set("pendingProposals", data.pending || 0);
  set("acceptedProposals", data.accepted || 0);
  set("rejectedProposals", data.rejected || 0);
  set("responseRate",     `${data.stats?.responseRate || 0}%`);
  set("winRate",          `${data.stats?.winRate || 0}%`);
  set("avgResponseTime",  data.stats?.avgResponseTime || "—");
}

/* =========================
   FILTER & SORT PIPELINE
========================= */

function applyFiltersAndRender() {
  const search   = (document.getElementById("proposalSearchInput")?.value || "").toLowerCase().trim();
  const status   = document.getElementById("statusFilter")?.value || "";
  const category = document.getElementById("categoryFilter")?.value || "";
  const dateVal  = document.getElementById("dateFilter")?.value || "";
  const sort     = document.getElementById("sortProposals")?.value || "newest";

  const quickChecked = Array.from(
    document.querySelectorAll(".quick-filter:checked")
  ).map(c => c.value);

  const now   = Date.now();
  const day   = 24 * 60 * 60 * 1000;
  const week  = 7  * day;
  const month = 30 * day;

  let result = allProposals.filter(p => {
    const title  = (p?.job?.jobTitle  || "").toLowerCase();
    const client = (p?.client?.fullname || "").toLowerCase();
    const pStatus = normaliseStatus(p?.proposal?.status || "");
    const pCat    = (p?.job?.category || "").toLowerCase();
    const submitted = Number(p?.submittedAt || 0);

    if (search && !title.includes(search) && !client.includes(search)) return false;

    if (status && pStatus !== status) return false;

    if (category && pCat !== category.toLowerCase()) return false;

    if (dateVal === "today"  && (now - submitted) > day)   return false;
    if (dateVal === "week"   && (now - submitted) > week)  return false;
    if (dateVal === "month"  && (now - submitted) > month) return false;

    if (quickChecked.length > 0) {
      const matchesQuick = quickChecked.some(q => {
        if (q === "recent") return (now - submitted) < week;
        return pStatus === q || pStatus === normaliseStatus(q);
      });
      if (!matchesQuick) return false;
    }

    return true;
  });

  result = sortProposals(result, sort);
  filteredProposals = result;

  renderProposalList(result);
}

function normaliseStatus(status) {
  const s = String(status || "").toLowerCase().trim();
  if (["pending_client_review", "submitted", "under_review"].includes(s)) return "pending";
  return s;
}

function sortProposals(list, sort) {
  return [...list].sort((a, b) => {
    if (sort === "oldest")     return Number(a.submittedAt || 0) - Number(b.submittedAt || 0);
    if (sort === "highest_bid") return Number(b.proposal?.proposedBudget || 0) - Number(a.proposal?.proposedBudget || 0);
    return Number(b.submittedAt || 0) - Number(a.submittedAt || 0);
  });
}

/* =========================
   BIND FILTER EVENTS
========================= */

function bindFilterEvents() {
  const ids = [
    "proposalSearchInput",
    "statusFilter",
    "categoryFilter",
    "dateFilter",
    "sortProposals"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const evt = el.tagName === "INPUT" ? "input" : "change";
    el.addEventListener(evt, () => applyFiltersAndRender());
  });

  document.getElementById("filterProposalsBtn")
    ?.addEventListener("click", () => applyFiltersAndRender());

  document.querySelectorAll(".quick-filter").forEach(cb => {
    cb.addEventListener("change", () => applyFiltersAndRender());
  });
}

/* =========================
   RENDER PROPOSALS
========================= */

function renderProposalList(proposals) {
  const container   = document.getElementById("proposalsContainer");
  const emptyState  = document.getElementById("proposalsEmptyState");
  const subtitle    = document.getElementById("proposalsSubtitle");
  const loadingState = document.getElementById("proposalsLoadingState");

  if (!container) return;

  if (loadingState) loadingState.style.display = "none";

  if (!Array.isArray(proposals) || proposals.length === 0) {
    container.innerHTML = "";

    const hasFilters = hasActiveFilters();

    if (hasFilters) {
      container.innerHTML = noResultsHTML();
    } else if (emptyState) {
      emptyState.style.display = "grid";
    }

    if (subtitle) subtitle.textContent = "No proposals found";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  if (subtitle) {
    subtitle.textContent = `Showing ${proposals.length} proposal${proposals.length !== 1 ? "s" : ""}`;
  }

  container.innerHTML = "";
  proposals.forEach((proposal, i) => {
    const card = document.createElement("div");
    card.className = "proposal-card";
    card.style.animationDelay = `${i * 0.04}s`;
    card.innerHTML = createProposalCard(proposal);
    container.appendChild(card);

    card.querySelector(".view-btn")
      ?.addEventListener("click", () => openDrawer(proposal));

    card.querySelector(".withdraw-btn")
      ?.addEventListener("click", (e) => showWithdrawConfirm(e, proposal, card));

    card.querySelector(".message-client-btn")
      ?.addEventListener("click", () => messageClient(proposal));
  });
}

function hasActiveFilters() {
  const search   = document.getElementById("proposalSearchInput")?.value?.trim();
  const status   = document.getElementById("statusFilter")?.value;
  const category = document.getElementById("categoryFilter")?.value;
  const dateVal  = document.getElementById("dateFilter")?.value;
  const quick    = document.querySelectorAll(".quick-filter:checked").length;
  return !!(search || status || category || dateVal || quick);
}

function noResultsHTML() {
  return `
    <div class="no-results-state">
      <div class="no-results-icon">
        <i class="fa-solid fa-filter-circle-xmark"></i>
      </div>
      <h3>No proposals match your filters</h3>
      <p>Try adjusting your search, status filter, or date range to find what you're looking for.</p>
      <button class="clear-filters-btn" onclick="clearAllFilters()">
        <i class="fa-solid fa-rotate-left"></i>
        Clear All Filters
      </button>
    </div>
  `;
}

function clearAllFilters() {
  const ids = ["proposalSearchInput", "statusFilter", "categoryFilter", "dateFilter"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.querySelectorAll(".quick-filter:checked").forEach(cb => cb.checked = false);
  applyFiltersAndRender();
}

/* =========================
   CREATE PROPOSAL CARD
========================= */

function createProposalCard(item) {
  const rawStatus  = item?.proposal?.status || "pending";
  const status     = normaliseStatus(rawStatus);
  const submitted  = formatDate(item?.submittedAt);
  const aiScore    = Number(item?.ai?.score || 0);

  const statusIcon =
    status === "accepted"  ? "fa-circle-check"  :
    status === "rejected"  ? "fa-circle-xmark"  :
    status === "withdrawn" ? "fa-ban"            : "fa-clock";

  const scoreClass =
    aiScore >= 70 ? "good" :
    aiScore >= 45 ? "mid"  : "low";

  const skillsHTML = Array.isArray(item?.job?.requiredSkills)
    ? item.job.requiredSkills
        .slice(0, 5)
        .map(s => `<span>${escapeHTML(s)}</span>`)
        .join("")
    : "";

  return `
    <div class="proposal-card-top">
      <div class="proposal-card-meta">
        <div class="proposal-status-row">
          <span class="status-badge ${status}">
            <i class="fa-solid ${statusIcon}"></i>
            ${formatStatus(rawStatus)}
          </span>
          <span class="job-pill">
            <i class="fa-solid fa-tag" style="font-size:10px;margin-right:3px;"></i>
            ${escapeHTML(item?.job?.category || "General")}
          </span>
        </div>

        <h3>${escapeHTML(item?.job?.jobTitle || "Untitled Job")}</h3>

        <div class="client-name">
          <i class="fa-solid fa-user"></i>
          ${escapeHTML(item?.client?.fullname || "Unknown Client")}
        </div>

        <p class="cover-letter-preview">
          ${escapeHTML(item?.proposal?.coverLetter || "No cover letter provided.")}
        </p>
      </div>

      <div class="proposal-card-actions">
        <button class="view-btn">
          <i class="fa-solid fa-eye"></i>
          View
        </button>
        ${status === "pending" ? `
          <button class="withdraw-btn">
            <i class="fa-solid fa-trash"></i>
            Withdraw
          </button>
        ` : ""}
      </div>
    </div>

    <div class="proposal-info-grid">
      <div>
        <i class="fa-solid fa-wallet"></i>
        <strong>${escapeHTML(item?.job?.currency || "USD")} ${formatMoney(item?.proposal?.proposedBudget || 0)}</strong>
        <small>Proposed Budget</small>
      </div>
      <div>
        <i class="fa-solid fa-clock"></i>
        <strong>${escapeHTML(item?.proposal?.deliveryTime || "N/A")}</strong>
        <small>Delivery Time</small>
      </div>
      <div>
        <i class="fa-solid fa-brain"></i>
        <strong>${aiScore}/100</strong>
        <small>AI Score</small>
        <div class="ai-score-bar-wrap">
          <div class="ai-score-bar ${scoreClass}" style="width:${aiScore}%"></div>
        </div>
      </div>
      <div>
        <i class="fa-solid fa-star"></i>
        <strong>${escapeHTML(item?.ai?.rating || "N/A")}</strong>
        <small>AI Rating</small>
      </div>
    </div>

    ${skillsHTML ? `<div class="job-tags">${skillsHTML}</div>` : ""}

    <div class="proposal-card-footer">
      <span>
        <i class="fa-solid fa-calendar"></i>
        Submitted ${submitted}
      </span>
      <button class="message-client-btn">
        <i class="fa-solid fa-comments"></i>
        Message Client
      </button>
    </div>
  `;
}

/* =========================
   WITHDRAW CONFIRM (inline)
========================= */

function showWithdrawConfirm(e, proposal, card) {
  const existingConfirm = card.querySelector(".withdraw-confirm-box");
  if (existingConfirm) {
    existingConfirm.remove();
    return;
  }

  const box = document.createElement("div");
  box.className = "withdraw-confirm-box";
  box.innerHTML = `
    <p>
      <i class="fa-solid fa-triangle-exclamation" style="margin-right:6px;"></i>
      Withdraw this proposal? This cannot be undone.
    </p>
    <div class="withdraw-confirm-actions">
      <button class="confirm-yes-btn">Yes, Withdraw</button>
      <button class="confirm-no-btn">Cancel</button>
    </div>
  `;

  card.appendChild(box);

  box.querySelector(".confirm-no-btn").addEventListener("click", () => box.remove());

  box.querySelector(".confirm-yes-btn").addEventListener("click", async () => {
    await doWithdraw(proposal, card, box);
  });
}

async function doWithdraw(proposal, card, box) {
  const yesBtn = box.querySelector(".confirm-yes-btn");
  yesBtn.disabled = true;
  yesBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Withdrawing...`;

  try {
    const res = await fetch(`${API_URL}/api/freelancer/withdraw-proposal`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposalId: proposal.proposalId })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Withdraw failed");
    }

    proposal.proposal.status = "withdrawn";
    allProposals = allProposals.map(p =>
      p.proposalId === proposal.proposalId ? proposal : p
    );

    card.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    card.style.opacity = "0";
    card.style.transform = "translateX(-10px)";
    setTimeout(() => {
      applyFiltersAndRender();
      showToast("Proposal withdrawn successfully", "success");
    }, 320);

  } catch (err) {
    console.error("WITHDRAW ERROR:", err);
    yesBtn.disabled = false;
    yesBtn.innerHTML = "Yes, Withdraw";
    showToast(err.message || "Failed to withdraw proposal", "error");
    box.remove();
  }
}

/* =========================
   MESSAGE CLIENT
========================= */

function messageClient(proposal) {
  const clientUid = proposal?.client?.uid || proposal?.clientUid;
  if (clientUid) {
    window.location.href = `../messages?uid=${encodeURIComponent(clientUid)}`;
  } else {
    showToast("Client info unavailable", "info");
  }
}

/* =========================
   PROPOSAL DETAIL DRAWER
========================= */

function injectDrawer() {
  const overlay = document.createElement("div");
  overlay.className = "drawer-overlay";
  overlay.id = "drawerOverlay";
  overlay.addEventListener("click", closeDrawer);

  const drawer = document.createElement("div");
  drawer.className = "proposal-drawer";
  drawer.id = "proposalDrawer";
  drawer.innerHTML = `
    <div class="drawer-header" id="drawerHeader">
      <div class="drawer-header-info">
        <h2 id="drawerTitle">Proposal Details</h2>
        <div class="drawer-header-badges" id="drawerBadges"></div>
      </div>
      <button class="drawer-close-btn" onclick="closeDrawer()">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="drawer-body" id="drawerBody"></div>
    <div class="drawer-footer">
      <button class="drawer-msg-btn" id="drawerMsgBtn">
        <i class="fa-solid fa-comments"></i>
        Message Client
      </button>
      <button class="drawer-close-footer-btn" onclick="closeDrawer()">Close</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeDrawer();
  });
}

function openDrawer(proposal) {
  activeDrawerProposal = proposal;

  const overlay = document.getElementById("drawerOverlay");
  const drawer  = document.getElementById("proposalDrawer");
  const title   = document.getElementById("drawerTitle");
  const badges  = document.getElementById("drawerBadges");
  const body    = document.getElementById("drawerBody");
  const msgBtn  = document.getElementById("drawerMsgBtn");

  const rawStatus = proposal?.proposal?.status || "pending";
  const status    = normaliseStatus(rawStatus);
  const aiScore   = Number(proposal?.ai?.score || 0);
  const scoreClass =
    aiScore >= 70 ? "good" :
    aiScore >= 45 ? "mid"  : "low";

  const statusIcon =
    status === "accepted"  ? "fa-circle-check"  :
    status === "rejected"  ? "fa-circle-xmark"  :
    status === "withdrawn" ? "fa-ban"            : "fa-clock";

  title.textContent = escapeHTML(proposal?.job?.jobTitle || "Untitled Job");

  badges.innerHTML = `
    <span class="drawer-badge">
      <i class="fa-solid ${statusIcon}"></i>
      ${formatStatus(rawStatus)}
    </span>
    <span class="drawer-badge">
      <i class="fa-solid fa-tag"></i>
      ${escapeHTML(proposal?.job?.category || "General")}
    </span>
  `;

  const goodPoints = Array.isArray(proposal?.ai?.goodPoints) ? proposal.ai.goodPoints : [];
  const badPoints  = Array.isArray(proposal?.ai?.badPoints)  ? proposal.ai.badPoints  : [];
  const riskFlags  = Array.isArray(proposal?.ai?.riskFlags)  ? proposal.ai.riskFlags  : [];
  const skills     = Array.isArray(proposal?.job?.requiredSkills) ? proposal.job.requiredSkills : [];

  body.innerHTML = `
    <!-- JOB INFO -->
    <div class="drawer-section">
      <div class="drawer-section-title">
        <i class="fa-solid fa-briefcase"></i>
        Job Details
      </div>
      <div class="drawer-info-row">
        <span>Job Title</span>
        <strong>${escapeHTML(proposal?.job?.jobTitle || "—")}</strong>
      </div>
      <div class="drawer-info-row">
        <span>Category</span>
        <strong>${escapeHTML(proposal?.job?.category || "—")}</strong>
      </div>
      <div class="drawer-info-row">
        <span>Job Type</span>
        <strong>${escapeHTML(proposal?.job?.jobType || "—")}</strong>
      </div>
      <div class="drawer-info-row">
        <span>Job Budget</span>
        <strong>${escapeHTML(proposal?.job?.currency || "USD")} ${formatMoney(proposal?.job?.budgetAmount || 0)}</strong>
      </div>
      <div class="drawer-info-row">
        <span>Timeline</span>
        <strong>${escapeHTML(proposal?.job?.timeline || "—")}</strong>
      </div>
      ${skills.length ? `
        <div class="drawer-info-row" style="align-items:flex-start;flex-wrap:wrap;gap:10px;">
          <span>Required Skills</span>
          <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;">
            ${skills.map(s => `
              <span style="background:var(--soft-blue);color:var(--primary);padding:4px 10px;border-radius:999px;font-size:12px;font-weight:900;">
                ${escapeHTML(s)}
              </span>
            `).join("")}
          </div>
        </div>
      ` : ""}
    </div>

    <!-- MY PROPOSAL -->
    <div class="drawer-section">
      <div class="drawer-section-title">
        <i class="fa-solid fa-paper-plane"></i>
        Your Proposal
      </div>
      <div class="drawer-info-row">
        <span>Proposed Budget</span>
        <strong>${escapeHTML(proposal?.job?.currency || "USD")} ${formatMoney(proposal?.proposal?.proposedBudget || 0)}</strong>
      </div>
      <div class="drawer-info-row">
        <span>Delivery Time</span>
        <strong>${escapeHTML(proposal?.proposal?.deliveryTime || "—")}</strong>
      </div>
      <div class="drawer-info-row">
        <span>Submitted</span>
        <strong>${formatDate(proposal?.submittedAt)}</strong>
      </div>
      <div class="drawer-info-row">
        <span>Status</span>
        <strong style="display:inline-flex;align-items:center;gap:6px;">
          <i class="fa-solid ${statusIcon}" style="color:${statusColor(status)}"></i>
          ${formatStatus(rawStatus)}
        </strong>
      </div>
    </div>

    <!-- COVER LETTER -->
    <div class="drawer-section">
      <div class="drawer-section-title">
        <i class="fa-solid fa-file-lines"></i>
        Cover Letter
      </div>
      <p class="drawer-cover-letter">${escapeHTML(proposal?.proposal?.coverLetter || "No cover letter provided.")}</p>
    </div>

    <!-- CLIENT -->
    <div class="drawer-section">
      <div class="drawer-section-title">
        <i class="fa-solid fa-user"></i>
        Client
      </div>
      <div class="drawer-info-row">
        <span>Name</span>
        <strong>${escapeHTML(proposal?.client?.fullname || "Unknown Client")}</strong>
      </div>
      ${proposal?.client?.email ? `
        <div class="drawer-info-row">
          <span>Email</span>
          <strong>${escapeHTML(proposal.client.email)}</strong>
        </div>
      ` : ""}
    </div>

    <!-- AI REVIEW -->
    <div class="drawer-section">
      <div class="drawer-section-title">
        <i class="fa-solid fa-brain"></i>
        AI Review
      </div>

      <div class="drawer-ai-grid">
        <div class="drawer-ai-card">
          <div class="ai-num">${aiScore}</div>
          <small>AI Score / 100</small>
          <div class="drawer-ai-bar-wrap">
            <div class="drawer-ai-bar ${scoreClass}" style="width:${aiScore}%"></div>
          </div>
        </div>
        <div class="drawer-ai-card">
          <div class="ai-num" style="font-size:20px;text-transform:capitalize;">
            ${escapeHTML(proposal?.ai?.rating || "N/A")}
          </div>
          <small>Rating</small>
          <div style="margin-top:8px;font-size:12px;color:var(--muted);font-weight:800;">
            ${proposal?.ai?.passed ? "✅ Qualified" : "❌ Not Qualified"}
          </div>
        </div>
      </div>

      ${proposal?.ai?.summary ? `
        <p style="color:var(--muted);font-size:13px;line-height:1.8;margin-bottom:14px;">
          ${escapeHTML(proposal.ai.summary)}
        </p>
      ` : ""}

      ${goodPoints.length ? `
        <div style="margin-bottom:12px;">
          <div class="drawer-section-title" style="margin-bottom:10px;">
            <i class="fa-solid fa-thumbs-up"></i> Strengths
          </div>
          <div class="drawer-list">
            ${goodPoints.map(p => `
              <div class="drawer-list-item good">
                <i class="fa-solid fa-circle-check"></i>
                <span>${escapeHTML(p)}</span>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      ${badPoints.length ? `
        <div style="margin-bottom:12px;">
          <div class="drawer-section-title" style="margin-bottom:10px;">
            <i class="fa-solid fa-thumbs-down"></i> Weaknesses
          </div>
          <div class="drawer-list">
            ${badPoints.map(p => `
              <div class="drawer-list-item bad">
                <i class="fa-solid fa-circle-xmark"></i>
                <span>${escapeHTML(p)}</span>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      ${riskFlags.length ? `
        <div>
          <div class="drawer-section-title" style="margin-bottom:10px;">
            <i class="fa-solid fa-triangle-exclamation"></i> Risk Flags
          </div>
          <div class="drawer-list">
            ${riskFlags.map(f => `
              <div class="drawer-list-item warn">
                <i class="fa-solid fa-flag"></i>
                <span>${escapeHTML(f)}</span>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}
    </div>
  `;

  msgBtn.onclick = () => messageClient(proposal);

  overlay.classList.add("open");
  drawer.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeDrawer() {
  const overlay = document.getElementById("drawerOverlay");
  const drawer  = document.getElementById("proposalDrawer");

  overlay?.classList.remove("open");
  drawer?.classList.remove("open");
  document.body.style.overflow = "";
  activeDrawerProposal = null;
}

function statusColor(status) {
  if (status === "accepted")  return "#16a34a";
  if (status === "rejected")  return "#dc2626";
  if (status === "withdrawn") return "#64748b";
  return "#b45309";
}

/* =========================
   SKELETON LOADING
========================= */

function showSkeletonState() {
  const container    = document.getElementById("proposalsContainer");
  const loadingState = document.getElementById("proposalsLoadingState");
  const emptyState   = document.getElementById("proposalsEmptyState");
  const subtitle     = document.getElementById("proposalsSubtitle");

  if (loadingState) loadingState.style.display = "none";
  if (emptyState)   emptyState.style.display   = "none";
  if (subtitle)     subtitle.textContent        = "Loading your submitted proposals...";

  if (!container) return;

  container.innerHTML = Array.from({ length: 4 }).map(() => `
    <div class="proposal-skeleton-row">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;gap:10px;margin-bottom:12px;">
          <div class="skeleton-pill"></div>
          <div class="skeleton-pill" style="width:70px;"></div>
        </div>
        <div class="skeleton-line title"></div>
        <div class="skeleton-line short" style="margin-top:8px;"></div>
        <div class="skeleton-line" style="margin-top:14px;"></div>
        <div class="skeleton-line small"></div>
        <div class="skeleton-grid" style="margin-top:16px;">
          <div class="skeleton-block"></div>
          <div class="skeleton-block"></div>
          <div class="skeleton-block"></div>
          <div class="skeleton-block"></div>
        </div>
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
          <div class="skeleton-line" style="width:130px;margin-top:0;"></div>
          <div class="skeleton-button" style="width:140px;"></div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;min-width:160px;">
        <div class="skeleton-button"></div>
        <div class="skeleton-button"></div>
      </div>
    </div>
  `).join("");
}

/* =========================
   ERROR STATE
========================= */

function showErrorState(message) {
  const container    = document.getElementById("proposalsContainer");
  const loadingState = document.getElementById("proposalsLoadingState");
  const subtitle     = document.getElementById("proposalsSubtitle");

  if (loadingState) loadingState.style.display = "none";
  if (subtitle)     subtitle.textContent = "Failed to load proposals";

  if (!container) return;

  container.innerHTML = `
    <div class="error-state">
      <div class="error-icon">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>
      <h3>Failed to Load Proposals</h3>
      <p>${escapeHTML(message)}</p>
      <button class="retry-btn" onclick="location.reload()">
        <i class="fa-solid fa-rotate-right"></i>
        Try Again
      </button>
    </div>
  `;
}

/* =========================
   TOAST SYSTEM
========================= */

function injectToastContainer() {
  if (document.getElementById("toastContainer")) return;
  const container = document.createElement("div");
  container.className = "toast-container";
  container.id = "toastContainer";
  document.body.appendChild(container);
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const icons = {
    success: "fa-circle-check",
    error:   "fa-triangle-exclamation",
    info:    "fa-circle-info"
  };

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">
      <i class="fa-solid ${icons[type] || icons.info}"></i>
    </div>
    <span>${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("removing");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  }, 3500);
}

/* =========================
   HELPERS
========================= */

function formatStatus(status) {
  return String(status || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, l => l.toUpperCase());
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString();
}

function formatDate(timestamp) {
  if (!timestamp) return "Unknown";
  try {
    const d = new Date(Number(timestamp));
    return d.toLocaleDateString("en-US", {
      month: "short",
      day:   "numeric",
      year:  "numeric"
    });
  } catch {
    return "Unknown";
  }
}

function escapeHTML(str) {
  return String(str || "")
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#039;");
}
