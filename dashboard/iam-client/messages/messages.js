const API_URL = "https://backend.impactacademy.site";

let CURRENT_USER = null;
let CURRENT_FREELANCER = null;
let CURRENT_CONVERSATION_ID = null;
let CURRENT_RECEIVER_UID = null;
let IS_FIRST_MESSAGE_LOAD = true;
let INBOX_TIMER = null;
let INBOX_ONLY_MODE = false;
let CHAT_TIMER = null;
let LAST_MESSAGE_COUNT = 0;
let TYPING_TIMER = null;
let TYPING_STATUS_TIMER = null;
let LAST_TYPING_STATE = false;
let CALL_TIMER_INTERVAL = null;
let CALL_SECONDS = 0;

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
    const auth = await AuthenticateUser();

    if (!auth.success) {
        window.location.href = "../../signin";
        return;
    }

    CURRENT_USER = auth.user;

    bindChatEvents();
    initVideoCallSystem();
    await initMessagesPage(auth.user);
});

/* =========================
   INIT PAGE
========================= */
async function initMessagesPage(user) {
    const params = new URLSearchParams(window.location.search);

    const freelancerUid =
        params.get("freelancer") ||
        params.get("freelancerUid") ||
        params.get("uid") ||
        params.get("chatId") ||
        "";

    startInboxRealtime();

    if (!freelancerUid) {
        INBOX_ONLY_MODE = true;
        showInboxOnlyMode();
        return;
    }

    INBOX_ONLY_MODE = false;
    CURRENT_RECEIVER_UID = freelancerUid;

    await loadFreelancerForChat(freelancerUid);
    await startConversation(freelancerUid);
}

function startInboxRealtime() {
    loadConversations();

    if (INBOX_TIMER) clearInterval(INBOX_TIMER);

    INBOX_TIMER = setInterval(() => {
        loadConversations(false);
    }, 3000);
}

function showInboxOnlyMode() {
    const chatWindow = document.querySelector(".chat-window-panel");
    const shell = document.querySelector(".messages-shell");

    if (chatWindow) {
        chatWindow.style.display = "none";
    }

    if (shell) {
        shell.classList.add("inbox-only");
    }
}

/* =========================
   LOAD FREELANCER
========================= */
async function loadFreelancerForChat(freelancerUid) {
    try {
        if (!CURRENT_CONVERSATION_ID) {
            setChatLoading();
        }

        const response = await fetch(
            `${API_URL}/api/load-freelancer-data/${encodeURIComponent(freelancerUid)}`,
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
            showChatError(
                "Could not load freelancer",
                data.message || "Something went wrong while loading this freelancer."
            );
            return null;
        }

        CURRENT_FREELANCER = data.freelancer;

        renderFreelancerHeader(data.freelancer);

        return data.freelancer;

    } catch (error) {
        console.error("loadFreelancerForChat error:", error);

        showChatError(
            "Network error",
            "Please check your connection and try again."
        );

        return null;
    }
}

/* =========================
   START CONVERSATION
========================= */
async function startConversation(receiverUid) {
    try {
        const response = await fetch(`${API_URL}/api/messages/start`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                receiverUid
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            showChatError(
                "Could not start chat",
                data.message || "Unable to start conversation."
            );
            return;
        }

        CURRENT_CONVERSATION_ID = data.conversationId;

        enableComposer(true);
        await loadMessages(CURRENT_CONVERSATION_ID, true);
        startChatRealtime(CURRENT_CONVERSATION_ID);
        startTypingRealtime();

    } catch (error) {
        console.error("startConversation error:", error);

        showChatError(
            "Chat failed",
            "Unable to start this chat right now."
        );
    }
}

/* =========================
   LOAD MESSAGES
========================= */
async function loadMessages(conversationId, forceScroll = false) {
    try {
        const response = await fetch(
            `${API_URL}/api/messages/chat/${encodeURIComponent(conversationId)}?limit=100`,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) return;

        const messages = data.messages || [];
        const signature = messages.map(m => `${m.messageId}_${m.read ? 1 : 0}`).join("|");

        if (window.LAST_CHAT_SIGNATURE === signature && !forceScroll) {
            return;
        }

        window.LAST_CHAT_SIGNATURE = signature;

        renderMessages(messages, forceScroll || messages.length !== LAST_MESSAGE_COUNT);

        LAST_MESSAGE_COUNT = messages.length;
        IS_FIRST_MESSAGE_LOAD = false;

    } catch (error) {
        console.error("loadMessages error:", error);
    }
}

