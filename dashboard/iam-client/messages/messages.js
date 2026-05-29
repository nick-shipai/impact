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
let SELECTED_IMAGE_FILES = [];
let SELECTED_IMAGE_URLS = [];
let LIGHTBOX_IMAGES = [];
let LIGHTBOX_INDEX  = 0;
let LB_TOUCH_X      = 0;
let MSG_CTX_OPEN    = false;

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
    bindImageUpload();
    initLightbox();
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
    }, 700);
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

    // CASE 1: IMAGE MESSAGE
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

        cancelImagePreview();
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

async function sendImageMessage() {
    if (!SELECTED_IMAGE_FILES.length || !CURRENT_RECEIVER_UID) return;

    const formData = new FormData();
    formData.append("receiverUid", CURRENT_RECEIVER_UID);
    SELECTED_IMAGE_FILES.forEach((file) => formData.append("images", file));

    const tempId = "temp_" + Date.now();
    const previewUrls = [...SELECTED_IMAGE_URLS];

    // Clear preview tray immediately
    cancelImagePreview();

    // Optimistic bubble
    appendMessageBubble({
        messageId: tempId,
        senderUid: CURRENT_USER.uid,
        receiverUid: CURRENT_RECEIVER_UID,
        type: "images",
        images: previewUrls,
        createdAt: Date.now(),
        sending: true
    });

    // Tiny progress strip
    showUploadProgress();

    try {
        const response = await fetch(`${API_URL}/api/messages/send`, {
            method: "POST",
            credentials: "include",
            body: formData
        });

        const data = await response.json();

        if (!data.success) {
            hideUploadProgress();
            alert(data.message || "Image failed to send");
            return;
        }

        hideUploadProgress();
        await loadMessages(CURRENT_CONVERSATION_ID);
        await loadConversations();

    } catch (error) {
        console.error(error);
        hideUploadProgress();
        alert("Image upload failed");
    }
}

