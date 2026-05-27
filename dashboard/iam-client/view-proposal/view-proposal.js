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
    showPageLoading();

    const auth = await AuthenticateUser();

    if (!auth.success) {
        window.location.href = "../../signin";
        return;
    }

    await initViewProposalPage();
});

/* =========================
   INIT PAGE
========================= */
async function initViewProposalPage() {
    const proposalId = getProposalIdFromUrl();

    if (!proposalId) {
        showPageError("Proposal ID is missing from URL.");
        return;
    }

    await loadProposalDetails(proposalId);
}

/* =========================
   GET PROPOSAL ID
========================= */
function getProposalIdFromUrl() {
    const params = new URLSearchParams(window.location.search);

    return (
        params.get("id") ||
        params.get("proposalId") ||
        params.get("Id") ||
        ""
    ).trim();
}

/* =========================
   LOAD PROPOSAL DETAILS
========================= */
async function loadProposalDetails(proposalId) {
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get("jobId") || "";

    const response = await fetch(
        `${API_URL}/api/load-proposal-details/${encodeURIComponent(proposalId)}?jobId=${encodeURIComponent(jobId)}`,
        {
            method: "GET",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            }
        }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
        showPageError(data.message || "Failed to load proposal details.");
        return;
    }

    renderProposalDetails(data.proposal);
    hidePageLoading();
}

/* =========================
   RENDER DATA
========================= */
function renderProposalDetails(proposal = {}) {
    console.log("FULL PROPOSAL RESPONSE:", proposal);

    const raw = proposal.raw || proposal;

    const job = proposal.job || raw.job || {};
    const freelancer = proposal.freelancer || raw.freelancer || {};
    const setup = freelancer.freelancerSetup || freelancer.raw?.freelancerSetup || {};

    const basic = job.basic || {};
    const details = job.details || {};
    const skills = job.skills || {};
    const budget = job.budget || {};
    const pref = job.freelancerPreference || {};

    const proposalStatus =
        proposal.status ||
        raw.status ||
        raw.proposalStatus ||
        "pending";

    setProposalStatus("proposalStatus", proposalStatus);
    setProposalStatus("sideProposalStatus", proposalStatus);
    setText("jobTitle", basic.jobTitle || job.jobTitle || raw.jobTitle || "Untitled Job");
    setText("proposalSummary", proposal.aiReview || raw.aiReview || raw.interviewReview || "Proposal details loaded.");
    setText("jobDetailsSubtitle", basic.category || job.category || "Job information");

    setText("jobBudget", formatBudget(budget));
    setText("jobType", basic.jobType || job.jobType || "-");
    setText("jobDuration", budget.timeline || job.timeline || raw.deliveryTime || "-");
    setText("jobExperience", pref.experienceLevel || job.experienceLevel || "-");
    setText("jobLocation", pref.locationPreference || job.locationPreference || "-");

    setText("jobDescription", details.description || job.description || "-");

    renderSkills(skills.requiredSkills || job.requiredSkills || []);
    renderDeliverables(details.deliverables || job.deliverables || "");

    const fullname =
        freelancer.fullname ||
        freelancer.raw?.profile?.fullname ||
        freelancer.raw?.freelancerSetup?.fullname ||
        setup.fullname ||
        setup.fullName ||
        raw.freelancerName ||
        raw.fullname ||
        "Freelancer";

    setText("freelancerName", fullname);

    setText(
        "freelancerTitle",
        freelancer.title ||
        setup.title ||
        setup.professionalTitle ||
        setup.skillTitle ||
        raw.freelancerTitle ||
        "Freelancer"
    );

    renderAvatar(fullname, freelancer.photoURL || freelancer.profilePic || raw.profilePic);

    const score =
        proposal.aiScore ||
        proposal.interviewScore ||
        raw.aiScore ||
        raw.interviewScore ||
        raw.interview?.score ||
        "-";

    setText("aiScore", score === "-" ? "-" : `${score}%`);

    setText(
        "aiScoreText",
        proposal.aiReview ||
        raw.aiReview ||
        raw.interviewReview ||
        raw.interview?.description ||
        "AI interview result"
    );

    setText(
        "proposalSubmittedAt",
        formatDate(
            proposal.submittedAt ||
            proposal.createdAt ||
            raw.submittedAt ||
            raw.createdAt ||
            raw.timestamps?.submittedAt ||
            raw.meta?.createdAt
        )
    );

    setText(
        "expectedPay",
        proposal.expectedPay ||
        proposal.proposedBudget ||
        raw.expectedPay ||
        raw.proposedBudget ||
        raw.price ||
        "-"
    );

    setText("proposalSubtitle", "Freelancer proposal message");

    setText(
        "proposalText",
        proposal.proposalText ||
        proposal.coverLetter ||
        proposal.message ||
        raw.proposalText ||
        raw.coverLetter ||
        raw.message ||
        "-"
    );

    const acceptBtn = document.getElementById("acceptProposalBtn");
    const rejectBtn = document.getElementById("rejectProposalBtn");
    const messageBtn = document.getElementById("sendMessageBtn");

    if (acceptBtn) acceptBtn.dataset.proposalId = proposal.proposalId || raw.proposalId || "";
    if (rejectBtn) rejectBtn.dataset.proposalId = proposal.proposalId || raw.proposalId || "";
    if (messageBtn) messageBtn.dataset.freelancerUid = proposal.freelancerUid || raw.freelancerUid || "";
    lockProposalActionsIfFinal(proposalStatus);
    setupProposalDecisionButtons(proposal, raw);
}