/* =========================
   SEND MESSAGE
========================= */
async function sendMessage() {
    const input = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendMessageBtn");

    if (!input || !CURRENT_RECEIVER_UID) return;

    const message = input.value.trim();
    if (!message) return;

    const tempMessage = {
        messageId: "temp_" + Date.now(),
        senderUid: CURRENT_USER?.uid,
        receiverUid: CURRENT_RECEIVER_UID,
        message,
        createdAt: Date.now(),
        sending: true
    };

    appendMessageBubble(tempMessage);

    input.value = "";
    autoGrowTextarea(input);
    input.focus();

    if (sendBtn) sendBtn.disabled = true;

    try {
        sendTypingStatus(false);
        const response = await fetch(`${API_URL}/api/messages/send`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                receiverUid: CURRENT_RECEIVER_UID,
                message
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            alert(data.message || "Failed to send message");
            await loadMessages(CURRENT_CONVERSATION_ID);
            return;
        }

        if (data.conversationId) {
            CURRENT_CONVERSATION_ID = data.conversationId;
        }

        await loadMessages(CURRENT_CONVERSATION_ID, false);
        await loadConversations();

    } catch (error) {
        console.error("sendMessage error:", error);
        alert("Network error. Message not sent.");
        await loadMessages(CURRENT_CONVERSATION_ID);
    } finally {
        enableComposer(true);
        if (sendBtn) sendBtn.disabled = true;
        input.focus();
    }
}

