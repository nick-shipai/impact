const API_URL = "https://backend.impactacademy.site";

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
   CHECK LOGIN ON PAGE LOAD
========================= */

document.addEventListener("DOMContentLoaded", async function () {
    const auth = await AuthenticateUser();

    if (auth.success) {
        renderProfileDashBtn(auth.user);
        console.log("User authenticated:", auth.user);
    }
});

/* =========================
   PROFILE DASHBOARD BUTTON
========================= */

function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0];
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function renderProfileDashBtn(user) {
    const signInBtn = document.querySelector(".sign-in-btn");
    const signUpBtn = document.querySelector(".sign-up-btn");

    // Remove sign-up link entirely
    if (signUpBtn) signUpBtn.remove();

    // If no sign-in button found, nothing to replace
    if (!signInBtn) return;

    const photoURL = user.photoURL || "";
    const fullname = user.fullname || user.email || "User";
    const firstName = fullname.split(" ")[0];
    const initials = getInitials(fullname);

    const avatarInner = photoURL
        ? `<img src="${photoURL}" alt="${firstName}" loading="lazy">`
        : `<span class="avatar-initial">${initials}</span>`;

    const btnHTML = `
        <a href="./dashboard/#get-started" class="profile-dash-btn" aria-label="Go to dashboard">
            <span class="profile-dash-avatar">${avatarInner}</span>
            <span class="profile-dash-text">
                <span class="profile-dash-name">${firstName}</span>
                <span class="profile-dash-label">Dashboard &rsaquo;</span>
            </span>
            <span class="profile-dash-arrow">&#x276F;</span>
        </a>
    `;

    const wrapper = document.createElement("span");
    wrapper.innerHTML = btnHTML.trim();
    signInBtn.replaceWith(wrapper.firstElementChild);
}

/* placeholder closing — removed duplicate
   The block above already closed DOMContentLoaded.

/* =========================
   ANIMATE ELEMENTS ON SCROLL
========================= */

function revealOnScroll() {
    const elements = document.querySelectorAll('.slide-left, .slide-right, .slide-bottom');

    elements.forEach(el => {
        const windowHeight = window.innerHeight;
        const elementTop = el.getBoundingClientRect().top;
        const revealPoint = 150;

        if (elementTop < windowHeight - revealPoint) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}

window.addEventListener('scroll', revealOnScroll);
window.addEventListener('load', revealOnScroll);

/* =========================
   CONTACT MODAL
========================= */

const modal = document.getElementById("contactModal");
const btn = document.querySelector(".outline");
const span = document.querySelector(".close");
const viewResumeBtn = document.getElementById("viewResume");
const sendMessage = document.getElementById("sendMessage");
const hireUsBtn = document.getElementById("hire-us-btn");
const hireUsBtn2 = document.getElementById("hire-us-btn2");

if (btn && modal) {
    btn.onclick = function () {
        modal.style.display = "block";
    };
}

if (hireUsBtn) {
    hireUsBtn.onclick = function () {
        window.location.href = "./service-checkout";
    };
}

if (hireUsBtn2) {
    hireUsBtn2.onclick = function () {
        window.location.href = "./service-checkout";
    };
}

if (viewResumeBtn) {
    viewResumeBtn.onclick = function () {
        window.open('cv.pdf', '_blank');
    };
}

if (sendMessage) {
    sendMessage.onclick = function () {
        const message = encodeURIComponent("Hello! I want to know more about your virtual assistant services.");
        const phone = "2348089380180";
        const url = `https://wa.me/${phone}?text=${message}`;

        window.open(url, "_blank");
    };
}

if (span && modal) {
    span.onclick = function () {
        modal.style.display = "none";
    };
}

window.onclick = function (event) {
    if (modal && event.target === modal) {
        modal.style.display = "none";
    }
};

/* =========================
   AI CHAT WIDGET
========================= */

document.addEventListener("DOMContentLoaded", function () {
    const aiChatWidget = document.getElementById("aiChatWidget");
    const aiChatBubble = document.getElementById("aiChatBubble");
    const closeAiChat = document.getElementById("closeAiChat");

    if (!aiChatWidget || !aiChatBubble || !closeAiChat) {
        console.error("AI chat widget elements not found");
        return;
    }

    aiChatBubble.addEventListener("click", function () {
        aiChatWidget.classList.add("active");
    });

    closeAiChat.addEventListener("click", function () {
        aiChatWidget.classList.remove("active");
    });
});