/* =========================
   LOCK ACTIONS IF FINAL
========================= */
function lockProposalActionsIfFinal(status) {
    const clean = String(status || "").toLowerCase();

    const isFinal =
        clean === "rejected" ||
        clean === "accepted" ||
        clean === "approved" ||
        clean === "hired";

    const acceptBtn = document.getElementById("acceptProposalBtn");
    const rejectBtn = document.getElementById("rejectProposalBtn");

    if (!isFinal) return;

    if (acceptBtn) {
        acceptBtn.disabled = true;
        acceptBtn.classList.add("disabled");

        acceptBtn.innerHTML = `
      <i class="fa-solid fa-lock"></i>
      ${clean === "rejected" ? "Cannot Accept" : "Already Accepted"}
    `;
    }

    if (rejectBtn) {
        rejectBtn.disabled = true;
        rejectBtn.classList.add("disabled");

        rejectBtn.innerHTML = `
      <i class="fa-solid fa-lock"></i>
      ${clean === "rejected" ? "Already Rejected" : "Cannot Reject"}
    `;
    }
}

/* =========================
   RENDER HELPERS
========================= */
function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;

    el.textContent = value || "-";
}

function renderSkills(skillArray) {
    const box = document.getElementById("jobSkills");
    if (!box) return;

    box.innerHTML = "";

    if (!Array.isArray(skillArray) || skillArray.length === 0) {
        box.innerHTML = `<span>No skills added</span>`;
        return;
    }

    skillArray.forEach((skill) => {
        const span = document.createElement("span");
        span.textContent = skill;
        box.appendChild(span);
    });
}

function renderDeliverables(deliverables) {
    const list = document.getElementById("jobDeliverables");
    if (!list) return;

    list.innerHTML = "";

    const items = String(deliverables || "")
        .split(/\n|,|•|-/)
        .map(item => item.trim())
        .filter(Boolean);

    if (items.length === 0) {
        list.innerHTML = `<li>No deliverables added</li>`;
        return;
    }

    items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        list.appendChild(li);
    });
}

function renderAvatar(name, photoURL) {
    const avatar = document.getElementById("freelancerAvatar");
    if (!avatar) return;

    avatar.innerHTML = "";

    if (photoURL) {
        const img = document.createElement("img");
        img.src = photoURL;
        img.alt = name;
        img.className = "avatar-img";
        avatar.appendChild(img);
        return;
    }

    avatar.textContent = getInitials(name);
}

function getInitials(name) {
    return String(name || "F")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(word => word[0])
        .join("")
        .toUpperCase();
}

function formatBudget(budget = {}) {
    const currency = budget.currency || "USD";
    const amount = Number(budget.budgetAmount || 0);
    const type = budget.budgetType || "";

    if (!amount) return "-";

    return `${currency} ${amount.toLocaleString()}${type ? ` / ${type}` : ""}`;
}