/* =========================
   UPLOAD PROGRESS HELPERS
========================= */
function showUploadProgress() {
    let strip = document.getElementById("uploadProgressStrip");
    if (!strip) {
        const composer = document.querySelector(".chat-composer-wrapper") ||
                         document.querySelector(".chat-composer");
        if (!composer) return;
        strip = document.createElement("div");
        strip.id = "uploadProgressStrip";
        strip.className = "upload-progress-strip";
        strip.innerHTML = `
            <div class="upload-spinner"></div>
            <div class="upload-progress-track">
                <div class="upload-progress-fill"></div>
            </div>
            <span class="upload-progress-label">Uploading…</span>
        `;
        composer.insertAdjacentElement("beforebegin", strip);
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
    const isMine =
        msg.senderUid === CURRENT_USER?.uid;

    const isRead = !!msg.read;

    let content = "";

    /* =========================
       MULTIPLE IMAGES
    ========================= */

    if (
        msg.type === "images" ||
        msg.type === "mixed"
    ) {

        const images = Array.isArray(msg.images)
            ? msg.images
            : [];

        const gridClass = images.length === 1 ? "count-1"
            : images.length === 2 ? "count-2"
            : images.length === 3 ? "count-3"
            : images.length === 4 ? "count-4"
            : "count-many";

        content = `
            <div class="chat-images-grid ${gridClass}">
                ${images.map((img) => `
                    <img
                        src="${escapeHTML(img)}"
                        class="chat-image"
                        loading="lazy"
                        onclick="openLightboxFromImg(this); event.stopPropagation();"
                    >
                `).join("")}
            </div>
        `;

        if (msg.message) {
            content += `
                <p>
                    ${escapeHTML(msg.message)}
                </p>
            `;
        }
    }

    /* =========================
       SINGLE IMAGE
    ========================= */

    else if (msg.type === "image") {

        const image =
            msg.imageUrl ||
            (Array.isArray(msg.images)
                ? msg.images[0]
                : "");

        content = `
            <img
                src="${escapeHTML(image)}"
                class="chat-image"
                loading="lazy"
                onclick="openLightboxFromImg(this); event.stopPropagation();"
            >
        `;

        if (msg.message) {
            content += `
                <p>
                    ${escapeHTML(msg.message)}
                </p>
            `;
        }
    }

    /* =========================
       TEXT
    ========================= */

    else {

        content = `
            <p>
                ${escapeHTML(msg.message || "")}
            </p>
        `;
    }

    return `
        <div class="message-row ${isMine ? "mine" : "theirs"}">

            <div class="message-bubble ${msg.type === "image" || msg.type === "images" || msg.type === "mixed" ? "image-bubble" : ""}"
                data-msg-id="${escapeHTML(msg.messageId || "")}"
                data-msg-type="${msg.type || 'text'}"
                data-msg-mine="${isMine}"
                data-msg-text="${escapeHTML(msg.message || "")}"
                data-msg-imgs="${escapeHTML(JSON.stringify(Array.isArray(msg.images) ? msg.images : (msg.imageUrl ? [msg.imageUrl] : [])))}"
                ${isMine ? 'oncontextmenu="handleBubbleClick(event, this)"' : ""}>

                ${content}

                <div class="message-meta">

                    <span>
                        ${formatMessageTime(msg.createdAt)}
                    </span>

                    ${isMine
            ? `
                            <span class="
                                css-checks
                                ${isRead ? "seen" : ""}
                            "></span>
                        `
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
                    <button
                        class="cancel-preview"
                        onclick="removePreviewImage(${index})"
                        title="Remove"
                    >✕</button>
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
    SELECTED_IMAGE_URLS = [];

    removeImagePreview();
}

function removeImagePreview() {
    const container = document.getElementById("imagePreviewContainer");

    if (container) {
        container.innerHTML = "";
    }
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

        const validUrls = [];

        for (const file of files) {
            if (!file.type.startsWith("image/")) {
                continue;
            }

            validFiles.push(file);

            validUrls.push(URL.createObjectURL(file));
        }

        if (!validFiles.length) {
            alert("Only images are allowed");
            return;
        }

        SELECTED_IMAGE_FILES = validFiles;
        SELECTED_IMAGE_URLS = validUrls;

        showImagePreview(validUrls);
    });
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
    }, 700);
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
    document.getElementById("switchCameraBtn")?.addEventListener("click", switchCamera);
    document.getElementById("expandCallBtn")?.addEventListener("click", toggleFullscreen);
    document.getElementById("toggleSpeakerBtn")?.addEventListener("click", toggleSpeaker);
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

    if (CALLS_TIMER) {
        clearInterval(CALLS_TIMER);
    }

    CALLS_TIMER = setInterval(loadIncomingCalls, 2500);

    loadIncomingCalls();
}

async function loadIncomingCalls() {

    try {

        // validate current active call
        if (ACTIVE_CALL_ID) {
            await validateActiveCall();
        }

        const res = await fetch(`${API_URL}/api/video-call/my-calls`, {
            method: "GET",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = await res.json().catch(() => ({}));

        // failed request
        if (!res.ok || !data.success) {

            hideIncomingCallModal();

            INCOMING_CALL = null;

            return;
        }

        const calls = Array.isArray(data.calls)
            ? data.calls
            : [];

        const incoming = calls.find(call =>
            call.direction === "incoming" ||
            call.receiverUid === CURRENT_USER?.uid
        );

        const isActive = incoming &&
            !["ended", "rejected", "missed", "cancelled", "expired"].includes(incoming.status);

        if (!isActive) {
            hideIncomingCallModal();
            INCOMING_CALL = null;
            return;
        }

        // already showing same modal
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

        INCOMING_CALL = null;
    }
}

/* =========================
   VALIDATE ACTIVE CALL
========================= */

async function validateActiveCall() {

    if (!ACTIVE_CALL_ID) return;

    try {

        const res = await fetch(`${API_URL}/api/video-call/my-calls`, {
            method: "GET",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.success) {
            return;
        }

        const calls = Array.isArray(data.calls)
            ? data.calls
            : [];

        const activeCall = calls.find(
            call => call.callId === ACTIVE_CALL_ID
        );

        // call disappeared
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

        console.error(
            "validateActiveCall error:",
            error
        );
    }
}

/* =========================
   FULL CLEANUP
========================= */

function cleanupCallCompletely(message = "Call ended") {

    console.log(
        "cleanupCallCompletely:",
        message
    );

    updateCallStatus(message);

    hideIncomingCallModal();

    // close rtc
    if (PEER_CONNECTION) {

        try {
            PEER_CONNECTION.close();
        } catch (e) { }

        PEER_CONNECTION = null;
    }

    // stop local stream
    if (LOCAL_STREAM) {

        LOCAL_STREAM.getTracks().forEach(track => {

            try {
                track.stop();
            } catch (e) { }

        });

        LOCAL_STREAM = null;
    }

    // clear remote video
    const remoteVideo =
        document.getElementById("remoteVideo");

    if (remoteVideo) {
        remoteVideo.srcObject = null;
    }

    // clear local video
    const localVideo =
        document.getElementById("localVideo");

    if (localVideo) {
        localVideo.srcObject = null;
    }

    ACTIVE_CALL_ID = null;
    ACTIVE_CALL_ROLE = null;
    INCOMING_CALL = null;

    ADDED_ICE_IDS = new Set();

    setTimeout(() => {

        closeVideoCallModal?.();

    }, 800);
}

function createIncomingCallModal() {
    let overlay = document.getElementById("incomingCallOverlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.className = "incoming-call-overlay";
    overlay.id = "incomingCallOverlay";
    overlay.innerHTML = `
        <div class="incoming-call-card">

            <div class="incoming-rings">
                <span></span>
                <span></span>
                <span></span>

                <div class="incoming-avatar" id="incomingCallerAvatar">
                    <span>CL</span>
                </div>
            </div>

            <span class="incoming-pill">
                Incoming video call
            </span>

            <h3 id="incomingCallerName">
                Someone is calling...
            </h3>

            <p>
                Answer to start camera and microphone
            </p>

            <div class="incoming-actions">

                <button type="button" class="reject-call-btn" id="rejectIncomingCallBtn">
                    <span class="call-svg-icon phone-down-icon"></span>
                    Reject
                </button>

                <button type="button" class="answer-call-btn" id="answerIncomingCallBtn">
                    <span class="call-svg-icon phone-up-icon"></span>
                    Answer
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector("#answerIncomingCallBtn")?.addEventListener("click", answerIncomingCall);
    overlay.querySelector("#rejectIncomingCallBtn")?.addEventListener("click", rejectIncomingCall);

    return overlay;
}

function showIncomingCallModal(call) {
    const overlay = createIncomingCallModal();
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

    // stop polling while answering
    if (CALLS_TIMER) {
        clearInterval(CALLS_TIMER);
        CALLS_TIMER = null;
    }

    const callId = INCOMING_CALL.callId;

    ACTIVE_CALL_ID = callId;
    ACTIVE_CALL_ROLE = "receiver";
    ADDED_ICE_IDS = new Set();

    hideIncomingCallModal();

    openVideoCallModal({
        title: "Video call",
        status: "Answering call..."
    });

    const cameraReady = await startLocalCamera();

    if (!cameraReady) {

        updateCallStatus(
            "Camera permission denied or unavailable."
        );

        startIncomingCallWatcher();

        return;
    }

    try {

        const acceptRes = await fetch(
            `${API_URL}/api/video-call/accept`,
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    callId
                })
            }
        );

        const acceptData =
            await acceptRes.json().catch(() => ({}));

        if (!acceptRes.ok || !acceptData.success) {

            console.error(
                "accept failed:",
                acceptData
            );

            cleanupCallCompletely(
                acceptData.message ||
                "Could not answer call"
            );

            startIncomingCallWatcher();

            return;
        }

        updateCallStatus(
            "Connecting WebRTC..."
        );

        await createPeerConnection();

        await createAndSendAnswer();

        updateCallStatus("Connected");

        INCOMING_CALL = null;

        watchActiveCall();

        startWebRTCWatcher();

    } catch (error) {

        console.error(
            "answerIncomingCall error:",
            error
        );

        cleanupCallCompletely(
            error.message || "Network error."
        );

        startIncomingCallWatcher();
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

    cleanupCallCompletely("Call rejected");
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
                cleanupCallCompletely(`Call ${call.status}`);
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

    }, 700);
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
                cleanupCallCompletely(`Call ${status}`);
            }

        } catch (error) {
            console.error("watchActiveCall error:", error);
        }

    }, 700);
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