function appendMessageBubble(msg) {
    const chatBody = document.getElementById("chatBody");
    if (!chatBody) return;

    chatBody.classList.add("chat-messages-body");

    let list = chatBody.querySelector(".messages-list");

    if (!list) {
        chatBody.innerHTML = `<div class="messages-list"></div>`;
        list = chatBody.querySelector(".messages-list");
    }

    list.insertAdjacentHTML("beforeend", renderMessageBubble(msg));
    chatBody.scrollTop = chatBody.scrollHeight;
}
/* =========================
   LOAD CONVERSATIONS
========================= */
async function loadConversations(showError = true) {
    try {
        const response = await fetch(`${API_URL}/api/messages/list`, {
            method: "GET",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            if (showError) renderEmptyConversations();
            return;
        }

        renderConversationList(data.conversations || []);

    } catch (error) {
        console.error("loadConversations error:", error);
        if (showError) renderEmptyConversations();
    }
}

function showChatPanelMode() {
    const chatWindow = document.querySelector(".chat-window-panel");
    const shell = document.querySelector(".messages-shell");

    if (chatWindow) {
        chatWindow.style.display = "";
    }

    if (shell) {
        shell.classList.remove("inbox-only");
    }

    INBOX_ONLY_MODE = false;
    openMobileChatPanel();
}

/* =========================
   RENDER CONVERSATIONS
========================= */
function renderConversationList(conversations) {
    const panel =
        document.querySelector(".conversation-list") ||
        document.querySelector(".empty-chat-list");
    const subtitle = document.querySelector(".chat-list-header p");

    if (subtitle) {
        subtitle.textContent = conversations.length
            ? `${conversations.length} conversation${conversations.length > 1 ? "s" : ""} loaded`
            : "No messages loaded yet";
    }

    if (!panel) return;

    if (!conversations.length) {
        panel.className = "empty-chat-list";
        panel.innerHTML = `
            <div class="empty-mini-icon">
                <i class="fa-solid fa-comments"></i>
            </div>
            <h3>No conversations yet</h3>
            <p>Your freelancer conversations will appear here after loading.</p>
        `;
        return;
    }

    panel.className = "conversation-list";

    panel.innerHTML = conversations.map((item) => {
        const user = item.withUser || {};
        const name = user.fullname || "User";
        const photo = user.photoURL || "";
        const lastText = item.lastMessage?.text || item.lastMessage || "No message yet";
        const unread = Number(item.unreadCount || 0);

        return `
            <button 
                type="button" 
                class="conversation-item ${item.conversationId === CURRENT_CONVERSATION_ID ? "active" : ""}"
                data-conversation-id="${escapeHTML(item.conversationId)}"
                data-with-uid="${escapeHTML(item.withUid || "")}"
            >
                <div class="conversation-avatar">
                    ${photo
                ? `<img src="${escapeHTML(photo)}" alt="${escapeHTML(name)}">`
                : `<span>${getInitials(name)}</span>`
            }
                </div>

                <div class="conversation-info">
                    <div class="conversation-topline">
                        <h4>${escapeHTML(name)}</h4>
                        ${unread ? `<b>${unread}</b>` : ""}
                    </div>
                    <p>${escapeHTML(lastText)}</p>
                </div>
            </button>
        `;
    }).join("");

    document.querySelectorAll(".conversation-item").forEach((btn) => {
        btn.addEventListener("click", async function () {
            const conversationId = this.dataset.conversationId;
            const withUid = this.dataset.withUid;

            showChatPanelMode();

            CURRENT_CONVERSATION_ID = conversationId;
            CURRENT_RECEIVER_UID = withUid;
            IS_FIRST_MESSAGE_LOAD = false;

            document.querySelectorAll(".conversation-item").forEach(item => {
                item.classList.remove("active");
            });

            this.classList.add("active");

            if (withUid) {
                await loadFreelancerForChat(withUid);
            }

            enableComposer(true);
            await loadMessages(conversationId, true);
            startChatRealtime(conversationId);
            startTypingRealtime();

            const url = new URL(window.location.href);
            url.searchParams.set("chatId", withUid || conversationId);
            window.history.replaceState({}, "", url.toString());
        });
    });
}

function renderEmptyConversations() {
    const panel = document.querySelector(".conversation-list") || document.querySelector(".empty-chat-list");
    if (!panel) return;

    panel.className = "empty-chat-list";
    panel.innerHTML = `
        <div class="empty-mini-icon">
            <i class="fa-solid fa-comments"></i>
        </div>
        <h3>No conversations yet</h3>
        <p>Your freelancer conversations will appear here after loading.</p>
    `;
}

/* =========================
   RENDER MESSAGES
========================= */
function renderMessages(messages, scrollToBottom = true) {
    const chatBody = document.getElementById("chatBody");

    if (!chatBody) return;

    chatBody.classList.add("chat-messages-body");

    if (!messages.length) {
        chatBody.innerHTML = `
            <div class="chat-empty-state">
                <div class="empty-icon">
                    <i class="fa-solid fa-comments"></i>
                </div>

                <h3>Start the conversation</h3>
                <p>Send your first message below.</p>
            </div>
        `;
        return;
    }

    chatBody.innerHTML = `
        <div class="messages-list">
            ${messages.map((msg) => renderMessageBubble(msg)).join("")}
        </div>
    `;

    if (scrollToBottom) {
        chatBody.scrollTop = chatBody.scrollHeight;
    }
}

function renderMessageBubble(msg) {
    const isMine = msg.senderUid === CURRENT_USER?.uid;
    const isRead = !!msg.read;

    return `
        <div class="message-row ${isMine ? "mine" : "theirs"}">
            <div class="message-bubble">
                <p>${escapeHTML(msg.message || "")}</p>

                <div class="message-meta">
                    <span>${formatMessageTime(msg.createdAt)}</span>

                    ${isMine
            ? `<span class="css-checks ${isRead ? "seen" : ""}"></span>`
            : ""
        }
                </div>
            </div>
        </div>
    `;
}

/* =========================
   RENDER HEADER
========================= */
function renderFreelancerHeader(freelancer) {
    const nameEl = document.getElementById("chatFreelancerName");
    const statusEl = document.getElementById("chatFreelancerStatus");
    const avatarEl = document.getElementById("chatAvatar");

    const fullname = freelancer?.fullname || "Freelancer";
    const title = freelancer?.title || freelancer?.accountType || "Freelancer";

    if (nameEl) nameEl.textContent = fullname;
    if (statusEl) statusEl.textContent = title;

    if (avatarEl) {
        if (freelancer?.photoURL) {
            avatarEl.innerHTML = `
                <img 
                    src="${escapeHTML(freelancer.photoURL)}" 
                    alt="${escapeHTML(fullname)}"
                    class="profile-avatar"
                >
            `;
        } else {
            avatarEl.innerHTML = `
                <span class="profile-letter">
                    ${getInitials(fullname)}
                </span>
            `;
        }
    }
}

/* =========================
   STATES
========================= */
function setChatLoading() {
    const chatBody = document.getElementById("chatBody");
    const nameEl = document.getElementById("chatFreelancerName");
    const statusEl = document.getElementById("chatFreelancerStatus");
    const avatarEl = document.getElementById("chatAvatar");

    enableComposer(false);

    if (nameEl) nameEl.textContent = "Loading freelancer...";
    if (statusEl) statusEl.textContent = "Connecting...";
    if (avatarEl) avatarEl.innerHTML = `<i class="fa-solid fa-user"></i>`;

    if (chatBody) {
        chatBody.innerHTML = `
            <div class="chat-empty-state">
                <div class="empty-icon">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                </div>

                <h3>Loading chat...</h3>
                <p>Please wait while we load the freelancer details.</p>
            </div>
        `;
    }
}

function showChatEmpty(title, message) {
    const chatBody = document.getElementById("chatBody");

    enableComposer(false);

    if (chatBody) {
        chatBody.innerHTML = `
            <div class="chat-empty-state">
                <div class="empty-icon">
                    <i class="fa-solid fa-message"></i>
                </div>

                <h3>${escapeHTML(title)}</h3>
                <p>${escapeHTML(message)}</p>
            </div>
        `;
    }
}

function showChatError(title, message) {
    const chatBody = document.getElementById("chatBody");
    const nameEl = document.getElementById("chatFreelancerName");
    const statusEl = document.getElementById("chatFreelancerStatus");

    enableComposer(false);

    if (nameEl) nameEl.textContent = title || "Error";
    if (statusEl) statusEl.textContent = "Unable to load chat";

    if (chatBody) {
        chatBody.innerHTML = `
            <div class="chat-empty-state">
                <div class="empty-icon" style="background:linear-gradient(135deg,#ef4444,#be123c);">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>

                <h3>${escapeHTML(title || "Something went wrong")}</h3>
                <p>${escapeHTML(message || "Unable to load this chat right now.")}</p>
            </div>
        `;
    }
}

function enableComposer(enabled) {
    const input = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendMessageBtn");
    const buttons = document.querySelectorAll(".composer-icon");

    if (input) {
        input.disabled = !enabled;
        input.placeholder = enabled
            ? "Type your message..."
            : "Select a conversation first...";
    }

    if (sendBtn) {
        sendBtn.disabled = !enabled;
    }

    buttons.forEach((btn) => {
        btn.disabled = !enabled;
    });
    const videoBtn = document.getElementById("videoCallBtn");
    if (videoBtn) videoBtn.disabled = !enabled;
}

/* =========================
   EVENTS
========================= */
function bindChatEvents() {
    const input = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendMessageBtn");

    if (sendBtn) {
        sendBtn.addEventListener("click", sendMessage);
    }

    const mobileBackBtn = document.getElementById("mobileChatBackBtn");

    if (mobileBackBtn) {
        mobileBackBtn.addEventListener("click", closeMobileChatPanel);
    }

    if (input) {
        input.addEventListener("keydown", function (event) {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });

        input.addEventListener("input", function () {
            autoGrowTextarea(input);
            handleTypingInput();

            const btn = document.getElementById("sendMessageBtn");
            if (!btn || input.disabled) return;

            btn.disabled = input.value.trim().length < 1;
        });

        input.addEventListener("input", function () {
            const btn = document.getElementById("sendMessageBtn");
            if (!btn || input.disabled) return;

            btn.disabled = input.value.trim().length < 1;
        });
    }
}

function autoGrowTextarea(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
}

/* =========================
   HELPERS
========================= */
function getInitials(name) {
    return String(name || "U")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("") || "U";
}

function formatMessageTime(timestamp) {
    if (!timestamp) return "";

    const date = new Date(Number(timestamp));

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function escapeHTML(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function startChatRealtime(conversationId) {
    if (CHAT_TIMER) clearInterval(CHAT_TIMER);

    CHAT_TIMER = setInterval(() => {
        if (CURRENT_CONVERSATION_ID) {
            loadMessages(CURRENT_CONVERSATION_ID, false);
        }
    }, 2500);
}
async function sendTypingStatus(isTyping) {
    if (!CURRENT_RECEIVER_UID) return;
    if (LAST_TYPING_STATE === isTyping) return;

    LAST_TYPING_STATE = isTyping;

    try {
        await fetch(`${API_URL}/api/messages/typing`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                receiverUid: CURRENT_RECEIVER_UID,
                isTyping
            })
        });
    } catch (error) {
        console.error("sendTypingStatus error:", error);
    }
}

