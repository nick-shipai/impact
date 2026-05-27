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