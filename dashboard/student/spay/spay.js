/* ========================
   CONFIG
======================== */

var API_URL = "https://backend.impactacademy.site";

/* ========================
   PAGE STATE
======================== */

var PAGE = {
    paymentId:      null,
    payment:        null,
    isNigerian:     false,
    country:        "",
    usdToNgnRate:   0,
    amountUSD:      0,
    amountNGN:      0,
    virtualAccount: null,
    vaCountdownInterval: null,
    paymentVerifyInterval: null
};

/* ========================
   AUTH + INIT
======================== */

async function AuthenticateUser() {
    try {
        var response = await fetch(API_URL + "/api/auth/validate-session", {
            method:      "POST",
            credentials: "include",
            headers:     { "Content-Type": "application/json" }
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

    } catch (err) {
        console.error("AuthenticateUser error:", err);
        return { success: false, user: null };
    }
}

document.addEventListener("DOMContentLoaded", async function () {
    var authOverlay = document.getElementById("authOverlay");

    /* ---- 1. Authenticate ---- */
    var auth = await AuthenticateUser();

    if (!auth.success) {
        window.location.href = "../../../signin/";
        return;
    }

    var allowedStudentTypes = ["student", "va-student"];
    var userType = (auth.user?.accountType || "").toLowerCase().trim();
    if (!allowedStudentTypes.includes(userType)) {
        window.location.href = "../../../404.html";
        return;
    }

    /* ---- 2. Validate payment ID ---- */
    var paymentId = getPaymentIdFromUrl();

    if (!paymentId) {
        showToast("No payment ID found. Redirecting...", "error");
        setTimeout(function () {
            window.location.href = "https://impactacademy.site/student-dashboard/";
        }, 2000);
        return;
    }

    PAGE.paymentId = paymentId;

    /* ---- 3. Fetch payment details + geo options in parallel ---- */
    showLoadingState(true);

    var results = await Promise.allSettled([
        fetchPaymentDetails(paymentId),
        fetchGeoPaymentOptions()
    ]);

    /* Payment details */
    var paymentResult = results[0];
    if (paymentResult.status === "fulfilled" && paymentResult.value) {
        PAGE.payment = paymentResult.value;
    }

    /* Geo / country options */
    var geoResult = results[1];
    if (geoResult.status === "fulfilled" && geoResult.value) {
        PAGE.isNigerian   = geoResult.value.isNigerian  || false;
        PAGE.country      = geoResult.value.country     || "";
        PAGE.usdToNgnRate = geoResult.value.usdToNgnRate || 0;
    }

    /* ---- 4. Compute amounts ---- */
    if (PAGE.payment) {
        PAGE.amountUSD = PAGE.payment.amount || 0;
        if (PAGE.isNigerian && PAGE.usdToNgnRate > 0) {
            PAGE.amountNGN = Math.ceil(PAGE.amountUSD * PAGE.usdToNgnRate);
        }
    }

    showLoadingState(false);

    /* ---- 5. Dismiss auth overlay ---- */
    if (authOverlay) {
        authOverlay.style.opacity = "0";
        setTimeout(function () { authOverlay.style.display = "none"; }, 300);
    }

    /* ---- 6. Apply everything to UI ---- */
    applyPaymentDetails();
    applyCountryRestrictions();
    initTabs();
    initProofUpload();
    initBankPayButton();
    startPaymentVerificationPolling();

    /* ---- 7. Pre-generate virtual account for Nigerian users ---- */
    if (PAGE.isNigerian) {
        generateVirtualAccount();
    }
});

/* ========================
   GET PAYMENT ID FROM URL
======================== */

function getPaymentIdFromUrl() {
    var params = new URLSearchParams(window.location.search);
    return params.get("id") || null;
}

/* ========================
   FETCH PAYMENT DETAILS FROM SERVER
======================== */

async function fetchPaymentDetails(paymentId) {
    try {
        var res = await fetch(API_URL + "/api/subscription-payment/" + paymentId, {
            method:      "GET",
            credentials: "include"
        });

        var data = await res.json().catch(function () { return {}; });

        if (!res.ok || !data.success || !data.payment) {
            var fb     = await fetch(API_URL + "/api/student/pending-subscription", {
                method:      "GET",
                credentials: "include"
            });
            var fbData = await fb.json().catch(function () { return {}; });

            if (fbData.success && fbData.pendingSubscription) {
                return fbData.pendingSubscription;
            }

            return null;
        }

        return data.payment;

    } catch (err) {
        console.error("fetchPaymentDetails error:", err);
        return null;
    }
}

/* ========================
   FETCH GEO PAYMENT OPTIONS
======================== */

async function fetchGeoPaymentOptions() {
    try {
        var res  = await fetch(API_URL + "/api/geo/payment-options", {
            credentials: "include"
        });
        var data = await res.json().catch(function () { return {}; });

        if (data.success) {
            return {
                isNigerian:   data.isNigerian   || false,
                country:      data.country      || "",
                usdToNgnRate: data.usdToNgnRate || 0
            };
        }

        return { isNigerian: false, country: "", usdToNgnRate: 0 };

    } catch (err) {
        console.error("fetchGeoPaymentOptions error:", err);
        return { isNigerian: false, country: "", usdToNgnRate: 0 };
    }
}

/* ========================
   GENERATE FLUTTERWAVE VIRTUAL ACCOUNT
======================== */

window.generateVirtualAccount = async function (force) {
    if (!PAGE.paymentId) return;

    if (PAGE.vaCountdownInterval) {
        clearInterval(PAGE.vaCountdownInterval);
        PAGE.vaCountdownInterval = null;
    }

    showVAState("loading");

    try {
        var url = API_URL + "/api/payment/virtual-account/" + PAGE.paymentId;
        if (force === true) url += "?force=true";

        var res = await fetch(url, {
            method:      "POST",
            credentials: "include",
            headers:     { "Content-Type": "application/json" }
        });

        var data = await res.json().catch(function () { return {}; });

        if (!res.ok || !data.success || !data.virtualAccount) {
            showVAState("error", data.message || "Could not generate account number. Please try again.");
            return;
        }

        PAGE.virtualAccount = data.virtualAccount;
        applyVirtualAccount(data.virtualAccount);
        showVAState("details");

    } catch (err) {
        console.error("generateVirtualAccount error:", err);
        showVAState("error", "Network error. Please check your connection and try again.");
    }
};

/* ========================
   PAYMENT VERIFICATION POLLING
======================== */

function startPaymentVerificationPolling() {
    if (!PAGE.paymentId) return;

    if (PAGE.paymentVerifyInterval) {
        clearInterval(PAGE.paymentVerifyInterval);
        PAGE.paymentVerifyInterval = null;
    }

    verifyPaymentStatus();
    PAGE.paymentVerifyInterval = setInterval(verifyPaymentStatus, 30000);
}

async function verifyPaymentStatus(fromButton) {
    if (!PAGE.paymentId) return;

    var bankPayBtn = document.getElementById("bankPayBtn");
    if (fromButton && bankPayBtn) {
        bankPayBtn.disabled = true;
        bankPayBtn.textContent = "Checking payment...";
    }

    try {
        var res = await fetch(API_URL + "/api/payment/verify/" + encodeURIComponent(PAGE.paymentId), {
            method:      "POST",
            credentials: "include",
            headers:     { "Content-Type": "application/json" }
        });

        var data = await res.json().catch(function () { return {}; });

        if (!res.ok || !data.success) {
            if (fromButton && bankPayBtn) {
                bankPayBtn.disabled    = false;
                bankPayBtn.textContent = "I Have Transferred";
            }
            if (fromButton) showToast("Could not check payment. Please try again.", "error");
            return;
        }

        if (data.status === "paid") {
            if (PAGE.paymentVerifyInterval) {
                clearInterval(PAGE.paymentVerifyInterval);
                PAGE.paymentVerifyInterval = null;
            }

            PAGE.payment = PAGE.payment || {};
            PAGE.payment.status = "paid";

            if (bankPayBtn) {
                bankPayBtn.disabled    = true;
                bankPayBtn.textContent = "Payment Confirmed ✓";
                bankPayBtn.style.background = "#16a34a";
            }

            showToast("Payment confirmed! Redirecting to your dashboard...", "success");

            setTimeout(function () {
                window.location.href = "../";
            }, 3000);

        } else {
            if (fromButton && bankPayBtn) {
                bankPayBtn.disabled    = false;
                bankPayBtn.textContent = "I Have Transferred";
            }
            if (fromButton) showToast("Payment not received yet. Please wait a moment and try again.", "error");
        }

    } catch (err) {
        console.error("verifyPaymentStatus error:", err);
        if (fromButton && bankPayBtn) {
            bankPayBtn.disabled    = false;
            bankPayBtn.textContent = "I Have Transferred";
        }
        if (fromButton) showToast("Network error. Please check your connection.", "error");
    }
}

/* ========================
   FLUTTERWAVE CARD PAYMENT
   Called when user clicks "Continue with Card"
======================== */

window.launchFlutterwaveCardPayment = async function () {
    if (!PAGE.paymentId) {
        showToast("Payment session not ready. Please refresh and try again.", "error");
        return;
    }

    var cardPayBtn     = document.getElementById("cardPayBtn");
    var cardPayBtnText = document.getElementById("cardPayBtnText");
    var cardPayBtnIcon = document.getElementById("cardPayBtnIcon");

    if (cardPayBtn) cardPayBtn.disabled = true;
    if (cardPayBtnText) cardPayBtnText.textContent = "Loading...";
    if (cardPayBtnIcon) cardPayBtnIcon.className = "fa-solid fa-spinner fa-spin";

    try {
        var res  = await fetch(API_URL + "/api/payment/card-config/" + PAGE.paymentId, {
            method:      "POST",
            credentials: "include",
            headers:     { "Content-Type": "application/json" }
        });

        var data = await res.json().catch(function () { return {}; });

        if (!res.ok || !data.success || !data.config) {
            showToast(data.message || "Could not initialise card payment. Please try again.", "error");
            resetCardButton();
            return;
        }

        var cfg = data.config;

        FlutterwaveCheckout({
            public_key:  cfg.public_key,
            tx_ref:      cfg.tx_ref,
            amount:      cfg.amount,
            currency:    cfg.currency || "USD",
            payment_options: "card",
            customer: {
                email:        cfg.customer.email,
                name:         cfg.customer.name,
                phone_number: cfg.customer.phone_number || ""
            },
            customizations: {
                title:       "IMPACTECH ACADEMY",
                description: cfg.customizations.description || "Subscription Payment",
                logo:        cfg.customizations.logo        || "https://impactacademy.site/images/icon.png"
            },
            callback: function (response) {
                handleCardPaymentCallback(response);
            },
            onclose: function () {
                resetCardButton();
            }
        });

    } catch (err) {
        console.error("launchFlutterwaveCardPayment error:", err);
        showToast("Network error. Please check your connection and try again.", "error");
        resetCardButton();
    }
};

/* ========================
   CARD PAYMENT CALLBACK
   Called by FLW inline after payment attempt
======================== */

async function handleCardPaymentCallback(response) {
    resetCardButton();

    if (!response || response.status !== "successful") {
        showToast("Card payment was not completed. Please try again.", "error");
        return;
    }

    var cardPayBtn     = document.getElementById("cardPayBtn");
    var cardPayBtnText = document.getElementById("cardPayBtnText");
    var cardPayBtnIcon = document.getElementById("cardPayBtnIcon");

    if (cardPayBtn) cardPayBtn.disabled = true;
    if (cardPayBtnText) cardPayBtnText.textContent = "Verifying payment...";
    if (cardPayBtnIcon) cardPayBtnIcon.className = "fa-solid fa-spinner fa-spin";

    try {
        var res = await fetch(API_URL + "/api/payment/verify/" + encodeURIComponent(PAGE.paymentId), {
            method:      "POST",
            credentials: "include",
            headers:     { "Content-Type": "application/json" },
            body:        JSON.stringify({ flw_transaction_id: response.transaction_id })
        });

        var data = await res.json().catch(function () { return {}; });

        if (data.status === "paid") {
            if (PAGE.paymentVerifyInterval) {
                clearInterval(PAGE.paymentVerifyInterval);
                PAGE.paymentVerifyInterval = null;
            }

            if (cardPayBtn) {
                cardPayBtn.disabled         = true;
                cardPayBtn.style.background = "#16a34a";
            }
            if (cardPayBtnText) cardPayBtnText.textContent = "Payment Confirmed ✓";
            if (cardPayBtnIcon) cardPayBtnIcon.className   = "fa-solid fa-circle-check";

            showToast("Payment confirmed! Redirecting to your dashboard...", "success");

            setTimeout(function () {
                window.location.href = "../";
            }, 3000);

        } else {
            showToast("Payment could not be verified. Please contact support if the issue persists.", "error");
            resetCardButton();
        }

    } catch (err) {
        console.error("handleCardPaymentCallback verify error:", err);
        showToast("Verification error. Please contact support.", "error");
        resetCardButton();
    }
}

function resetCardButton() {
    var cardPayBtn     = document.getElementById("cardPayBtn");
    var cardPayBtnText = document.getElementById("cardPayBtnText");
    var cardPayBtnIcon = document.getElementById("cardPayBtnIcon");

    if (cardPayBtn) {
        cardPayBtn.disabled         = false;
        cardPayBtn.style.background = "";
    }
    if (cardPayBtnText) cardPayBtnText.textContent = "Continue with Card";
    if (cardPayBtnIcon) cardPayBtnIcon.className   = "fa-solid fa-credit-card";
}

/* ========================
   APPLY VIRTUAL ACCOUNT DETAILS TO UI
======================== */

function applyVirtualAccount(va) {
    if (!va) return;

    setText("bankName",    va.bankName    || "—");
    setText("bankAccName", va.accountName || "—");
    setText("bankAccNum",  va.accountNumber || "—");
    setText("bankRef",     va.txRef       || PAGE.paymentId || "—");

    var ngnLabel = va.amount
        ? "₦" + Number(va.amount).toLocaleString("en-NG")
        : "—";
    setText("bankAmount", ngnLabel);

    if (PAGE.amountUSD && PAGE.usdToNgnRate) {
        var usdLabel = "$" + PAGE.amountUSD + " at ₦" + Number(PAGE.usdToNgnRate).toLocaleString("en-NG") + "/$";
        var subEl    = document.getElementById("bankAmountSub");
        if (subEl) {
            subEl.textContent   = "≈ " + usdLabel;
            subEl.style.display = "";
        }
    }

    if (va.expiresAt) {
        startVACountdown(va.expiresAt);
    }

    var bankPayBtn = document.getElementById("bankPayBtn");
    if (bankPayBtn) bankPayBtn.disabled = false;

    var narrationNote = document.getElementById("vaNarrationNote");
    if (narrationNote) narrationNote.style.display = "";
}

/* ========================
   VA UI STATE SWITCHER
======================== */

function showVAState(state, errorMsg) {
    var vaLoading      = document.getElementById("vaLoading");
    var vaError        = document.getElementById("vaError");
    var bankDetailsBox = document.getElementById("bankDetailsBox");
    var vaErrorMsg     = document.getElementById("vaErrorMsg");

    if (vaLoading)      vaLoading.style.display      = state === "loading"  ? "flex"  : "none";
    if (vaError)        vaError.style.display        = state === "error"    ? "flex"  : "none";
    if (bankDetailsBox) bankDetailsBox.style.display = state === "details"  ? "block" : "none";

    if (state === "error" && vaErrorMsg && errorMsg) {
        vaErrorMsg.textContent = errorMsg;
    }
}

/* ========================
   VA EXPIRY COUNTDOWN
======================== */

function startVACountdown(expiresAtISO) {
    var expiryWrap  = document.getElementById("vaExpiryWrap");
    var countdownEl = document.getElementById("vaExpiryCountdown");

    if (!expiryWrap || !countdownEl) return;

    expiryWrap.style.display = "";

    var expiryMs = new Date(expiresAtISO).getTime();

    function tick() {
        var remaining = expiryMs - Date.now();

        if (remaining <= 0) {
            clearInterval(PAGE.vaCountdownInterval);
            PAGE.vaCountdownInterval = null;
            countdownEl.textContent  = "Expired";
            expiryWrap.style.color   = "#dc2626";

            var bankPayBtn = document.getElementById("bankPayBtn");
            if (bankPayBtn) bankPayBtn.disabled = true;

            showToast("Your virtual account has expired. Please generate a new one.", "error");
            showVAState("error", "This account number has expired. Please generate a new one.");
            return;
        }

        var totalSecs = Math.floor(remaining / 1000);
        var hours     = Math.floor(totalSecs / 3600);
        var mins      = Math.floor((totalSecs % 3600) / 60);
        var secs      = totalSecs % 60;

        var parts = [];
        if (hours > 0) parts.push(hours + "h");
        parts.push(pad2(mins) + "m");
        parts.push(pad2(secs) + "s");

        countdownEl.textContent = parts.join(" ");

        if (remaining < 5 * 60 * 1000) {
            expiryWrap.classList.add("va-expiry-urgent");
        }
    }

    tick();
    PAGE.vaCountdownInterval = setInterval(tick, 1000);
}

function pad2(n) {
    return n < 10 ? "0" + n : String(n);
}

/* ========================
   LOADING STATE
======================== */

function showLoadingState(loading) {
    var card = document.querySelector(".setup-card");
    if (!card) return;
    card.style.opacity       = loading ? "0.5" : "1";
    card.style.pointerEvents = loading ? "none" : "";
}

/* ========================
   APPLY PAYMENT DETAILS TO UI
======================== */

function applyPaymentDetails() {
    var payment      = PAGE.payment;
    var isNigerian   = PAGE.isNigerian;
    var amountUSD    = PAGE.amountUSD;
    var amountNGN    = PAGE.amountNGN;
    var paymentId    = PAGE.paymentId;

    var plan         = (payment && payment.plan)         || "Pro";
    var billingCycle = (payment && payment.billingCycle) || "monthly";

    var iconMap  = { Starter: "fa-seedling", Pro: "fa-bolt", Elite: "fa-crown" };
    var planIcon = iconMap[plan] || "fa-crown";

    var cycleLabel  = billingCycle === "yearly" ? "Yearly (Save 2 months)" : "Monthly";
    var cycleSuffix = billingCycle === "yearly" ? "/yr" : "/mo";

    var usdLabel = "$" + amountUSD + cycleSuffix;
    var ngnLabel = amountNGN > 0
        ? "₦" + amountNGN.toLocaleString("en-NG") + cycleSuffix
        : null;

    var primaryLabel   = (isNigerian && ngnLabel) ? ngnLabel : usdLabel;
    var secondaryLabel = (isNigerian && ngnLabel) ? "≈ " + usdLabel : null;

    /* Sidebar order summary */
    setText("orderPlan",  plan + " Plan");
    setText("orderCycle", cycleLabel);
    setText("orderTotal", primaryLabel);

    if (isNigerian && ngnLabel && PAGE.usdToNgnRate > 0) {
        var rateNote = document.getElementById("orderRateNote");
        if (rateNote) {
            rateNote.textContent   = "Rate: $1 ≈ ₦" + PAGE.usdToNgnRate.toLocaleString("en-NG");
            rateNote.style.display = "";
        }
    }

    /* Plan reminder pill */
    setText("planReminderName",  plan + " Plan");
    setText("planReminderPrice", primaryLabel + " · " + cycleLabel);

    var iconEl = document.getElementById("planReminderIcon");
    if (iconEl) iconEl.innerHTML = '<i class="fa-solid ' + planIcon + '"></i>';

    if (secondaryLabel) {
        var secEl = document.getElementById("planReminderSecondary");
        if (secEl) {
            secEl.textContent  = secondaryLabel;
            secEl.style.display = "";
        }
    }

    /* Card CTA button label */
    setText("cardPayBtnText", "Continue with Card");

    /* Bank pay button label */
    if (isNigerian && ngnLabel) {
        setText("bankPayBtnText", "I Have Transferred " + ngnLabel);
    } else {
        setText("bankPayBtnText", "I Have Made Payment");
    }

    /* Bank reference placeholder */
    setText("bankRef", paymentId || "—");
}

/* ========================
   APPLY COUNTRY RESTRICTIONS
======================== */

function applyCountryRestrictions() {
    var tabBank     = document.getElementById("tabBank");
    var panelBank   = document.getElementById("panelBank");
    var tabCard     = document.getElementById("tabCard");
    var panelCard   = document.getElementById("panelCard");
    var tabsWrap    = document.querySelector(".pay-tabs");
    var countryNote = document.getElementById("countryPayNote");

    if (PAGE.isNigerian) {
        if (tabBank)   tabBank.style.display  = "";
        if (panelBank) panelBank.style.display = "";

        if (countryNote) {
            countryNote.innerHTML =
                '<i class="fa-solid fa-flag"></i>' +
                ' Nigerian users: Bank Transfer is available in <strong>Naira (₦)</strong> with a dedicated virtual account.';
            countryNote.className     = "country-pay-note nigerian";
            countryNote.style.display = "";
        }

    } else {
        if (tabBank)   tabBank.style.display  = "none";
        if (panelBank) panelBank.style.display = "none";

        if (tabCard)   tabCard.classList.add("active");
        if (panelCard) panelCard.classList.add("active");

        if (tabsWrap) tabsWrap.classList.add("single-tab");

        if (countryNote) {
            countryNote.innerHTML =
                '<i class="fa-solid fa-earth-americas"></i>' +
                ' Bank Transfer is only available for Nigerian users. Card payment is accepted globally.';
            countryNote.className     = "country-pay-note international";
            countryNote.style.display = "";
        }
    }
}

/* ========================
   TAB SWITCHING
======================== */

function initTabs() {
    window.switchTab = function (tab) {
        var tabCard   = document.getElementById("tabCard");
        var tabBank   = document.getElementById("tabBank");
        var panelCard = document.getElementById("panelCard");
        var panelBank = document.getElementById("panelBank");

        if (tab === "bank" && !PAGE.isNigerian) return;

        if (tab === "card") {
            if (tabCard)   tabCard.classList.add("active");
            if (tabBank)   tabBank.classList.remove("active");
            if (panelCard) panelCard.classList.add("active");
            if (panelBank) panelBank.classList.remove("active");
        } else {
            if (tabBank)   tabBank.classList.add("active");
            if (tabCard)   tabCard.classList.remove("active");
            if (panelBank) panelBank.classList.add("active");
            if (panelCard) panelCard.classList.remove("active");
        }
    };
}

/* ========================
   PROOF UPLOAD
======================== */

function initProofUpload() {
    var proofFile        = document.getElementById("proofFile");
    var proofPlaceholder = document.getElementById("proofPlaceholder");
    var proofPreview     = document.getElementById("proofPreview");
    var proofFileName    = document.getElementById("proofFileName");
    var proofRemoveBtn   = document.getElementById("proofRemoveBtn");

    if (!proofFile) return;

    proofFile.addEventListener("change", function () {
        var file = this.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showToast("File too large. Maximum 5MB allowed.", "error");
            this.value = "";
            return;
        }

        proofFileName.textContent      = file.name;
        proofPlaceholder.style.display = "none";
        proofPreview.style.display     = "flex";
    });

    if (proofRemoveBtn) {
        proofRemoveBtn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            proofFile.value                = "";
            proofPlaceholder.style.display = "flex";
            proofPreview.style.display     = "none";
        });
    }
}