function formatDate(value) {
    if (!value) return "-";

    const date = new Date(Number(value) || value);

    if (isNaN(date.getTime())) return "-";

    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function cleanStatus(status) {
    return String(status || "pending")
        .replace(/_/g, " ")
        .replace(/\b\w/g, char => char.toUpperCase());
}

/* =========================
   LOADING + ERROR
========================= */
function showPageLoading() {
    document.body.classList.add("page-loading");
}

function hidePageLoading() {
    document.body.classList.remove("page-loading");
}

function showPageError(message) {
    hidePageLoading();

    const page = document.querySelector(".view-job-page");

    if (!page) return;

    page.innerHTML = `
    <section class="page-error">
      <div class="page-error-icon">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>

      <h2>Unable to load proposal</h2>
      <p>${message}</p>

      <a href="../proposals/" class="back-btn">
        <i class="fa-solid fa-arrow-left"></i>
        Back to Proposals
      </a>
    </section>
  `;
}
/* =========================
   STATUS COLORS
========================= */
function setProposalStatus(id, status) {
    const el = document.getElementById(id);

    if (!el) return;

    const clean = String(status || "pending")
        .toLowerCase()
        .trim();

    el.textContent = cleanStatus(status);

    el.classList.remove(
        "status-pending",
        "status-approved",
        "status-accepted",
        "status-rejected",
        "status-hired"
    );

    if (
        clean.includes("pending") ||
        clean.includes("review")
    ) {
        el.classList.add("status-pending");
    }

    else if (
        clean.includes("accepted") ||
        clean.includes("approved") ||
        clean.includes("hired")
    ) {
        el.classList.add("status-approved");
    }

    else if (
        clean.includes("rejected") ||
        clean.includes("declined")
    ) {
        el.classList.add("status-rejected");
    }
}
let currentProposalDecision = null;

function setupProposalDecisionButtons(proposal = {}, raw = {}) {
    const acceptBtn = document.getElementById("acceptProposalBtn");
    const rejectBtn = document.getElementById("rejectProposalBtn");

    const proposalId = proposal.proposalId || raw.proposalId || getProposalIdFromUrl();
    const jobId = proposal.jobId || raw.jobId || proposal.job?.jobId || raw.job?.jobId || "";
    const freelancerUid = proposal.freelancerUid || raw.freelancerUid || proposal.freelancer?.uid || raw.freelancer?.uid || "";

    if (acceptBtn) {
        acceptBtn.onclick = function () {
            openDecisionModal({
                decision: "accepted",
                proposalId,
                jobId,
                freelancerUid
            });
        };
    }

    if (rejectBtn) {
        rejectBtn.onclick = function () {
            openDecisionModal({
                decision: "rejected",
                proposalId,
                jobId,
                freelancerUid
            });
        };
    }

    const closeBtn = document.getElementById("closeDecisionModal");
    const cancelBtn = document.getElementById("cancelDecisionBtn");
    const confirmBtn = document.getElementById("confirmDecisionBtn");

    if (closeBtn) closeBtn.onclick = closeDecisionModal;
    if (cancelBtn) cancelBtn.onclick = closeDecisionModal;
    if (confirmBtn) confirmBtn.onclick = submitProposalDecision;
}

function openDecisionModal(data) {
    if (!data.proposalId || !data.jobId || !data.freelancerUid) {
        alert("Missing proposal information. Please reload the page.");
        return;
    }

    currentProposalDecision = data;

    const modal = document.getElementById("decisionModal");
    const title = document.getElementById("decisionTitle");
    const text = document.getElementById("decisionText");
    const reason = document.getElementById("decisionReason");
    const confirmBtn = document.getElementById("confirmDecisionBtn");
    const icon = document.getElementById("decisionIcon");

    if (reason) reason.value = "";

    if (data.decision === "accepted") {
        if (title) title.textContent = "Accept Proposal?";
        if (text) text.textContent = "Are you sure you want to accept this freelancer proposal?";
        if (confirmBtn) {
            confirmBtn.className = "confirm-decision-btn accept";
            confirmBtn.innerHTML = `<i class="fa-solid fa-check"></i> Accept Proposal`;
        }
        if (icon) {
            icon.className = "decision-icon accept";
            icon.innerHTML = `<i class="fa-solid fa-check"></i>`;
        }
    } else {
        if (title) title.textContent = "Reject Proposal?";
        if (text) text.textContent = "Are you sure you want to reject this freelancer proposal?";
        if (confirmBtn) {
            confirmBtn.className = "confirm-decision-btn reject";
            confirmBtn.innerHTML = `<i class="fa-solid fa-ban"></i> Reject Proposal`;
        }
        if (icon) {
            icon.className = "decision-icon reject";
            icon.innerHTML = `<i class="fa-solid fa-ban"></i>`;
        }
    }

    if (modal) modal.classList.add("active");
}

function closeDecisionModal() {
    const modal = document.getElementById("decisionModal");
    if (modal) modal.classList.remove("active");

    currentProposalDecision = null;
}

async function submitProposalDecision() {
    if (!currentProposalDecision) return;

    const confirmBtn = document.getElementById("confirmDecisionBtn");
    const reasonInput = document.getElementById("decisionReason");

    const {
        proposalId,
        jobId,
        freelancerUid,
        decision
    } = currentProposalDecision;

    try {
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin"></i>
                Processing...
            `;
        }

        const response = await fetch(`${API_URL}/api/client/proposal-decision`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                proposalId,
                jobId,
                freelancerUid,
                decision,
                reason: reasonInput?.value?.trim() || `Client ${decision} this proposal`
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Failed to update proposal");
        }

        closeDecisionModal();

        await loadProposalDetails(proposalId);

    } catch (error) {
        console.error("PROPOSAL DECISION ERROR:", error);
        alert(error.message || "Failed to update proposal");

    } finally {
        if (confirmBtn) {
            confirmBtn.disabled = false;
        }
    }
}