function endVideoCall() {
    console.log("clicked")
    try {
        const callId = ACTIVE_CALL_ID; // SAVE FIRST

        // Stop local media stream
        if (LOCAL_STREAM) {
            LOCAL_STREAM.getTracks().forEach(track => track.stop());
            LOCAL_STREAM = null;
        }

        // Close peer connection
        if (PEER_CONNECTION) {
            PEER_CONNECTION.close();
            PEER_CONNECTION = null;
        }

        // Clear timers
        if (WEBRTC_TIMER) clearInterval(WEBRTC_TIMER);
        if (ACTIVE_CALL_WATCH_TIMER) clearInterval(ACTIVE_CALL_WATCH_TIMER);

        // Reset state AFTER saving callId
        ACTIVE_CALL_ID = null;
        ACTIVE_CALL_ROLE = null;
        INCOMING_CALL = null;
        ADDED_ICE_IDS = new Set();

        // UI update
        updateCallStatus("Call ended");
        closeVideoCallModal();

        // Notify backend
        fetch(`${API_URL}/api/video-call/end`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callId })
        }).catch(err =>
            console.error("endVideoCall notify error:", err)
        );

    } catch (error) {
        console.error("endVideoCall error:", error);
    }
}




/* =========================
   MODAL UI
========================= */

