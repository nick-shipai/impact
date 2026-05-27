const API_URL = "https://backend.impactacademy.site";
function setPageSkeletonLoading() {
    document.querySelector(".client-profile").innerHTML = `<span class="profile-skeleton"></span>`;

    document.querySelectorAll(".stat-card").forEach(card => {
        card.classList.add("skeleton-card");
        card.querySelector("h2").innerHTML = `<span class="skeleton-line short"></span>`;
        card.querySelector("p").innerHTML = `<span class="skeleton-line"></span>`;
    });

    const content = document.querySelector(".client-content");
    const oldList = document.querySelector(".job-list");
    if (oldList) oldList.remove();

    const emptyState = document.querySelector(".empty-state");
    if (emptyState) emptyState.style.display = "none";

    const oldLoader = document.querySelector(".jobs-loading");
    if (oldLoader) oldLoader.remove();

    content.insertAdjacentHTML("beforeend", `
        <div class="job-skeleton-list">
            ${Array(4).fill("").map(() => `
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
            `).join("")}
        </div>
    `);
}
setPageSkeletonLoading();
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

document.addEventListener("DOMContentLoaded", async function () {
    const auth = await AuthenticateUser();

    if (!auth.success) {
        window.location.href = "../../signin";
        return;
    }

    initClientPage(auth.user);
});

function stopPageSkeletonLoading() {
    document.querySelectorAll(".skeleton-card").forEach(card => {
        card.classList.remove("skeleton-card");
    });

    const skeleton = document.querySelector(".job-skeleton-list");
    if (skeleton) skeleton.remove();
}

async function initClientPage(user) {
    await Promise.all([
        updateClientProfile(user),
        loadClientJobs()
    ]);

    stopPageSkeletonLoading();
}

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
        console.log("Profile pic response:", data);

        profile.innerHTML = "";

        // show image if exists
        if (response.ok && data.success && data.profilePic) {
            const img = document.createElement("img");
            img.src = data.profilePic;
            img.alt = "Profile";
            img.className = "profile-avatar";
            profile.appendChild(img);
            return;
        }

        // fallback to API username first letter
        const username =
            data?.username ||
            user?.username ||
            user?.firstname ||
            user?.email ||
            "C";

        const text = document.createElement("span");
        text.className = "profile-letter";
        text.textContent = username.trim().charAt(0).toUpperCase();

        profile.appendChild(text);

    } catch (error) {
        console.error("PROFILE PIC LOAD ERROR:", error);

        profile.innerHTML = "";

        const username =
            user?.username ||
            user?.firstname ||
            user?.email ||
            "C";

        const text = document.createElement("span");
        text.className = "profile-letter";
        text.textContent = username.trim().charAt(0).toUpperCase();

        profile.appendChild(text);
    }
}

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

function setJobsLoading() {
    const content = document.querySelector(".client-content");

    const oldList = document.querySelector(".job-list");
    if (oldList) oldList.remove();

    const emptyState = document.querySelector(".empty-state");
    if (emptyState) {
        emptyState.style.display = "none";
    }

    const loader = document.createElement("div");
    loader.className = "jobs-loading";
    loader.innerHTML = `
        <div class="jobs-loader-ring"></div>
        <h3>Loading your jobs...</h3>
        <p>Please wait while we fetch your posted jobs.</p>
    `;

    content.appendChild(loader);
}