function handleTypingInput() {
    sendTypingStatus(true);

    if (TYPING_TIMER) clearTimeout(TYPING_TIMER);

    TYPING_TIMER = setTimeout(() => {
        sendTypingStatus(false);
    }, 1200);
}

function startTypingRealtime() {
    if (TYPING_STATUS_TIMER) clearInterval(TYPING_STATUS_TIMER);

    TYPING_STATUS_TIMER = setInterval(() => {
        loadTypingStatus();
    }, 1200);
}

async function loadTypingStatus() {
    if (!CURRENT_CONVERSATION_ID) return;

    try {
        const response = await fetch(
            `${API_URL}/api/messages/typing/${encodeURIComponent(CURRENT_CONVERSATION_ID)}`,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) return;

        if (data.isTyping) {
            showTypingBubble();
        } else {
            removeTypingBubble();
        }

    } catch (error) {
        console.error("loadTypingStatus error:", error);
    }
}

function showTypingBubble() {
    const chatBody = document.getElementById("chatBody");
    if (!chatBody) return;

    let list = chatBody.querySelector(".messages-list");

    if (!list) {
        chatBody.innerHTML = `<div class="messages-list"></div>`;
        list = chatBody.querySelector(".messages-list");
    }

    if (list.querySelector(".typing-row")) return;

    list.insertAdjacentHTML("beforeend", `
        <div class="message-row theirs typing-row">
            <div class="typing-bubble">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `);

    chatBody.scrollTop = chatBody.scrollHeight;
}

