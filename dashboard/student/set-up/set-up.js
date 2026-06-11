/* ========================
   CONFIG
======================== */

var API_URL = "https://backend.impactacademy.site";

/* ========================
   AUTH + INIT
======================== */

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

document.addEventListener("DOMContentLoaded", async function () {
    var authOverlay = document.getElementById("authOverlay");

    var auth = await AuthenticateUser();

    if (!auth.success) {
        window.location.href = "../../../../signin//";
        return;
    }

    var allowedStudentTypes = ["student", "va-student"];
    var userType = (auth.user?.accountType || "").toLowerCase().trim();
    if (!allowedStudentTypes.includes(userType)) {
        window.location.href = "/404.html";
        return;
    }

    if (auth.user?.setup?.completed) {
        window.location.href = "../student";
        return;
    }

    if (authOverlay) {
        authOverlay.style.opacity = "0";
        setTimeout(function () { authOverlay.style.display = "none"; }, 300);
    }

    console.log("Authenticated user:", auth.user);

    initStudentSetup(auth.user);
});

/* ========================
   INIT FORM
======================== */

function initStudentSetup(user) {
    prefillUserData(user);
    fetchCountry();
    initBillingToggle();
    initCourseSearch();
    initFormLogic(user);
}

/* ========================
   PREFILL USER DATA (readonly)
======================== */

function prefillUserData(user) {
    if (!user) return;

    var fullName = user.fullname || user.full_name || user.name || "";
    var email    = user.email || "";
    var phone    = user.phone || user.phoneNumber || "";

    var fullNameInput = document.getElementById("fullNameInput");
    var emailInput    = document.getElementById("emailInput");
    var phoneInput    = document.getElementById("phoneInput");

    if (fullNameInput && fullName) {
        fullNameInput.value = fullName;
        fullNameInput.readOnly = true;
        fullNameInput.placeholder = "";
    }

    if (emailInput && email) {
        emailInput.value = email;
        emailInput.readOnly = true;
        emailInput.placeholder = "";
    }

    if (phoneInput && phone && !phoneInput.value) {
        phoneInput.value = phone;
    }
}

/* ========================
   FETCH COUNTRY FROM SERVER (readonly)
======================== */

async function fetchCountry() {
    var countryInput = document.getElementById("countryInput");
    var countryBadge = document.getElementById("countryAutoBadge");

    if (!countryInput || countryInput.value) return;

    try {
        var res  = await fetch(API_URL + "/api/geo/country", { credentials: "include" });
        var data = await res.json();

        if (data.success && data.country) {
            countryInput.value = data.country;
            countryInput.readOnly = true;
            countryInput.placeholder = "";
            if (countryBadge) countryBadge.style.display = "";
        } else {
            countryInput.placeholder = "Enter your country";
            countryInput.readOnly = false;
        }
    } catch (err) {
        var inp = document.getElementById("countryInput");
        if (inp) {
            inp.placeholder = "Enter your country";
            inp.readOnly = false;
        }
    }
}

/* ========================
   BILLING TOGGLE
======================== */