/* ========================
   BANK PAY BUTTON
======================== */

function initBankPayButton() {
    var bankPayBtn = document.getElementById("bankPayBtn");

    if (bankPayBtn) {
        bankPayBtn.addEventListener("click", function () {
            if (!PAGE.virtualAccount) {
                showToast("Please wait for your account number to be generated.", "error");
                return;
            }
            verifyPaymentStatus(true);
        });
    }
}

/* ========================
   COPY TO CLIPBOARD
======================== */

window.copyValue = function (elementId) {
    var el = document.getElementById(elementId);
    if (!el) return;

    var text = el.textContent.trim();
    if (!text || text === "—") return;

    navigator.clipboard.writeText(text).then(function () {
        var wrap = el.closest(".bank-detail-value-wrap");
        var btn  = wrap ? wrap.querySelector(".copy-btn") : null;

        if (btn) {
            btn.classList.add("copied");
            btn.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(function () {
                btn.classList.remove("copied");
                btn.innerHTML = '<i class="fa-solid fa-copy"></i>';
            }, 2000);
        }

        showToast("Copied to clipboard!", "success");

    }).catch(function () {
        showToast("Could not copy. Please copy manually.", "error");
    });
};

/* ========================
   HELPERS
======================== */

function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setInputValue(id, value) {
    var el = document.getElementById(id);
    if (el && !el.value) el.value = value;
}

function setSelectValue(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value;
}

/* ========================
   TOAST
======================== */

function showToast(msg, type) {
    var toast = document.getElementById("setupToast");
    if (!toast) return;
    toast.textContent = msg;
    toast.className   = "setup-toast show " + (type || "");
    clearTimeout(showToast._timer);
    showToast._timer  = setTimeout(function () {
        toast.className = "setup-toast";
    }, 4500);
}