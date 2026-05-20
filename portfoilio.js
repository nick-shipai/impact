// Animate elements on scroll
function revealOnScroll() {
    const elements = document.querySelectorAll('.slide-left, .slide-right, .slide-bottom');

    elements.forEach(el => {
        const windowHeight = window.innerHeight;
        const elementTop = el.getBoundingClientRect().top;
        const revealPoint = 150; // distance from bottom of screen

        if (elementTop < windowHeight - revealPoint) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}

// Listen to scroll
window.addEventListener('scroll', revealOnScroll);

// Trigger animation on load for elements already visible
window.addEventListener('load', revealOnScroll);

// Get modal elements
const modal = document.getElementById("contactModal");
const btn = document.querySelector(".outline"); // "Get In Touch" button
const span = document.querySelector(".close");
const viewResumeBtn = document.getElementById("viewResume");
const sendMessage = document.getElementById("sendMessage");
const hireUsBtn = document.getElementById("hire-us-btn");
const hireUsBtn2 = document.getElementById("hire-us-btn2");
// Open modal on button click
btn.onclick = function () {
    modal.style.display = "block";
}

hireUsBtn.onclick = function () {
    window.location.href = "./service-checkout"
}

hireUsBtn2.onclick = function () {
    window.location.href = "./service-checkout"
}

viewResumeBtn.onclick = function () {
    window.open('cv.pdf', '_blank');
}

sendMessage.onclick = function () {
    // Pre-filled message
    const message = encodeURIComponent("Hello! I want to know more about your virtual assistant services.");
    // WhatsApp link (international format, no spaces or dashes)
    const phone = "2348089380180";
    const url = `https://wa.me/${phone}?text=${message}`;

    // Open WhatsApp link
    window.open(url, "_blank");
};
// Close modal on X click
span.onclick = function () {
    modal.style.display = "none";
}

// Close modal if clicked outside the content
window.onclick = function (event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

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