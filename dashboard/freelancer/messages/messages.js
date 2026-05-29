const API_URL = "https://backend.impactacademy.site";

let allJobs = [];
let filteredJobs = [];

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

    initMessagesPage(auth.user);
});

let CURRENT_USER = null;
let CURRENT_CONVERSATION_ID = null;
let CURRENT_RECEIVER_UID = null;
let CURRENT_WITH_USER = null;
let INBOX_TIMER = null;
let CHAT_TIMER = null;
let LAST_MESSAGE_COUNT = 0;
let TYPING_TIMER = null;
let TYPING_STATUS_TIMER = null;
let LAST_TYPING_STATE = false;

function initMessagesPage(user) {
    CURRENT_USER = user;

    bindMessageEvents();
    initVideoCallSystem();
    loadInbox(true);
    startInboxRealtime();

    const params = new URLSearchParams(window.location.search);
    const receiverUid =
        params.get("client") ||
        params.get("clientUid") ||
        params.get("user") ||
        params.get("uid") ||
        params.get("chatId") ||
        "";

    if (receiverUid) {
        startChat(receiverUid);
    } else {
        showInboxOnly();
    }
}

/* =========================
   REALTIME INBOX
========================= */
function startInboxRealtime() {
    if (INBOX_TIMER) clearInterval(INBOX_TIMER);

    INBOX_TIMER = setInterval(() => {
        loadInbox(false);
    }, 3000);
}

/* =========================
   LOAD INBOX LIST
========================= */
async function loadInbox(showEmpty = true) {
    try {
        const response = await fetch(`${API_URL}/api/messages/list`, {
            method: "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json" }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            if (showEmpty) renderEmptyInbox();
            return;
        }

        renderInboxList(data.conversations || []);

    } catch (error) {
        console.error("loadInbox error:", error);
        if (showEmpty) renderEmptyInbox();
    }
}

/* =========================
   RENDER INBOX
========================= */
function renderInboxList(conversations) {
    const inboxPanel =
        document.querySelector(".inbox-empty") ||
        document.querySelector(".conversation-list");

    const subtitle = document.querySelector(".inbox-header p");
    const heroCount = document.querySelector(".hero-mini-card h3");

    if (subtitle) {
        subtitle.textContent = conversations.length
            ? `${conversations.length} conversation${conversations.length > 1 ? "s" : ""} loaded`
            : "No conversations yet";
    }

    if (heroCount) heroCount.textContent = conversations.length;

    if (!inboxPanel) return;

    if (!conversations.length) {
        renderEmptyInbox();
        return;
    }

    inboxPanel.className = "conversation-list";

    inboxPanel.innerHTML = conversations.map(item => {
        const user = item.withUser || {};
        const name = user.fullname || "Client";
        const photo = user.photoURL || "";
        const unread = Number(item.unreadCount || 0);
        const lastText = item.lastMessage?.text || item.lastMessage || "No message yet";

        const timeText = formatInboxTime(item.lastMessageAt || item.updatedAt);

        return `
  <button 
    type="button"
    class="conversation-item ${item.conversationId === CURRENT_CONVERSATION_ID ? "active" : ""} ${unread ? "unread" : ""}"
    data-conversation-id="${escapeHTML(item.conversationId)}"
    data-with-uid="${escapeHTML(item.withUid || "")}"
  >
    <div class="conversation-avatar-wrap">
      <div class="conversation-avatar">
        ${photo
                ? `<img src="${escapeHTML(photo)}" alt="${escapeHTML(name)}">`
                : `<span>${getInitials(name)}</span>`
            }
      </div>

      ${unread ? `<span class="online-ping"></span>` : ""}
    </div>

    <div class="conversation-info">
      <div class="conversation-topline">
        <h4>${escapeHTML(name)}</h4>
        <time>${escapeHTML(timeText)}</time>
      </div>

      <div class="conversation-bottomline">
        <p>${escapeHTML(lastText)}</p>
        ${unread ? `<b>${unread}</b>` : ""}
      </div>
    </div>
  </button>
`;
    }).join("");

    document.querySelectorAll(".conversation-item").forEach(btn => {
        btn.addEventListener("click", async function () {
            const conversationId = this.dataset.conversationId;
            const withUid = this.dataset.withUid;

            CURRENT_CONVERSATION_ID = conversationId;
            CURRENT_RECEIVER_UID = withUid;

            openChatPanel();

            document.querySelectorAll(".conversation-item").forEach(item => {
                item.classList.remove("active");
            });

            this.classList.add("active");

            await loadChatUser(withUid);
            await loadMessages(conversationId, true);
            startChatRealtime(conversationId);
            startTypingRealtime();

            const url = new URL(window.location.href);
            url.searchParams.set("chatId", withUid);
            window.history.replaceState({}, "", url.toString());
        });
    });
}