function removeTypingBubble() {
    document.querySelectorAll(".typing-row").forEach(el => el.remove());
}
function openMobileChatPanel() {
    if (window.innerWidth <= 700) {
        document.body.classList.add("mobile-chat-open");
    }
}

function closeMobileChatPanel() {
    document.body.classList.remove("mobile-chat-open");
}
/* =========================
   FULL WEBRTC VIDEO CALL
   Client <-> Freelancer
========================= */

let CALLS_TIMER = null;
let ACTIVE_CALL_ID = null;
let ACTIVE_CALL_ROLE = null;
let LOCAL_STREAM = null;
let PEER_CONNECTION = null;
let INCOMING_CALL = null;
let WEBRTC_TIMER = null;
let ACTIVE_CALL_WATCH_TIMER = null;
let ADDED_ICE_IDS = new Set();

const RTC_CONFIG = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
    ]
};

/* =========================
   INIT
========================= */

function initVideoCallSystem() {
    bindVideoCallButtons();
    startIncomingCallWatcher();
}

function bindVideoCallButtons() {
    document.getElementById("videoCallBtn")?.addEventListener("click", requestVideoCall);
    document.getElementById("closeCallModalBtn")?.addEventListener("click", endVideoCall);
    document.getElementById("endCallBtn")?.addEventListener("click", endVideoCall);
    document.getElementById("toggleMicBtn")?.addEventListener("click", toggleMic);
    document.getElementById("toggleCamBtn")?.addEventListener("click", toggleCamera);
    document.getElementById("answerIncomingCallBtn")?.addEventListener("click", answerIncomingCall);
    document.getElementById("rejectIncomingCallBtn")?.addEventListener("click", rejectIncomingCall);
}

/* =========================
   OUTGOING CALL
========================= */

