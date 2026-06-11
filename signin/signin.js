const BASE_URL = "https://backend.impactacademy.site";
const SIGNIN_API_URL = `${BASE_URL}/api/signin`;
const VALIDATE_SESSION_URL = `${BASE_URL}/api/auth/validate-session`;

const signinForm = document.getElementById("signinForm");
const formMessage = document.getElementById("formMessage");
const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

/* =========================
   ROLE → DASHBOARD MAP
========================= */

const ROLE_DASHBOARD = {
    freelancer: "../dashboard/freelancer",
    client:     "../dashboard/iam-client",
    student:    "../dashboard/student"
};

function getDashboardForRole(role) {
    if (!role) return "../dashboard/va-student";
    const key = String(role).toLowerCase();
    return ROLE_DASHBOARD[key] || "../dashboard/va-student";
}

/* =========================
   SESSION CHECK ON LOAD
   If the user already has a valid session, skip the signin
   page entirely and send them straight to their dashboard.
========================= */

(async function checkExistingSession() {
    try {
        const res = await fetch(VALIDATE_SESSION_URL, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" }
        });

        if (!res.ok) return;

        const data = await res.json().catch(() => ({}));

        if (!data.success || !data.user) return;

        localStorage.setItem("impactech_user", JSON.stringify(data.user));

        // Server returns accountType — fall back through common field names
        const role =
            data.user.accountType ||
            data.user.role        ||
            data.user.userType    ||
            data.user.type;

        const destination = data.redirectUrl || getDashboardForRole(role);

        showMessage("Already signed in. Redirecting...", "success");

        setTimeout(() => {
            window.location.href = destination;
        }, 400);

    } catch (err) {
        // No session or network error — stay on signin page
    }
})();

/* =========================
   UI HELPERS
========================= */

function showMessage(message, type = "error") {
    if (!formMessage) return;

    formMessage.style.display = "block";
    formMessage.textContent = message;
    formMessage.className = "form-message";

    if (type === "success") {
        formMessage.classList.add("success-message");
    } else {
        formMessage.classList.add("error-message");
    }
}

function hideMessage() {
    if (!formMessage) return;

    formMessage.style.display = "none";
    formMessage.textContent = "";
}

function setFieldError(id, message) {
    const errorEl = document.getElementById(id);
    if (errorEl) errorEl.textContent = message;
}

function clearErrors() {
    hideMessage();

    setFieldError("emailError", "");
    setFieldError("passwordError", "");

    document.querySelectorAll(".input-box").forEach((box) => {
        box.classList.remove("error");
    });
}

function setInputError(inputId) {
    const input = document.getElementById(inputId);
    const box = input?.closest(".input-box");

    if (box) {
        box.classList.add("error");
    }
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* =========================
   PASSWORD TOGGLE
========================= */

if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", function () {
        const icon = togglePassword.querySelector("i");

        if (passwordInput.type === "password") {
            passwordInput.type = "text";
            icon.className = "fa-solid fa-eye-slash";
        } else {
            passwordInput.type = "password";
            icon.className = "fa-solid fa-eye";
        }
    });
}

/* =========================
   SIGNIN FORM SUBMIT
========================= */

signinForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearErrors();

    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const rememberInput = document.getElementById("rememberMe");

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const rememberMe = rememberInput ? rememberInput.checked : false;

    const signinBtn = document.querySelector(".signin-btn");
    const originalBtnText = signinBtn.innerHTML;

    let hasError = false;

    if (!email) {
        setFieldError("emailError", "Email address is required.");
        setInputError("email");
        hasError = true;
    } else if (!isValidEmail(email)) {
        setFieldError("emailError", "Please enter a valid email address.");
        setInputError("email");
        hasError = true;
    }

    if (!password) {
        setFieldError("passwordError", "Password is required.");
        setInputError("password");
        hasError = true;
    }

    if (hasError) {
        showMessage("Please fix the errors below and try again.", "error");
        return;
    }

    try {
        signinBtn.disabled = true;
        signinBtn.innerHTML = `Signing In... <i class="fa-solid fa-spinner fa-spin"></i>`;

        showMessage("Checking your account, please wait...", "success");

        const response = await fetch(SIGNIN_API_URL, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password,
                rememberMe,
                userAgent: navigator.userAgent
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            if (data.code === "EMAIL_NOT_VERIFIED") {
                throw new Error(data.message || "Please verify your email before signing in.");
            }

            if (response.status === 400) {
                throw new Error(data.message || "Email and password are required.");
            }

            if (response.status === 401) {
                throw new Error(data.message || "Invalid email or password.");
            }

            if (response.status === 403) {
                throw new Error(data.message || "You are not allowed to sign in yet.");
            }

            if (response.status === 404) {
                throw new Error(data.message || "Account profile was not found.");
            }

            if (response.status >= 500) {
                throw new Error(data.message || "Server error. Please try again later.");
            }

            throw new Error(data.message || "Signin failed. Please try again.");
        }

        if (data.user) {
            localStorage.setItem("impactech_user", JSON.stringify(data.user));
        }

        showMessage("Signin successful. Redirecting...", "success");

        const role =
            data.user?.accountType ||
            data.user?.role        ||
            data.user?.userType    ||
            data.user?.type;

        const destination = data.redirectUrl || getDashboardForRole(role);

        setTimeout(() => {
            window.location.href = destination;
        }, 700);

    } catch (error) {
        console.error("Signin error:", error);

        if (!navigator.onLine) {
            showMessage("You are offline. Please check your internet connection.", "error");
        } else if (error.name === "TypeError") {
            showMessage("Network or CORS error. Please check your server connection.", "error");
        } else {
            showMessage(error.message || "Something went wrong. Please try again.", "error");
        }

    } finally {
        signinBtn.disabled = false;
        signinBtn.innerHTML = originalBtnText;
    }
});
