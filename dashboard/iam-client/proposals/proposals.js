const API_URL = "https://ai-impact-server.vercel.app";

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
    setProposalLoading();

    const auth = await AuthenticateUser();

    if (!auth.success) {
        window.location.href = "../../signin.html";
        return;
    }

    await initProposalsPage(auth.user);
});

/* =========================
   INIT
========================= */
async function initProposalsPage(user) {
    await Promise.all([
        updateClientProfile(user),
        loadClientProposals()
    ]);
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
            profile.innerHTML = `
                <img src="${escapeHtml(data.profilePic)}" alt="Profile" class="profile-avatar">
            `;
            return;
        }

        const username =
            data?.username ||
            user?.fullname ||
            user?.firstname ||
            user?.email ||
            "C";

        profile.innerHTML = `
            <span>${escapeHtml(username.trim().charAt(0).toUpperCase())}</span>
        `;

    } catch (error) {
        console.error("PROFILE LOAD ERROR:", error);

        const username =
            user?.fullname ||
            user?.firstname ||
            user?.email ||
            "C";

        profile.innerHTML = `
            <span>${escapeHtml(username.trim().charAt(0).toUpperCase())}</span>
        `;
    }
}

/* =========================
   LOAD PROPOSALS
========================= */
async function loadClientProposals() {
    try {
        setProposalLoading();

        const response = await fetch(`${API_URL}/api/load-client-proposals`, {
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

        renderProposals(data.proposals || [], data);

    } catch (error) {
        console.error("LOAD PROPOSALS ERROR:", error);
        showProposalError(error.message || "Failed to load proposals");
    }
}

/* =========================
   LOADING
========================= */
function setProposalLoading() {
    const skeleton = document.querySelector(".proposal-skeleton-list");
    const emptyState = document.querySelector(".empty-state");
    const oldList = document.querySelector(".proposal-list");
    const oldError = document.querySelector(".proposal-error");

    if (skeleton) skeleton.style.display = "grid";
    if (emptyState) emptyState.style.display = "none";
    if (oldList) oldList.remove();
    if (oldError) oldError.remove();

    document.querySelectorAll(".stat-card").forEach(card => {
        const h2 = card.querySelector("h2");
        const p = card.querySelector("p");

        if (h2) h2.innerHTML = `<span class="skeleton-line short"></span>`;
        if (p) p.innerHTML = `<span class="skeleton-line"></span>`;
    });

    updateTabs({
        total: "-",
        pending: "-",
        passed: "-",
        rejected: "-"
    });
}

/* =========================
   RENDER
========================= */
function renderProposals(proposals, counts = {}) {
    const skeleton = document.querySelector(".proposal-skeleton-list");
    const emptyState = document.querySelector(".empty-state");
    const content = document.querySelector(".client-content");
    const oldList = document.querySelector(".proposal-list");

    if (skeleton) skeleton.style.display = "none";
    if (oldList) oldList.remove();

    updateStats(proposals, counts);
    updateTabs({
        total: proposals.length,
        pending: counts.pendingCount ?? countStatus(proposals, "pending"),
        passed: counts.passedCount ?? proposals.filter(p => p.proposal?.interviewPassed).length,
        rejected: counts.rejectedCount ?? countStatus(proposals, "rejected")
    });

    if (!proposals.length) {
        if (emptyState) emptyState.style.display = "grid";
        return;
    }

    if (emptyState) emptyState.style.display = "none";

    const list = document.createElement("div");
    list.className = "proposal-list";

    list.innerHTML = proposals.map(item => {
        const proposalId = escapeHtml(item.proposalId || "");
        const jobId = escapeHtml(item.job?.jobId || "");
        const jobTitle = escapeHtml(item.job?.jobTitle || "Untitled Job");
        const category = escapeHtml(item.job?.category || "No category");

        const fullname = escapeHtml(item.freelancer?.fullname || "Freelancer");
        const email = escapeHtml(item.freelancer?.email || "");
        const title = escapeHtml(item.freelancer?.title || "Freelancer");
        const country = escapeHtml(item.freelancer?.country || "");
        const profilePic = item.freelancer?.profilePic || "";

        const coverLetter = escapeHtml(item.proposal?.coverLetter || "No cover letter provided.");
        const status = String(item.proposal?.status || "pending").toLowerCase();
        const aiScore = Number(item.proposal?.aiScore || item.proposal?.interviewScore || 0);
        const aiReview = escapeHtml(item.proposal?.aiReview || "No AI review available yet.");
        const interviewPassed = !!item.proposal?.interviewPassed;

        const proposedBudget = Number(item.proposal?.proposedBudget || 0);
        const currency = escapeHtml(item.job?.currency || "USD");
        const deliveryTime = escapeHtml(item.proposal?.deliveryTime || "Not set");
        const submittedAt = formatDate(item.timestamps?.submittedAt);

        const avatar = profilePic
            ? `<img src="${escapeHtml(profilePic)}" alt="${fullname}" class="freelancer-avatar-img">`
            : `<span>${fullname.charAt(0).toUpperCase()}</span>`;

        return `
            <article class="proposal-card" data-status="${escapeHtml(status)}">
                <div class="proposal-top">
                    <div class="freelancer-info">
                        <div class="avatar">${avatar}</div>

                        <div>
                            <h3>${fullname}</h3>
                            <p>${title}${country ? ` • ${country}` : ""}</p>
                            ${email ? `<small>${email}</small>` : ""}
                        </div>
                    </div>

                    <span class="status-badge ${getStatusClass(status, interviewPassed)}">
                        ${interviewPassed ? "Interview Passed" : cleanText(status)}
                    </span>
                </div>

                <div class="proposal-job">
                    <i class="fa-solid fa-briefcase"></i>
                    <span>${jobTitle} • ${category}</span>
                </div>

                <p class="proposal-text">${coverLetter}</p>

                <div class="proposal-meta">
                    <div>
                        <h4>${proposedBudget > 0 ? `${currency} ${proposedBudget}` : "Not set"}</h4>
                        <p>Proposed Budget</p>
                    </div>

                    <div>
                        <h4>${deliveryTime}</h4>
                        <p>Delivery Time</p>
                    </div>

                    <div>
                        <h4>${aiScore}%</h4>
                        <p>AI Score</p>
                    </div>

                    <div>
                        <h4>${submittedAt}</h4>
                        <p>Submitted</p>
                    </div>
                </div>

                <div class="ai-review">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                    <p><strong>AI Review:</strong> ${aiReview}</p>
                </div>

                <div class="proposal-actions">
                    <a href="./proposal-details.html?proposalId=${encodeURIComponent(proposalId)}&jobId=${encodeURIComponent(jobId)}" class="primary-action">
                        <i class="fa-solid fa-eye"></i>
                        View Proposal
                    </a>

                    <a href="../messages/?freelancer=${encodeURIComponent(item.freelancer?.uid || "")}" class="secondary-action">
                        <i class="fa-solid fa-message"></i>
                        Message
                    </a>
                </div>
            </article>
        `;
    }).join("");

    content.appendChild(list);
}

/* =========================
   STATS
========================= */
function updateStats(proposals, counts = {}) {
    const cards = document.querySelectorAll(".stat-card");

    const total = proposals.length;
    const passed = counts.passedCount ?? proposals.filter(p => p.proposal?.interviewPassed).length;
    const rejected = counts.rejectedCount ?? countStatus(proposals, "rejected");
    const shortlisted = countStatus(proposals, "shortlisted");

    setStat(cards[0], total, total ? "All received proposals" : "No proposals loaded yet");
    setStat(cards[1], passed, passed ? "Freelancers passed interview" : "No passed interviews yet");
    setStat(cards[2], shortlisted, shortlisted ? "Saved for review" : "No shortlisted proposals yet");
    setStat(cards[3], rejected, rejected ? "Rejected proposals" : "No rejected proposals yet");
}

function setStat(card, value, text) {
    if (!card) return;

    const h2 = card.querySelector("h2");
    const p = card.querySelector("p");

    if (h2) h2.textContent = value;
    if (p) p.textContent = text;
}

function updateTabs(counts) {
    const tabs = document.querySelectorAll(".client-tabs a");

    if (tabs[0]) tabs[0].querySelector("span").textContent = counts.total;
    if (tabs[1]) tabs[1].querySelector("span").textContent = counts.pending;
    if (tabs[2]) tabs[2].querySelector("span").textContent = counts.passed;
    if (tabs[3]) tabs[3].querySelector("span").textContent = counts.rejected;
}

function countStatus(proposals, status) {
    return proposals.filter(item =>
        String(item.proposal?.status || "").toLowerCase() === status
    ).length;
}

/* =========================
   ERROR
========================= */
function showProposalError(message) {
    const skeleton = document.querySelector(".proposal-skeleton-list");
    const emptyState = document.querySelector(".empty-state");
    const content = document.querySelector(".client-content");

    if (skeleton) skeleton.style.display = "none";
    if (emptyState) emptyState.style.display = "none";

    const oldError = document.querySelector(".proposal-error");
    if (oldError) oldError.remove();

    updateStats([], {});
    updateTabs({
        total: 0,
        pending: 0,
        passed: 0,
        rejected: 0
    });

    const errorBox = document.createElement("div");
    errorBox.className = "proposal-error";

    errorBox.innerHTML = `
        <div class="empty-icon danger">
            <i class="fa-solid fa-triangle-exclamation"></i>
        </div>

        <h3>Could not load proposals</h3>
        <p>${escapeHtml(message)}</p>

        <button onclick="loadClientProposals()" class="post-job-btn">
            <i class="fa-solid fa-rotate"></i>
            Try Again
        </button>
    `;

    content.appendChild(errorBox);
}

/* =========================
   HELPERS
========================= */
function getStatusClass(status, interviewPassed) {
    if (interviewPassed) return "passed";
    if (status === "rejected") return "rejected";
    if (status === "shortlisted") return "shortlisted";
    if (status === "approved") return "passed";
    return "pending";
}

function cleanText(text) {
    return String(text || "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, char => char.toUpperCase());
}

function formatDate(value) {
    if (!value) return "Not set";

    const date = new Date(Number(value));

    if (Number.isNaN(date.getTime())) {
        return "Not set";
    }

    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}