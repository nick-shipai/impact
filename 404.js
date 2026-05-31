/* =========================
   404 PAGE JAVASCRIPT
========================= */

/* ── Funny excuse lines ── */
const excuses = [
  "The page you're looking for took a gap year and forgot to come back.",
  "404: This page went on a coffee run 3 years ago. Still waiting.",
  "The developer who built this page got distracted by a YouTube video.",
  "Our robot searched everywhere. Even under the couch cushions. Nothing.",
  "This page ghosted you. It's not you, it's us. (It's us.)",
  "Plot twist: the page existed, but we deleted it by accident. Oops.",
  "Error 404: Page not found. Our intern blamed the intern before them.",
  "The URL you typed is giving us trust issues.",
  "Our server whispered: 'I have no idea what you're talking about.'",
  "The page was here. Then we pushed to production. RIP.",
  "You've reached the digital void. Population: you and this robot.",
  "This page is in Witness Protection. We legally cannot tell you where.",
  "The link that led you here? Absolute snake. Report it immediately.",
  "We asked ChatGPT where this page went. It hallucinated an answer.",
  "This page moved without leaving a forwarding address. Classic.",
  "Warning: Page missing. Last seen arguing with a semicolon.",
  "The page retired early and moved to a beach with no Wi-Fi.",
  "We checked the blockchain. Still no page. Blockchain lied again.",
  "Our AI is 94.7% confident this page never existed. (It's wrong.)",
  "This page is on strike. It demands a dark mode and better pay."
];

/* ── DOM refs ── */
const funnyLine    = document.getElementById("funnyLine");
const newJokeBtn   = document.getElementById("newJokeBtn");
const countdown    = document.getElementById("countdown");
const redirectBar  = document.getElementById("redirectBar");
const cancelBtn    = document.getElementById("cancelRedirect");

/* ── Show a random (non-repeating) excuse ── */
let lastIndex = -1;

function showRandomExcuse() {
  let idx;
  do { idx = Math.floor(Math.random() * excuses.length); }
  while (idx === lastIndex);
  lastIndex = idx;

  funnyLine.classList.add("fade-out");
  setTimeout(() => {
    funnyLine.textContent = excuses[idx];
    funnyLine.classList.remove("fade-out");
  }, 250);
}

newJokeBtn.addEventListener("click", () => {
  newJokeBtn.classList.add("spinning");
  setTimeout(() => newJokeBtn.classList.remove("spinning"), 500);
  showRandomExcuse();
});

/* Show first joke on load */
showRandomExcuse();

/* ── Auto-redirect countdown ── */
let secondsLeft = 10;
let redirectTimer = null;
let redirectCancelled = false;

function startCountdown() {
  redirectTimer = setInterval(() => {
    secondsLeft--;
    countdown.textContent = secondsLeft;

    if (secondsLeft <= 0) {
      clearInterval(redirectTimer);
      if (!redirectCancelled) {
        window.location.href = "https://impactacademy.site";
      }
    }
  }, 1000);
}

cancelBtn.addEventListener("click", () => {
  redirectCancelled = true;
  clearInterval(redirectTimer);
  redirectBar.classList.add("hidden");
});

startCountdown();

