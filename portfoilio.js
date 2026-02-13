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
