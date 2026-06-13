const API_URL = "https://backend.impactacademy.site";

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
        window.location.href = "../../../signin/";
        return;
    }

    var userType = (auth.user?.accountType || "").toLowerCase().trim();
    if (userType !== "client") {
        window.location.href = "../../../404.html";
        return;
    }

    initPostJobPage(auth.user);
    console.log("Authenticated user:", auth.user);
});

function initPostJobPage(user) {
    const steps = document.querySelectorAll(".form-step");
    const stepTabs = document.querySelectorAll(".step-tab");

    const backBtn = document.getElementById("backBtn");
    const nextBtn = document.getElementById("nextBtn");
    const publishBtn = document.getElementById("publishBtn");
    const draftBtn = document.getElementById("draftBtn");

    const progressText = document.getElementById("progressText");
    const progressPercent = document.getElementById("progressPercent");
    const progressFill = document.getElementById("progressFill");

    const summaryBox = document.getElementById("summaryBox");
    const paymentTotal = document.getElementById("paymentTotal");
    const heroTotal = document.getElementById("heroTotal");
    const heroPlan = document.getElementById("heroPlan");

    const form = document.getElementById("postJobForm");
    const toast = document.getElementById("toast");
    const pageLoader = document.getElementById("pageLoader");

    let currentStep = 0;

    function showStep(index) {
        currentStep = index;

        steps.forEach((step, i) => {
            step.classList.toggle("active", i === currentStep);
        });

        stepTabs.forEach((tab, i) => {
            tab.classList.toggle("active", i === currentStep);
        });

        const percent = Math.round(((currentStep + 1) / steps.length) * 100);

        progressText.textContent = `Step ${currentStep + 1} of ${steps.length}`;
        progressPercent.textContent = `${percent}%`;
        progressFill.style.width = `${percent}%`;

        backBtn.disabled = currentStep === 0;

        if (currentStep === steps.length - 1) {
            nextBtn.style.display = "none";
            publishBtn.style.display = "inline-flex";
            updateSummary();
        } else {
            nextBtn.style.display = "inline-flex";
            publishBtn.style.display = "none";
        }

        updatePayment();
    }

    function getFormData() {
        const data = new FormData(form);

        const selectedSkills = [...document.querySelectorAll('input[name="skills"]:checked')]
            .map(input => input.value);

        const selectedPlan = document.querySelector('input[name="plan"]:checked');
        const selectedPayment = document.querySelector('input[name="paymentMethod"]:checked');

        return {
            jobTitle: data.get("jobTitle") || "Not added",
            category: data.get("category") || "Not added",
            jobType: data.get("jobType") || "Not added",
            description: data.get("description") || "Not added",
            deliverables: data.get("deliverables") || "Not added",
            skills: selectedSkills.length ? selectedSkills.join(", ") : "No skills selected",
            budgetType: data.get("budgetType") || "Not added",
            budgetAmount: data.get("budgetAmount") || "0",
            currency: data.get("currency") || "USD",
            timeline: data.get("timeline") || "Not added",
            plan: selectedPlan ? selectedPlan.value : "Free Post",
            planPrice: selectedPlan ? Number(selectedPlan.dataset.price) : 0,
            paymentMethod: selectedPayment ? selectedPayment.value : "Card Payment",
            experienceLevel: data.get("experienceLevel") || "Not added",
            locationPreference: data.get("locationPreference") || "Not added",
            communication: data.get("communication") || "Not added",
            proposalLimit: data.get("proposalLimit") || "Unlimited",
        };
    }

    function updatePayment() {
        const selectedPlan = document.querySelector('input[name="plan"]:checked');
        const price = selectedPlan ? Number(selectedPlan.dataset.price) : 0;
        const planName = selectedPlan ? selectedPlan.value : "Free Post";

        paymentTotal.textContent = `$${price}`;
        heroTotal.textContent = `$${price}`;
        heroPlan.textContent = `${planName} selected`;
    }

    function updateSummary() {
        const data = getFormData();

        summaryBox.innerHTML = `
    <h3><i class="fa-solid fa-satellite-dish"></i> Job Summary</h3>

    <div class="summary-item">
      <small>Job Title</small>
      <strong>${escapeHtml(data.jobTitle)}</strong>
    </div>

    <div class="summary-item">
      <small>Category / Type</small>
      <strong>${escapeHtml(data.category)} • ${escapeHtml(data.jobType)}</strong>
    </div>

    <div class="summary-item">
      <small>Description</small>
      <strong>${escapeHtml(data.description)}</strong>
    </div>

    <div class="summary-item">
      <small>Deliverables</small>
      <strong>${escapeHtml(data.deliverables)}</strong>
    </div>

    <div class="summary-item">
      <small>Skills</small>
      <strong>${escapeHtml(data.skills)}</strong>
    </div>

    <div class="summary-item">
      <small>Budget</small>
      <strong>${escapeHtml(data.currency)} ${escapeHtml(data.budgetAmount)} • ${escapeHtml(data.budgetType)}</strong>
    </div>

    <div class="summary-item">
      <small>Timeline</small>
      <strong>${escapeHtml(data.timeline)}</strong>
    </div>

    <div class="summary-item">
  <small>Freelancer Preference</small>
  <strong>
    ${escapeHtml(data.experienceLevel)} • 
    ${escapeHtml(data.locationPreference)} • 
    ${escapeHtml(data.communication)}
  </strong>
</div>

<div class="summary-item">
  <small>Proposal Limit</small>
  <strong>${escapeHtml(data.proposalLimit)}</strong>
</div>

    <div class="summary-item">
      <small>Visibility Plan</small>
      <strong>${escapeHtml(data.plan)} — $${data.planPrice}</strong>
    </div>

    <div class="summary-item">
      <small>Payment Method</small>
      <strong>${escapeHtml(data.paymentMethod)}</strong>
    </div>
  `;
    }

    function validateCurrentStep() {
        const activeStep = steps[currentStep];
        const requiredFields = activeStep.querySelectorAll("[required]");

        for (const field of requiredFields) {
            if (!field.value.trim()) {
                field.focus();
                showToast("Please fill all required fields before continuing.", "error");
                return false;
            }
        }

        return true;
    }

    function showToast(message, type = "success") {
        toast.textContent = message;
        toast.className = `toast show ${type}`;

        setTimeout(() => {
            toast.className = "toast";
        }, 3000);
    }

    function escapeHtml(text) {
        return String(text)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    nextBtn.addEventListener("click", () => {
        if (!validateCurrentStep()) return;

        if (currentStep < steps.length - 1) {
            showStep(currentStep + 1);
        }
    });

    backBtn.addEventListener("click", () => {
        if (currentStep > 0) {
            showStep(currentStep - 1);
        }
    });

    stepTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetStep = Number(tab.dataset.step);

            if (targetStep > currentStep && !validateCurrentStep()) return;

            showStep(targetStep);
        });
    });

    document.querySelectorAll('input[name="plan"]').forEach(input => {
        input.addEventListener("change", () => {
            updatePayment();
            updateSummary();
        });
    });

    document.querySelectorAll('input[name="paymentMethod"]').forEach(input => {
        input.addEventListener("change", updateSummary);
    });

    draftBtn.addEventListener("click", () => {
        const data = getFormData();
        localStorage.setItem("impactech_job_draft", JSON.stringify(data));
        showToast("Job saved as draft successfully.", "success");
    });

    async function saveJobPostData() {
        const data = getFormData();

        const job = {
            jobTitle: data.jobTitle,
            category: data.category,
            jobType: data.jobType,
            description: data.description,
            deliverables: data.deliverables,

            skills: data.skills === "No skills selected"
                ? []
                : data.skills.split(",").map(skill => skill.trim()),

            budgetType: data.budgetType,
            budgetAmount: Number(data.budgetAmount),
            currency: data.currency,
            timeline: data.timeline,
            experienceLevel: data.experienceLevel,
            locationPreference: data.locationPreference,
            communication: data.communication,
            proposalLimit: data.proposalLimit,

            visibilityPlan: data.plan,
            visibilityPrice: data.planPrice,

            paymentMethod: data.paymentMethod
        };

        const response = await fetch(`${API_URL}/api/save-job-post-data`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ job })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to save job post");
        }

        return result;
    }

    const skillSearch = document.getElementById("skillSearch");
    const skillCount = document.getElementById("skillCount");
    const skillCheckboxes = document.querySelectorAll('input[name="skills"]');

    function updateSkillCount() {
        const selected = document.querySelectorAll('input[name="skills"]:checked').length;
        skillCount.textContent = `${selected} skill${selected === 1 ? "" : "s"} selected`;
    }

    skillCheckboxes.forEach(input => {
        input.addEventListener("change", updateSkillCount);
    });

    if (skillSearch) {
        skillSearch.addEventListener("input", () => {
            const searchValue = skillSearch.value.toLowerCase().trim();

            document.querySelectorAll("#skillsGrid label").forEach(label => {
                const text = label.textContent.toLowerCase();
                label.classList.toggle("hidden-skill", !text.includes(searchValue));
            });
        });
    }

    updateSkillCount();

    form.addEventListener("submit", async e => {
        e.preventDefault();

        if (!validateCurrentStep()) return;

        updateSummary();

        try {
            pageLoader.classList.add("show");
            publishBtn.disabled = true;
            publishBtn.innerHTML = `
            Publishing...
            <i class="fa-solid fa-spinner fa-spin"></i>
        `;

            const result = await saveJobPostData();

            pageLoader.classList.remove("show");

            showToast(result.message || "Job saved successfully.", "success");

            console.log("SAVED JOB RESULT:", result);

            setTimeout(() => {
                const jobId = result.jobId || result.jobPost?.jobId;

                if (!jobId) {
                    console.warn("Missing jobId:", result);
                    showToast("Job saved but job ID is missing.", "error");
                    return;
                }

                const paymentRequired =
                    result.paymentRequired === true ||
                    Number(result.amountToPay || 0) > 0;

                if (!paymentRequired) {
                    const modal = document.getElementById("jobReviewModal");

                    if (modal) {
                        modal.classList.add("show");
                    } else {
                        window.location.href = "../client-jobs";
                    }

                    return;
                }

                const paymentMethod = encodeURIComponent(
                    result.paymentMethod ||
                    result.jobPost?.payment?.paymentMethod ||
                    "not_selected"
                );

                window.location.href = `../job-checkout/?Id=${encodeURIComponent(jobId)}&payMeth=${paymentMethod}`;
            }, 1200);

        } catch (error) {
            pageLoader.classList.remove("show");

            publishBtn.disabled = false;
            publishBtn.innerHTML = `
            Publish Job
            <i class="fa-solid fa-check"></i>
        `;

            showToast(error.message || "Failed to save job.", "error");
            console.error("SAVE JOB ERROR:", error);
        }
    });

    showStep(0);
    updatePayment();
}