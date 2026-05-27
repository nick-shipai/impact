const API_URL = "https://ai-impact-server.vercel.app";

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

document.addEventListener("DOMContentLoaded", async function () {
    const auth = await AuthenticateUser();

    if (!auth.success) {
        window.location.href = "../../signin";
        return;
    }

    initClientSetup(auth.user);
    console.log("Authenticated user:", auth.user);
});

function initClientSetup(authUser) {
    const form = document.getElementById("clientSetupForm");
    const steps = document.querySelectorAll(".form-step");

    const stepTitle = document.getElementById("stepTitle");
    const stepDescription = document.getElementById("stepDescription");
    const currentStepText = document.getElementById("currentStepText");
    const totalStepText = document.getElementById("totalStepText");
    const progressPercent = document.getElementById("progressPercent");
    const progressFill = document.getElementById("progressFill");

    const backBtn = document.getElementById("backBtn");
    const nextBtn = document.getElementById("nextBtn");
    const skipBtn = document.getElementById("skipBtn");
    const finishBtn = document.getElementById("finishBtn");
    const summaryBox = document.getElementById("summaryBox");

    async function loadSavedClientSetupData() {
        try {
            const response = await fetch(`${API_URL}/api/load-client-set-up-data`, {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok || !result.success || !result.client) {
                return null;
            }

            const fullNameInput = form.querySelector('[name="fullName"]');
            const emailInput = form.querySelector('[name="email"]');

            if (fullNameInput && result.client.fullName) {

                fullNameInput.value =
                    result.client.fullName;

                fullNameInput.readOnly = true;

                console.log(
                    "FULL NAME LOADED:",
                    result.client.fullName
                );
            }

            if (emailInput && result.client.email) {

                emailInput.value =
                    result.client.email;

                emailInput.readOnly = true;

                console.log(
                    "EMAIL LOADED:",
                    result.client.email
                );
            }

            return result.client;

        } catch (error) {
            console.error("Load client setup error:", error);
            return null;
        }
    }
    loadSavedClientSetupData();

    let currentStep = 0;
    const totalSteps = steps.length;

    const optionalSteps = [6];
    // step 7 payment setup can be skipped
    // index starts from 0, so 6 means step 7

    totalStepText.textContent = totalSteps;

    function showToast(message, type = "error") {
        const oldToast = document.querySelector(".setup-toast");
        if (oldToast) oldToast.remove();

        const toast = document.createElement("div");
        toast.className = `setup-toast show ${type}`;
        toast.textContent = message;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.remove("show");
        }, 2500);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    function isOptionalStep(index) {
        return optionalSteps.includes(index);
    }

    function showStep(index) {
        steps.forEach((step, i) => {
            step.classList.toggle("active", i === index);
        });

        const activeStep = steps[index];

        stepTitle.textContent = activeStep.dataset.title || "Client Setup";
        stepDescription.textContent = activeStep.dataset.description || "Complete your setup.";
        currentStepText.textContent = index + 1;

        const percent = Math.round(((index + 1) / totalSteps) * 100);
        progressPercent.textContent = percent + "%";
        progressFill.style.width = percent + "%";

        backBtn.disabled = index === 0;

        if (isOptionalStep(index)) {
            skipBtn.style.display = "inline-flex";
        } else {
            skipBtn.style.display = "none";
        }

        if (index === totalSteps - 1) {
            nextBtn.style.display = "none";
            skipBtn.style.display = "none";
            finishBtn.style.display = "inline-flex";
            updateSummary();
        } else {
            nextBtn.style.display = "inline-flex";
            finishBtn.style.display = "none";
        }
    }

    function validateStep(index) {
        const step = steps[index];

        const requiredFields = step.querySelectorAll("[data-required='true']");

        for (const field of requiredFields) {
            if (!String(field.value || "").trim()) {
                field.focus();
                showToast("Please complete the required information before continuing.");
                return false;
            }
        }

        if (index === 0) {
            const fullName = form.querySelector('[name="fullName"]');
            const email = form.querySelector('[name="email"]');
            const phone = form.querySelector('[name="phone"]');
            const country = form.querySelector('[name="country"]');

            if (!fullName.value.trim()) {
                fullName.focus();
                showToast("Full name is required.");
                return false;
            }

            if (!email.value.trim()) {
                email.focus();
                showToast("Email is required.");
                return false;
            }

            if (!phone.value.trim()) {
                phone.focus();
                showToast("Phone number is required.");
                return false;
            }

            if (!country.value.trim()) {
                country.focus();
                showToast("Country is required.");
                return false;
            }
        }

        if (index === 1) {
            const companyName = form.querySelector('[name="companyName"]');
            const industry = form.querySelector('[name="industry"]');
            const companySize = form.querySelector('[name="companySize"]');

            if (!companyName.value.trim()) {
                companyName.focus();
                showToast("Company name is required.");
                return false;
            }

            if (!industry.value.trim()) {
                industry.focus();
                showToast("Industry is required.");
                return false;
            }

            if (!companySize.value.trim()) {
                companySize.focus();
                showToast("Company size is required.");
                return false;
            }
        }

        if (index === 2) {
            const selectedServices = document.querySelectorAll('input[name="services"]:checked');

            if (selectedServices.length === 0) {
                showToast("Please select at least one service you need.");
                return false;
            }
        }

        if (index === 3) {
            const projectTitle = form.querySelector('[name="projectTitle"]');
            const projectDescription = form.querySelector('[name="projectDescription"]');

            if (!projectTitle.value.trim()) {
                projectTitle.focus();
                showToast("Project title is required.");
                return false;
            }

            if (!projectDescription.value.trim()) {
                projectDescription.focus();
                showToast("Project description is required.");
                return false;
            }
        }

        if (index === 4) {
            const budgetType = form.querySelector('[name="budgetType"]');
            const budgetAmount = form.querySelector('[name="budgetAmount"]');
            const currency = form.querySelector('[name="currency"]');
            const timeline = form.querySelector('[name="timeline"]');

            if (!budgetType.value.trim()) {
                budgetType.focus();
                showToast("Budget type is required.");
                return false;
            }

            if (!budgetAmount.value.trim()) {
                budgetAmount.focus();
                showToast("Budget amount is required.");
                return false;
            }

            if (!currency.value.trim()) {
                currency.focus();
                showToast("Currency is required.");
                return false;
            }

            if (!timeline.value.trim()) {
                timeline.focus();
                showToast("Timeline is required.");
                return false;
            }
        }

        if (index === 5) {
            const experienceLevel = form.querySelector('[name="experienceLevel"]');
            const locationPreference = form.querySelector('[name="locationPreference"]');
            const communication = form.querySelector('[name="communication"]');
            const workStyle = form.querySelector('[name="workStyle"]');

            if (!experienceLevel.value.trim()) {
                experienceLevel.focus();
                showToast("Experience level is required.");
                return false;
            }

            if (!locationPreference.value.trim()) {
                locationPreference.focus();
                showToast("Location preference is required.");
                return false;
            }

            if (!communication.value.trim()) {
                communication.focus();
                showToast("Communication method is required.");
                return false;
            }

            if (!workStyle.value.trim()) {
                workStyle.focus();
                showToast("Work style is required.");
                return false;
            }
        }

        return true;
    }

    function nextStep() {
        if (!validateStep(currentStep)) return;

        if (currentStep < totalSteps - 1) {
            currentStep++;
            showStep(currentStep);
        }
    }

    function backStep() {
        if (currentStep > 0) {
            currentStep--;
            showStep(currentStep);
        }
    }

    function skipStep() {
        if (!isOptionalStep(currentStep)) {
            showToast("This step cannot be skipped.");
            return;
        }

        if (currentStep < totalSteps - 1) {
            currentStep++;
            showStep(currentStep);
        }
    }

    function getFormData() {
        const formData = new FormData(form);
        const data = {};

        formData.forEach((value, key) => {
            if (data[key]) {
                if (!Array.isArray(data[key])) {
                    data[key] = [data[key]];
                }

                data[key].push(value);
            } else {
                data[key] = value;
            }
        });

        const services = [];

        document.querySelectorAll('input[name="services"]:checked').forEach((box) => {
            services.push(box.value);
        });

        data.services = services;

        return data;
    }

    function updateSummary() {
        const data = getFormData();

        const items = [
            {
                label: "Full Name",
                value: data.fullName || "Not added",
                step: 0,
                icon: "fa-user"
            },
            {
                label: "Email",
                value: data.email || "Not added",
                step: 0,
                icon: "fa-envelope"
            },
            {
                label: "Phone",
                value: data.phone || "Not added",
                step: 0,
                icon: "fa-phone"
            },
            {
                label: "Country",
                value: data.country || "Not added",
                step: 0,
                icon: "fa-location-dot"
            },
            {
                label: "Company",
                value: data.companyName || "Not added",
                step: 1,
                icon: "fa-building"
            },
            {
                label: "Industry",
                value: data.industry || "Not added",
                step: 1,
                icon: "fa-layer-group"
            },
            {
                label: "Company Size",
                value: data.companySize || "Not added",
                step: 1,
                icon: "fa-users"
            },
            {
                label: "Services Needed",
                value: data.services.length ? data.services.join(", ") : "Not selected",
                step: 2,
                icon: "fa-screwdriver-wrench"
            },
            {
                label: "Project Title",
                value: data.projectTitle || "Not added",
                step: 3,
                icon: "fa-briefcase"
            },
            {
                label: "Budget",
                value: `${data.currency || ""} ${data.budgetAmount || "0"} ${data.budgetType || ""}`,
                step: 4,
                icon: "fa-wallet"
            },
            {
                label: "Timeline",
                value: data.timeline || "Not added",
                step: 4,
                icon: "fa-clock"
            },
            {
                label: "Experience Level",
                value: data.experienceLevel || "Not added",
                step: 5,
                icon: "fa-star"
            },
            {
                label: "Payment Method",
                value: data.paymentMethod || "Skipped",
                step: 6,
                icon: "fa-credit-card"
            }
        ];

        summaryBox.innerHTML = `
        <div class="summary-head">
            <div>
                <span>CLIENT DATA PREVIEW</span>
                <h4>Review your setup</h4>
            </div>

            <div class="summary-live">
                <i class="fa-solid fa-circle"></i>
                Live
            </div>
        </div>

        <div class="summary-grid">
            ${items.map(item => `
                <div class="summary-item">
                    <div class="summary-icon">
                        <i class="fa-solid ${item.icon}"></i>
                    </div>

                    <div class="summary-info">
                        <small>${item.label}</small>
                        <strong>${item.value}</strong>
                    </div>

                    <button type="button" class="summary-edit-btn" data-step="${item.step}">
                        Edit
                    </button>
                </div>
            `).join("")}
        </div>
    `;

        document.querySelectorAll(".summary-edit-btn").forEach((btn) => {
            btn.addEventListener("click", function () {
                currentStep = Number(this.dataset.step);
                showStep(currentStep);
            });
        });
    }

    async function saveClientSetupData() {
        const data = getFormData();

        const payload = {
            accountType: "client",
            setupCompleted: true,
            setupCompletedAt: new Date().toISOString(),
            user: authUser,
            client: data
        };

        const response = await fetch(`${API_URL}/api/save-client-set-up-data`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to save client setup data");
        }

        return result;
    }

    nextBtn.addEventListener("click", nextStep);
    backBtn.addEventListener("click", backStep);
    skipBtn.addEventListener("click", skipStep);

    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        if (!validateStep(currentStep)) return;

        finishBtn.disabled = true;
        finishBtn.innerHTML = `Saving... <i class="fa-solid fa-spinner fa-spin"></i>`;

        try {
            const result = await saveClientSetupData();

            localStorage.setItem("impactech_client_setup", JSON.stringify(result.clientSetup || getFormData()));

            showToast("Client setup saved successfully!", "success");

            setTimeout(() => {
                window.location.href = "../../iam-client/";
            }, 1200);

        } catch (error) {
            console.error("Save client setup error:", error);
            showToast(error.message || "Failed to save setup. Try again.");

            finishBtn.disabled = false;
            finishBtn.innerHTML = `Finish Setup <i class="fa-solid fa-check"></i>`;
        }
    });

    showStep(currentStep);
}