const API_URL = "https://ai-impact-server.vercel.app/api/chat";

const chatBody = document.getElementById("chatBody");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const clearChatBtn = document.getElementById("clearChatBtn");

const toolBtns = document.querySelectorAll(".tool-btn");
const sideBtns = document.querySelectorAll(".sidebar-tool");

let chatHistory = JSON.parse(
    localStorage.getItem("impactech_chat_history")
) || [];

/* ===============================
   LOAD CHAT
================================= */
window.addEventListener("DOMContentLoaded", () => {
    if (chatHistory.length) {
        renderStoredMessages();
    } else {
        addBotMessage(
            "Hello 👋 I’m IMPACTECH AI Support. Ask me about services, pricing, automation, checkout, or business help."
        );
    }
});

/* ===============================
   RENDER STORED CHAT
================================= */
function renderStoredMessages() {
    chatBody.innerHTML = "";

    chatHistory.forEach((item) => {
        if (item.role === "user") {
            addUserMessage(item.text, false);
        } else {
            addBotMessage(item.text, false);
        }
    });

    scrollBottom();
}

/* ===============================
   SAVE CHAT
================================= */
function saveChat() {
    localStorage.setItem(
        "impactech_chat_history",
        JSON.stringify(chatHistory)
    );
}

/* ===============================
   USER MESSAGE
================================= */
function addUserMessage(text, save = true) {
    const wrapper = document.createElement("div");
    wrapper.className = "message user-message";

    wrapper.innerHTML = `
        <div class="message-content">
            <span class="message-name">You</span>
            <p>${escapeHtml(text)}</p>
        </div>
    `;

    chatBody.appendChild(wrapper);

    if (save) {
        chatHistory.push({
            role: "user",
            text
        });
        saveChat();
    }

    scrollBottom();
}

