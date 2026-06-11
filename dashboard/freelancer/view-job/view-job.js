const API_URL = "https://backend.impactacademy.site";
let APPLICATION_STATUS = null;
let CURRENT_JOB_DATA = null;

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
   HELPERS
========================= */
function getJobIdFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return (
        params.get("id") ||
        params.get("jobId") ||
        params.get("Id") ||
        ""
    ).trim();
}

function $(id) {
    return document.getElementById(id);
}

function cleanText(value, fallback = "Not provided") {
    const text = String(value || "").trim();
    return text || fallback;
}

function formatMoney(amount, currency = "USD") {
    const value = Number(amount || 0);

    if (!value) return `${currency} 0`;

    try {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency || "USD",
            maximumFractionDigits: 0
        }).format(value);
    } catch {
        return `${currency} ${value.toLocaleString()}`;
    }
}

function formatDate(timestamp, isoDate) {
    if (isoDate) {
        const date = new Date(isoDate);
        if (!isNaN(date.getTime())) {
            return `Posted: ${date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
            })}`;
        }
    }

    if (timestamp) {
        const date = new Date(Number(timestamp));
        if (!isNaN(date.getTime())) {
            return `Posted: ${date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
            })}`;
        }
    }

    return "Posted date not available";
}

function showLoading() {
    $("jobLoadingState").style.display = "flex";
    $("jobErrorState").style.display = "none";
    $("jobContent").style.display = "none";
}

function showError(message) {
    $("jobLoadingState").style.display = "none";
    $("jobContent").style.display = "none";
    $("jobErrorState").style.display = "block";

    const errorText = $("jobErrorState").querySelector("p");
    if (errorText) {
        errorText.textContent = message || "The job details could not be loaded. Please go back and try again.";
    }
}

function showContent() {
    $("jobLoadingState").style.display = "none";
    $("jobErrorState").style.display = "none";
    $("jobContent").style.display = "block";
}

function setText(id, value, fallback = "Not provided") {
    const el = $(id);
    if (!el) return;
    el.textContent = cleanText(value, fallback);
}

function setHTML(id, html) {
    const el = $(id);
    if (!el) return;
    el.innerHTML = html;
}

