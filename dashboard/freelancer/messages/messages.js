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

    initLightbox();
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
let SELECTED_IMAGE_FILES = [];
let SELECTED_IMAGE_URLS = [];
let LIGHTBOX_IMAGES = [];
let LIGHTBOX_INDEX  = 0;
let LB_TOUCH_X      = 0;
let CALL_STARTED_AT = null;
let CALL_TIMER_INTERVAL = null;

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

    if (SELECTED_IMAGE_FILES.length > 0) {
        await sendImageMessage();
        return;
    }

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

        cancelImagePreview();
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

    let content = "";
    let isImageMsg = false;
    let rawImgsArr = [];

    if (msg.type === "images" || msg.type === "mixed") {
        isImageMsg = true;
        const images = Array.isArray(msg.images) ? msg.images : [];
        rawImgsArr = images;
        const gridClass = images.length === 1 ? "count-1"
            : images.length === 2 ? "count-2"
            : images.length === 3 ? "count-3"
            : images.length === 4 ? "count-4"
            : "count-many";
        content = `<div class="chat-images-grid ${gridClass}">
            ${images.map(img => `<img src="${escapeHTML(img)}" class="chat-image" loading="lazy" onclick="openLightboxFromImg(this); event.stopPropagation();">`).join("")}
          </div>`;
        if (msg.message) content += `<p>${escapeHTML(msg.message)}</p>`;
    } else if (msg.type === "image") {
        isImageMsg = true;
        const image = msg.imageUrl || (Array.isArray(msg.images) ? msg.images[0] : "");
        rawImgsArr = image ? [image] : [];
        content = `<img src="${escapeHTML(image)}" class="chat-image" loading="lazy" onclick="openLightboxFromImg(this); event.stopPropagation();">`;
        if (msg.message) content += `<p>${escapeHTML(msg.message)}</p>`;
    } else {
        content = `<p>${escapeHTML(msg.message || "")}</p>`;
    }

    const msgType = msg.type || "text";
    const msgText = escapeHTML(msg.message || "");
    const msgImgs = escapeHTML(JSON.stringify(rawImgsArr));

    return `
    <div class="message-row ${isMine ? "mine" : "theirs"}">
      <div class="message-bubble ${isImageMsg ? "image-bubble" : ""}"
        data-msg-id="${escapeHTML(msg.messageId || "")}"
        data-msg-type="${msgType}"
        data-msg-mine="${isMine}"
        data-msg-text="${msgText}"
        data-msg-imgs="${msgImgs}"
        oncontextmenu="handleBubbleClick(event, this)">
        ${content}
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

    bindImageUpload();

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
let CALL_IS_LIVE = false;          // FIX: tracks whether call actually connected
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
        CALL_IS_LIVE = false;
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

        // If call was created server-side but crashed locally, mark it ended
        if (ACTIVE_CALL_ID) {
            try {
                await fetch(`${API_URL}/api/video-call/end`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ callId: ACTIVE_CALL_ID })
                });
            } catch (e) {
                console.error("endVideoCall (error cleanup) failed:", e);
            }
        }
    }
}

/* =========================
   INCOMING CALL WATCHER
========================= */

function startIncomingCallWatcher() {
    if (CALLS_TIMER) clearInterval(CALLS_TIMER);

    CALLS_TIMER = setInterval(loadIncomingCalls, 2000);
    loadIncomingCalls();
}

async function loadIncomingCalls() {
    try {

        // if currently inside active call screen, check if call still exists
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

        const calls = Array.isArray(data.calls) ? data.calls : [];

        // FIX: If we have a cached INCOMING_CALL, check its current status in the
        // fresh calls list. If it is no longer ringing (cancelled, missed, ended,
        // deleted), dismiss the modal immediately — before doing anything else.
        if (INCOMING_CALL) {
            const cached = calls.find(c => c.callId === INCOMING_CALL.callId);
            const deadStatuses = ["ended", "rejected", "missed", "cancelled", "expired"];

            if (!cached || deadStatuses.includes(cached.status)) {
                hideIncomingCallModal();
                INCOMING_CALL = null;
            }
        }

        // Only surface a call that is actively ringing and directed at us
        const incoming = calls.find(call =>
            call.direction === "incoming" &&
            call.status === "ringing"
        );

        // Nothing ringing right now
        if (!incoming) {
            hideIncomingCallModal();
            INCOMING_CALL = null;
            return;
        }

        // Hard-block any dead-status call just in case direction/status mismatch
        const deadStatuses = ["ended", "rejected", "missed", "cancelled", "expired"];
        if (deadStatuses.includes(incoming.status)) {
            hideIncomingCallModal();
            INCOMING_CALL = null;
            return;
        }

        // Already displaying this exact call — do nothing
        if (INCOMING_CALL && INCOMING_CALL.callId === incoming.callId) {
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

        const calls = Array.isArray(data.calls) ? data.calls : [];

        const activeCall = calls.find(c => c.callId === ACTIVE_CALL_ID);

        // call deleted/not found — clean up
        if (!activeCall) {
            cleanupCallCompletely("Call ended");
            return;
        }

        // call reached a terminal state
        if (
            ["ended", "rejected", "missed", "cancelled", "expired"].includes(activeCall.status)
        ) {
            cleanupCallCompletely(`Call ${activeCall.status}`);
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
    CALL_IS_LIVE = false;
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

        CALL_IS_LIVE = true;          // FIX: mark call as live when remote track arrives
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
            CALL_IS_LIVE = true;      // FIX: also mark live when connection state confirms it
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

// FIX: removed duplicate definition — single correct version that clears both video and stage class
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
   END / CANCEL / CLEANUP
========================= */

async function endVideoCall() {
    if (!ACTIVE_CALL_ID) return;

    const callIdToEnd = ACTIVE_CALL_ID;

    // Reset state immediately so the UI is unblocked
    ACTIVE_CALL_ID = null;
    ACTIVE_CALL_ROLE = null;
    CALL_IS_LIVE = false;
    INCOMING_CALL = null;
    ADDED_ICE_IDS.clear();
    hideIncomingCallModal();
    closeVideoCallModal();
    cleanupCallUI("Call ended");

    // Always mark as ended regardless of whether the call was live or still ringing.
    // The server /api/video-call/end updates status to "ended" for any non-closed call,
    // which causes the receiver's incoming-call poller to dismiss the modal automatically.
    try {
        await fetch(`${API_URL}/api/video-call/end`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callId: callIdToEnd })
        });
    } catch (error) {
        console.error("endVideoCall error:", error);
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
    CALL_IS_LIVE = false;            // FIX: reset live flag on cleanup
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

    updateCallStatus(message);

    hideIncomingCallModal();

    if (WEBRTC_TIMER) clearInterval(WEBRTC_TIMER);
    WEBRTC_TIMER = null;

    if (ACTIVE_CALL_WATCH_TIMER) clearInterval(ACTIVE_CALL_WATCH_TIMER);
    ACTIVE_CALL_WATCH_TIMER = null;

    if (PEER_CONNECTION) {
        try {
            PEER_CONNECTION.close();
        } catch (e) {}

        PEER_CONNECTION = null;
    }

    if (LOCAL_STREAM) {
        LOCAL_STREAM.getTracks().forEach(track => {
            try {
                track.stop();
            } catch (e) {}
        });

        LOCAL_STREAM = null;
    }

    const remoteVideo = document.getElementById("remoteVideo");
    if (remoteVideo) {
        remoteVideo.srcObject = null;
    }

    const localVideo = document.getElementById("localVideo");
    if (localVideo) {
        localVideo.srcObject = null;
    }

    document.getElementById("remoteVideoStage")?.classList.remove("has-video");
    document.getElementById("localVideoCard")?.classList.remove("has-video");

    ACTIVE_CALL_ID = null;
    ACTIVE_CALL_ROLE = null;
    CALL_IS_LIVE = false;             // FIX: reset live flag
    INCOMING_CALL = null;
    ADDED_ICE_IDS = new Set();

    stopCallTimer();

    setTimeout(() => {
        closeVideoCallModal?.();
    }, 1000);
}

/* =========================
   IMAGE UPLOAD
========================= */
function bindImageUpload() {
    const fileInput = document.getElementById("chatImageInput");
    const uploadBtn = document.getElementById("uploadImageBtn");

    if (!fileInput || !uploadBtn) return;

    uploadBtn.addEventListener("click", () => {
        if (uploadBtn.disabled) return;
        fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        const validFiles = [];
        const validUrls  = [];

        for (const file of files) {
            if (!file.type.startsWith("image/")) continue;
            validFiles.push(file);
            validUrls.push(URL.createObjectURL(file));
        }

        if (!validFiles.length) { alert("Only images are allowed"); return; }

        SELECTED_IMAGE_FILES = validFiles;
        SELECTED_IMAGE_URLS  = validUrls;

        showImagePreview(validUrls);

        const sendBtn = document.querySelector(".send-btn");
        if (sendBtn) sendBtn.disabled = false;

        fileInput.value = "";
    });
}

function showImagePreview(urls) {
    const container = document.getElementById("imagePreviewContainer");
    if (!container) return;

    const count = urls.length;
    const label = count === 1 ? "1 image" : `${count} images`;

    container.innerHTML = `
        <div class="image-preview-grid">
            ${urls.map((url, index) => `
                <div class="image-preview-box">
                    <img src="${url}" alt="preview" />
                    <button class="cancel-preview" onclick="removePreviewImage(${index})" title="Remove">\u2715</button>
                </div>
            `).join("")}
            ${count > 1 ? `<span class="image-preview-count">${label} selected</span>` : ""}
        </div>
    `;
}

function removePreviewImage(index) {
    SELECTED_IMAGE_FILES.splice(index, 1);
    SELECTED_IMAGE_URLS.splice(index, 1);

    if (!SELECTED_IMAGE_URLS.length) {
        cancelImagePreview();
        return;
    }

    showImagePreview(SELECTED_IMAGE_URLS);
}

function cancelImagePreview() {
    SELECTED_IMAGE_FILES = [];
    SELECTED_IMAGE_URLS  = [];
    removeImagePreview();

    const sendBtn = document.querySelector(".send-btn");
    const input   = document.querySelector(".chat-composer textarea");
    if (sendBtn && input) sendBtn.disabled = input.value.trim().length < 1;
}

function removeImagePreview() {
    const container = document.getElementById("imagePreviewContainer");
    if (container) container.innerHTML = "";
}

async function sendImageMessage() {
    if (!SELECTED_IMAGE_FILES.length || !CURRENT_RECEIVER_UID) return;

    const formData = new FormData();
    formData.append("receiverUid", CURRENT_RECEIVER_UID);
    SELECTED_IMAGE_FILES.forEach(file => formData.append("images", file));

    const previewUrls = [...SELECTED_IMAGE_URLS];

    cancelImagePreview();

    appendMessage({
        messageId : "temp_" + Date.now(),
        senderUid : CURRENT_USER?.uid,
        receiverUid: CURRENT_RECEIVER_UID,
        type      : "images",
        images    : previewUrls,
        createdAt : Date.now(),
        sending   : true
    });

    showUploadProgress();

    try {
        const response = await fetch(`${API_URL}/api/messages/send`, {
            method: "POST",
            credentials: "include",
            body: formData
        });

        const data = await response.json().catch(() => ({}));

        if (!data.success) {
            hideUploadProgress();
            alert(data.message || "Image failed to send");
            return;
        }

        hideUploadProgress();
        await loadMessages(CURRENT_CONVERSATION_ID);
        await loadInbox(false);

    } catch (error) {
        console.error("sendImageMessage error:", error);
        hideUploadProgress();
        alert("Image upload failed");
    }
}

function showUploadProgress() {
    let strip = document.getElementById("uploadProgressStrip");
    if (!strip) {
        const wrapper = document.querySelector(".chat-composer-wrapper");
        if (!wrapper) return;
        strip = document.createElement("div");
        strip.id = "uploadProgressStrip";
        strip.className = "upload-progress-strip";
        strip.innerHTML = `
            <div class="upload-spinner"></div>
            <div class="upload-progress-track">
                <div class="upload-progress-fill"></div>
            </div>
            <span class="upload-progress-label">Uploading\u2026</span>
        `;
        const composer = wrapper.querySelector(".chat-composer");
        wrapper.insertBefore(strip, composer);
    }
    strip.classList.add("visible");
}

function hideUploadProgress() {
    const strip = document.getElementById("uploadProgressStrip");
    if (strip) {
        strip.classList.remove("visible");
        setTimeout(() => { if (strip.parentNode) strip.remove(); }, 350);
    }
}

/* =========================
   IMAGE LIGHTBOX
========================= */

function initLightbox() {
    if (document.getElementById("imageLightbox")) return;

    const el = document.createElement("div");
    el.id = "imageLightbox";
    el.className = "image-lightbox";
    el.innerHTML = [
        '<div class="lightbox-backdrop"></div>',
        '<button class="lightbox-close" aria-label="Close">\u00d7</button>',
        '<button class="lightbox-prev lb-hidden" id="lightboxPrev" aria-label="Previous">&#8249;</button>',
        '<button class="lightbox-next lb-hidden" id="lightboxNext" aria-label="Next">&#8250;</button>',
        '<div class="lightbox-stage"><img id="lightboxImg" src="" alt="" draggable="false"></div>',
        '<div class="lightbox-counter" id="lightboxCounter">1 / 1</div>'
    ].join("");
    document.body.appendChild(el);

    el.querySelector(".lightbox-backdrop").addEventListener("click", closeLightbox);
    el.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
    el.querySelector("#lightboxPrev").addEventListener("click", function () { lightboxMove(-1); });
    el.querySelector("#lightboxNext").addEventListener("click", function () { lightboxMove(1); });

    document.addEventListener("keydown", function (e) {
        if (!document.getElementById("imageLightbox")?.classList.contains("active")) return;
        if (e.key === "Escape")     closeLightbox();
        if (e.key === "ArrowLeft")  lightboxMove(-1);
        if (e.key === "ArrowRight") lightboxMove(1);
    });

    el.addEventListener("touchstart", function (e) {
        LB_TOUCH_X = e.touches[0].clientX;
    }, { passive: true });

    el.addEventListener("touchend", function (e) {
        const diff = LB_TOUCH_X - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 48) lightboxMove(diff > 0 ? 1 : -1);
    }, { passive: true });
}

function openLightboxFromImg(imgEl) {
    const chatBody = document.querySelector(".chat-body");

    let images = [imgEl.src];
    let idx    = 0;

    if (chatBody) {
        const all = Array.from(chatBody.querySelectorAll(".chat-image"));
        if (all.length) {
            images = all.map(function (el) { return el.src; });
            const found = all.indexOf(imgEl);
            idx = found >= 0 ? found : 0;
        }
    }

    openLightbox(images, idx);
}

function openLightbox(images, startIndex) {
    initLightbox();
    LIGHTBOX_IMAGES = images;
    LIGHTBOX_INDEX  = typeof startIndex === "number" ? startIndex : 0;
    _lbShow(LIGHTBOX_INDEX);
    document.getElementById("imageLightbox").classList.add("active");
    document.body.style.overflow = "hidden";
}

function _lbShow(index) {
    const img     = document.getElementById("lightboxImg");
    const counter = document.getElementById("lightboxCounter");
    const prev    = document.getElementById("lightboxPrev");
    const next    = document.getElementById("lightboxNext");
    if (!img) return;

    img.style.animation = "none";
    void img.offsetHeight;
    img.style.animation = "";

    img.src = LIGHTBOX_IMAGES[index];
    if (counter) counter.textContent = (index + 1) + " / " + LIGHTBOX_IMAGES.length;
    if (prev)    prev.classList.toggle("lb-hidden", index === 0);
    if (next)    next.classList.toggle("lb-hidden", index === LIGHTBOX_IMAGES.length - 1);
}

function lightboxMove(dir) {
    const n = LIGHTBOX_INDEX + dir;
    if (n < 0 || n >= LIGHTBOX_IMAGES.length) return;
    LIGHTBOX_INDEX = n;
    _lbShow(LIGHTBOX_INDEX);
}

function closeLightbox() {
    document.getElementById("imageLightbox")?.classList.remove("active");
    document.body.style.overflow = "";
}

/* =========================
   MESSAGE CONTEXT MENU
========================= */
let MSG_CTX_OPEN = false;

function handleBubbleClick(event, bubbleEl) {
    event.preventDefault();
    event.stopPropagation();
    showMsgMenu(event, bubbleEl);
}

function showMsgMenu(event, bubbleEl) {
    closeMsgMenu();

    const msgId   = bubbleEl.dataset.msgId   || "";
    const msgType = bubbleEl.dataset.msgType  || "text";
    const msgText = bubbleEl.dataset.msgText  || "";
    const isMine  = bubbleEl.dataset.msgMine  === "true";
    const isImg   = ["image", "images", "mixed"].includes(msgType);

    let rawImgs = [];
    try { rawImgs = JSON.parse(bubbleEl.dataset.msgImgs || "[]"); } catch (e) {}

    if (!msgId) return;

    const menu = document.createElement("div");
    menu.id = "msgCtxMenu";
    menu.className = "msg-ctx-menu";

    const items = [];

    if (isMine && !isImg) {
        items.push(
            `<button class="msg-ctx-item" onclick="startEditMsg('${msgId}'); closeMsgMenu();">` +
            `<i class="fa-solid fa-pen msg-ctx-icon"></i> Edit</button>`
        );
    }

    if (isImg && rawImgs.length) {
        const encoded = encodeURIComponent(JSON.stringify(rawImgs));
        items.push(
            `<button class="msg-ctx-item" onclick="downloadMsgImages(JSON.parse(decodeURIComponent('${encoded}'))); closeMsgMenu();">` +
            `<i class="fa-solid fa-download msg-ctx-icon"></i> Download</button>`
        );
    }

    if (isMine) {
        items.push(
            `<button class="msg-ctx-item danger" onclick="confirmDeleteMsg('${msgId}'); closeMsgMenu();">` +
            `<i class="fa-solid fa-trash msg-ctx-icon"></i> Delete</button>`
        );
    }

    if (!items.length) return;

    menu.innerHTML = items.join("");
    document.body.appendChild(menu);

    requestAnimationFrame(function () {
        const mw = menu.offsetWidth;
        const mh = menu.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const cx = event.clientX;
        const cy = event.clientY;

        let x = cx + 4;
        let y = cy + 4;

        if (x + mw > vw - 8) x = cx - mw - 4;
        if (y + mh > vh - 8) y = cy - mh - 4;

        menu.style.left = x + "px";
        menu.style.top  = y + "px";
        menu.classList.add("visible");
        MSG_CTX_OPEN = true;
    });
}

function closeMsgMenu() {
    const m = document.getElementById("msgCtxMenu");
    if (m) m.remove();
    MSG_CTX_OPEN = false;
}

document.addEventListener("click", function (e) {
    if (MSG_CTX_OPEN && !e.target.closest("#msgCtxMenu")) {
        closeMsgMenu();
    }
});

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && MSG_CTX_OPEN) closeMsgMenu();
});

/* =========================
   DELETE MESSAGE
========================= */
async function confirmDeleteMsg(msgId) {
    if (!CURRENT_CONVERSATION_ID) return;
    if (!confirm("Delete this message? This cannot be undone.")) return;

    try {
        const response = await fetch(
            `${API_URL}/api/messages/delete/${encodeURIComponent(msgId)}?conversationId=${encodeURIComponent(CURRENT_CONVERSATION_ID)}`,
            {
                method: "DELETE",
                credentials: "include",
                headers: { "Content-Type": "application/json" }
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            alert(data.message || "Could not delete message.");
            return;
        }

        await loadMessages(CURRENT_CONVERSATION_ID, false);

    } catch (error) {
        console.error("confirmDeleteMsg error:", error);
        alert("Network error. Message not deleted.");
    }
}

/* =========================
   EDIT MESSAGE
========================= */
function startEditMsg(msgId) {
    const bubbleEl = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (!bubbleEl) return;

    const currentText = bubbleEl.dataset.msgText || "";
    const textEl = bubbleEl.querySelector("p");
    if (!textEl) return;

    const escaped = currentText.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

    textEl.outerHTML = `
        <div class="msg-edit-wrap" id="msgEditWrap_${msgId}">
            <textarea class="msg-edit-input" id="msgEditInput_${msgId}">${escaped}</textarea>
            <div class="msg-edit-actions">
                <button class="msg-edit-btn save" onclick="saveEditMsg('${msgId}')">Save</button>
                <button class="msg-edit-btn cancel" onclick="cancelEditMsg('${msgId}', '${encodeURIComponent(currentText)}')">Cancel</button>
            </div>
        </div>
    `;

    const input = document.getElementById(`msgEditInput_${msgId}`);
    if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                saveEditMsg(msgId);
            }
            if (e.key === "Escape") {
                cancelEditMsg(msgId, encodeURIComponent(currentText));
            }
        });
    }
}

async function saveEditMsg(msgId) {
    if (!CURRENT_CONVERSATION_ID) return;

    const input = document.getElementById(`msgEditInput_${msgId}`);
    if (!input) return;

    const newText = input.value.trim();
    if (!newText) { alert("Message cannot be empty."); return; }

    const saveBtn = input.closest(".msg-edit-wrap")?.querySelector(".save");
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving\u2026"; }

    try {
        const response = await fetch(
            `${API_URL}/api/messages/edit/${encodeURIComponent(msgId)}`,
            {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: newText,
                    conversationId: CURRENT_CONVERSATION_ID
                })
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            alert(data.message || "Could not edit message.");
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save"; }
            return;
        }

        await loadMessages(CURRENT_CONVERSATION_ID, false);

    } catch (error) {
        console.error("saveEditMsg error:", error);
        alert("Network error. Message not edited.");
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save"; }
    }
}

function cancelEditMsg(msgId, encodedText) {
    const wrap = document.getElementById(`msgEditWrap_${msgId}`);
    if (!wrap) return;

    const text = decodeURIComponent(encodedText);
    const p = document.createElement("p");
    p.textContent = text;
    wrap.replaceWith(p);
}

/* =========================
   DOWNLOAD IMAGES
========================= */
async function downloadMsgImages(urls) {
    if (!Array.isArray(urls) || !urls.length) return;

    for (let i = 0; i < urls.length; i++) {
        try {
            const res  = await fetch(urls[i]);
            const blob = await res.blob();
            const ext  = blob.type.split("/")[1] || "jpg";
            const blobUrl = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href     = blobUrl;
            a.download = `image_${Date.now()}_${i + 1}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

            if (i < urls.length - 1) {
                await new Promise(r => setTimeout(r, 400));
            }
        } catch (error) {
            console.error("downloadMsgImages error for url", urls[i], error);
        }
    }
}
