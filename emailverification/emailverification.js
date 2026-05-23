const VERIFY_API_URL = "https://ai-impact-server.vercel.app/api/auth/verify-email";

const statusIcon = document.getElementById("statusIcon");
const statusBadge = document.getElementById("statusBadge");
const verifyTitle = document.getElementById("verifyTitle");
const verifyText = document.getElementById("verifyText");
const verifyLoader = document.getElementById("verifyLoader");
const infoBox = document.getElementById("infoBox");
const verifyActions = document.getElementById("verifyActions");
const signinBtn = document.getElementById("signinBtn");
const signupBtn = document.getElementById("signupBtn");

function getTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") || "";
}

function setLoadingState() {
    statusIcon.className = "verify-status-icon loading";
    statusIcon.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;

    statusBadge.className = "verify-badge";
    statusBadge.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Checking secure verification link`;

    verifyTitle.textContent = "Verifying Your Email";
    verifyText.textContent = "Please wait while we confirm your account. This helps us protect your dashboard and keep your account secure.";

    verifyLoader.style.display = "flex";
    infoBox.style.display = "flex";
    infoBox.innerHTML = `<i class="fa-solid fa-lock"></i><span>Do not close this page while verification is running.</span>`;

    verifyActions.style.display = "none";
}

function setSuccessState(message) {
    statusIcon.className = "verify-status-icon success";
    statusIcon.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;

    statusBadge.className = "verify-badge success";
    statusBadge.innerHTML = `<i class="fa-solid fa-check"></i> Account verified successfully`;

    verifyTitle.textContent = "Email Verified";
    verifyText.textContent = message || "Your email has been verified successfully. You can now sign in and continue to your dashboard.";

    verifyLoader.style.display = "none";
    infoBox.style.display = "flex";
    infoBox.innerHTML = `<i class="fa-solid fa-unlock-keyhole"></i><span>Your account is now active and ready to use.</span>`;

    verifyActions.style.display = "grid";

    signinBtn.style.display = "inline-flex";
    signupBtn.style.display = "none";
}

function setErrorState(message) {
    statusIcon.className = "verify-status-icon error";
    statusIcon.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>`;

    statusBadge.className = "verify-badge error";
    statusBadge.innerHTML = `<i class="fa-solid fa-xmark"></i> Verification failed`;

    verifyTitle.textContent = "Verification Failed";
    verifyText.textContent = message || "This verification link is invalid or expired. Please request a new verification email.";

    verifyLoader.style.display = "none";
    infoBox.style.display = "flex";
    infoBox.innerHTML = `<i class="fa-solid fa-circle-info"></i><span>You may need to create a new account or request a fresh verification email.</span>`;

    verifyActions.style.display = "grid";

    signinBtn.style.display = "inline-flex";
    signupBtn.style.display = "inline-flex";
}

async function verifyEmail() {
    setLoadingState();

    const token = getTokenFromUrl();

    if (!token) {
        setErrorState("Verification token is missing from the link. Please use the exact link sent to your email.");
        return;
    }

    try {
        const response = await fetch(`${VERIFY_API_URL}?token=${encodeURIComponent(token)}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Email verification failed.");
        }

        setSuccessState(data.message || "Email verified successfully.");

    } catch (error) {
        console.error("Email verification error:", error);

        if (!navigator.onLine) {
            setErrorState("You are offline. Please check your internet connection and reload this page.");
        } else if (error.name === "TypeError") {
            setErrorState("Network or CORS error. Please check your server connection and try again.");
        } else {
            setErrorState(error.message || "Email verification failed.");
        }
    }
}

document.addEventListener("DOMContentLoaded", verifyEmail);