function escapeHTML(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function paragraphText(value) {
    const text = cleanText(value, "No information provided.");
    return escapeHTML(text);
}

function getJobIcon(category, jobType) {
    const value = `${category || ""} ${jobType || ""}`.toLowerCase();

    if (value.includes("audio")) return "fa-solid fa-microphone-lines";
    if (value.includes("writing")) return "fa-solid fa-pen-nib";
    if (value.includes("design")) return "fa-solid fa-palette";
    if (value.includes("web") || value.includes("development")) return "fa-solid fa-code";
    if (value.includes("marketing")) return "fa-solid fa-bullhorn";
    if (value.includes("virtual")) return "fa-solid fa-headset";

    return "fa-solid fa-briefcase";
}

/* =========================
   LOAD JOB DETAILS
========================= */
async function loadJobDetails(jobId) {
    const response = await fetch(`${API_URL}/api/load-job-details/${encodeURIComponent(jobId)}`, {
        method: "GET",
        credentials: "include",
        headers: {
            "Content-Type": "application/json"
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load job details");
    }

    return data.job;
}

/* =========================
   RENDER JOB
========================= */
function renderJob(job) {
    const basic = job.basic || {};
    const details = job.details || {};
    const skills = job.skills || {};
    const budget = job.budget || {};
    const pref = job.freelancerPreference || {};
    const status = job.status || {};
    const client = job.client || {};
    CURRENT_JOB_ID = job.jobId || getJobIdFromQuery();

    const title = cleanText(basic.jobTitle, "Untitled Job");
    const category = cleanText(basic.category, "General");
    const jobType = cleanText(basic.jobType, "Job");
    const budgetType = cleanText(budget.budgetType, "Budget");
    const currency = cleanText(budget.currency, "USD");
    const amount = Number(budget.budgetAmount || 0);
    const timeline = cleanText(budget.timeline, "Not provided");
    const experience = cleanText(pref.experienceLevel, "Not provided");
    const location = cleanText(pref.locationPreference, "Remote");
    const communication = cleanText(pref.communication, "Not provided");

    setText("jobPostedDate", formatDate(status.postedAt, status.postedAtISO), "");
    setText("jobTitle", title);
    setText("jobOverview", details.description || "No project overview provided.");
    setText("jobDescription", details.deliverables || details.description || "No job description provided.");

    setText("jobBudget", formatMoney(amount, currency));
    setText("jobType", jobType || budgetType);
    setText("jobExperience", experience);
    setText("jobCategory", category);

    const icon = $("jobMainIcon");
    if (icon) {
        icon.className = getJobIcon(category, jobType);
    }

    const tags = [
        `<span><i class="fa-solid fa-sack-dollar"></i> ${escapeHTML(formatMoney(amount, currency))}</span>`,
        `<span><i class="fa-solid fa-briefcase"></i> ${escapeHTML(budgetType)}</span>`,
        `<span><i class="fa-solid fa-layer-group"></i> ${escapeHTML(category)}</span>`,
        `<span><i class="fa-solid fa-location-dot"></i> ${escapeHTML(location)}</span>`,
        `<span><i class="fa-regular fa-clock"></i> ${escapeHTML(timeline)}</span>`
    ];

    setHTML("jobTags", tags.join(""));

    const skillList = Array.isArray(skills.requiredSkills)
        ? skills.requiredSkills.filter(Boolean)
        : [];

    if (skillList.length) {
        setHTML(
            "jobSkills",
            skillList.map(skill => `<span>${escapeHTML(skill)}</span>`).join("")
        );
    } else {
        setHTML("jobSkills", `<span>No skills listed</span>`);
    }

    const avatarText = cleanText(client.fullname, "Client").charAt(0).toUpperCase();

    setText("clientAvatar", avatarText, "C");
    setText("clientName", client.fullname || "Client");
    setHTML(
        "clientVerifiedText",
        client.verified
            ? `<i class="fa-solid fa-circle-check"></i> Verified client`
            : `<i class="fa-regular fa-circle"></i> Client`
    );

    setText(
        "clientNote",
        `Preferred communication: ${communication}. Location preference: ${location}.`
    );

    const submitButtons = [
        $("submitProposalBtn"),
        $("sideSubmitProposalBtn")
    ];

    submitButtons.forEach((btn) => {
        if (!btn) return;

        btn.onclick = async function () {
            await openProposalModal(job);
        };
    });

    const saveBtn = $("saveJobBtn");

    if (saveBtn) {
        saveBtn.onclick = function () {
            saveBtn.classList.toggle("saved");

            if (saveBtn.classList.contains("saved")) {
                saveBtn.innerHTML = `<i class="fa-solid fa-bookmark"></i> Saved`;
            } else {
                saveBtn.innerHTML = `<i class="fa-regular fa-bookmark"></i> Save`;
            }
        };
    }
}

/* =========================
   PROPOSAL MODAL
========================= */
async function openProposalModal(job) {
    const modal = $("proposalModalOverlay");
    if (!modal) return;

    CURRENT_JOB_DATA = job;
    fillProposalModal(job);

    try {
        const status = await checkJobApplicationStatus();
        applyApplicationStatusToUI(status);
    } catch (error) {
        console.error("Application status check error:", error);
        setProposalSubmitState();
    }

    modal.classList.add("active");
    document.body.classList.add("modal-open");
}

function closeProposalModal() {
    const modal = $("proposalModalOverlay");
    if (!modal) return;

    modal.classList.remove("active");
    document.body.classList.remove("modal-open");
}

function fillProposalModal(job) {
    const basic = job.basic || {};
    const budget = job.budget || {};
    const pref = job.freelancerPreference || {};
    const skills = job.skills || {};

    const title = cleanText(basic.jobTitle, "Untitled Job");
    const category = cleanText(basic.category, "General");
    const jobType = cleanText(basic.jobType, "Fixed Price");
    const budgetType = cleanText(budget.budgetType, "Fixed Price");
    const currency = cleanText(budget.currency, "USD");
    const amount = Number(budget.budgetAmount || 0);
    const timeline = cleanText(budget.timeline, "Ongoing Project");
    const location = cleanText(pref.locationPreference, "Global - Any Location");
    const experience = cleanText(pref.experienceLevel, "Freelancers & Agencies");

    setText("modalJobTitle", title);
    setText("modalJobCategory", category);
    setText("modalJobLocation", location);
    setText("modalJobExperience", experience);
    setText("modalJobTimeline", timeline);
    setText("modalJobBudget", formatMoney(amount, currency));
    setText("modalJobEarnings", formatMoney(amount, currency));
    setText("modalJobType", jobType || budgetType);

    const modalIcon = $("modalJobIcon");
    if (modalIcon) {
        modalIcon.className = getJobIcon(category, jobType);
    }

    const skillList = Array.isArray(skills.requiredSkills)
        ? skills.requiredSkills.filter(Boolean).slice(0, 2)
        : [];

    const tags = [
        `<span><i class="fa-solid fa-screwdriver-wrench"></i> ${escapeHTML(category)}</span>`,
        `<span><i class="fa-solid fa-briefcase"></i> ${escapeHTML(jobType)}</span>`,
        ...skillList.map(skill => `<span><i class="fa-solid fa-tag"></i> ${escapeHTML(skill)}</span>`)
    ];

    setHTML("modalJobTags", tags.join(""));
}

function initProposalModalEvents() {
    const closeBtn = $("closeProposalModal");
    const cancelBtn = $("cancelProposalModal");
    const overlay = $("proposalModalOverlay");
    const sendBtn = $("sendProposalBtn");

    if (closeBtn) closeBtn.onclick = closeProposalModal;
    if (cancelBtn) cancelBtn.onclick = closeProposalModal;

    if (overlay) {
        overlay.addEventListener("click", function (event) {
            if (event.target === overlay) {
                closeProposalModal();
            }
        });
    }

    if (sendBtn) {
        sendBtn.onclick = function () {
            console.log("Submit proposal button clicked. Backend will be handled later.");
        };
    }

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeProposalModal();
        }
    });
}