function renderClientJobs(jobs) {
    const loader = document.querySelector(".jobs-loading");
    if (loader) loader.remove();

    const emptyState = document.querySelector(".empty-state");
    const content = document.querySelector(".client-content");

    if (!jobs.length) {
        if (emptyState) emptyState.style.display = "grid";
        updateStats([]);
        updateTabs([]);
        return;
    }

    if (emptyState) emptyState.style.display = "none";

    const oldList = document.querySelector(".job-list");
    if (oldList) oldList.remove();

    const jobList = document.createElement("div");
    jobList.className = "job-list";

    jobList.innerHTML = jobs.map(job => {
        const title = escapeHtml(job.basic?.jobTitle || "Untitled Job");
        const category = escapeHtml(job.basic?.category || "No category");
        const jobType = escapeHtml(job.basic?.jobType || "Job");
        const status = String(job.status?.jobStatus || "reviewing").toLowerCase();
        const reviewStatus = String(job.status?.reviewStatus || "pending_review").replaceAll("_", " ");
        const paymentStatus = String(job.payment?.paymentStatus || "unknown").replaceAll("_", " ");
        const amount = Number(job.payment?.amountToPay || 0);
        const currency = escapeHtml(job.payment?.currency || "USD");
        const postedDate = formatDate(job.status?.postedAt);

        return `
            <article class="job-row">
                <div>
                    <span class="job-status ${getStatusClass(status)}">
                        ${escapeHtml(status)}
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
                    <p>${escapeHtml(job.visibility?.plan || "Free Post")}</p>
                </div>

                <div class="job-actions">
                    <a href="./client-job-details.html?Id=${encodeURIComponent(job.jobId)}">
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

function updateStats(jobs) {
    const statCards = document.querySelectorAll(".stat-card");

    const activeJobs = jobs.filter(job =>
        ["open", "reviewing", "pending_payment"].includes(
            String(job.status?.jobStatus || "").toLowerCase()
        )
    ).length;

    const reviewing = jobs.filter(job =>
        String(job.status?.jobStatus || "").toLowerCase() === "reviewing"
    ).length;

    const totalSpent = jobs.reduce((sum, job) => {
        const paid = String(job.payment?.paymentStatus || "").toLowerCase() === "paid";
        return paid ? sum + Number(job.payment?.amountToPay || 0) : sum;
    }, 0);

    if (statCards[0]) {
        statCards[0].querySelector("h2").textContent = activeJobs;
        statCards[0].querySelector("p").textContent = `${reviewing} under review`;
    }

    if (statCards[1]) {
        statCards[1].querySelector("h2").textContent = "0";
        statCards[1].querySelector("p").textContent = "Proposals will show here";
    }

    if (statCards[2]) {
        statCards[2].querySelector("h2").textContent = "0";
        statCards[2].querySelector("p").textContent = "No freelancers hired yet";
    }

    if (statCards[3]) {
        statCards[3].querySelector("h2").textContent = `$${totalSpent}`;
        statCards[3].querySelector("p").textContent = "Confirmed payments";
    }
}

function updateTabs(jobs) {
    const tabs = document.querySelectorAll(".client-tabs a");

    const all = jobs.length;
    const open = jobs.filter(job => String(job.status?.jobStatus || "").toLowerCase() === "open").length;
    const progress = jobs.filter(job => String(job.status?.jobStatus || "").toLowerCase() === "in_progress").length;
    const closed = jobs.filter(job => String(job.status?.jobStatus || "").toLowerCase() === "closed").length;

    const counts = [all, open, progress, closed];

    tabs.forEach((tab, index) => {
        const span = tab.querySelector("span");
        if (span) span.textContent = counts[index] || 0;
    });
}

function updateHeaderText(count) {
    const headerP = document.querySelector(".content-header p");
    const heroP = document.querySelector(".client-hero p");

    if (headerP) {
        headerP.textContent = `You have posted ${count} job${count === 1 ? "" : "s"}.`;
    }

    if (heroP) {
        heroP.textContent = `Manage your posted jobs, proposals, reviews, and payments from one dashboard.`;
    }
}

function showJobsError(message) {
    const loader = document.querySelector(".jobs-loading");
    if (loader) loader.remove();

    const content = document.querySelector(".client-content");

    const errorBox = document.createElement("div");
    errorBox.className = "jobs-error";
    errorBox.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation"></i>
        <h3>Could not load jobs</h3>
        <p>${escapeHtml(message)}</p>
        <button onclick="loadClientJobs()">Try Again</button>
    `;

    content.appendChild(errorBox);
}

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

    return new Date(Number(timestamp)).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

function escapeHtml(text) {
    return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}