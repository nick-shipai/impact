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
// Open modal on button click
btn.onclick = function () {
    modal.style.display = "block";
}

viewResumeBtn.onclick = function () {
    window.open('https://drive.google.com/file/d/1uNBYcBOw4pZxdlKn_AhPc7J5bo1tG7h2/view?usp=drivesdk', '_blank');
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