let CURRENT_JOB_ID = "";
let CURRENT_INTERVIEW_ID = "";
let AI_INTERVIEW_BUSY = false;
let AI_INTERVIEW_ENDED = false;
let AI_CAN_APPLY = false;

async function startAiInterview(question = "") {
    const jobId = CURRENT_JOB_ID || getJobIdFromQuery();

    if (!jobId) throw new Error("Job ID is missing");

    const response = await fetch(`${API_URL}/api/ai-interview/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, question })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to start AI interview");
    }

    return data;
}
async function submitProposalAfterInterview() {
    const status = await checkJobApplicationStatus();

    if (status.alreadyApplied) {
        applyApplicationStatusToUI(status);
        addSystemBubble("You already submitted a proposal for this job.");
        return;
    }

    if (status.disapproved) {
        applyApplicationStatusToUI(status);
        addSystemBubble("Your interview was rejected. You cannot submit a proposal for this job.");
        return;
    }

    if (!status.canApply || !status.interviewEnded) {
        applyApplicationStatusToUI(status);
        addSystemBubble("You must complete and pass the AI interview before submitting this proposal.");
        return;
    }

    const btn = $("chatSubmitProposalBtn");
    const mainBtn = $("sendProposalBtn");

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `Submitting <i class="fa-solid fa-spinner"></i>`;
        }

        if (mainBtn) {
            mainBtn.disabled = true;
            mainBtn.innerHTML = `Submitting <i class="fa-solid fa-spinner"></i>`;
        }

        const response = await fetch(`${API_URL}/api/submit-job-proposal`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                jobId: CURRENT_JOB_ID || getJobIdFromQuery(),
                interviewId: CURRENT_INTERVIEW_ID
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Failed to submit proposal");
        }

        addSystemBubble("Proposal submitted successfully. The client can now see your proposal.");

        APPLICATION_STATUS = {
            alreadyApplied: true,
            status: "already_applied"
        };

        applyApplicationStatusToUI(APPLICATION_STATUS);

    } catch (error) {
        addSystemBubble(error.message || "Failed to submit proposal.");
        setProposalSubmitState();
    }
}
function setProposalSubmitState() {
    const buttons = [
        $("sendProposalBtn"),
        $("chatSubmitProposalBtn")
    ];

    const canSubmit =
        AI_INTERVIEW_ENDED &&
        AI_CAN_APPLY;

    buttons.forEach((btn) => {
        if (!btn) return;

        // ALWAYS disabled unless approved
        btn.disabled = !canSubmit;

        if (canSubmit) {
            btn.innerHTML =
                `Submit Proposal <i class="fa-solid fa-check"></i>`;
            btn.classList.add("ready-submit");
            btn.classList.remove("locked-submit");
        } else {
            btn.innerHTML =
                `Submit Proposal <i class="fa-solid fa-lock"></i>`;
            btn.classList.remove("ready-submit");
            btn.classList.add("locked-submit");
        }
    });
}

function handleInterviewDecision(data) {
    const decision = data.decision || {};
    const canApply = !!data.canApply || !!decision.canApply;
    const interviewEnded = !!data.interviewEnded || !!decision.interviewEnded;

    AI_CAN_APPLY = canApply;
    AI_INTERVIEW_ENDED = interviewEnded;

    setProposalSubmitState();

    if (canApply) {
        addSystemBubble(
            `AI interview passed. Score: ${decision.score || 0}/100. You can now submit your proposal.`
        );

        enableInterviewInput(false);
        setInterviewCardState("ended", "You passed the AI interview. You can now submit your proposal.");
        return;
    }

    if (interviewEnded) {
        const msg =
            decision.frontendMessage ||
            "The AI interview has ended. You are not approved to submit a proposal for this job yet.";

        addSystemBubble(msg);
        enableInterviewInput(false);
        setInterviewCardState("ended", msg);
        return;
    }

    // interview still running
    AI_INTERVIEW_ENDED = false;
    setInterviewCardState("ready");
    enableInterviewInput(true);
}

function openAiInterviewModal() {
    const proposalModal = $("proposalModalOverlay");
    const aiModal = $("aiInterviewModalOverlay");

    if (proposalModal) proposalModal.classList.remove("active");
    if (aiModal) aiModal.classList.add("active");

    // always re-check state
    setProposalSubmitState();

    document.body.classList.add("modal-open");
}

function closeAiInterviewModal() {
    const aiModal = $("aiInterviewModalOverlay");
    if (aiModal) aiModal.classList.remove("active");
    document.body.classList.remove("modal-open");
}

function goBackToProposalModal() {
    const aiModal = $("aiInterviewModalOverlay");
    const proposalModal = $("proposalModalOverlay");

    if (aiModal) aiModal.classList.remove("active");
    if (proposalModal) proposalModal.classList.add("active");

    document.body.classList.add("modal-open");
}

function setInterviewCardState(state, message = "") {
    const startBtn = $("startInterviewBtn");
    const cardTitle = document.querySelector(".ai-interview-body h4");
    const cardText = document.querySelector(".ai-interview-body p");
    const statusText = document.querySelector(".ai-interview-top span");

    if (!startBtn) return;

    if (state === "ended") {
        startBtn.disabled = true;
        startBtn.innerHTML = `Interview Ended <i class="fa-solid fa-lock"></i>`;
        startBtn.classList.add("ended");

        if (cardTitle) cardTitle.textContent = "Interview Completed";
        if (cardText) cardText.textContent = message || "This interview has already ended.";
        if (statusText) statusText.innerHTML = `<i class="fa-solid fa-circle"></i> Completed`;
        return;
    }

    if (state === "loading") {
        startBtn.disabled = true;
        startBtn.innerHTML = `Starting Interview <i class="fa-solid fa-spinner"></i>`;
        startBtn.classList.add("loading");
        return;
    }

    startBtn.disabled = false;
    startBtn.classList.remove("loading", "ended");
    startBtn.innerHTML = `Start Live Chat Interview <i class="fa-solid fa-arrow-right"></i>`;

    if (cardTitle) cardTitle.textContent = "Complete AI Live Chat Interview to Apply";
    if (cardText) {
        cardText.textContent =
            "This job requires you to complete a live chat interview to apply. The interview will be conducted by Impact Academy AI system to see if you are qualified. This only takes a few minutes.";
    }
    if (statusText) statusText.innerHTML = `<i class="fa-solid fa-circle"></i> Available Now`;
}

function setStartInterviewLoading(isLoading) {
    if (isLoading) {
        setInterviewCardState("loading");
        return;
    }

    if (AI_INTERVIEW_ENDED) return;

    setInterviewCardState("ready");
}

function enableInterviewInput(enabled) {
    const input = $("aiInterviewMessageInput");
    const sendBtn = $("sendInterviewMessageBtn");
    const inputBox = document.querySelector(".ai-chat-input-box");

    const canType = enabled && !AI_INTERVIEW_ENDED && !AI_INTERVIEW_BUSY;
    const hasText = input ? input.value.trim().length > 0 : false;

    if (input) input.disabled = !canType;

    if (sendBtn) {
        sendBtn.disabled = !canType || !hasText;
    }

    if (inputBox) {
        inputBox.classList.toggle("active", canType);
    }
}

function getChatTime() {
    return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function clearInterviewMessages() {
    const messages = $("aiChatMessages");
    if (!messages) return;
    messages.innerHTML = "";
}

function scrollChatToBottom() {
    const messages = $("aiChatMessages");
    if (!messages) return;
    messages.scrollTop = messages.scrollHeight;
}

function addChatBubble(role, text) {
    const messages = $("aiChatMessages");
    if (!messages) return;

    const safeText = escapeHTML(text || "");
    const isUser = role === "user";

    const row = document.createElement("div");
    row.className = `chat-row ${isUser ? "user" : "ai"}`;

    row.innerHTML = `
    <div class="chat-avatar">
      <i class="${isUser ? "fa-solid fa-user" : "fa-solid fa-robot"}"></i>
    </div>

    <div class="chat-message-wrap">
      <div class="chat-name-time">
        <strong>${isUser ? "You" : "Impactech AI Interviewer"}</strong>
        <span>${getChatTime()}</span>
      </div>

      <div class="chat-bubble">${safeText}</div>
    </div>
  `;

    messages.appendChild(row);
    scrollChatToBottom();
}

function addSystemBubble(text) {
    const messages = $("aiChatMessages");
    if (!messages) return;

    const row = document.createElement("div");
    row.className = "chat-system-row";

    row.innerHTML = `
    <div class="chat-system-bubble">
      <i class="fa-solid fa-circle-info"></i>
      <span>${escapeHTML(text)}</span>
    </div>
  `;

    messages.appendChild(row);
    scrollChatToBottom();
}

function showAiTyping() {
    const messages = $("aiChatMessages");
    if (!messages) return;

    removeAiTyping();

    const row = document.createElement("div");
    row.className = "chat-row ai";
    row.id = "aiTypingRow";

    row.innerHTML = `
    <div class="chat-avatar">
      <i class="fa-solid fa-robot"></i>
    </div>

    <div class="chat-message-wrap">
      <div class="chat-name-time">
        <strong>Impactech AI Interviewer</strong>
        <span>typing...</span>
      </div>

      <div class="ai-typing">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;

    messages.appendChild(row);
    scrollChatToBottom();
}

function removeAiTyping() {
    const typing = $("aiTypingRow");
    if (typing) typing.remove();
}

async function beginAiInterview() {
    if (AI_INTERVIEW_BUSY) return;

    AI_INTERVIEW_BUSY = true;
    AI_INTERVIEW_ENDED = false;
    AI_CAN_APPLY = false;

    setProposalSubmitState(false);
    setStartInterviewLoading(true);

    try {
        openAiInterviewModal();
        clearInterviewMessages();
        enableInterviewInput(false);
        showAiTyping();

        const data = await startAiInterview("");

        CURRENT_INTERVIEW_ID = data.interviewId || "";

        removeAiTyping();

        const aiText =
            data.question ||
            data.aiMessage?.text ||
            "Hi, thanks for joining. Can you briefly explain your experience related to this job?";

        addChatBubble("ai", aiText);

        AI_INTERVIEW_BUSY = true;
        AI_INTERVIEW_ENDED = false;
        AI_CAN_APPLY = false;

        setProposalSubmitState(); // still disabled

        const input = $("aiInterviewMessageInput");
        if (input && !AI_INTERVIEW_ENDED) input.focus();

    } catch (error) {
        removeAiTyping();
        addChatBubble("ai", error.message || "Failed to start interview. Please try again.");
        enableInterviewInput(false);
    } finally {
        AI_INTERVIEW_BUSY = false;
        setStartInterviewLoading(false);
        if (!AI_INTERVIEW_ENDED) {
            enableInterviewInput(true);
        }
    }
}

async function sendInterviewMessage() {
    if (AI_INTERVIEW_BUSY || AI_INTERVIEW_ENDED) return;

    const input = $("aiInterviewMessageInput");
    const message = String(input?.value || "").trim();

    if (!message) return;

    AI_INTERVIEW_BUSY = true;
    setProposalSubmitState(); // keep disabled while chatting

    addChatBubble("user", message);

    input.value = "";
    enableInterviewInput(false);
    showAiTyping();

    try {
        const data = await startAiInterview(message);

        CURRENT_INTERVIEW_ID = data.interviewId || CURRENT_INTERVIEW_ID;

        removeAiTyping();

        const aiText =
            data.question ||
            data.aiMessage?.text ||
            "Thanks. Can you tell me more about your experience with this type of work?";

        addChatBubble("ai", aiText);

        // IMPORTANT: unlock before decision enables input
        AI_INTERVIEW_BUSY = false;

        handleInterviewDecision(data);

        if (!AI_INTERVIEW_ENDED) {
            enableInterviewInput(true);
            input.focus();
        }

    } catch (error) {
        removeAiTyping();
        addChatBubble("ai", error.message || "Failed to send message.");
        AI_INTERVIEW_BUSY = false;
        enableInterviewInput(true);

    } finally {
        AI_INTERVIEW_BUSY = false;

        if (!AI_INTERVIEW_ENDED) {
            enableInterviewInput(true);
        }
    }
}

function initAiInterviewModalEvents() {
    const startBtn = $("startInterviewBtn");
    const closeBtn = $("closeAiInterviewModal");
    const backBtn = $("backToJobDetailsBtn");
    const sendBtn = $("sendInterviewMessageBtn");
    const input = $("aiInterviewMessageInput");
    const submitProposalBtn = $("sendProposalBtn");
    const chatSubmitProposalBtn = $("chatSubmitProposalBtn");

    if (startBtn) startBtn.onclick = beginAiInterview;
    if (closeBtn) closeBtn.onclick = closeAiInterviewModal;
    if (backBtn) backBtn.onclick = goBackToProposalModal;
    if (sendBtn) sendBtn.onclick = sendInterviewMessage;

    if (submitProposalBtn) {
        submitProposalBtn.onclick = submitProposalAfterInterview;
    }

    if (chatSubmitProposalBtn) {
        chatSubmitProposalBtn.onclick = submitProposalAfterInterview;
    }

    if (input) {
        input.addEventListener("input", function () {
            const hasText = input.value.trim().length > 0;
            const sendBtn = $("sendInterviewMessageBtn");

            if (sendBtn && !AI_INTERVIEW_BUSY && !AI_INTERVIEW_ENDED) {
                sendBtn.disabled = !hasText;
            }
        });

        input.addEventListener("keydown", function (event) {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendInterviewMessage();
            }
        });
    }
}