/* ── Particle canvas ── */
(function initParticles() {
  const canvas  = document.getElementById("particleCanvas");
  const ctx     = canvas.getContext("2d");
  let  W, H, particles;

  const COLORS = [
    "rgba(37,  99,  235, ",
    "rgba(6,   182, 212, ",
    "rgba(245, 158, 11,  ",
    "rgba(139, 92,  246, ",
    "rgba(255, 255, 255, "
  ];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createParticles(n) {
    return Array.from({ length: n }, () => ({
      x:     Math.random() * W,
      y:     Math.random() * H,
      r:     Math.random() * 2.5 + 0.5,
      dx:    (Math.random() - 0.5) * 0.6,
      dy:    (Math.random() - 0.5) * 0.6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: Math.random() * 0.5 + 0.1
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    /* Draw connection lines */
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx   = particles[i].x - particles[j].x;
        const dy   = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(37, 99, 235, ${0.08 * (1 - dist / 120)})`;
          ctx.lineWidth   = 0.8;
          ctx.stroke();
        }
      }
    }

    /* Draw particles */
    particles.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color}${p.alpha})`;
      ctx.fill();

      p.x += p.dx;
      p.y += p.dy;

      if (p.x < -10)  p.x = W + 10;
      if (p.x > W+10) p.x = -10;
      if (p.y < -10)  p.y = H + 10;
      if (p.y > H+10) p.y = -10;
    });

    requestAnimationFrame(draw);
  }

  resize();
  particles = createParticles(90);
  draw();

  window.addEventListener("resize", () => {
    resize();
    particles = createParticles(90);
  });
})();

/* ── Mouse parallax on robot ── */
(function initParallax() {
  const robot = document.querySelector(".robot");
  if (!robot) return;

  document.addEventListener("mousemove", (e) => {
    const cx    = window.innerWidth  / 2;
    const cy    = window.innerHeight / 2;
    const dx    = (e.clientX - cx) / cx;  /* -1 to 1 */
    const dy    = (e.clientY - cy) / cy;
    const tiltX = dy * 8;
    const tiltY = dx * -8;

    robot.style.transform = `perspective(400px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  });

  document.addEventListener("mouseleave", () => {
    robot.style.transform = "";
  });
})();

/* ── Klick glitch on 404 number ── */
(function initGlitchClick() {
  const glitch = document.querySelector(".glitch");
  if (!glitch) return;

  glitch.style.cursor = "pointer";

  glitch.addEventListener("click", () => {
    glitch.style.animation = "none";
    /* Force reflow */
    void glitch.offsetWidth;
    /* Rapid shake sequence */
    glitch.style.animation = "glitchShake 0.2s steps(1) 5, glitchShake 3s infinite 1s";
    setTimeout(() => {
      glitch.style.animation = "";
    }, 1200);
  });
})();

/* ── Konami code easter egg ── */
(function initKonami() {
  const KONAMI = [38,38,40,40,37,39,37,39,66,65];
  let pos = 0;

  document.addEventListener("keydown", (e) => {
    if (e.keyCode === KONAMI[pos]) {
      pos++;
      if (pos === KONAMI.length) {
        pos = 0;
        triggerPartyMode();
      }
    } else {
      pos = 0;
    }
  });

  function triggerPartyMode() {
    document.body.style.animation = "partyBg 0.5s steps(1) 10";
    const msg = document.createElement("div");
    msg.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:linear-gradient(135deg,#2563eb,#06b6d4);
      color:white;padding:28px 40px;border-radius:24px;
      font-size:28px;font-weight:900;z-index:9999;
      box-shadow:0 20px 60px rgba(37,99,235,0.5);
      text-align:center;pointer-events:none;
      animation:konamiPop 0.4s cubic-bezier(0.34,1.56,0.64,1);
    `;
    msg.innerHTML = "🎉 CHEAT CODE ACTIVATED!<br><small style='font-size:14px;opacity:.8'>You found the secret! You get... nothing. But respect.</small>";
    document.body.appendChild(msg);

    const style = document.createElement("style");
    style.textContent = `
      @keyframes konamiPop {
        from { transform:translate(-50%,-50%) scale(0) rotate(-10deg); opacity:0; }
        to   { transform:translate(-50%,-50%) scale(1) rotate(0deg);   opacity:1; }
      }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
      msg.style.transition = "opacity 0.4s, transform 0.4s";
      msg.style.opacity    = "0";
      msg.style.transform  = "translate(-50%,-60%) scale(0.9)";
      setTimeout(() => msg.remove(), 400);
    }, 3000);
  }
})();

/* ── Cursor trail effect ── */
(function initCursorTrail() {
  const trail = [];
  const NUM   = 8;

  for (let i = 0; i < NUM; i++) {
    const dot  = document.createElement("div");
    const size = (NUM - i) * 3 + 2;
    dot.style.cssText = `
      position:fixed;pointer-events:none;z-index:9000;
      width:${size}px;height:${size}px;
      border-radius:50%;
      background:radial-gradient(circle,rgba(37,99,235,${0.6 - i * 0.06}),transparent);
      transform:translate(-50%,-50%);
      transition:left ${20 + i * 15}ms, top ${20 + i * 15}ms;
      mix-blend-mode:screen;
    `;
    document.body.appendChild(dot);
    trail.push(dot);
  }

  document.addEventListener("mousemove", (e) => {
    trail.forEach((dot) => {
      dot.style.left = e.clientX + "px";
      dot.style.top  = e.clientY + "px";
    });
  });
})();