function initBillingToggle() {
    var billingToggle     = document.getElementById("billingToggle");
    var billingCycleInput = document.getElementById("billingCycleInput");
    var labelMonthly      = document.getElementById("labelMonthly");
    var labelYearly       = document.getElementById("labelYearly");

    if (!billingToggle) return;

    var isYearly = false;

    function applyBillingToggle() {
        document.querySelectorAll(".price-monthly").forEach(function (el) {
            el.style.display = isYearly ? "none" : "";
        });
        document.querySelectorAll(".price-yearly").forEach(function (el) {
            el.style.display = isYearly ? "" : "none";
        });

        billingCycleInput.value = isYearly ? "yearly" : "monthly";

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

    billingToggle.addEventListener("click", function () {
        isYearly = !isYearly;
        applyBillingToggle();
    });

    labelMonthly.addEventListener("click", function () {
        if (isYearly) { isYearly = false; applyBillingToggle(); }
    });

    labelYearly.addEventListener("click", function () {
        if (!isYearly) { isYearly = true; applyBillingToggle(); }
    });
}

/* ========================
   COURSE SEARCH & COUNTER
======================== */

function initCourseSearch() {
    var courseSearch     = document.getElementById("courseSearch");
    var courseCount      = document.getElementById("courseCount");
    var courseClearBtn   = document.getElementById("courseClearBtn");
    var courseCategories = document.getElementById("courseCategories");
    var courseNoResults  = document.getElementById("courseNoResults");

    function updateCourseCount() {
        var checked = document.querySelectorAll('input[name="courses"]:checked').length;
        courseCount.textContent = checked === 0 ? "0 selected" : checked + " selected";
        courseCount.style.background = checked > 0 ? "rgba(37,99,235,0.15)" : "";
    }

    if (courseSearch) {
        courseSearch.addEventListener("input", function () {
            var query      = this.value.trim().toLowerCase();
            var categories = courseCategories.querySelectorAll(".course-category");
            var anyVisible = false;

            categories.forEach(function (cat) {
                var labels      = cat.querySelectorAll("label");
                var catHasMatch = false;

                labels.forEach(function (label) {
                    var text    = label.textContent.trim().toLowerCase();
                    var matches = !query || text.includes(query);
                    label.style.display = matches ? "" : "none";
                    if (matches) catHasMatch = true;
                });

                cat.classList.toggle("hidden", !catHasMatch);
                if (catHasMatch) anyVisible = true;
            });

            if (courseNoResults) {
                courseNoResults.style.display = anyVisible ? "none" : "block";
            }
            courseCategories.style.display = anyVisible ? "" : "none";
        });
    }

    if (courseClearBtn) {
        courseClearBtn.addEventListener("click", function () {
            document.querySelectorAll('input[name="courses"]').forEach(function (cb) {
                cb.checked = false;
            });
            updateCourseCount();
        });
    }

    document.addEventListener("change", function (e) {
        if (e.target.name === "courses") updateCourseCount();
    });
}

/* ========================
   STEP VALIDATION
======================== */

function validateStep(stepIndex, steps) {
    var step = steps[stepIndex];

    /* Step 1: Basic Information */
    if (stepIndex === 0) {
        var phone   = step.querySelector('[name="phone"]');
        var country = step.querySelector('[name="country"]');

        if (phone && !phone.value.trim()) {
            showToastGlobal("Please enter your phone number.", "error");
            phone.focus();
            return false;
        }
        if (country && !country.value.trim()) {
            showToastGlobal("Country could not be detected. Please enter it manually.", "error");
            country.focus();
            return false;
        }
        return true;
    }

    /* Step 2: Academic Background */
    if (stepIndex === 1) {
        var educationLevel = step.querySelector('[name="educationLevel"]');
        var fieldOfStudy   = step.querySelector('[name="fieldOfStudy"]');
        var graduationYear = step.querySelector('[name="graduationYear"]');

        if (educationLevel && !educationLevel.value) {
            showToastGlobal("Please select your education level.", "error");
            educationLevel.focus();
            return false;
        }
        if (fieldOfStudy && !fieldOfStudy.value.trim()) {
            showToastGlobal("Please enter your field of study.", "error");
            fieldOfStudy.focus();
            return false;
        }
        if (graduationYear && !graduationYear.value) {
            showToastGlobal("Please select your graduation year.", "error");
            graduationYear.focus();
            return false;
        }
        return true;
    }

    /* Step 3: Learning Goals (at least 1) */
    if (stepIndex === 2) {
        var checked = step.querySelectorAll('input[name="goals"]:checked').length;
        if (checked === 0) {
            showToastGlobal("Please select at least one learning goal.", "error");
            return false;
        }
        return true;
    }

    /* Step 4: Course Interest (at least 1) */
    if (stepIndex === 3) {
        var checkedCourses = document.querySelectorAll('input[name="courses"]:checked').length;
        if (checkedCourses === 0) {
            showToastGlobal("Please select at least one course interest.", "error");
            return false;
        }
        return true;
    }

    /* Step 5: Learning Preferences */
    if (stepIndex === 4) {
        var selects = step.querySelectorAll("select[required]");
        for (var i = 0; i < selects.length; i++) {
            if (!selects[i].value) {
                showToastGlobal("Please fill in all required fields.", "error");
                selects[i].focus();
                return false;
            }
        }
        return true;
    }

    /* Step 6: Plan Selection */
    if (stepIndex === 5) {
        var planSelected = step.querySelector('input[name="plan"]:checked');
        if (!planSelected) {
            showToastGlobal("Please select a plan to continue.", "error");
            return false;
        }
        return true;
    }

    return true;
}

/* ========================
   GLOBAL TOAST
======================== */

function showToastGlobal(msg, type) {
    var toast = document.getElementById("setupToast");
    if (!toast) return;
    toast.textContent = msg;
    toast.className = "setup-toast show " + (type || "");
    clearTimeout(showToastGlobal._timer);
    showToastGlobal._timer = setTimeout(function () {
        toast.className = "setup-toast";
    }, 4000);
}

/* ========================
   PLAN PRICE LOOKUP
======================== */

var PLAN_PRICES = {
    Pro:   { monthly: 0.1,  yearly: 2 },
    Elite: { monthly: 0.5,  yearly: 4 }
};

/* ========================
   MAIN FORM LOGIC
======================== */

function initFormLogic(user) {
    var steps           = document.querySelectorAll(".form-step");
    var nextBtn         = document.getElementById("nextBtn");
    var backBtn         = document.getElementById("backBtn");
    var finishBtn       = document.getElementById("finishBtn");
    var progressFill    = document.getElementById("progressFill");
    var progressPercent = document.getElementById("progressPercent");
    var currentStepText = document.getElementById("currentStepText");
    var totalStepText   = document.getElementById("totalStepText");
    var stepTitle       = document.getElementById("stepTitle");
    var stepDescription = document.getElementById("stepDescription");
    var summaryBox      = document.getElementById("summaryBox");
    var billingCycleInput = document.getElementById("billingCycleInput");

    var TOTAL   = steps.length;
    var current = 0;
    var formData = {};

    totalStepText.textContent = TOTAL;

    /* --- UI update --- */
    function updateUI() {
        steps.forEach(function (s, i) {
            s.classList.toggle("active", i === current);
        });

        var pct = Math.round((current / TOTAL) * 100);
        progressFill.style.width = pct + "%";
        progressPercent.textContent = pct + "%";
        currentStepText.textContent = current + 1;

        var activeStep = steps[current];
        stepTitle.textContent = activeStep.dataset.title || "";
        stepDescription.textContent = activeStep.dataset.description || "";

        backBtn.disabled = current === 0;

        var isLast = current === TOTAL - 1;
        nextBtn.style.display   = isLast ? "none" : "inline-flex";
        finishBtn.style.display = isLast ? "inline-flex" : "none";

        if (isLast) buildSummary();
    }

    /* --- Collect step data --- */
    function collectStep() {
        var step   = steps[current];
        var inputs = step.querySelectorAll("input, select, textarea");

        inputs.forEach(function (input) {
            if (!input.name) return;

            if (input.type === "checkbox") {
                if (!formData[input.name]) formData[input.name] = [];
                if (input.checked) {
                    if (!formData[input.name].includes(input.value)) {
                        formData[input.name].push(input.value);
                    }
                } else {
                    formData[input.name] = formData[input.name].filter(function (v) {
                        return v !== input.value;
                    });
                }
            } else if (input.type === "radio") {
                if (input.checked) formData[input.name] = input.value;
            } else if (input.type === "hidden") {
                formData[input.name] = input.value;
            } else {
                if (input.value.trim()) formData[input.name] = input.value.trim();
            }
        });

        if (billingCycleInput) {
            formData.billingCycle = billingCycleInput.value;
        }
    }

    /* --- Build summary --- */
    function buildSummary() {
        var labelMap = {
            fullName:       "Full Name",
            email:          "Email Address",
            phone:          "Phone Number",
            country:        "Country",
            educationLevel: "Education Level",
            school:         "School / Institution",
            fieldOfStudy:   "Field of Study",
            graduationYear: "Graduation Year",
            goals:          "Learning Goals",
            courses:        "Course Interests",
            learningStyle:  "Learning Style",
            hoursPerWeek:   "Hours Per Week",
            schedule:       "Preferred Schedule",
            device:         "Primary Device",
            plan:           "Chosen Plan",
            billingCycle:   "Billing Cycle"
        };

        var iconMap = {
            fullName:       "fa-user",
            email:          "fa-envelope",
            phone:          "fa-phone",
            country:        "fa-earth-africa",
            educationLevel: "fa-graduation-cap",
            school:         "fa-school",
            fieldOfStudy:   "fa-book",
            graduationYear: "fa-calendar",
            goals:          "fa-bullseye",
            courses:        "fa-book-open",
            learningStyle:  "fa-brain",
            hoursPerWeek:   "fa-clock",
            schedule:       "fa-sun",
            device:         "fa-laptop",
            plan:           "fa-crown",
            billingCycle:   "fa-rotate"
        };

        var skipInSummary = [];

        var entries = Object.entries(formData).filter(function (pair) {
            if (skipInSummary.includes(pair[0])) return false;
            var val = pair[1];
            return val && (Array.isArray(val) ? val.length > 0 : String(val).trim() !== "");
        });

        if (!entries.length) {
            summaryBox.innerHTML =
                '<div class="summary-empty">' +
                    '<i class="fa-solid fa-inbox"></i>' +
                    '<p>No information filled in yet.</p>' +
                '</div>';
            return;
        }

        var itemsHTML = entries.map(function (pair) {
            var key     = pair[0];
            var val     = pair[1];
            var label   = labelMap[key] || key;
            var icon    = iconMap[key] || "fa-circle-info";
            var display = Array.isArray(val) ? val.join(", ") : val;

            return (
                '<div class="summary-item">' +
                    '<div class="summary-icon"><i class="fa-solid ' + icon + '"></i></div>' +
                    '<div class="summary-info">' +
                        '<small>' + label + '</small>' +
                        '<strong>' + display + '</strong>' +
                    '</div>' +
                    '<button class="summary-edit-btn" type="button" onclick="jumpToField(\'' + key + '\')">Edit</button>' +
                '</div>'
            );
        }).join("");

        summaryBox.innerHTML =
            '<div class="summary-head">' +
                '<div>' +
                    '<span>STUDENT PROFILE</span>' +
                    '<h4>Your Setup Summary</h4>' +
                '</div>' +
                '<div class="summary-live">' +
                    '<i class="fa-solid fa-circle"></i> Live' +
                '</div>' +
            '</div>' +
            '<div class="summary-grid">' + itemsHTML + '</div>';
    }

    /* --- Jump to field for edit --- */
    var fieldStepMap = {
        fullName: 0, email: 0, phone: 0, country: 0,
        educationLevel: 1, school: 1, fieldOfStudy: 1, graduationYear: 1,
        goals: 2,
        courses: 3,
        learningStyle: 4, hoursPerWeek: 4, schedule: 4, device: 4,
        plan: 5, billingCycle: 5
    };

    window.jumpToField = function (field) {
        var idx = fieldStepMap[field];
        if (idx !== undefined) {
            collectStep();
            current = idx;
            updateUI();
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    /* --- Toast --- */
    function showToast(msg, type) {
        var toast = document.getElementById("setupToast");
        if (!toast) return;
        toast.textContent = msg;
        toast.className = "setup-toast show " + (type || "");
        setTimeout(function () { toast.className = "setup-toast"; }, 4000);
    }

    /* ====================================================
       SAVE SETUP + HANDLE PAYMENT REDIRECT
    ==================================================== */

    async function saveSetupData() {
        var btnText = document.getElementById("finishBtnText");
        var btnIcon = document.getElementById("finishBtnIcon");

        finishBtn.disabled = true;
        if (btnText) btnText.textContent = "Saving...";
        if (btnIcon) btnIcon.className = "fa-solid fa-spinner fa-spin";

        var payload = Object.assign({}, formData);

        var chosenPlan  = payload.plan || "Starter";
        var isPaidPlan  = chosenPlan === "Pro" || chosenPlan === "Elite";
        var billingCycle = payload.billingCycle || "monthly";

        try {
            if (btnText) btnText.textContent = "Saving profile...";

            var setupRes = await fetch(API_URL + "/api/student/setup", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    setupData: payload,
                    plan: chosenPlan,
                    billingCycle: billingCycle,
                    paymentRequired: isPaidPlan
                })
            });

            var setupData = await setupRes.json().catch(function () { return {}; });

            if (!setupRes.ok || !setupData.success) {
                throw new Error(setupData.message || "Failed to save profile. Please try again.");
            }

            if (isPaidPlan) {
                if (btnText) btnText.textContent = "Setting up payment...";

                var priceInfo  = PLAN_PRICES[chosenPlan] || {};
                var amount     = billingCycle === "yearly"
                    ? (priceInfo.yearly  || 0)
                    : (priceInfo.monthly || 0);

                var spayRes = await fetch(API_URL + "/api/save-subscription-payment", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        plan:         chosenPlan,
                        billingCycle: billingCycle,
                        amount:       amount,
                        currency:     "USD"
                    })
                });

                var spayData = await spayRes.json().catch(function () { return {}; });

                if (!spayRes.ok || !spayData.success) {
                    throw new Error(spayData.message || "Failed to initialise payment. Please try again.");
                }

                showToast("Redirecting to payment...", "success");

                setTimeout(function () {
                    window.location.href = "../spay/?id=" + spayData.paymentId;
                }, 1200);

            } else {
                showToast("Setup complete! Redirecting to dashboard...", "success");

                setTimeout(function () {
                    window.location.href = "../";
                }, 1800);
            }

        } catch (err) {
            console.error("saveSetupData error:", err);
            showToast(err.message || "Something went wrong. Please try again.", "error");
            finishBtn.disabled = false;
            if (btnText) btnText.textContent = "Finish Setup";
            if (btnIcon) btnIcon.className = "fa-solid fa-check";
        }
    }

    /* --- Next button --- */
    nextBtn.addEventListener("click", function () {
        if (!validateStep(current, steps)) return;
        collectStep();
        if (current < TOTAL - 1) {
            current++;
            updateUI();
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    });

    /* --- Back button --- */
    backBtn.addEventListener("click", function () {
        collectStep();
        if (current > 0) {
            current--;
            updateUI();
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    });

    /* --- Form submit (Finish button) --- */
    document.getElementById("studentSetupForm").addEventListener("submit", function (e) {
        e.preventDefault();
        collectStep();
        saveSetupData();
    });

    /* --- Start --- */
    updateUI();
}
