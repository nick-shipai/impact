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
        console.log("User logged in:", auth.user);

        const signupLinks = document.querySelectorAll(".signup-link, .login-link, .signin-link");
        signupLinks.forEach(link => {
            link.textContent = "Dashboard";
            link.href = "./dashboard/#get-started";
        });
    } else {
        console.log("User not logged in");
    }
});

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