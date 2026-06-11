/* =============================================
   PRICING PAGE - IMPACTECH ACADEMY
============================================= */

var API_URL = "https://backend.impactacademy.site";

var PLAN_PRICES = {
    Pro:   { monthly: 0.1,  yearly: 2 },
    Elite: { monthly: 0.5,  yearly: 4 }
};

/* =========================
   AUTH
========================= */

async function AuthenticateUser() {
    try {
        var response = await fetch(API_URL + "/api/auth/validate-session", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" }
        });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok || !data.success) {
            localStorage.removeItem("impactech_user");
            localStorage.removeItem("impactech_token");
            return { success: false, user: null };
        }
        if (data.user) {
            localStorage.setItem("impactech_user", JSON.stringify(data.user));
        }
        return { success: true, user: data.user };
    } catch (error) {
        console.error("AuthenticateUser error:", error);
        return { success: false, user: null };
    }
}

/* =========================
   TOAST
========================= */

function prShowToast(msg, type) {
    var toast = document.getElementById("prToast");
    if (!toast) return;
    toast.textContent = msg;
    toast.className = "pr-toast show " + (type || "");
    clearTimeout(prShowToast._timer);
    prShowToast._timer = setTimeout(function () {
        toast.className = "pr-toast";
    }, 4000);
}

/* =========================
   UPGRADE / PAYMENT
========================= */

var _prProcessing = false;

async function prUpgradePlan(plan) {
    if (_prProcessing) return;

    var btn = document.querySelector('.pr-btn-upgrade[data-plan="' + plan + '"]');
    if (!btn) return;

    /* Validate plan — backend expects "Pro" or "Elite" (capitalized) */
    var planKey = plan.charAt(0).toUpperCase() + plan.slice(1);
    if (!PLAN_PRICES[planKey]) {
        prShowToast("Invalid plan selected.", "error");
        return;
    }

    _prProcessing = true;
    var originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="pr-btn-spinner"></span> Processing...';

    try {
        /* Get billing cycle from toggle */
        var isYearly = document.getElementById("prBillingToggle") &&
                       document.getElementById("prBillingToggle").classList.contains("yearly");
        var billingCycle = isYearly ? "yearly" : "monthly";
        var priceInfo = PLAN_PRICES[planKey];
        var amount = isYearly ? priceInfo.yearly : priceInfo.monthly;

        /* Initialize payment via existing backend route */
        var res = await fetch(API_URL + "/api/save-subscription-payment", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                plan:         planKey,
                billingCycle: billingCycle,
                amount:       amount,
                currency:     "USD"
            })
        });

        var data = await res.json().catch(function () { return {}; });

        if (!res.ok || !data.success) {
            throw new Error(data.message || "Failed to initialize payment. Please try again.");
        }

        if (!data.paymentId) {
            throw new Error("No payment ID received. Please try again.");
        }

        /* Redirect to SPay checkout */
        btn.innerHTML = '<span class="pr-btn-spinner"></span> Redirecting to payment...';
        prShowToast("Redirecting to payment...", "success");

        setTimeout(function () {
            window.location.href = "../spay/?id=" + data.paymentId;
        }, 1000);

    } catch (err) {
        console.error("Upgrade error:", err);
        prShowToast(err.message || "Unable to connect to payment service. Please try again.", "error");
        btn.disabled = false;
        btn.textContent = originalText;
        _prProcessing = false;
    }
}

/* =========================
   MAIN INIT
========================= */

