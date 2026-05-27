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