function openVideoCallModal({ title = "Video call", status = "Connecting...", profilePic = "", userName = "Client Name" } = {}) {
    let overlay = document.getElementById("videoCallOverlay");

    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "videoCallOverlay";
        overlay.className = "video-call-overlay";
        overlay.innerHTML = `
            <section class="video-call-screen">

                <!-- BACKGROUND GLOWS -->
                <div class="call-bg-glow glow-one"></div>
                <div class="call-bg-glow glow-two"></div>

                <!-- TOP BAR -->
                <header class="call-screen-topbar">

                    <div class="call-person-card">

                        <div class="call-person-avatar" id="callUserAvatar">
                            <img id="callUserAvatarImg" src="" alt="avatar" />
                            <span class="avatar-initial" id="callUserAvatarInitial" style="display:none;"></span>
                        </div>

                        <div class="call-person-info">

                            <span class="call-live-badge">
                                <i></i>
                                Secure Call
                            </span>

                            <h3 id="callModalTitle">
                                
                            </h3>

                            <p id="callModalStatus">
                                Connecting...
                            </p>

                        </div>

                    </div>

                    <div class="call-top-actions">

                        <button class="call-round-btn" id="switchCameraBtn">
                            <span class="call-svg-icon switch-camera-icon"></span>
                        </button>

                        <button class="call-round-btn" id="expandCallBtn">
                            <span class="call-svg-icon expand-icon"></span>
                        </button>

                        <button class="call-round-btn close-call-btn" id="closeCallModalBtn">
                            <span class="call-svg-icon close-icon"></span>
                        </button>

                    </div>

                </header>

                <!-- CALL STAGE -->
                <main class="call-stage">

                    <!-- REMOTE VIDEO -->
                    <section class="remote-video-stage" id="remoteVideoStage">

                        <video id="remoteVideo" autoplay playsinline></video>

                        <!-- REMOTE OFF STATE -->
                        <div class="video-off-state" id="remoteVideoPlaceholder">

                            <div class="video-off-avatar" id="remoteCallAvatar">
                                <img id="remoteCallAvatarImg" src="" alt="avatar" />
                            </div>

                            <h2 id="remoteCallName">
                                Freelancer
                            </h2>

                            <p id="remoteCallText">
                                Waiting for the other person to join the call...
                            </p>

                        </div>

                        <!-- CALL TIME -->
                        <div class="call-quality-pill">

                            <span class="quality-dot"></span>

                            <span id="callTimer">
                                00:00
                            </span>

                        </div>

                    </section>

                    <!-- RIGHT PANEL -->
                    <aside class="call-side-panel">

                        <!-- LOCAL VIDEO -->
                        <div class="local-video-card" id="localVideoCard">

                            <video id="localVideo" autoplay muted playsinline></video>

                            <div class="local-video-off" id="localVideoOff">

                                <span class="call-svg-icon camera-off-icon"></span>

                                <p>Camera Off</p>

                            </div>

                            <span class="mini-label">
                                You
                            </span>

                        </div>

                        <!-- INFO CARD -->
                        <div class="call-info-card">

                            <span class="call-info-kicker">
                                Call Status
                            </span>

                            <h4>
                                HD Video Active
                            </h4>

                            <p>
                                Your call is encrypted and secured.
                                Network quality is stable.
                            </p>

                        </div>

                    </aside>

                </main>

                <!-- CONTROLS -->
                <footer class="call-control-dock">

                    <!-- MIC -->
                    <button type="button" class="call-control-btn" id="toggleMicBtn">

                        <span class="call-svg-icon mic-icon"></span>

                        <small>Mic</small>

                    </button>

                    <!-- CAMERA -->
                    <button type="button" class="call-control-btn" id="toggleCamBtn">

                        <span class="call-svg-icon chat-video-icon"></span>

                        <small>Camera</small>

                    </button>

                    <!-- SPEAKER -->
                    <button type="button" class="call-control-btn" id="toggleSpeakerBtn">

                        <span class="call-svg-icon speaker-icon"></span>

                        <small>Audio</small>

                    </button>

                    <!-- END -->
                    <button type="button" class="call-control-btn end-call-btn" id="endCallBtn">

                        <span class="call-svg-icon phone-down-icon"></span>

                        <small>End</small>

                    </button>

                </footer>

            </section>

        </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector("#endCallBtn")?.addEventListener("click", endVideoCall);
        overlay.querySelector("#switchCameraBtn")?.addEventListener("click", switchCamera);
        overlay.querySelector("#expandCallBtn")?.addEventListener("click", toggleFullscreen);
        overlay.querySelector("#toggleSpeakerBtn")?.addEventListener("click", toggleSpeaker);
        overlay.querySelector("#toggleMicBtn")?.addEventListener("click", toggleMic);
        overlay.querySelector("#toggleCamBtn")?.addEventListener("click", toggleCamera);
        overlay.querySelector("#closeCallModalBtn")?.addEventListener("click", endVideoCall);
    }

    const titleEl = document.getElementById("callModalTitle");
    const statusEl = document.getElementById("callModalStatus");
    const avatarImg = document.getElementById("callUserAvatarImg");
    const avatarInitial = document.getElementById("callUserAvatarInitial");
    const avatarContainer = document.getElementById("callUserAvatar");

    if (titleEl) titleEl.textContent = title;
    if (statusEl) statusEl.textContent = status;

    if (avatarImg && avatarInitial && avatarContainer) {
        if (profilePic) {
            avatarImg.src = profilePic;
            avatarImg.style.display = "block";
            avatarInitial.style.display = "none";
            avatarInitial.textContent = "";
        } else {
            avatarImg.src = "";
            avatarImg.style.display = "none";
            const initial = (userName || title || "").trim().charAt(0).toUpperCase() || "U";
            avatarInitial.textContent = initial;
            avatarInitial.style.display = "flex";
        }
    }

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
/* =========================
   SWITCH CAMERA (front/back)
========================= */

let CURRENT_FACING_MODE = "user";

async function switchCamera() {
    if (!LOCAL_STREAM) return;

    CURRENT_FACING_MODE = CURRENT_FACING_MODE === "user" ? "environment" : "user";

    const oldTrack = LOCAL_STREAM.getVideoTracks()[0];
    if (oldTrack) {
        oldTrack.stop();
        LOCAL_STREAM.removeTrack(oldTrack);
    }

    try {
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: CURRENT_FACING_MODE },
            audio: false
        });

        const newTrack = newStream.getVideoTracks()[0];
        LOCAL_STREAM.addTrack(newTrack);

        const localVideo = document.getElementById("localVideo");
        if (localVideo) {
            localVideo.srcObject = LOCAL_STREAM;
            await localVideo.play().catch(() => { });
        }

        if (PEER_CONNECTION) {
            const sender = PEER_CONNECTION.getSenders().find(s => s.track?.kind === "video");
            if (sender) await sender.replaceTrack(newTrack);
        }

    } catch (error) {
        console.error("switchCamera error:", error);
        CURRENT_FACING_MODE = CURRENT_FACING_MODE === "user" ? "environment" : "user";
    }
}

/* =========================
   EXPAND / FULLSCREEN
========================= */

let IS_EXPANDED = false;

function toggleFullscreen() {
    const stage = document.querySelector(".call-stage");
    const btn = document.getElementById("expandCallBtn");

    if (!stage) return;

    IS_EXPANDED = !IS_EXPANDED;

    stage.classList.toggle("expanded", IS_EXPANDED);
}
/* =========================
   TOGGLE SPEAKER
========================= */

let SPEAKER_ENABLED = true;

function toggleSpeaker() {
    const remoteVideo = document.getElementById("remoteVideo");
    const btn = document.getElementById("toggleSpeakerBtn");

    if (!remoteVideo) return;

    SPEAKER_ENABLED = !SPEAKER_ENABLED;
    remoteVideo.muted = !SPEAKER_ENABLED;

    btn?.classList.toggle("off", !SPEAKER_ENABLED);

    if (btn) {
        btn.innerHTML = SPEAKER_ENABLED
            ? `<span class="call-svg-icon speaker-icon"></span><small>Audio</small>`
            : `<span class="call-svg-icon speaker-off-icon"></span><small>Muted</small>`;
    }
}


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
    const chatBody =
        document.getElementById("chatBody") ||
        document.querySelector(".chat-body");

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

    // re-trigger pop animation on swap
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

function handleBubbleClick(event, bubbleEl) {
    if (event.target.closest(".chat-image, .chat-images-grid")) return;
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

    if (!msgId || !isMine) return;

    const menu = document.createElement("div");
    menu.id = "msgCtxMenu";
    menu.className = "msg-ctx-menu";

    const items = [];

    if (!isImg) {
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

    items.push(
        `<button class="msg-ctx-item danger" onclick="confirmDeleteMsg('${msgId}'); closeMsgMenu();">` +
        `<i class="fa-solid fa-trash msg-ctx-icon"></i> Delete</button>`
    );

    menu.innerHTML = items.join("");
    document.body.appendChild(menu);

    requestAnimationFrame(function () {
        const mw = menu.offsetWidth;
        const mh = menu.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const cx = event.clientX;
        const cy = event.clientY;
        menu.style.left = (cx + mw + 14 > vw ? cx - mw - 8 : cx + 8) + "px";
        menu.style.top  = (cy + mh + 14 > vh ? cy - mh - 8 : cy + 8) + "px";
        menu.classList.add("visible");
    });

    MSG_CTX_OPEN = true;

    setTimeout(function () {
        document.addEventListener("click", closeMsgMenu, { once: true });
        document.addEventListener("keydown", function escFn(e) {
            if (e.key === "Escape") { closeMsgMenu(); document.removeEventListener("keydown", escFn); }
        });
    }, 0);
}

function closeMsgMenu() {
    const menu = document.getElementById("msgCtxMenu");
    if (menu) {
        menu.classList.remove("visible");
        setTimeout(function () { if (menu.parentNode) menu.remove(); }, 160);
    }
    MSG_CTX_OPEN = false;
}

/* =========================
   INLINE MESSAGE EDIT
========================= */

function startEditMsg(messageId) {
    const bubble = document.querySelector('[data-msg-id="' + messageId + '"]');
    if (!bubble) return;

    const currentText = bubble.dataset.msgText || "";
    const p = bubble.querySelector("p");
    if (!p) return;

    bubble._origHTML = p.innerHTML;

    p.innerHTML =
        '<div class="msg-edit-wrap">' +
        '<textarea class="msg-edit-input" id="msgEditTA_' + messageId + '">' +
        escapeHTML(currentText) +
        '</textarea>' +
        '<div class="msg-edit-actions">' +
        '<button class="msg-edit-cancel" onclick="cancelEditMsg(\'' + messageId + '\')">Cancel</button>' +
        '<button class="msg-edit-save"   onclick="saveEditMsg(\''   + messageId + '\')">Save</button>' +
        '</div></div>';

    const ta = document.getElementById("msgEditTA_" + messageId);
    if (ta) {
        ta.style.height = "auto";
        ta.style.height = ta.scrollHeight + "px";
        ta.focus();
        ta.selectionStart = ta.selectionEnd = ta.value.length;

        ta.addEventListener("input", function () {
            ta.style.height = "auto";
            ta.style.height = ta.scrollHeight + "px";
        });

        ta.addEventListener("keydown", function (e) {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEditMsg(messageId); }
            if (e.key === "Escape") cancelEditMsg(messageId);
        });
    }
}

function cancelEditMsg(messageId) {
    const bubble = document.querySelector('[data-msg-id="' + messageId + '"]');
    if (!bubble) return;
    const p = bubble.querySelector("p");
    if (p && bubble._origHTML !== undefined) p.innerHTML = bubble._origHTML;
}

async function saveEditMsg(messageId) {
    const ta = document.getElementById("msgEditTA_" + messageId);
    if (!ta) return;

    const newText = ta.value.trim();
    if (!newText) { alert("Message cannot be empty"); return; }

    const bubble = document.querySelector('[data-msg-id="' + messageId + '"]');

    try {
        const res = await fetch(API_URL + "/api/messages/edit/" + encodeURIComponent(messageId), {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: newText, conversationId: CURRENT_CONVERSATION_ID })
        });

        const data = await res.json().catch(function () { return {}; });

        if (!data.success) {
            alert(data.message || "Failed to edit message");
            return;
        }

        if (bubble) {
            bubble.dataset.msgText = newText;
            const p = bubble.querySelector("p");
            if (p) p.innerHTML = escapeHTML(newText) + ' <span class="edited-tag">edited</span>';
        }

    } catch (err) {
        console.error("saveEditMsg:", err);
        alert("Network error. Could not edit message.");
    }
}

/* =========================
   DELETE MESSAGE
========================= */

async function confirmDeleteMsg(messageId) {
    if (!confirm("Delete this message?")) return;

    const bubble = document.querySelector('[data-msg-id="' + messageId + '"]');
    const row = bubble ? bubble.closest(".message-row") : null;

    if (row) {
        row.style.transition = "opacity 0.28s ease, transform 0.28s ease";
        row.style.opacity = "0";
        row.style.transform = "scale(0.94)";
    }

    try {
        const convId = encodeURIComponent(CURRENT_CONVERSATION_ID || "");
        const res = await fetch(
            API_URL + "/api/messages/delete/" + encodeURIComponent(messageId) + "?conversationId=" + convId,
            { method: "DELETE", credentials: "include" }
        );

        const data = await res.json().catch(function () { return {}; });

        if (!data.success) {
            if (row) { row.style.opacity = "1"; row.style.transform = ""; }
            alert(data.message || "Could not delete message");
            return;
        }

        setTimeout(function () { if (row && row.parentNode) row.remove(); }, 300);

    } catch (err) {
        console.error("confirmDeleteMsg:", err);
        if (row) { row.style.opacity = "1"; row.style.transform = ""; }
        alert("Network error");
    }
}

/* =========================
   DOWNLOAD IMAGE(S)
========================= */

function downloadMsgImages(images) {
    if (!Array.isArray(images) || !images.length) return;
    images.forEach(function (url, i) {
        setTimeout(function () {
            const a = document.createElement("a");
            a.href = url;
            a.download = "image_" + Date.now() + "_" + i + ".jpg";
            a.target = "_blank";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }, i * 300);
    });
}