document.addEventListener("DOMContentLoaded", async function () {

    /* --- Auth Check --- */
    var auth = await AuthenticateUser();
    if (!auth.success) {
        window.location.href = "../../../signin/";
        return;
    }

    var user = auth.user;
    var allowedStudentTypes = ["student", "va-student"];
    var userType = (user?.accountType || "").toLowerCase().trim();
    if (!allowedStudentTypes.includes(userType)) {
        window.location.href = "/404.html";
        return;
    }

    /* --- Update UI based on subscription --- */
    if (user.isPro || user.isElite) {
        /* User already has a paid plan — update buttons */
        document.querySelectorAll(".pr-btn-upgrade").forEach(function (btn) {
            var card = btn.closest(".pr-plan-card");
            if (!card) return;
            var plan = card.getAttribute("data-plan");

            if ((plan === "pro" && user.isPro) || (plan === "elite" && user.isElite)) {
                btn.textContent = "Current Plan";
                btn.disabled = true;
                btn.classList.remove("pr-btn-primary", "pr-btn-elite");
                btn.classList.add("pr-btn-outline");
            } else if (plan === "pro" && user.isElite) {
                btn.textContent = "Downgrade";
                btn.disabled = true;
                btn.classList.remove("pr-btn-primary");
                btn.classList.add("pr-btn-outline");
            }
        });
    }

    /* --- Wire Upgrade Buttons --- */
    document.querySelectorAll(".pr-btn-upgrade").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var plan = btn.getAttribute("data-plan");
            if (plan) prUpgradePlan(plan);
        });
    });

    /* =========================
       PAYMENT VERIFICATION POLLING
    ========================= */

    var _payPollInterval = null;
    var _payPollActive = false;

    function updatePricingUI(isPro, isElite) {
        document.querySelectorAll(".pr-btn-upgrade").forEach(function (btn) {
            var card = btn.closest(".pr-plan-card");
            var plan = card ? card.getAttribute("data-plan") : btn.getAttribute("data-plan");

            if ((plan === "pro" && isPro) || (plan === "elite" && isElite)) {
                btn.textContent = "Current Plan";
                btn.disabled = true;
                btn.classList.remove("pr-btn-primary", "pr-btn-elite");
                btn.classList.add("pr-btn-outline");
            } else if (plan === "pro" && isElite) {
                btn.textContent = "Downgrade";
                btn.disabled = true;
                btn.classList.remove("pr-btn-primary");
                btn.classList.add("pr-btn-outline");
            }
        });
    }

    async function pollPaymentVerification() {
        if (_payPollActive) return;
        _payPollActive = true;

        try {
            var pendingRes = await fetch(API_URL + "/api/student/pending-subscription", {
                credentials: "include",
                cache: "no-store"
            });
            var pendingData = await pendingRes.json().catch(function () { return {}; });

            if (!pendingRes.ok || !pendingData.success) {
                console.log("[PAYMENT] pending-subscription failed: status=" + pendingRes.status);
                _payPollActive = false;
                return;
            }

            var payments = pendingData.pendingPayments || [];
            if (payments.length === 0) {
                console.log("[PAYMENT] No pending payments.");
                if (_payPollInterval) {
                    clearInterval(_payPollInterval);
                    _payPollInterval = null;
                }
                _payPollActive = false;
                return;
            }

            console.log("[PAYMENT] Found " + payments.length + " pending payment(s). Verifying...");

            var anyPaid = false;

            for (var i = 0; i < payments.length; i++) {
                var p = payments[i];
                console.log("[PAYMENT] Checking paymentId=" + p.paymentId + " plan=" + p.plan + " status=" + p.status);

                try {
                    var verifyRes = await fetch(API_URL + "/api/payment/verify/" + encodeURIComponent(p.paymentId), {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" }
                    });
                    var verifyData = await verifyRes.json().catch(function () { return {}; });

                    console.log("[PAYMENT] Verify response: paymentId=" + p.paymentId + " status=" + verifyData.status);

                    if (verifyData.status === "paid") {
                        anyPaid = true;
                    }
                } catch (e) {
                    console.log("[PAYMENT] Verify error for " + p.paymentId + ": " + e.message);
                }
            }

            if (anyPaid) {
                if (_payPollInterval) {
                    clearInterval(_payPollInterval);
                    _payPollInterval = null;
                }

                console.log("[PAYMENT] At least one payment confirmed! Refreshing...");

                var authRes = await fetch(API_URL + "/api/auth/validate-session", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" }
                });
                var authData = await authRes.json().catch(function () { return {}; });
                if (authData.success && authData.user) {
                    localStorage.setItem("impactech_user", JSON.stringify(authData.user));
                    updatePricingUI(!!authData.user.isPro, !!authData.user.isElite);
                    prShowToast("Upgrade successful! Welcome to " + (authData.user.isElite ? "Elite" : "Pro") + "!", "success");
                }
            }
        } catch (e) {
            console.log("[PAYMENT] Poll error:", e.message);
        }

        _payPollActive = false;
    }

    async function initPaymentPolling() {
        try {
            var res = await fetch(API_URL + "/api/student/pending-subscription", {
                credentials: "include",
                cache: "no-store"
            });
            var data = await res.json().catch(function () { return {}; });
            var payments = data.pendingPayments || [];
            if (payments.length > 0) {
                console.log("[PAYMENT] Found " + payments.length + " pending payment(s) on pricing page, starting poll...");
                pollPaymentVerification();
                _payPollInterval = setInterval(pollPaymentVerification, 30000);
            } else {
                console.log("[PAYMENT] No pending payments on pricing page.");
            }
        } catch (e) {}
    }

    initPaymentPolling();
    window.addEventListener("beforeunload", function () {
        if (_payPollInterval) clearInterval(_payPollInterval);
    });

    /* --- Billing Toggle --- */
    var billingToggle = document.getElementById("prBillingToggle");
    var labelMonthly  = document.getElementById("prLabelMonthly");
    var labelYearly   = document.getElementById("prLabelYearly");
    var isYearly = false;

    function applyBilling() {
        document.querySelectorAll(".price-monthly").forEach(function (el) {
            el.style.display = isYearly ? "none" : "";
        });
        document.querySelectorAll(".price-yearly").forEach(function (el) {
            el.style.display = isYearly ? "" : "none";
        });

        if (isYearly) {
            billingToggle.classList.add("yearly");
            billingToggle.setAttribute("aria-pressed", "true");
            labelMonthly.classList.remove("active");
            labelYearly.classList.add("active");
        } else {
            billingToggle.classList.remove("yearly");
            billingToggle.setAttribute("aria-pressed", "false");
            labelMonthly.classList.add("active");
            labelYearly.classList.remove("active");
        }
    }

    if (billingToggle) {
        billingToggle.addEventListener("click", function () {
            isYearly = !isYearly;
            applyBilling();
        });
    }

    if (labelMonthly) {
        labelMonthly.addEventListener("click", function () {
            if (isYearly) { isYearly = false; applyBilling(); }
        });
    }

    if (labelYearly) {
        labelYearly.addEventListener("click", function () {
            if (!isYearly) { isYearly = true; applyBilling(); }
        });
    }

    /* --- FAQ Accordion --- */
    document.querySelectorAll(".pr-faq-question").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var item = btn.closest(".pr-faq-item");
            var isOpen = item.classList.contains("open");

            document.querySelectorAll(".pr-faq-item.open").forEach(function (openItem) {
                if (openItem !== item) openItem.classList.remove("open");
            });

            item.classList.toggle("open", !isOpen);
        });
    });

    /* --- Scroll Reveal --- */
    var revealTargets = document.querySelectorAll(
        ".pr-plan-card, .pr-testimonial-card, .pr-faq-item, .pr-table-wrap, .pr-section-header, .pr-cta-content"
    );

    revealTargets.forEach(function (el) { el.classList.add("pr-reveal"); });

    if ("IntersectionObserver" in window) {
        var revealObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        revealTargets.forEach(function (el) { revealObserver.observe(el); });
    } else {
        revealTargets.forEach(function (el) { el.classList.add("visible"); });
    }

    /* --- Button Ripple --- */
    document.querySelectorAll(".pr-btn").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
            if (btn.disabled) return;
            var rect = btn.getBoundingClientRect();
            var ripple = document.createElement("span");
            ripple.style.cssText =
                "position:absolute;border-radius:50%;background:rgba(255,255,255,0.35);" +
                "width:0;height:0;left:" + (e.clientX - rect.left) + "px;" +
                "top:" + (e.clientY - rect.top) + "px;transform:translate(-50%,-50%);" +
                "pointer-events:none;animation:prRipple 0.5s ease-out forwards;";
            btn.style.position = "relative";
            btn.style.overflow = "hidden";
            btn.appendChild(ripple);
            setTimeout(function () { ripple.remove(); }, 600);
        });
    });

    if (!document.getElementById("prRippleStyle")) {
        var style = document.createElement("style");
        style.id = "prRippleStyle";
        style.textContent = "@keyframes prRipple{to{width:250px;height:250px;opacity:0;}}";
        document.head.appendChild(style);
    }

    /* --- Plan Card Tilt --- */
    document.querySelectorAll(".pr-plan-card").forEach(function (card) {
        card.addEventListener("mousemove", function (e) {
            var rect = card.getBoundingClientRect();
            var x = (e.clientX - rect.left) / rect.width - 0.5;
            var y = (e.clientY - rect.top) / rect.height - 0.5;
            card.style.transform = "perspective(800px) rotateY(" + (x * 4) + "deg) rotateX(" + (-y * 4) + "deg) translateY(-6px)";
        });

        card.addEventListener("mouseleave", function () {
            card.style.transform = "";
        });
    });

});