function initAiInterviewEvents() {
    const input = $("aiInterviewMessageInput");
    const sendBtn = $("sendInterviewMessageBtn");
    const closeBtn = $("closeAiInterviewModal");
    const overlay = $("aiInterviewModalOverlay");

    // close modal
    if (closeBtn) {
        closeBtn.onclick = closeAiInterviewModal;
    }

    if (overlay) {
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) {
                closeAiInterviewModal();
            }
        });
    }

    // send message
    if (sendBtn) {
        sendBtn.onclick = sendInterviewMessage;
    }

    // INPUT WATCHER (PUT IT HERE)
    if (input) {
        input.addEventListener("input", function () {
            enableInterviewInput(true);
        });

        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();

                if (
                    !AI_INTERVIEW_BUSY &&
                    !AI_INTERVIEW_ENDED &&
                    input.value.trim()
                ) {
                    sendInterviewMessage();
                }
            }
        });
    }
}

async function checkJobApplicationStatus() {
    const jobId = CURRENT_JOB_ID || getJobIdFromQuery();

    if (!jobId) {
        throw new Error("Job ID is missing");
    }

    const response = await fetch(
        `${API_URL}/api/check-job-application-status/${encodeURIComponent(jobId)}`,
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
        throw new Error(data.message || "Failed to check application status");
    }

    APPLICATION_STATUS = data;

    AI_CAN_APPLY = !!data.canApply;
    AI_INTERVIEW_ENDED = !!data.interviewEnded;
    CURRENT_INTERVIEW_ID = data.interviewId || CURRENT_INTERVIEW_ID || "";

    return data;
}