async function requestVideoCall() {
    if (!CURRENT_RECEIVER_UID) {
        alert("Select a conversation first.");
        return;
    }

    openVideoCallModal({
        title: getCurrentCallName(),
        status: "Starting camera..."
    });

    const cameraReady = await startLocalCamera();

    if (!cameraReady) {
        updateCallStatus("Camera permission denied or unavailable.");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/video-call/request`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                uid: CURRENT_RECEIVER_UID
            })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.success) {
            updateCallStatus(data.message || "Could not start call");
            return;
        }

        ACTIVE_CALL_ID = data.callId;
        ACTIVE_CALL_ROLE = "caller";
        ADDED_ICE_IDS = new Set();

        updateCallStatus("Creating WebRTC offer...");

        await createPeerConnection();
        await createAndSendOffer();

        updateCallStatus("Ringing... waiting for answer");

        watchActiveCall();
        startWebRTCWatcher();

    } catch (error) {
        console.error("requestVideoCall error:", error);
        updateCallStatus(error.message || "Network error.");
    }
}

/* =========================
   INCOMING CALL
========================= */

function startIncomingCallWatcher() {
    if (CALLS_TIMER) clearInterval(CALLS_TIMER);

    CALLS_TIMER = setInterval(loadIncomingCalls, 2500);
    loadIncomingCalls();
}

async function loadIncomingCalls() {
    try {

        const res = await fetch(`${API_URL}/api/video-call/my-calls`, {
            method: "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json" }
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.success) return;

        const incoming = (data.calls || []).find(call =>
            call.direction === "incoming" &&
            call.status === "ringing"
        );

        if (!incoming) return;
        if (INCOMING_CALL?.callId === incoming.callId) return;

        INCOMING_CALL = incoming;
        showIncomingCallModal(incoming);

    } catch (error) {
        console.error("loadIncomingCalls error:", error);
    }
}

function showIncomingCallModal(call) {

    const overlay = document.getElementById("incomingCallOverlay");
    const nameEl = document.getElementById("incomingCallerName");
    const avatarEl = document.getElementById("incomingCallerAvatar");

    const callerName =
        call?.callerData?.fullname ||
        call?.callerName ||
        "Someone";

    if (nameEl) {
        nameEl.textContent = `${callerName} is calling`;
    }

    if (avatarEl) {

        const initials = getInitials(callerName);

        avatarEl.innerHTML = `
            <span>${initials}</span>
        `;
    }

    overlay?.classList.add("active");
}

function hideIncomingCallModal() {
    document.getElementById("incomingCallOverlay")?.classList.remove("active");
}

async function answerIncomingCall() {
    if (!INCOMING_CALL?.callId) return;

    ACTIVE_CALL_ID = INCOMING_CALL.callId;
    ACTIVE_CALL_ROLE = "receiver";
    ADDED_ICE_IDS = new Set();

    hideIncomingCallModal();

    openVideoCallModal({
        title: "Video call",
        status: "Starting camera..."
    });

    const cameraReady = await startLocalCamera();

    if (!cameraReady) {
        updateCallStatus("Camera permission denied or unavailable.");
        return;
    }

    try {
        const acceptRes = await fetch(`${API_URL}/api/video-call/accept`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                callId: ACTIVE_CALL_ID
            })
        });

        const acceptData = await acceptRes.json().catch(() => ({}));

        if (!acceptRes.ok || !acceptData.success) {
            updateCallStatus(acceptData.message || "Could not answer call");
            return;
        }

        updateCallStatus("Connecting WebRTC...");

        await createPeerConnection();
        await createAndSendAnswer();

        updateCallStatus("Connected");

        INCOMING_CALL = null;

        watchActiveCall();
        startWebRTCWatcher();

    } catch (error) {
        console.error("answerIncomingCall error:", error);
        updateCallStatus(error.message || "Network error.");
    }
}

async function rejectIncomingCall() {
    if (INCOMING_CALL?.callId) {
        await fetch(`${API_URL}/api/video-call/reject`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                callId: INCOMING_CALL.callId
            })
        }).catch(console.error);
    }

    INCOMING_CALL = null;
    hideIncomingCallModal();
}

/* =========================
   PEER CONNECTION
========================= */

async function createPeerConnection() {
    if (PEER_CONNECTION) {
        PEER_CONNECTION.close();
        PEER_CONNECTION = null;
    }

    PEER_CONNECTION = new RTCPeerConnection(RTC_CONFIG);

    if (LOCAL_STREAM) {
        LOCAL_STREAM.getTracks().forEach(track => {
            PEER_CONNECTION.addTrack(track, LOCAL_STREAM);
        });
    }

    PEER_CONNECTION.ontrack = async function (event) {

        const remoteVideo = document.getElementById("remoteVideo");
        const placeholder = document.getElementById("remoteVideoPlaceholder");

        if (remoteVideo && event.streams?.[0]) {

            remoteVideo.srcObject = event.streams[0];

            remoteVideo.autoplay = true;
            remoteVideo.playsInline = true;

            await remoteVideo.play().catch(() => { });

            if (placeholder) {
                placeholder.style.display = "none";
            }

        }

        updateCallStatus("Connected");

    };

    PEER_CONNECTION.onicecandidate = async function (event) {
        if (event.candidate && ACTIVE_CALL_ID) {
            await sendIceCandidate(event.candidate);
        }
    };

    PEER_CONNECTION.onconnectionstatechange = function () {
        const state = PEER_CONNECTION.connectionState;

        if (state === "connected") {
            updateCallStatus("Connected");
            startCallTimer();
        }

        if (state === "connecting") {
            updateCallStatus("Connecting...");
        }

        if (state === "disconnected") {
            updateCallStatus("Connection lost. Reconnecting...");
        }

        if (state === "failed") {
            updateCallStatus("Connection failed. TURN server may be needed.");
        }

        if (state === "closed") {
            updateCallStatus("Call closed");
        }
    };

    PEER_CONNECTION.oniceconnectionstatechange = function () {
        const state = PEER_CONNECTION.iceConnectionState;

        if (state === "checking") updateCallStatus("Checking connection...");
        if (state === "connected" || state === "completed") updateCallStatus("Connected");
        if (state === "failed") updateCallStatus("ICE failed. TURN server may be needed.");
    };
}

/* =========================
   OFFER / ANSWER
========================= */

async function createAndSendOffer() {
    if (!PEER_CONNECTION || !ACTIVE_CALL_ID) {
        throw new Error("Peer connection not ready");
    }

    const offer = await PEER_CONNECTION.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
    });

    await PEER_CONNECTION.setLocalDescription(offer);

    const res = await fetch(`${API_URL}/api/video-call/${ACTIVE_CALL_ID}/offer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            offer: PEER_CONNECTION.localDescription
        })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to send offer");
    }
}