function renderEmptyInbox() {
    const box =
        document.querySelector(".conversation-list") ||
        document.querySelector(".inbox-empty");

    if (!box) return;

    box.className = "inbox-empty";
    box.innerHTML = `
    <div class="empty-mini-icon">
      <i class="fa-solid fa-comments"></i>
    </div>

    <h3>No conversations loaded</h3>
    <p>Your client conversations will appear here from the server.</p>
  `;
}

/* =========================
   START CHAT BY UID
========================= */
async function startChat(receiverUid) {
    try {
        openChatPanel();
        setChatHeaderLoading();

        const response = await fetch(`${API_URL}/api/messages/start`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ receiverUid })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            showChatError(data.message || "Could not start chat");
            return;
        }

        CURRENT_CONVERSATION_ID = data.conversationId;
        CURRENT_RECEIVER_UID = receiverUid;
        CURRENT_WITH_USER = data.withUser || null;

        renderChatHeader(CURRENT_WITH_USER);
        enableComposer(true);

        await loadMessages(CURRENT_CONVERSATION_ID, true);
        await loadInbox(false);
        startChatRealtime(CURRENT_CONVERSATION_ID);
        startTypingRealtime();

    } catch (error) {
        console.error("startChat error:", error);
        showChatError("Unable to start chat right now.");
    }
}

/* =========================
   LOAD CHAT USER
========================= */
async function loadChatUser(uid) {
    if (!uid) return;

    try {
        setChatHeaderLoading();

        const response = await fetch(`${API_URL}/api/messages/user/${encodeURIComponent(uid)}`, {
            method: "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json" }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) return;

        CURRENT_WITH_USER = data.user;
        renderChatHeader(data.user);

    } catch (error) {
        console.error("loadChatUser error:", error);
    }
}

/* =========================
   REALTIME CHAT
========================= */
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
            headers: { "Content-Type": "application/json" },
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
                headers: { "Content-Type": "application/json" }
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
    const chatBody = document.querySelector(".chat-body");
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
                headers: { "Content-Type": "application/json" }
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            showChatError(data.message || "Could not load messages");
            return;
        }

        const messages = data.messages || [];
        const shouldScroll = forceScroll || messages.length !== LAST_MESSAGE_COUNT;

        renderMessages(messages, shouldScroll);

        LAST_MESSAGE_COUNT = messages.length;

    } catch (error) {
        console.error("loadMessages error:", error);
    }
}

/* =========================
   SEND MESSAGE
========================= */
async function sendMessage() {
    const input = document.querySelector(".chat-composer textarea");
    const sendBtn = document.querySelector(".send-btn");

    if (!input || !CURRENT_RECEIVER_UID) return;

    const message = input.value.trim();
    if (!message) return;

    const tempMessage = {
        messageId: "temp_" + Date.now(),
        senderUid: CURRENT_USER?.uid,
        receiverUid: CURRENT_RECEIVER_UID,
        message,
        createdAt: Date.now()
    };

    appendMessage(tempMessage);

    input.value = "";
    autoGrowTextarea(input);

    if (sendBtn) sendBtn.disabled = true;

    try {
        sendTypingStatus(false);
        const response = await fetch(`${API_URL}/api/messages/send`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                receiverUid: CURRENT_RECEIVER_UID,
                message
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            alert(data.message || "Message failed");
            await loadMessages(CURRENT_CONVERSATION_ID, true);
            return;
        }

        CURRENT_CONVERSATION_ID = data.conversationId;

        await loadInbox(false);

    } catch (error) {
        console.error("sendMessage error:", error);
        alert("Network error. Message not sent.");
    } finally {
        enableComposer(true);
        if (sendBtn) sendBtn.disabled = true;
        input.focus();
    }
}