function addBotMessage(text, save = true) {
    const wrapper = document.createElement("div");
    wrapper.className = "message bot-message";

    wrapper.innerHTML = `
        <div class="message-avatar">
            <img src="../images/icon.png" alt="AI">
        </div>

        <div class="message-content ai-rich-content">
            <span class="message-name">IMPACTECH AI</span>
            ${formatAIResponse(text)}
            ${createSmartButtons(text)}
        </div>
    `;

    chatBody.appendChild(wrapper);

    if (save) {
        chatHistory.push({
            role: "model",
            text
        });
        saveChat();
    }

    scrollBottom();
}
/* ===============================
   TYPING
================================= */
function showTyping() {
    const typing = document.createElement("div");
    typing.className = "typing-row";
    typing.id = "typingRow";

    typing.innerHTML = `
        <div class="message-avatar">
            <img src="../images/icon.png" alt="AI">
        </div>

        <div class="typing-bubble">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;

    chatBody.appendChild(typing);
    scrollBottom();
}

function removeTyping() {
    const typing = document.getElementById("typingRow");
    if (typing) typing.remove();
}

/* ===============================
   SEND TO AI
================================= */
async function sendMessage(text) {
    if (!text.trim()) return;

    const memoryContext = buildMemoryContext();

    addUserMessage(text);
    userInput.value = "";
    showTyping();

    sendBtn.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: text,
                history: chatHistory,
                memoryContext: memoryContext
            })
        });

        const data = await response.json();

        removeTyping();

        if (!response.ok || !data.success) {
            addBotMessage(
                data.message ||
                "AI server failed. Try again."
            );
            return;
        }

        addBotMessage(data.reply);

        updateLongTermMemory(text, data.reply);

    } catch (error) {
        removeTyping();

        addBotMessage(
            "Could not connect to AI server. Please try again."
        );

        console.error(error);
    }

    sendBtn.disabled = false;
}

/* ===============================
   FORM SUBMIT
================================= */
chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    sendMessage(userInput.value);
});

/* ===============================
   QUICK TOOL BUTTONS
================================= */
toolBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
        const prompt = btn.dataset.prompt;
        sendMessage(prompt);
    });
});

sideBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
        const prompt = btn.dataset.prompt;
        sendMessage(prompt);
    });
});

/* ===============================
   NEW CHAT
================================= */
newChatBtn.addEventListener("click", () => {
    chatBody.innerHTML = "";
    chatHistory = [];
    saveChat();

    addBotMessage(
        "New chat started. How can I help you today?"
    );
});

/* ===============================
   CLEAR CHAT
================================= */
clearChatBtn.addEventListener("click", () => {
    chatBody.innerHTML = "";
    chatHistory = [];

    localStorage.removeItem("impactech_chat_history");
    localStorage.removeItem("impactech_long_memory");

    addBotMessage(
        "Chat and memory cleared. Ask me anything."
    );
});

/* ===============================
   ENTER KEY
================================= */
userInput.addEventListener("keydown", (e) => {
    if (
        e.key === "Enter" &&
        !e.shiftKey
    ) {
        e.preventDefault();
        sendMessage(userInput.value);
    }
});

/* ===============================
   SCROLL
================================= */
function scrollBottom() {
    chatBody.scrollTop =
        chatBody.scrollHeight;
}


function formatAIResponse(text) {
    if (!text) return "<p>No response.</p>";

    let safe = escapeHtml(text);

    safe = safe.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    const lines = safe.split("<br>");
    let html = "";
    let listOpen = false;

    lines.forEach((line) => {
        const clean = line.trim();

        if (!clean) {
            if (listOpen) {
                html += "</ul>";
                listOpen = false;
            }
            return;
        }

        if (clean.startsWith("•") || clean.startsWith("-")) {
            if (!listOpen) {
                html += `<ul class="ai-list">`;
                listOpen = true;
            }

            html += `<li>${clean.replace(/^•\s?|-+\s?/, "")}</li>`;
        } else {
            if (listOpen) {
                html += "</ul>";
                listOpen = false;
            }

            if (clean.includes("$49") || clean.includes("$149") || clean.includes("$299")) {
                html += `<p class="ai-price-line">${linkify(clean)}</p>`;
            } else {
                html += `<p>${linkify(clean)}</p>`;
            }
        }
    });

    if (listOpen) html += "</ul>";

    return html;
}

function createSmartButtons(text) {
    const lower = text.toLowerCase();
    let buttons = "";

    if (
        lower.includes("checkout") ||
        lower.includes("pay") ||
        lower.includes("payment") ||
        lower.includes("service-checkout")
    ) {
        buttons += `
            <a href="https://impactacademy.site/service-checkout" target="_blank" class="ai-action-btn primary-action">
                Continue To Checkout
            </a>
        `;
    }

    if (
        lower.includes("contact") ||
        lower.includes("support") ||
        lower.includes("team")
    ) {
        buttons += `
            <a href="https://impactacademy.site/contact" target="_blank" class="ai-action-btn light-action">
                Contact Support
            </a>
        `;
    }

    if (
        lower.includes("course") ||
        lower.includes("training") ||
        lower.includes("learn")
    ) {
        buttons += `
            <a href="https://impactacademy.site/ai-virtual-assistant-course" target="_blank" class="ai-action-btn light-action">
                Buy Course
            </a>
        `;
    }

    if (
        lower.includes("starter") ||
        lower.includes("business") ||
        lower.includes("growth") ||
        lower.includes("$49") ||
        lower.includes("$149") ||
        lower.includes("$299")
    ) {
        buttons += `
            <button type="button" class="ai-action-btn light-action" onclick="sendMessage('Help me choose the best plan for my business.')">
                Help Me Choose Plan
            </button>
        `;
    }

    if (!buttons) return "";

    return `<div class="ai-action-row">${buttons}</div>`;
}

function linkify(text) {
    return text.replace(
        /(https?:\/\/[^\s<]+)/g,
        `<a href="$1" target="_blank" class="ai-inline-link">$1</a>`
    );
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\n/g, "<br>");
}
/* ===============================
   LONG TERM MEMORY
================================= */

function getLongTermMemory() {
    return JSON.parse(
        localStorage.getItem("impactech_long_memory")
    ) || {
        userFacts: [],
        interests: [],
        lastTopics: [],
        importantMessages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

function saveLongTermMemory(memory) {
    memory.updatedAt = new Date().toISOString();

    localStorage.setItem(
        "impactech_long_memory",
        JSON.stringify(memory)
    );
}

function buildMemoryContext() {
    const memory = getLongTermMemory();

    const recentChat = chatHistory
        .slice(-12)
        .map((item) => {
            return `${item.role === "user" ? "User" : "Assistant"}: ${item.text}`;
        })
        .join("\n");

    return `
User long-term memory:
User facts:
${memory.userFacts.length ? memory.userFacts.map(item => "- " + item).join("\n") : "- No saved facts yet"}

User interests:
${memory.interests.length ? memory.interests.map(item => "- " + item).join("\n") : "- No saved interests yet"}

Last topics:
${memory.lastTopics.length ? memory.lastTopics.map(item => "- " + item).join("\n") : "- No topics yet"}

Important past messages:
${memory.importantMessages.length ? memory.importantMessages.map(item => "- " + item).join("\n") : "- No important messages yet"}

Recent chat:
${recentChat || "No recent chat yet"}
`;
}

function updateLongTermMemory(userText, botReply) {
    const memory = getLongTermMemory();

    const text = userText.toLowerCase();

    const importantWords = [
        "my name is",
        "i am",
        "i'm",
        "i want",
        "i need",
        "my business",
        "my company",
        "my website",
        "my plan",
        "remember",
        "save this",
        "i like",
        "i prefer",
        "i sell",
        "i offer",
        "i created",
        "i built",
        "my project"
    ];

    const isImportant = importantWords.some(word => text.includes(word));

    if (isImportant) {
        addUniqueMemory(
            memory.importantMessages,
            userText,
            30
        );
    }

    if (text.includes("my name is")) {
        addUniqueMemory(
            memory.userFacts,
            userText,
            20
        );
    }

    if (text.includes("i like") || text.includes("i prefer")) {
        addUniqueMemory(
            memory.interests,
            userText,
            20
        );
    }

    if (
        text.includes("service") ||
        text.includes("pricing") ||
        text.includes("checkout") ||
        text.includes("automation") ||
        text.includes("course") ||
        text.includes("payment") ||
        text.includes("business")
    ) {
        addUniqueMemory(
            memory.lastTopics,
            userText,
            15
        );
    }

    saveLongTermMemory(memory);
}

function addUniqueMemory(array, value, limit) {
    const clean = String(value).trim();

    if (!clean) return;

    const exists = array.some(
        item => item.toLowerCase() === clean.toLowerCase()
    );

    if (!exists) {
        array.push(clean);
    }

    while (array.length > limit) {
        array.shift();
    }
}

function clearLongTermMemory() {
    localStorage.removeItem("impactech_long_memory");
}