async function createAndSendAnswer() {
    if (!PEER_CONNECTION || !ACTIVE_CALL_ID) {
        throw new Error("Peer connection not ready");
    }

    let callData = null;
    let offer = null;

    for (let i = 0; i < 12; i++) {
        callData = await getCallData();
        offer = callData?.webrtc?.offer;

        if (offer?.sdp) break;

        updateCallStatus("Waiting for caller offer...");
        await sleep(700);
    }

    if (!offer?.sdp) {
        throw new Error("No WebRTC offer found");
    }

    await PEER_CONNECTION.setRemoteDescription(
        new RTCSessionDescription({
            type: "offer",
            sdp: offer.sdp
        })
    );

    const answer = await PEER_CONNECTION.createAnswer();

    await PEER_CONNECTION.setLocalDescription(answer);

    const res = await fetch(`${API_URL}/api/video-call/${ACTIVE_CALL_ID}/answer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            answer: PEER_CONNECTION.localDescription
        })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to send answer");
    }
}

/* =========================
   ICE CANDIDATES
========================= */

async function sendIceCandidate(candidate) {
    try {
        if (!ACTIVE_CALL_ID) return;

        await fetch(`${API_URL}/api/video-call/${ACTIVE_CALL_ID}/ice`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                candidate
            })
        });

    } catch (error) {
        console.error("sendIceCandidate error:", error);
    }
}

async function addRemoteIceCandidates(candidates) {
    if (!PEER_CONNECTION) return;

    const list = Object.values(candidates || {});

    for (const item of list) {
        if (!item?.candidateId) continue;
        if (ADDED_ICE_IDS.has(item.candidateId)) continue;
        if (item.fromUid === CURRENT_USER?.uid) continue;

        try {
            await PEER_CONNECTION.addIceCandidate(
                new RTCIceCandidate({
                    candidate: item.candidate,
                    sdpMid: item.sdpMid || null,
                    sdpMLineIndex: Number(item.sdpMLineIndex || 0),
                    usernameFragment: item.usernameFragment || undefined
                })
            );

            ADDED_ICE_IDS.add(item.candidateId);

        } catch (error) {
            console.error("addRemoteIceCandidates error:", error);
        }
    }
}

/* =========================
   WATCHERS
========================= */

function startWebRTCWatcher() {
    if (WEBRTC_TIMER) clearInterval(WEBRTC_TIMER);

    WEBRTC_TIMER = setInterval(async () => {
        if (!ACTIVE_CALL_ID || !PEER_CONNECTION) return;

        try {
            const data = await getCallData();

            if (!data?.success) return;

            const call = data.call;
            const webrtc = data.webrtc || {};

            if (["ended", "rejected", "missed", "cancelled"].includes(call.status)) {
                cleanupCallUI(`Call ${call.status}`);
                return;
            }

            if (
                ACTIVE_CALL_ROLE === "caller" &&
                webrtc.answer?.sdp &&
                !PEER_CONNECTION.currentRemoteDescription
            ) {
                await PEER_CONNECTION.setRemoteDescription(
                    new RTCSessionDescription({
                        type: "answer",
                        sdp: webrtc.answer.sdp
                    })
                );

                updateCallStatus("Connected");
            }

            await addRemoteIceCandidates(webrtc.candidates || {});

        } catch (error) {
            console.error("startWebRTCWatcher error:", error);
        }

    }, 1200);
}

function watchActiveCall() {
    if (ACTIVE_CALL_WATCH_TIMER) clearInterval(ACTIVE_CALL_WATCH_TIMER);

    ACTIVE_CALL_WATCH_TIMER = setInterval(async () => {
        if (!ACTIVE_CALL_ID) {
            clearInterval(ACTIVE_CALL_WATCH_TIMER);
            ACTIVE_CALL_WATCH_TIMER = null;
            return;
        }

        try {
            const data = await getCallData();

            if (!data?.success) return;

            const status = data.call?.status;

            if (status === "accepted" && ACTIVE_CALL_ROLE === "caller") {
                updateCallStatus("Call accepted. Waiting for WebRTC answer...");
            }

            if (status === "live") {
                updateCallStatus("Connected");
            }

            if (["ended", "rejected", "missed", "cancelled"].includes(status)) {
                cleanupCallUI(`Call ${status}`);
            }

        } catch (error) {
            console.error("watchActiveCall error:", error);
        }

    }, 2000);
}

async function getCallData() {
    if (!ACTIVE_CALL_ID) return null;

    const res = await fetch(`${API_URL}/api/video-call/${ACTIVE_CALL_ID}`, {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
    });

    return await res.json().catch(() => ({}));
}

/* =========================
   CAMERA / MIC
========================= */

async function startLocalCamera() {
    try {

        if (LOCAL_STREAM) return true;

        if (!navigator.mediaDevices?.getUserMedia) {
            updateCallStatus("Camera not supported on this browser.");
            return false;
        }

        LOCAL_STREAM = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 1280,
                height: 720,
                facingMode: "user"
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true
            }
        });

        const localVideo = document.getElementById("localVideo");

        if (localVideo) {

            localVideo.srcObject = LOCAL_STREAM;

            localVideo.muted = true;
            localVideo.autoplay = true;
            localVideo.playsInline = true;

            await localVideo.play().catch(() => { });

        }

        const localOff = document.getElementById("localVideoOff");

        if (localOff) {
            localOff.style.display = "none";
        }

        return true;

    } catch (error) {

        console.error("startLocalCamera error:", error);

        updateCallStatus(
            "Camera permission blocked. Allow camera and microphone access."
        );

        return false;
    }
}

function stopLocalCamera() {
    if (!LOCAL_STREAM) return;

    LOCAL_STREAM.getTracks().forEach(track => track.stop());
    LOCAL_STREAM = null;

    const localVideo = document.getElementById("localVideo");

    if (localVideo) {
        localVideo.srcObject = null;
    }
}

function stopRemoteVideo() {
    const remoteVideo = document.getElementById("remoteVideo");

    if (remoteVideo?.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
    }
}

function toggleMic() {
    const track = LOCAL_STREAM?.getAudioTracks?.()[0];
    const btn = document.getElementById("toggleMicBtn");

    if (!track) return;

    track.enabled = !track.enabled;

    btn?.classList.toggle("off", !track.enabled);

    if (btn) {
        btn.innerHTML = track.enabled
            ? `<i class="fa-solid fa-microphone"></i>`
            : `<i class="fa-solid fa-microphone-slash"></i>`;
    }
}

function toggleCamera() {

    const track = LOCAL_STREAM?.getVideoTracks?.()[0];
    const btn = document.getElementById("toggleCamBtn");
    const offUI = document.getElementById("localVideoOff");

    if (!track) return;

    track.enabled = !track.enabled;

    btn?.classList.toggle("off", !track.enabled);

    if (offUI) {
        offUI.style.display = track.enabled ? "none" : "flex";
    }

    if (btn) {

        btn.innerHTML = track.enabled
            ? `
                <span class="icon video-icon"></span>
                <small>Camera</small>
            `
            : `
                <span class="icon video-off-icon"></span>
                <small>Camera Off</small>
            `;
    }
}

/* =========================
   END / CLEANUP
========================= */

async function endVideoCall() {
    if (ACTIVE_CALL_ID) {
        await fetch(`${API_URL}/api/video-call/end`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                callId: ACTIVE_CALL_ID
            })
        }).catch(console.error);
    }

    cleanupCallUI("Call ended");
}

function cleanupCallUI(statusText = "Call ended") {

    updateCallStatus(statusText);

    clearInterval(WEBRTC_TIMER);
    clearInterval(ACTIVE_CALL_WATCH_TIMER);
    clearInterval(CALL_TIMER_INTERVAL);

    WEBRTC_TIMER = null;
    ACTIVE_CALL_WATCH_TIMER = null;
    CALL_TIMER_INTERVAL = null;

    if (PEER_CONNECTION) {
        PEER_CONNECTION.ontrack = null;
        PEER_CONNECTION.onicecandidate = null;
        PEER_CONNECTION.close();
        PEER_CONNECTION = null;
    }

    stopLocalCamera();
    stopRemoteVideo();

    ACTIVE_CALL_ID = null;
    ACTIVE_CALL_ROLE = null;
    INCOMING_CALL = null;

    ADDED_ICE_IDS = new Set();

    const placeholder = document.getElementById("remoteVideoPlaceholder");

    if (placeholder) {
        placeholder.style.display = "flex";
    }

    setTimeout(() => {

        closeVideoCallModal();
        hideIncomingCallModal();

    }, 500);
}

/* =========================
   MODAL UI
========================= */

function openVideoCallModal({ title = "Video call", status = "Connecting..." } = {}) {
    const overlay = document.getElementById("videoCallOverlay");
    const titleEl = document.getElementById("callModalTitle");
    const statusEl = document.getElementById("callModalStatus");

    if (titleEl) titleEl.textContent = title;
    if (statusEl) statusEl.textContent = status;
    if (overlay) overlay.classList.add("active");
}

function closeVideoCallModal() {
    document.getElementById("videoCallOverlay")?.classList.remove("active");
}

function updateCallStatus(text) {

    const el = document.getElementById("callModalStatus");

    if (!el) return;

    el.textContent = text || "";

    const remoteText = document.getElementById("remoteCallText");

    if (remoteText) {
        remoteText.textContent = text || "";
    }

}

/* =========================
   HELPERS
========================= */

function getCurrentCallName() {
    return (
        CURRENT_FREELANCER?.fullname ||
        CURRENT_WITH_USER?.fullname ||
        CURRENT_WITH_USER?.name ||
        "Calling..."
    );
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function startCallTimer() {

    clearInterval(CALL_TIMER_INTERVAL);

    CALL_SECONDS = 0;

    CALL_TIMER_INTERVAL = setInterval(() => {

        CALL_SECONDS++;

        const mins = String(Math.floor(CALL_SECONDS / 60)).padStart(2, "0");
        const secs = String(CALL_SECONDS % 60).padStart(2, "0");

        const timer = document.getElementById("callTimer");

        if (timer) {
            timer.textContent = `${mins}:${secs}`;
        }

    }, 1000);
}