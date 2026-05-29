const API_URL = "https://backend.impactacademy.site";

/* =========================
   AUTHENTICATE USER
========================= */

async function AuthenticateUser() {
  try {
    const response = await fetch(`${API_URL}/api/auth/validate-session`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      localStorage.removeItem("impactech_user");
      localStorage.removeItem("impactech_token");

      return {
        success: false,
        user: null
      };
    }

    if (data.user) {
      localStorage.setItem("impactech_user", JSON.stringify(data.user));
    }

    return {
      success: true,
      user: data.user
    };

  } catch (error) {
    console.error("AuthenticateUser error:", error);

    return {
      success: false,
      user: null
    };
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

  initMyProposals(auth.user);
});

/* =========================
   INIT MY PROPOSALS
========================= */

async function initMyProposals(user) {
  try {
    showLoadingState();

    const response = await fetch(`${API_URL}/api/freelancer/my-proposals`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to load proposals");
    }

    renderProposalStats(data);
    renderProposalList(data.proposals || []);

  } catch (error) {
    console.error("LOAD MY PROPOSALS ERROR:", error);

    showErrorState(error.message || "Failed to load proposals");
  }
}

/* =========================
   RENDER STATS
========================= */

function renderProposalStats(data) {
  const totalEl = document.getElementById("totalProposals");
  const pendingEl = document.getElementById("pendingProposals");
  const acceptedEl = document.getElementById("acceptedProposals");
  const rejectedEl = document.getElementById("rejectedProposals");

  const responseRateEl = document.getElementById("responseRate");
  const winRateEl = document.getElementById("winRate");
  const avgResponseTimeEl = document.getElementById("avgResponseTime");

  if (totalEl) {
    totalEl.textContent = data.totalProposals || 0;
  }

  if (pendingEl) {
    pendingEl.textContent = data.pending || 0;
  }

  if (acceptedEl) {
    acceptedEl.textContent = data.accepted || 0;
  }

  if (rejectedEl) {
    rejectedEl.textContent = data.rejected || 0;
  }

  if (responseRateEl) {
    responseRateEl.textContent =
      `${data.stats?.responseRate || 0}%`;
  }

  if (winRateEl) {
    winRateEl.textContent =
      `${data.stats?.winRate || 0}%`;
  }

  if (avgResponseTimeEl) {
    avgResponseTimeEl.textContent =
      data.stats?.avgResponseTime || "-";
  }
}

/* =========================
   RENDER PROPOSALS
========================= */

function renderProposalList(proposals) {
  const container = document.getElementById("proposalsContainer");

  const loadingState =
    document.getElementById("proposalsLoadingState");

  const emptyState =
    document.getElementById("proposalsEmptyState");

  if (!container) return;

  if (loadingState) {
    loadingState.classList.remove("active");
  }

  container.innerHTML = "";

  if (!Array.isArray(proposals) || proposals.length === 0) {

    if (emptyState) {
      emptyState.style.display = "grid";
    }

    return;
  }

  if (emptyState) {
    emptyState.style.display = "none";
  }

  proposals.forEach((proposal) => {
    container.innerHTML += createProposalCard(proposal);
  });
}

/* =========================
   CREATE PROPOSAL CARD
========================= */

function createProposalCard(item) {

  const status =
    item?.proposal?.status || "pending";

  const submittedDate =
    formatDate(item?.submittedAt);

  const statusIcon =
    status === "accepted"
      ? "fa-circle-check"
      : status === "rejected"
      ? "fa-circle-xmark"
      : status === "withdrawn"
      ? "fa-ban"
      : "fa-clock";

  const skillsHTML = Array.isArray(item?.job?.requiredSkills)
    ? item.job.requiredSkills
        .map(skill => `
          <span>${escapeHTML(skill)}</span>
        `)
        .join("")
    : "";

  return `
  
    <div class="proposal-card">

      <div class="proposal-card-top">

        <div class="proposal-card-meta">

          <div class="proposal-status-row">

            <span class="status-badge ${status}">
              <i class="fa-solid ${statusIcon}"></i>
              ${formatStatus(status)}
            </span>

            <span class="job-pill">
              ${escapeHTML(item?.job?.category || "General")}
            </span>

          </div>

          <h3>
            ${escapeHTML(item?.job?.jobTitle || "Untitled Job")}
          </h3>

          <div class="client-name">
            <i class="fa-solid fa-user"></i>

            ${escapeHTML(
              item?.client?.fullname || "Unknown Client"
            )}
          </div>

          <p class="cover-letter-preview">
            ${escapeHTML(
              item?.proposal?.coverLetter ||
              "No cover letter provided."
            )}
          </p>

        </div>

        <div class="proposal-card-actions">

          <button class="view-btn">
            <i class="fa-solid fa-eye"></i>
            View
          </button>

          ${
            status === "pending"
              ? `
                <button class="withdraw-btn">
                  <i class="fa-solid fa-trash"></i>
                  Withdraw
                </button>
              `
              : ""
          }

        </div>

      </div>

      <div class="proposal-info-grid">

        <div>
          <i class="fa-solid fa-wallet"></i>
          <strong>
            ${escapeHTML(item?.job?.currency || "USD")}
            ${formatMoney(
              item?.proposal?.proposedBudget || 0
            )}
          </strong>
          <small>Proposed Budget</small>
        </div>

        <div>
          <i class="fa-solid fa-clock"></i>
          <strong>
            ${escapeHTML(
              item?.proposal?.deliveryTime || "N/A"
            )}
          </strong>
          <small>Delivery Time</small>
        </div>

        <div>
          <i class="fa-solid fa-brain"></i>
          <strong>
            ${item?.ai?.score || 0}/100
          </strong>
          <small>AI Score</small>
        </div>

        <div>
          <i class="fa-solid fa-star"></i>
          <strong>
            ${escapeHTML(item?.ai?.rating || "N/A")}
          </strong>
          <small>AI Rating</small>
        </div>

      </div>

      ${
        skillsHTML
          ? `
            <div class="job-tags">
              ${skillsHTML}
            </div>
          `
          : ""
      }

      <div class="proposal-card-footer">

        <span>
          <i class="fa-solid fa-calendar"></i>
          Submitted ${submittedDate}
        </span>

        <button class="message-client-btn">
          <i class="fa-solid fa-comments"></i>
          Message Client
        </button>

      </div>

    </div>
  `;
}

/* =========================
   STATUS HELPERS
========================= */

function getStatusClass(status) {
  status = String(status || "").toLowerCase();

  if (status === "accepted") {
    return "status-accepted";
  }

  if (status === "rejected") {
    return "status-rejected";
  }

  return "status-pending";
}

function formatStatus(status) {
  return String(status || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, l => l.toUpperCase());
}

/* =========================
   UI STATES
========================= */

function showLoadingState() {
  const container = document.getElementById("proposalsContainer");

  if (!container) return;

  container.innerHTML = `
    <div class="loading-state">
      <p>Loading proposals...</p>
    </div>
  `;
}

function showErrorState(message) {
  const container = document.getElementById("proposalsContainer");

  if (!container) return;

  container.innerHTML = `
    <div class="error-state">
      <h3>Failed to Load</h3>
      <p>${escapeHTML(message)}</p>
    </div>
  `;
}

/* =========================
   HELPERS
========================= */

function formatMoney(value) {
  return Number(value || 0).toLocaleString();
}

function formatDate(timestamp) {
  if (!timestamp) return "Unknown";

  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return "Unknown";
  }
}

function escapeHTML(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}