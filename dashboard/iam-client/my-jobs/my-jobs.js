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
   PAGE START
========================= */
document.addEventListener("DOMContentLoaded", async function () {
    setPageSkeletonLoading();

    const auth = await AuthenticateUser();

    if (!auth.success) {
        window.location.href = "../../../signin/";
        return;
    }

    var userType = (auth.user?.accountType || "").toLowerCase().trim();
    if (userType !== "client") {
        window.location.href = "../../../404.html";
        return;
    }

    await initMyJobPage(auth.user);
});

/* =========================
   INIT PAGE
========================= */
async function initMyJobPage(user) {
    await Promise.all([
        updateClientProfile(user),
        loadClientJobs()
    ]);

    stopPageSkeletonLoading();
}

/* =========================
   PROFILE
========================= */
async function updateClientProfile(user) {
    const profile = document.querySelector(".client-profile");
    if (!profile) return;

    try {
        const response = await fetch(`${API_URL}/api/get-user-pic`, {
            method: "GET",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = await response.json().catch(() => ({}));

        profile.innerHTML = "";

        if (response.ok && data.success && data.profilePic) {
            const img = document.createElement("img");
            img.src = data.profilePic;
            img.alt = "Profile";
            img.className = "profile-avatar";
            profile.appendChild(img);
            return;
        }

        const username =
            data?.username ||
            user?.username ||
            user?.firstname ||
            user?.FirstName ||
            user?.email ||
            "C";

        profile.innerHTML = `
            <span class="profile-letter">
                ${escapeHtml(username.trim().charAt(0).toUpperCase())}
            </span>
        `;

    } catch (error) {
        console.error("PROFILE LOAD ERROR:", error);

        const username =
            user?.username ||
            user?.firstname ||
            user?.FirstName ||
            user?.email ||
            "C";

        profile.innerHTML = `
            <span class="profile-letter">
                ${escapeHtml(username.trim().charAt(0).toUpperCase())}
            </span>
        `;
    }
}

/* =========================
   LOAD CLIENT JOBS
========================= */
async function loadClientJobs() {
    try {
        setJobsLoading();

        const response = await fetch(`${API_URL}/api/load-client-jobs`, {
            method: "GET",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Failed to load jobs");
        }

        renderClientJobs(data.jobs || []);

    } catch (error) {
        console.error("LOAD CLIENT JOBS ERROR:", error);
        showJobsError(error.message || "Failed to load jobs");
    }
}

/* =========================
   LOADING
========================= */
function setPageSkeletonLoading() {
    const profile = document.querySelector(".client-profile");
    if (profile) {
        profile.innerHTML = `<span class="profile-skeleton"></span>`;
    }

    document.querySelectorAll(".stat-card").forEach(card => {
        const h2 = card.querySelector("h2");
        const p = card.querySelector("p");

        if (h2) h2.innerHTML = `<span class="skeleton-line short"></span>`;
        if (p) p.innerHTML = `<span class="skeleton-line"></span>`;
    });

    const emptyState = document.querySelector(".empty-state");
    if (emptyState) emptyState.style.display = "none";
}

function stopPageSkeletonLoading() {
    const skeleton = document.querySelector(".job-skeleton-list");
    if (skeleton) skeleton.remove();
}

function setJobsLoading() {
    const content = document.querySelector(".client-content");
    if (!content) return;

    const oldList = document.querySelector(".job-list");
    if (oldList) oldList.remove();

    const oldError = document.querySelector(".jobs-error");
    if (oldError) oldError.remove();

    const oldLoader = document.querySelector(".jobs-loading");
    if (oldLoader) oldLoader.remove();

    const emptyState = document.querySelector(".empty-state");
    if (emptyState) emptyState.style.display = "none";

    const loader = document.createElement("div");
    loader.className = "job-skeleton-list";

    loader.innerHTML = Array(4).fill("").map(() => `
        <div class="job-skeleton-row">
            <span class="skeleton-pill"></span>

            <div>
                <span class="skeleton-line title"></span>
                <span class="skeleton-line"></span>
                <span class="skeleton-line small"></span>
            </div>

            <span class="skeleton-line short"></span>
            <span class="skeleton-button"></span>
        </div>
    `).join("");

    content.appendChild(loader);
}

/* =========================
   RENDER JOBS
========================= */
function renderClientJobs(jobs) {
    const skeleton = document.querySelector(".job-skeleton-list");
    if (skeleton) skeleton.remove();

    const loader = document.querySelector(".jobs-loading");
    if (loader) loader.remove();

    const errorBox = document.querySelector(".jobs-error");
    if (errorBox) errorBox.remove();

    const content = document.querySelector(".client-content");
    const emptyState = document.querySelector(".empty-state");

    if (!content) return;

    const oldList = document.querySelector(".job-list");
    if (oldList) oldList.remove();

    if (!jobs.length) {
        if (emptyState) emptyState.style.display = "grid";

        updateStats([]);
        updateTabs([]);
        updateHeaderText(0);
        return;
    }

    if (emptyState) emptyState.style.display = "none";

    const jobList = document.createElement("div");
    jobList.className = "job-list";

    jobList.innerHTML = jobs.map(job => {
        const title = escapeHtml(job.basic?.jobTitle || "Untitled Job");
        const category = escapeHtml(job.basic?.category || "No category");
        const jobType = escapeHtml(job.basic?.jobType || "Job");

        const status = String(job.status?.jobStatus || "reviewing").toLowerCase();
        const reviewStatus = cleanText(job.status?.reviewStatus || "pending review");
        const paymentStatus = cleanText(job.payment?.paymentStatus || "unknown");

        const amount = Number(job.payment?.amountToPay || job.budget?.budgetAmount || 0);
        const currency = escapeHtml(job.payment?.currency || job.budget?.currency || "USD");
        const plan = escapeHtml(job.visibility?.plan || "Free Post");
        const postedDate = formatDate(job.status?.postedAt);

        return `
            <article class="job-row">
                <div>
                    <span class="job-status ${getStatusClass(status)}">
                        ${escapeHtml(cleanText(status))}
                    </span>
                </div>

                <div class="job-info">
                    <h3>${title}</h3>
                    <p>${category} • ${jobType}</p>

                    <div class="job-meta">
                        <span>
                            <i class="fa-solid fa-clock"></i>
                            ${postedDate}
                        </span>

                        <span>
                            <i class="fa-solid fa-shield-halved"></i>
                            ${escapeHtml(reviewStatus)}
                        </span>

                        <span>
                            <i class="fa-solid fa-credit-card"></i>
                            ${escapeHtml(paymentStatus)}
                        </span>
                    </div>
                </div>

                <div class="job-budget">
                    <h4>${amount > 0 ? `${currency} ${amount}` : "Free"}</h4>
                    <p>${plan}</p>
                </div>

                <div class="job-actions">
                    <a href="./client-job-details.html?Id=${encodeURIComponent(job.jobId || "")}">
                        View
                    </a>
                </div>
            </article>
        `;
    }).join("");

    content.appendChild(jobList);

    updateStats(jobs);
    updateTabs(jobs);
    updateHeaderText(jobs.length);
}

/* =========================
   UPDATE STATS
========================= */
function updateStats(jobs) {
    const statCards = document.querySelectorAll(".stat-card");

    const totalJobs = jobs.length;

    const openJobs = jobs.filter(job =>
        String(job.status?.jobStatus || "").toLowerCase() === "open"
    ).length;

    const inProgress = jobs.filter(job =>
        String(job.status?.jobStatus || "").toLowerCase() === "in_progress"
    ).length;

    const totalSpent = jobs.reduce((sum, job) => {
        const paid = String(job.payment?.paymentStatus || "").toLowerCase() === "paid";
        return paid ? sum + Number(job.payment?.amountToPay || 0) : sum;
    }, 0);

    if (statCards[0]) {
        statCards[0].querySelector("h2").textContent = totalJobs;
        statCards[0].querySelector("p").textContent = totalJobs ? "All posted jobs" : "No jobs loaded yet";
    }

    if (statCards[1]) {
        statCards[1].querySelector("h2").textContent = openJobs;
        statCards[1].querySelector("p").textContent = openJobs ? "Currently accepting proposals" : "No open jobs yet";
    }

    if (statCards[2]) {
        statCards[2].querySelector("h2").textContent = inProgress;
        statCards[2].querySelector("p").textContent = inProgress ? "Jobs currently active" : "No active contracts";
    }

    if (statCards[3]) {
        statCards[3].querySelector("h2").textContent = `$${totalSpent}`;
        statCards[3].querySelector("p").textContent = totalSpent ? "Confirmed payments" : "No payments yet";
    }
}

/* =========================
   UPDATE TABS
========================= */
function updateTabs(jobs) {
    const tabs = document.querySelectorAll(".client-tabs a");

    const all = jobs.length;

    const open = jobs.filter(job =>
        String(job.status?.jobStatus || "").toLowerCase() === "open"
    ).length;

    const progress = jobs.filter(job =>
        String(job.status?.jobStatus || "").toLowerCase() === "in_progress"
    ).length;

    const closed = jobs.filter(job =>
        String(job.status?.jobStatus || "").toLowerCase() === "closed"
    ).length;

    const counts = [all, open, progress, closed];

    tabs.forEach((tab, index) => {
        const span = tab.querySelector("span");
        if (span) span.textContent = counts[index] || 0;
    });
}

/* =========================
   HEADER TEXT
========================= */
function updateHeaderText(count) {
    const headerP = document.querySelector(".content-header p");
    const heroP = document.querySelector(".client-hero p");

    if (headerP) {
        headerP.textContent = count
            ? `You have posted ${count} job${count === 1 ? "" : "s"}.`
            : "You have not posted any jobs yet.";
    }

    if (heroP) {
        heroP.textContent = count
            ? "Manage your posted jobs, proposals, reviews, contracts, and payments from one dashboard."
            : "Your posted jobs will appear here after loading. You can track review status, proposals, contracts, and payments.";
    }
}

/* =========================
   ERROR
========================= */
function showJobsError(message) {
    const skeleton = document.querySelector(".job-skeleton-list");
    if (skeleton) skeleton.remove();

    const loader = document.querySelector(".jobs-loading");
    if (loader) loader.remove();

    const oldError = document.querySelector(".jobs-error");
    if (oldError) oldError.remove();

    const content = document.querySelector(".client-content");
    if (!content) return;

    const emptyState = document.querySelector(".empty-state");
    if (emptyState) emptyState.style.display = "none";

    const errorBox = document.createElement("div");
    errorBox.className = "jobs-error";

    errorBox.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation"></i>
        <h3>Could not load jobs</h3>
        <p>${escapeHtml(message)}</p>
        <button type="button" onclick="loadClientJobs()">Try Again</button>
    `;

    content.appendChild(errorBox);
}

/* =========================
   HELPERS
========================= */
function getStatusClass(status) {
    if (status === "open") return "open";
    if (status === "reviewing") return "reviewing";
    if (status === "pending_payment") return "pending";
    if (status === "in_progress") return "progress";
    if (status === "closed") return "closed";
    return "pending";
}

function formatDate(timestamp) {
    if (!timestamp) return "Just now";

    const date = new Date(Number(timestamp));

    if (isNaN(date.getTime())) return "Just now";

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

function cleanText(text) {
    return String(text || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, char => char.toUpperCase());
}

function escapeHtml(text) {
    return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}