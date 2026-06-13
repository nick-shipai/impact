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
        window.location.href = "../../signin/";
        return;
    }

    console.log("User logged in:", auth.user);

    var userType = (auth.user?.accountType || "").toLowerCase().trim();
    if (userType !== "freelancer") {
        window.location.href = "../../404.html";
        return;
    }

    if (auth.user?.setupCompleted === false || (auth.user?.setup && !auth.user.setup.completed)) {
        window.location.href = "./set-up/";
        return;
    }

    initFreelancerPage(auth.user);
});

/* =========================
   INIT FREELANCER PAGE
========================= */
async function initFreelancerPage(user) {
    showDashboardLoading();
    updateProfileAvatar(user);

    try {
        const response = await fetch(`${API_URL}/api/load-freelancer-dashboard`, {
            method: "GET",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            showDashboardError(data.message || "Failed to load freelancer dashboard");
            return;
        }

        renderFreelancerDashboard(data);

    } catch (error) {
        console.error("Load freelancer dashboard error:", error);
        showDashboardError("Network error. Please check your connection and try again.");
    }
}

/* =========================
   PROFILE AVATAR
========================= */
function updateProfileAvatar(user) {
    const profile = document.querySelector(".client-profile");

    if (!profile) return;

    const name =
        user?.fullname ||
        user?.username ||
        user?.email ||
        "F";

    const firstLetter = String(name).trim().charAt(0).toUpperCase() || "F";

    profile.innerHTML = `<span>${firstLetter}</span>`;
}

/* =========================
   RENDER DASHBOARD
========================= */
function renderFreelancerDashboard(data) {
    const stats = data.stats || {};
    const tabs = data.tabs || {};
    const work = data.work || {};

    updateStats(stats);
    updateTabs(tabs);

    const activeWork = Array.isArray(work.active) ? work.active : [];

    if (activeWork.length < 1) {
        showEmptyState();
        return;
    }

    showWorkList(activeWork);
}

/* =========================
   UPDATE STATS
========================= */
function updateStats(stats) {
    const statCards = document.querySelectorAll(".stat-card");

    const values = [
        {
            value: stats.activeContracts || 0,
            text: stats.activeContracts > 0 ? "Active contract running" : "No active contract yet"
        },
        {
            value: stats.proposalsSent || 0,
            text: stats.proposalsSent > 0 ? "Proposal submitted" : "No proposal sent yet"
        },
        {
            value: stats.pendingApproval || 0,
            text: stats.pendingApproval > 0 ? "Waiting for approval" : "No pending jobs yet"
        },
        {
            value: formatMoney(stats.totalEarnings || 0),
            text: Number(stats.totalEarnings || 0) > 0 ? "Total money earned" : "No payment received yet"
        }
    ];

    statCards.forEach((card, index) => {
        const h2 = card.querySelector("h2");
        const p = card.querySelector("p");

        if (h2) h2.textContent = values[index]?.value ?? 0;
        if (p) p.textContent = values[index]?.text ?? "";
    });
}

/* =========================
   UPDATE TABS
========================= */
function updateTabs(tabs) {
    const tabLinks = document.querySelectorAll(".client-tabs a");

    const values = [
        tabs.active || 0,
        tabs.forApproval || 0,
        tabs.inactive || 0,
        tabs.completed || 0
    ];

    tabLinks.forEach((tab, index) => {
        const span = tab.querySelector("span");

        if (span) {
            span.textContent = values[index] || 0;
        }
    });
}

/* =========================
   SHOW WORK LIST
========================= */
function showWorkList(jobs) {
    const content = document.querySelector(".client-content");

    if (!content) return;

    const oldEmpty = content.querySelector(".empty-state");
    if (oldEmpty) oldEmpty.remove();

    const oldList = content.querySelector(".freelancer-work-list");
    if (oldList) oldList.remove();

    const list = document.createElement("div");
    list.className = "freelancer-work-list";

    list.innerHTML = jobs.map(job => {
        const title =
            job.jobTitle ||
            job.title ||
            job.basic?.jobTitle ||
            "Untitled Job";

        const category =
            job.category ||
            job.basic?.category ||
            "Freelance Work";

        const status =
            job.status ||
            job.jobStatus ||
            "active";

        const amount =
            job.amount ||
            job.budgetAmount ||
            job.budget?.budgetAmount ||
            0;

        return `
            <div class="job-row">
                <div>
                    <span class="job-status progress">${escapeHTML(status)}</span>
                </div>

                <div class="job-info">
                    <h3>${escapeHTML(title)}</h3>
                    <p>${escapeHTML(category)}</p>

                    <div class="job-meta">
                        <span>
                            <i class="fa-solid fa-clock"></i>
                            Active Work
                        </span>

                        <span>
                            <i class="fa-solid fa-briefcase"></i>
                            Contract
                        </span>
                    </div>
                </div>

                <div class="job-budget">
                    <h4>${formatMoney(amount)}</h4>
                    <p>Budget</p>
                </div>

                <div class="job-actions">
                    <a href="../freelancer/contracts">
                        View
                    </a>
                </div>
            </div>
        `;
    }).join("");

    content.appendChild(list);
}

/* =========================
   EMPTY STATE
========================= */
function showEmptyState() {
    const content = document.querySelector(".client-content");

    if (!content) return;

    const oldLoader = content.querySelector(".dashboard-loading");
    if (oldLoader) oldLoader.remove();

    const oldError = content.querySelector(".dashboard-error");
    if (oldError) oldError.remove();

    let empty = content.querySelector(".empty-state");

    if (!empty) {
        empty = document.createElement("div");
        empty.className = "empty-state";

        empty.innerHTML = `
            <div class="empty-icon">
                <i class="fa-solid fa-file-contract"></i>
            </div>

            <h3>No active work yet</h3>

            <p>
                You do not have any active freelance work right now. Start exploring available jobs,
                send proposals, and your accepted contracts will appear here.
            </p>

            <a href="../freelancer/find-jobs" class="post-job-btn">
                <i class="fa-solid fa-magnifying-glass"></i>
                Find Jobs
            </a>
        `;

        content.appendChild(empty);
    }
}

/* =========================
   LOADING
========================= */
function showDashboardLoading() {
    const content = document.querySelector(".client-content");

    if (!content) return;

    const empty = content.querySelector(".empty-state");
    if (empty) empty.remove();

    const oldLoader = content.querySelector(".dashboard-loading");
    if (oldLoader) oldLoader.remove();

    const loader = document.createElement("div");
    loader.className = "dashboard-loading empty-state";

    loader.innerHTML = `
        <div class="empty-icon">
            <i class="fa-solid fa-spinner fa-spin"></i>
        </div>

        <h3>Loading dashboard...</h3>
        <p>Please wait while we load your freelancer workspace.</p>
    `;

    content.appendChild(loader);
}

/* =========================
   ERROR
========================= */
function showDashboardError(message) {
    const content = document.querySelector(".client-content");

    if (!content) return;

    const oldLoader = content.querySelector(".dashboard-loading");
    if (oldLoader) oldLoader.remove();

    const oldError = content.querySelector(".dashboard-error");
    if (oldError) oldError.remove();

    const empty = content.querySelector(".empty-state");
    if (empty) empty.remove();

    const errorBox = document.createElement("div");
    errorBox.className = "dashboard-error empty-state";

    errorBox.innerHTML = `
        <div class="empty-icon">
            <i class="fa-solid fa-triangle-exclamation"></i>
        </div>

        <h3>Could not load dashboard</h3>

        <p>${escapeHTML(message)}</p>

        <button class="post-job-btn" type="button" onclick="location.reload()">
            <i class="fa-solid fa-rotate-right"></i>
            Try Again
        </button>
    `;

    content.appendChild(errorBox);
}

/* =========================
   HELPERS
========================= */
function formatMoney(amount) {
    const number = Number(amount || 0);

    return `$${number.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    })}`;
}

function escapeHTML(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}