function applyApplicationStatusToUI(status) {
    const buttons = [
        $("submitProposalBtn"),
        $("sideSubmitProposalBtn"),
        $("sendProposalBtn"),
        $("chatSubmitProposalBtn")
    ];

    buttons.forEach((btn) => {
        if (!btn) return;

        btn.classList.remove(
            "ready-submit",
            "locked-submit",
            "applied-submit",
            "rejected-submit",
            "running-submit"
        );
    });

    if (status.alreadyApplied) {
        buttons.forEach((btn) => {
            if (!btn) return;
            btn.disabled = true;
            btn.innerHTML = `Proposal Submitted <i class="fa-solid fa-check"></i>`;
            btn.classList.add("applied-submit");
        });

        setInterviewCardState("ended", "You have already submitted a proposal for this job.");
        enableInterviewInput(false);
        return;
    }

    if (status.disapproved || status.status === "disapproved") {
        buttons.forEach((btn) => {
            if (!btn) return;
            btn.disabled = true;
            btn.innerHTML = `Interview Rejected <i class="fa-solid fa-ban"></i>`;
            btn.classList.add("rejected-submit");
        });

        setInterviewCardState("ended", "Your AI interview was not approved for this job.");
        enableInterviewInput(false);
        return;
    }

    if (status.status === "interview_running") {
        buttons.forEach((btn) => {
            if (!btn) return;
            btn.disabled = true;
            btn.innerHTML = `Interview In Progress <i class="fa-solid fa-clock"></i>`;
            btn.classList.add("running-submit");
        });

        setInterviewCardState("ready", "Continue your AI interview before submitting proposal.");
        return;
    }

    if (status.status === "approved_to_apply") {
        AI_CAN_APPLY = true;
        AI_INTERVIEW_ENDED = true;
        setProposalSubmitState();
        setInterviewCardState("ended", "You passed the AI interview. You can now submit your proposal.");
        return;
    }

    // no interview yet
    AI_CAN_APPLY = false;
    AI_INTERVIEW_ENDED = false;
    setProposalSubmitState();
    setInterviewCardState("ready");
}

/* =========================
   PAGE LOAD
========================= */
document.addEventListener("DOMContentLoaded", async function () {
    showLoading();
    initProposalModalEvents();
    initAiInterviewModalEvents();
    initAiInterviewEvents()
    setProposalSubmitState();

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

    const jobId = getJobIdFromQuery();

    if (!jobId) {
        showError("No job ID was found in the page URL.");
        return;
    }

    try {
        const job = await loadJobDetails(jobId);

        if (!job) {
            showError("Job details were not found.");
            return;
        }

        renderJob(job);
        showContent();

    } catch (error) {
        console.error("Load job details error:", error);
        showError(error.message || "The job details could not be loaded.");
    }
});