/* =========================
   RENDER MESSAGES
========================= */
function renderMessages(messages, scrollToBottom = true) {
    const chatBody = document.querySelector(".chat-body");
    if (!chatBody) return;

    if (!messages.length) {
        chatBody.innerHTML = `
      <div class="chat-empty">
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
      ${messages.map(msg => renderMessageBubble(msg)).join("")}
    </div>
  `;

    if (scrollToBottom) {
        chatBody.scrollTop = chatBody.scrollHeight;
    }
}

function appendMessage(msg) {
    const chatBody = document.querySelector(".chat-body");
    if (!chatBody) return;

    let list = chatBody.querySelector(".messages-list");

    if (!list) {
        chatBody.innerHTML = `<div class="messages-list"></div>`;
        list = chatBody.querySelector(".messages-list");
    }

    list.insertAdjacentHTML("beforeend", renderMessageBubble(msg));
    chatBody.scrollTop = chatBody.scrollHeight;
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
            ? `<span class="css-checks ${isRead ? "seen" : ""}" aria-label="${isRead ? "Seen" : "Sent"}"></span>`
            : ""
        }
        </div>
      </div>
    </div>
  `;
}

/* =========================
   HEADER
========================= */
function renderChatHeader(user) {
    const avatar = document.querySelector(".chat-avatar");
    const name = document.querySelector(".chat-user h3");
    const status = document.querySelector(".chat-user p");

    const fullname = user?.fullname || "Client";
    const photo = user?.photoURL || "";

    if (name) name.textContent = fullname;

    if (status) {
        status.innerHTML = `
      <span class="status-dot"></span>
      ${escapeHTML(user?.accountType || "client")}
    `;
    }

    if (avatar) {
        avatar.innerHTML = photo
            ? `<img src="${escapeHTML(photo)}" alt="${escapeHTML(fullname)}" class="profile-avatar">`
            : `<span class="profile-letter">${getInitials(fullname)}</span>`;
    }
}

function setChatHeaderLoading() {
    const name = document.querySelector(".chat-user h3");
    const status = document.querySelector(".chat-user p");
    const avatar = document.querySelector(".chat-avatar");

    if (name) name.textContent = "Loading chat...";
    if (status) {
        status.innerHTML = `<span class="status-dot"></span> Connecting...`;
    }
    if (avatar) avatar.innerHTML = `<i class="fa-solid fa-user"></i>`;
}

function showChatError(message) {
    const chatBody = document.querySelector(".chat-body");
    enableComposer(false);

    if (chatBody) {
        chatBody.innerHTML = `
      <div class="chat-empty">
        <div class="empty-icon error-icon">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>

        <h3>Chat error</h3>
        <p>${escapeHTML(message || "Unable to load chat.")}</p>
      </div>
    `;
    }
}

/* =========================
   UI MODES
========================= */
function showInboxOnly() {
    const layout = document.querySelector(".messages-layout");
    const chatPanel = document.querySelector(".chat-panel");

    if (layout) layout.classList.add("inbox-only");
    if (chatPanel) chatPanel.style.display = "none";

    enableComposer(false);
}

function openChatPanel() {
    const layout = document.querySelector(".messages-layout");
    const chatPanel = document.querySelector(".chat-panel");

    if (layout) layout.classList.remove("inbox-only");
    if (chatPanel) chatPanel.style.display = "";

    enableComposer(true);

    openMobileChat();
}

function enableComposer(enabled) {
    const input = document.querySelector(".chat-composer textarea");
    const buttons = document.querySelectorAll(".composer-btn, .send-btn");

    if (input) {
        input.disabled = !enabled;
        input.placeholder = enabled
            ? "Type your message..."
            : "Select a conversation first...";
    }

    buttons.forEach(btn => {
        btn.disabled = !enabled;
    });

    const videoBtn = document.getElementById("videoCallBtn");
    if (videoBtn) videoBtn.disabled = !enabled;
}

/* =========================
   EVENTS
========================= */
function bindMessageEvents() {
    const input = document.querySelector(".chat-composer textarea");
    const sendBtn = document.querySelector(".send-btn");

    if (sendBtn) {
        sendBtn.addEventListener("click", sendMessage);
    }

    const mobileBackBtn = document.getElementById("mobileBackBtn");

    if (mobileBackBtn) {
        mobileBackBtn.addEventListener("click", closeMobileChat);
    }

    if (input) {
        input.addEventListener("input", function () {
            autoGrowTextarea(input);
            handleTypingInput();

            if (sendBtn) {
                sendBtn.disabled = input.value.trim().length < 1;
            }
        });

        input.addEventListener("keydown", function (event) {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });
    }
}

/* =========================
   HELPERS
========================= */
function autoGrowTextarea(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
}

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

    return new Date(Number(timestamp)).toLocaleTimeString([], {
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
function formatInboxTime(timestamp) {
    if (!timestamp) return "";

    const date = new Date(Number(timestamp));
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    if (isYesterday) return "Yesterday";

    return date.toLocaleDateString([], {
        month: "short",
        day: "numeric"
    });
}
function openMobileChat() {
    if (window.innerWidth <= 700) {
        document.body.classList.add("mobile-chat-open");
    }
}

function closeMobileChat() {
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
    document.getElementById("toggleSpeakerBtn")?.addEventListener("click", toggleSpeaker);
    document.getElementById("switchCameraBtn")?.addEventListener("click", switchCameraView);
    document.getElementById("expandCallBtn")?.addEventListener("click", toggleFocusCallView);

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
        const response = await fetch(`${API_URL}/api/video-call/request`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                uid: CURRENT_RECEIVER_UID
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
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
        updateCallStatus(error.message || "Network error. Could not request call.");
    }
}

/* =========================
   INCOMING CALL
========================= */

function startIncomingCallWatcher() {
    if (CALLS_TIMER) clearInterval(CALLS_TIMER);

    CALLS_TIMER = setInterval(loadIncomingCalls, 2000);
    loadIncomingCalls();
}

async function loadIncomingCalls() {
    try {

        // if currently inside active call screen
        // check if call still exists
        if (ACTIVE_CALL_ID) {
            await validateActiveCall();
        }

        const response = await fetch(`${API_URL}/api/video-call/my-calls`, {
            method: "GET",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            hideIncomingCallModal();
            return;
        }

        const calls = Array.isArray(data.calls)
            ? data.calls
            : [];

        // ONLY allow ACTIVE ringing incoming calls
        const incoming = calls.find(call =>
            call.direction === "incoming" &&
            call.status === "ringing"
        );

        // nothing incoming
        if (!incoming) {

            // close popup
            hideIncomingCallModal();

            // clear stale incoming
            INCOMING_CALL = null;

            return;
        }

        // hard block dead calls
        if (
            [
                "ended",
                "rejected",
                "missed",
                "cancelled",
                "expired"
            ].includes(incoming.status)
        ) {

            hideIncomingCallModal();

            INCOMING_CALL = null;

            return;
        }

        // already showing same call
        if (
            INCOMING_CALL &&
            INCOMING_CALL.callId === incoming.callId
        ) {
            return;
        }

        INCOMING_CALL = incoming;

        showIncomingCallModal(incoming);

    } catch (error) {
        console.error("loadIncomingCalls error:", error);

        hideIncomingCallModal();
    }
}

/* =========================
   VALIDATE ACTIVE CALL
========================= */

async function validateActiveCall() {

    if (!ACTIVE_CALL_ID) return;

    try {

        const response = await fetch(`${API_URL}/api/video-call/my-calls`, {
            method: "GET",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) return;

        const calls = Array.isArray(data.calls)
            ? data.calls
            : [];

        const activeCall = calls.find(
            c => c.callId === ACTIVE_CALL_ID
        );

        // call deleted/not found
        if (!activeCall) {

            cleanupCallCompletely("Call ended");

            return;
        }

        // call closed
        if (
            [
                "ended",
                "rejected",
                "missed",
                "cancelled",
                "expired"
            ].includes(activeCall.status)
        ) {

            cleanupCallCompletely(
                `Call ${activeCall.status}`
            );

            return;
        }

    } catch (error) {
        console.error("validateActiveCall error:", error);
    }
}

function showIncomingCallModal(call) {
    const overlay = document.getElementById("incomingCallOverlay");
    const nameEl = document.getElementById("incomingCallerName");
    const avatar = document.getElementById("incomingCallerAvatar");

    const callerName =
        CURRENT_WITH_USER?.uid === call.withUid
            ? CURRENT_WITH_USER?.fullname
            : "Incoming caller";

    if (nameEl) {
        nameEl.textContent = callerName || "Incoming video call";
    }

    if (avatar) {
        const photo =
            CURRENT_WITH_USER?.uid === call.withUid
                ? CURRENT_WITH_USER?.photoURL
                : "";

        avatar.innerHTML = photo
            ? `<img src="${escapeHTML(photo)}" alt="">`
            : `<i class="fa-solid fa-user"></i>`;
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
        const response = await fetch(`${API_URL}/api/video-call/accept`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                callId: ACTIVE_CALL_ID
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            updateCallStatus(data.message || "Could not answer call");

            INCOMING_CALL = null;
            ACTIVE_CALL_ID = null;
            ACTIVE_CALL_ROLE = null;

            hideIncomingCallModal();

            setTimeout(() => {
                cleanupCallUI(data.message || "Call ended");
            }, 1200);

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
        updateCallStatus(error.message || "Network error. Could not answer call.");
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
        const remoteStage = document.getElementById("remoteVideoStage");

        if (remoteVideo && event.streams && event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            remoteVideo.playsInline = true;

            remoteVideo.onloadedmetadata = async () => {
                try {
                    await remoteVideo.play();
                    remoteStage?.classList.add("has-video");
                } catch (error) {
                    console.error("remoteVideo play error:", error);
                }
            };

            remoteStage?.classList.add("has-video");
        }

        updateCallStatus("Connected");
        startCallTimer();
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

        if (state === "connecting") updateCallStatus("Connecting...");
        if (state === "disconnected") updateCallStatus("Connection lost. Reconnecting...");
        if (state === "failed") updateCallStatus("Connection failed. TURN server may be needed.");
        if (state === "closed") updateCallStatus("Call closed");
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

    const response = await fetch(`${API_URL}/api/video-call/${ACTIVE_CALL_ID}/offer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            offer: PEER_CONNECTION.localDescription
        })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
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

    const response = await fetch(`${API_URL}/api/video-call/${ACTIVE_CALL_ID}/answer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            answer: PEER_CONNECTION.localDescription
        })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
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

    const response = await fetch(`${API_URL}/api/video-call/${ACTIVE_CALL_ID}`, {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
    });

    return await response.json().catch(() => ({}));
}

/* =========================
   CAMERA / MIC
========================= */

async function startLocalCamera() {
    try {
        if (LOCAL_STREAM) {
            attachLocalStream();
            return true;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            updateCallStatus("Camera is not supported on this browser.");
            return false;
        }

        LOCAL_STREAM = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user"
            },
            audio: true
        });

        attachLocalStream();
        updateCallStatus("Camera ready");

        return true;

    } catch (error) {
        console.error("startLocalCamera error:", error);

        if (location.protocol !== "https:" && location.hostname !== "localhost") {
            updateCallStatus("Camera needs HTTPS to work.");
        } else if (error.name === "NotAllowedError") {
            updateCallStatus("Camera permission was blocked.");
        } else if (error.name === "NotFoundError") {
            updateCallStatus("No camera device found.");
        } else {
            updateCallStatus("Camera permission denied or unavailable.");
        }

        return false;
    }
}

function attachLocalStream() {
    const localVideo = document.getElementById("localVideo");
    const localCard = document.getElementById("localVideoCard");

    if (!localVideo || !LOCAL_STREAM) return;

    localVideo.srcObject = LOCAL_STREAM;
    localVideo.muted = true;
    localVideo.playsInline = true;

    localVideo.onloadedmetadata = async () => {
        try {
            await localVideo.play();
            localCard?.classList.add("has-video");
        } catch (error) {
            console.error("localVideo play error:", error);
        }
    };

    if (LOCAL_STREAM.getVideoTracks().length) {
        localCard?.classList.add("has-video");
    }
}

function stopLocalCamera() {
    if (LOCAL_STREAM) {
        LOCAL_STREAM.getTracks().forEach(track => track.stop());
        LOCAL_STREAM = null;
    }

    const localVideo = document.getElementById("localVideo");
    const localCard = document.getElementById("localVideoCard");

    if (localVideo) {
        localVideo.pause();
        localVideo.srcObject = null;
    }

    localCard?.classList.remove("has-video");
}

function stopRemoteVideo() {
    const remoteVideo = document.getElementById("remoteVideo");
    const remoteStage = document.getElementById("remoteVideoStage");

    if (remoteVideo?.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.pause();
        remoteVideo.srcObject = null;
    }

    remoteStage?.classList.remove("has-video");
}

function stopRemoteVideo() {
    const remoteVideo = document.getElementById("remoteVideo");

    if (remoteVideo?.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
    }
}

function toggleMic() {
    const audioTrack = LOCAL_STREAM?.getAudioTracks?.()[0];
    const btn = document.getElementById("toggleMicBtn");

    if (!audioTrack || !btn) return;

    audioTrack.enabled = !audioTrack.enabled;
    btn.classList.toggle("off", !audioTrack.enabled);

    btn.innerHTML = audioTrack.enabled
        ? `<span class="call-svg-icon mic-icon"></span><small>Mic</small>`
        : `<span class="call-svg-icon mic-off-icon"></span><small>Muted</small>`;
}

function toggleCamera() {
    const videoTrack = LOCAL_STREAM?.getVideoTracks?.()[0];
    const btn = document.getElementById("toggleCamBtn");
    const localCard = document.getElementById("localVideoCard");

    if (!videoTrack || !btn) return;

    videoTrack.enabled = !videoTrack.enabled;
    btn.classList.toggle("off", !videoTrack.enabled);
    localCard?.classList.toggle("has-video", videoTrack.enabled);

    btn.innerHTML = videoTrack.enabled
        ? `<span class="call-svg-icon video-icon"></span><small>Camera</small>`
        : `<span class="call-svg-icon video-off-icon"></span><small>Off</small>`;
}

function toggleSpeaker() {
    const remoteVideo = document.getElementById("remoteVideo");
    const btn = document.getElementById("toggleSpeakerBtn");

    if (!remoteVideo || !btn) return;

    remoteVideo.muted = !remoteVideo.muted;
    btn.classList.toggle("off", remoteVideo.muted);

    btn.innerHTML = remoteVideo.muted
        ? `<span class="call-svg-icon speaker-icon"></span><small>Muted</small>`
        : `<span class="call-svg-icon speaker-icon"></span><small>Speaker</small>`;
}

function switchCameraView() {
    const screen = document.querySelector(".video-call-screen");
    screen?.classList.toggle("swap-view");
}

function toggleFocusCallView() {
    const screen = document.querySelector(".video-call-screen");
    screen?.classList.toggle("focus-mode");
}

/* =========================
   END / CLEANUP
========================= */

async function endVideoCall() {
    if (!ACTIVE_CALL_ID) return;

    try {
        await fetch(`${API_URL}/api/video-call/end`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callId: ACTIVE_CALL_ID })
        });
    } catch (error) {
        console.error("endVideoCall error:", error);
    } finally {
        // ✅ Reset local state so call cannot be reused
        ACTIVE_CALL_ID = null;
        ACTIVE_CALL_ROLE = null;
        INCOMING_CALL = null;
        ADDED_ICE_IDS.clear();
        hideIncomingCallModal();
        closeVideoCallModal();
        cleanupCallUI("Call ended");
    }
}


function cleanupCallUI(statusText = "Call ended") {
    updateCallStatus(statusText);

    if (WEBRTC_TIMER) clearInterval(WEBRTC_TIMER);
    WEBRTC_TIMER = null;

    if (ACTIVE_CALL_WATCH_TIMER) clearInterval(ACTIVE_CALL_WATCH_TIMER);
    ACTIVE_CALL_WATCH_TIMER = null;

    if (PEER_CONNECTION) {
        PEER_CONNECTION.close();
        PEER_CONNECTION = null;
    }

    stopLocalCamera();
    stopRemoteVideo();

    ACTIVE_CALL_ID = null;
    ACTIVE_CALL_ROLE = null;
    INCOMING_CALL = null;
    ADDED_ICE_IDS = new Set();

    stopCallTimer();
    resetCallPlaceholders();

    setTimeout(() => {
        closeVideoCallModal();
        hideIncomingCallModal();
    }, 800);
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
    const statusEl = document.getElementById("callModalStatus");
    if (statusEl) statusEl.textContent = text || "";
}

/* =========================
   HELPERS
========================= */

function getCurrentCallName() {
    return (
        CURRENT_WITH_USER?.fullname ||
        CURRENT_WITH_USER?.name ||
        CURRENT_FREELANCER?.fullname ||
        "Calling..."
    );
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function startCallTimer() {
    if (CALL_TIMER_INTERVAL) return;

    CALL_STARTED_AT = Date.now();

    CALL_TIMER_INTERVAL = setInterval(() => {
        const timer = document.getElementById("callTimer");
        if (!timer || !CALL_STARTED_AT) return;

        const total = Math.floor((Date.now() - CALL_STARTED_AT) / 1000);
        const min = String(Math.floor(total / 60)).padStart(2, "0");
        const sec = String(total % 60).padStart(2, "0");

        timer.textContent = `${min}:${sec}`;
    }, 1000);
}

function stopCallTimer() {
    if (CALL_TIMER_INTERVAL) clearInterval(CALL_TIMER_INTERVAL);

    CALL_TIMER_INTERVAL = null;
    CALL_STARTED_AT = null;

    const timer = document.getElementById("callTimer");
    if (timer) timer.textContent = "00:00";
}
function resetCallPlaceholders() {
    const remoteName = document.getElementById("remoteCallName");
    const remoteText = document.getElementById("remoteCallText");
    const remoteAvatar = document.getElementById("remoteCallAvatar");

    const name = getCurrentCallName();
    const initials = getInitials(name);

    if (remoteName) remoteName.textContent = name || "Client";
    if (remoteText) remoteText.textContent = "Waiting for the other person to join.";
    if (remoteAvatar) remoteAvatar.textContent = initials || "CL";

    document.getElementById("remoteVideoStage")?.classList.remove("has-video");
    document.getElementById("localVideoCard")?.classList.remove("has-video");
}
/* =========================
   FULL CLEANUP
========================= */

function cleanupCallCompletely(message = "Call ended") {

    console.log("cleanupCallCompletely:", message);

    updateCallStatus(message);

    hideIncomingCallModal();

    // stop rtc
    if (PEER_CONNECTION) {
        try {
            PEER_CONNECTION.close();
        } catch (e) {}

        PEER_CONNECTION = null;
    }

    // stop local media
    if (LOCAL_STREAM) {
        LOCAL_STREAM.getTracks().forEach(track => {
            try {
                track.stop();
            } catch (e) {}
        });

        LOCAL_STREAM = null;
    }

    // clear remote video
    const remoteVideo = document.getElementById("remoteVideo");

    if (remoteVideo) {
        remoteVideo.srcObject = null;
    }

    // clear local video
    const localVideo = document.getElementById("localVideo");

    if (localVideo) {
        localVideo.srcObject = null;
    }

    ACTIVE_CALL_ID = null;
    ACTIVE_CALL_ROLE = null;
    INCOMING_CALL = null;

    ADDED_ICE_IDS = new Set();

    setTimeout(() => {
        closeVideoCallModal?.();
    }, 1000);
}