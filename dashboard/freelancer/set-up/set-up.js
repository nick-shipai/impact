const API_URL = "https://ai-impact-server.vercel.app";
const steps = document.querySelectorAll(".form-step");
const stepTitle = document.getElementById("stepTitle");
const stepDescription = document.getElementById("stepDescription");
const currentStepText = document.getElementById("currentStepText");
const totalStepText = document.getElementById("totalStepText");
const progressPercent = document.getElementById("progressPercent");
const progressFill = document.getElementById("progressFill");
const aiCvText = document.getElementById("aiCvText");
const aiCvLoader = document.getElementById("aiCvLoader");
const setupForm = document.getElementById("freelancerSetupForm");
const reviewScreen = document.getElementById("reviewScreen");
const reviewGrid = document.getElementById("reviewGrid");
const reviewCloseBtn = document.getElementById("reviewCloseBtn");
const reviewEditBtn = document.getElementById("reviewEditBtn");
const saveFreelancerSetupBtn = document.getElementById("saveFreelancerSetupBtn");
const countrySelect = document.getElementById("countrySelect");
const stateSelect = document.getElementById("stateSelect");
const redirectLoader = document.getElementById("redirectLoader");

/* =========================
   AUTHENTICATE USER
========================= */
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

/* =========================
   PAGE START
========================= */
document.addEventListener("DOMContentLoaded", async function () {

    const auth = await AuthenticateUser();

    if (!auth.success) {
        window.location.href = "../../signin.html";
        return;
    }
    console.log("Authenticated user:", auth.user);

    await initFreelancerSetupPage(auth.user);
    await loadCountries();
});

async function loadStatesByCountry(country) {
    if (!stateSelect) return;

    if (!country) {
        stateSelect.disabled = true;
        stateSelect.innerHTML = `<option value="">Select country first</option>`;
        return;
    }

    try {
        stateSelect.disabled = true;
        stateSelect.innerHTML = `<option value="">Loading states...</option>`;

        const response = await fetch(`${API_URL}/api/load-states/${encodeURIComponent(country)}`, {
            method: "GET",
            credentials: "include"
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            stateSelect.innerHTML = `<option value="">Failed to load states</option>`;
            return;
        }

        stateSelect.innerHTML = `<option value="">Select state</option>`;

        data.states.forEach((state) => {
            const option = document.createElement("option");
            option.value = state.name;
            option.textContent = state.name;
            stateSelect.appendChild(option);
        });

        stateSelect.disabled = false;

    } catch (error) {
        console.error("Load states error:", error);
        stateSelect.innerHTML = `<option value="">Network error</option>`;
    }
}

if (countrySelect) {
    countrySelect.addEventListener("change", () => {
        loadStatesByCountry(countrySelect.value);
    });
}
async function initFreelancerSetupPage(user) {
    try {
        const response = await fetch(`${API_URL}/api/load-set-up-user-data`, {
            method: "GET",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            console.error("Load setup user data failed:", data);
            return;
        }

        const fullNameInput = document.querySelector('input[name="fullName"]');
        const emailInput = document.querySelector('input[name="email"]');

        if (fullNameInput) {
            fullNameInput.value = data.user?.fullname || "";
            fullNameInput.readOnly = true;
        }

        if (emailInput) {
            emailInput.value = data.user?.email || "";
            emailInput.readOnly = true;
        }

    } catch (error) {
        console.error("initFreelancerSetupPage error:", error);
    }
}

let cvAnalyzed = false;
let cvAnalyzing = false;

const backBtn = document.getElementById("backBtn");
const nextBtn = document.getElementById("nextBtn");

const cvUpload = document.getElementById("cvUpload");
const fileName = document.getElementById("fileName");

const addExperienceBtn = document.getElementById("addExperienceBtn");
const addSchoolBtn = document.getElementById("addSchoolBtn");
const experienceList = document.getElementById("experienceList");
const schoolList = document.getElementById("schoolList");

let currentStep = 0;

totalStepText.textContent = steps.length;

function updateStep() {
    steps.forEach((step, index) => {
        step.classList.toggle("active", index === currentStep);
    });

    const activeStep = steps[currentStep];

    stepTitle.textContent = activeStep.dataset.title;
    stepDescription.textContent = activeStep.dataset.description;
    currentStepText.textContent = currentStep + 1;

    const percent = Math.round(((currentStep + 1) / steps.length) * 100);
    progressPercent.textContent = `${percent}%`;
    progressFill.style.width = `${percent}%`;

    backBtn.disabled = currentStep === 0;

    nextBtn.innerHTML =
        currentStep === steps.length - 1
            ? `Finish Setup <i class="fa-solid fa-check"></i>`
            : `Next <i class="fa-solid fa-arrow-right"></i>`;
}

nextBtn.addEventListener("click", async () => {
    if (!validateCurrentStep()) return;

    if (currentStep === 1 && cvUpload?.files?.length > 0 && !cvAnalyzed) {
        await uploadCvAndAnalyze();
    }

    if (currentStep < steps.length - 1) {
        currentStep++;
        updateStep();
        return;
    }

    showReviewScreen();
});

backBtn.addEventListener("click", () => {
    if (currentStep > 0) {
        currentStep--;
        updateStep();
    }
});

if (cvUpload) {
    cvUpload.addEventListener("change", () => {
        fileName.textContent =
            cvUpload.files.length > 0 ? cvUpload.files[0].name : "No file selected";
    });
}

function createExperienceCard() {
    const card = document.createElement("div");
    card.className = "dynamic-card";

    card.innerHTML = `
    <div class="dynamic-card-head">
      <button type="button" class="remove-card-btn">
        <i class="fa-solid fa-trash"></i> Remove
      </button>
    </div>

    <div class="form-grid">
      <div class="input-box">
        <label>Job Title</label>
        <input type="text" name="jobTitle[]" placeholder="Frontend Developer">
      </div>

      <div class="input-box">
        <label>Company</label>
        <input type="text" name="company[]" placeholder="Company name">
      </div>

      <div class="input-box">
        <label>Start Date</label>
        <input type="month" name="workStart[]">
      </div>

      <div class="input-box">
        <label>End Date</label>
        <input type="month" name="workEnd[]">
      </div>

      <div class="input-box full">
        <label>Description</label>
        <textarea name="workDescription[]" placeholder="What did you do there?"></textarea>
      </div>
    </div>
  `;

    card.querySelector(".remove-card-btn").addEventListener("click", () => {
        card.remove();
    });

    return card;
}

function createSchoolCard() {
    const card = document.createElement("div");
    card.className = "dynamic-card";

    card.innerHTML = `
    <div class="dynamic-card-head">
      <button type="button" class="remove-card-btn">
        <i class="fa-solid fa-trash"></i> Remove
      </button>
    </div>

    <div class="form-grid">
      <div class="input-box">
        <label>School Name</label>
        <input type="text" name="schoolName[]" placeholder="School / University">
      </div>

      <div class="input-box">
        <label>Course / Degree</label>
        <input type="text" name="course[]" placeholder="Computer Science">
      </div>

      <div class="input-box">
        <label>Start Date</label>
        <input type="month" name="schoolStart[]">
      </div>

      <div class="input-box">
        <label>End Date</label>
        <input type="month" name="schoolEnd[]">
      </div>

      <div class="input-box full">
        <label>Extra Note</label>
        <textarea name="schoolNote[]" placeholder="Certificate, grade, achievement..."></textarea>
      </div>
    </div>
  `;

    card.querySelector(".remove-card-btn").addEventListener("click", () => {
        card.remove();
    });

    return card;
}

addExperienceBtn.addEventListener("click", () => {
    experienceList.appendChild(createExperienceCard());
});

addSchoolBtn.addEventListener("click", () => {
    schoolList.appendChild(createSchoolCard());
});

async function uploadCvAndAnalyze() {
    if (cvAnalyzing) return;

    try {
        cvAnalyzing = true;
        nextBtn.disabled = true;

        if (aiCvText) {
            aiCvText.textContent = "AI is reading your CV, finding skills, work experience, education, and profile details...";
        }

        if (aiCvLoader) {
            aiCvLoader.classList.add("active");
        }

        const formData = new FormData();
        formData.append("cv", cvUpload.files[0]);

        const response = await fetch(`${API_URL}/api/ai-read-freelancer-cv`, {
            method: "POST",
            credentials: "include",
            body: formData
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            console.error("CV AI failed:", data);

            if (aiCvText) {
                aiCvText.textContent = "CV uploaded, but AI could not read it clearly. You can still fill everything manually.";
            }

            return;
        }

        console.log("AI CV DATA:", data);

        fillFormWithAiCv(data.extracted || {});
        cvAnalyzed = true;

        if (aiCvText) {
            aiCvText.textContent = data.aiFoundData
                ? "Done. AI found some details and filled your profile. You can edit anything."
                : "CV uploaded, but AI did not find enough details. You can continue and fill the rest manually.";
        }

    } catch (error) {
        console.error("uploadCvAndAnalyze error:", error);

        if (aiCvText) {
            aiCvText.textContent = "AI could not analyze this CV right now. You can continue and fill your details manually.";
        }

    } finally {
        cvAnalyzing = false;
        nextBtn.disabled = false;

        if (aiCvLoader) {
            aiCvLoader.classList.remove("active");
        }
    }
}

function fillFormWithAiCv(data) {
    fillCheckedValues("category", data.categories || []);
    fillCheckedValues("skills", data.skills || []);

    setInputValue('textarea[name="otherSkills"]', data.otherSkills);
    setInputValue('textarea[name="bio"]', data.bio);
    setSelectValue('select[name="experienceLevel"]', data.experienceLevel);
    setSelectValue('select[name="availability"]', data.availability);
    setInputValue('input[name="portfolio"]', data.portfolio);
    setInputValue('input[name="hourlyRate"]', data.hourlyRate);

    if (Array.isArray(data.workExperience) && data.workExperience.length > 0) {
        experienceList.innerHTML = "";

        data.workExperience.forEach((exp) => {
            const card = createExperienceCard();
            experienceList.appendChild(card);

            card.querySelector('input[name="jobTitle[]"]').value = exp.jobTitle || "";
            card.querySelector('input[name="company[]"]').value = exp.company || "";
            card.querySelector('input[name="workStart[]"]').value = normalizeMonth(exp.startDate);
            card.querySelector('input[name="workEnd[]"]').value = normalizeMonth(exp.endDate);
            card.querySelector('textarea[name="workDescription[]"]').value = exp.description || "";
        });
    }

    if (Array.isArray(data.education) && data.education.length > 0) {
        schoolList.innerHTML = "";

        data.education.forEach((edu) => {
            const card = createSchoolCard();
            schoolList.appendChild(card);

            card.querySelector('input[name="schoolName[]"]').value = edu.schoolName || "";
            card.querySelector('input[name="course[]"]').value = edu.course || "";
            card.querySelector('input[name="schoolStart[]"]').value = normalizeMonth(edu.startDate);
            card.querySelector('input[name="schoolEnd[]"]').value = normalizeMonth(edu.endDate);
            card.querySelector('textarea[name="schoolNote[]"]').value = edu.note || "";
        });
    }
}

function fillCheckedValues(name, values) {
    if (!Array.isArray(values)) return;

    values.forEach((value) => {
        const cleanValue = String(value || "").toLowerCase().trim();

        document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
            const inputValue = String(input.value || "").toLowerCase().trim();

            if (inputValue === cleanValue || inputValue.includes(cleanValue) || cleanValue.includes(inputValue)) {
                input.checked = true;
            }
        });
    });
}

function setInputValue(selector, value) {
    const input = document.querySelector(selector);
    if (input && value) input.value = value;
}

function setSelectValue(selector, value) {
    const select = document.querySelector(selector);
    if (!select || !value) return;

    const cleanValue = String(value).toLowerCase().trim();

    [...select.options].forEach((option) => {
        const optionValue = String(option.value || option.textContent).toLowerCase().trim();

        if (
            optionValue === cleanValue ||
            optionValue.includes(cleanValue) ||
            cleanValue.includes(optionValue)
        ) {
            select.value = option.value;
        }
    });
}

function normalizeMonth(value) {
    if (!value) return "";

    const text = String(value).trim();

    if (/^\d{4}-\d{2}$/.test(text)) return text;

    const match = text.match(/(\d{4})/);
    if (match) return `${match[1]}-01`;

    return "";
}

function showReviewScreen() {
    buildReview();

    setupForm.style.display = "none";
    reviewScreen.classList.add("active");

    stepTitle.textContent = "Final Review";
    stepDescription.textContent = "Check your freelancer profile before saving.";
    progressPercent.textContent = "100%";
    progressFill.style.width = "100%";
}

function hideReviewScreen() {
    reviewScreen.classList.remove("active");
    setupForm.style.display = "block";
    updateStep();
}

function buildReview() {
    const data = getFreelancerSetupData();

    reviewGrid.innerHTML = `
        ${reviewSection("Basic Information", 0, [
        ["Full Name", data.fullName],
        ["Email", data.email],
        ["Date Of Birth", data.dob],
        ["Phone", data.phone],
        ["Country", data.country],
        ["City", data.city],
        ["State", data.state]
    ])}

        ${reviewSection("CV & Job Categories", 1, [
        ["CV File", data.cvFile],
        ["Categories", data.categories.join(", ")]
    ])}

        ${reviewSection("Skills", 3, [
        ["Skills", data.skills.join(", ")],
        ["Other Skills", data.otherSkills]
    ])}

        ${reviewSection("Work Experience", 4, [
        ["Experience", data.workExperienceText]
    ], true)}

        ${reviewSection("Education", 5, [
        ["Education", data.educationText]
    ], true)}

        ${reviewSection("Profile Details", 6, [
        ["Experience Level", data.experienceLevel],
        ["Hourly Rate", data.hourlyRate],
        ["Availability", data.availability],
        ["Portfolio", data.portfolio],
        ["Bio", data.bio]
    ], true)}
    `;

    document.querySelectorAll(".review-edit").forEach((btn) => {
        btn.addEventListener("click", () => {
            const step = Number(btn.dataset.step || 0);
            currentStep = step;
            hideReviewScreen();
            updateStep();
        });
    });
}

function reviewSection(title, step, items, full = false) {
    return `
        <div class="review-section">
            <div class="review-section-head">
                <h3>${title}</h3>
                <button type="button" class="review-edit" data-step="${step}">
                    <i class="fa-solid fa-pen"></i> Edit
                </button>
            </div>

            <div class="review-items">
                ${items.map(([label, value]) => `
                    <div class="review-item ${full ? "full" : ""}">
                        <small>${label}</small>
                        <strong>${escapeHtml(value || "Not added")}</strong>
                    </div>
                `).join("")}
            </div>
        </div>
    `;
}

function getFreelancerSetupData() {
    return {
        fullName: getValue('input[name="fullName"]'),
        email: getValue('input[name="email"]'),
        dob: getValue('input[name="dob"]'),
        phone: getValue('input[name="phone"]'),
        country: getValue('select[name="country"]'),
        city: getValue('input[name="city"]'),
        state: getValue('select[name="state"]'),
        cvFile: cvUpload?.files?.[0]?.name || "No CV uploaded",

        categories: getCheckedValues("category"),
        skills: getCheckedValues("skills"),
        otherSkills: getValue('textarea[name="otherSkills"]'),

        workExperienceText: getWorkExperienceSummary(),
        educationText: getEducationSummary(),

        experienceLevel: getValue('select[name="experienceLevel"]'),
        hourlyRate: getValue('input[name="hourlyRate"]'),
        availability: getValue('select[name="availability"]'),
        portfolio: getValue('input[name="portfolio"]'),
        bio: getValue('textarea[name="bio"]')
    };
}

function getValue(selector) {
    const el = document.querySelector(selector);
    return el ? el.value.trim() : "";
}

function getCheckedValues(name) {
    return [...document.querySelectorAll(`input[name="${name}"]:checked`)]
        .map(input => input.value.trim())
        .filter(Boolean);
}

function getWorkExperienceSummary() {
    const cards = document.querySelectorAll("#experienceList .dynamic-card");

    const result = [...cards].map((card, index) => {
        const title = card.querySelector('input[name="jobTitle[]"]')?.value || "";
        const company = card.querySelector('input[name="company[]"]')?.value || "";
        const start = card.querySelector('input[name="workStart[]"]')?.value || "";
        const end = card.querySelector('input[name="workEnd[]"]')?.value || "";
        const desc = card.querySelector('textarea[name="workDescription[]"]')?.value || "";

        if (!title && !company && !desc) return "";

        return `${index + 1}. ${title || "Untitled Role"} at ${company || "Unknown Company"} (${start || "?"} - ${end || "Present"}) — ${desc || "No description"}`;
    }).filter(Boolean);

    return result.length ? result.join("\n\n") : "Not added";
}

function getEducationSummary() {
    const cards = document.querySelectorAll("#schoolList .dynamic-card");

    const result = [...cards].map((card, index) => {
        const school = card.querySelector('input[name="schoolName[]"]')?.value || "";
        const course = card.querySelector('input[name="course[]"]')?.value || "";
        const start = card.querySelector('input[name="schoolStart[]"]')?.value || "";
        const end = card.querySelector('input[name="schoolEnd[]"]')?.value || "";
        const note = card.querySelector('textarea[name="schoolNote[]"]')?.value || "";

        if (!school && !course && !note) return "";

        return `${index + 1}. ${course || "Course"} at ${school || "School"} (${start || "?"} - ${end || "?"}) — ${note || "No note"}`;
    }).filter(Boolean);

    return result.length ? result.join("\n\n") : "Not added";
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;")
        .replaceAll("\n", "<br>");
}

reviewCloseBtn.addEventListener("click", hideReviewScreen);

reviewEditBtn.addEventListener("click", () => {
    currentStep = 0;
    hideReviewScreen();
});

saveFreelancerSetupBtn.addEventListener("click", async () => {
    await saveFreelancerSetupData();
});

async function saveFreelancerSetupData() {
    clearValidationErrors();

    const freelancer = getFreelancerSetupPayload();
    const errors = validateFreelancerPayload(freelancer);

    if (errors.length > 0) {
        showReviewErrors(errors);
        return;
    }

    try {
        saveFreelancerSetupBtn.disabled = true;
        saveFreelancerSetupBtn.innerHTML = `Saving... <i class="fa-solid fa-spinner fa-spin"></i>`;

        if (redirectLoader) {
            redirectLoader.classList.add("active");
        }

        const response = await fetch(`${API_URL}/api/save-freelancer-set-up-data`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ freelancer })
        });

        const data = await response.json().catch(() => ({}));

        console.log("SAVE FREELANCER RESPONSE:", data);

        if (!response.ok || !data.success) {
            if (redirectLoader) redirectLoader.classList.remove("active");

            saveFreelancerSetupBtn.disabled = false;
            saveFreelancerSetupBtn.innerHTML = `Save Freelancer Setup <i class="fa-solid fa-check"></i>`;

            const serverErrors = Array.isArray(data.errors)
                ? data.errors
                : [data.message || "Failed to save freelancer setup"];

            showReviewErrors(serverErrors);
            return;
        }

        window.location.href = data.redirectUrl || "../freelancer";

    } catch (error) {
        console.error("Save freelancer setup error:", error);

        if (redirectLoader) redirectLoader.classList.remove("active");

        saveFreelancerSetupBtn.disabled = false;
        saveFreelancerSetupBtn.innerHTML = `Save Freelancer Setup <i class="fa-solid fa-check"></i>`;

        showReviewErrors(["Network error. Please check your connection and try again."]);
    }
}
async function loadCountries() {

    if (!countrySelect) return;

    try {
        countrySelect.innerHTML = `<option value="">Loading countries...</option>`;

        const response = await fetch(`${API_URL}/api/load-countries`, {
            method: "GET",
            credentials: "include"
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            countrySelect.innerHTML = `<option value="">Failed to load countries</option>`;
            return;
        }

        countrySelect.innerHTML = `<option value="">Select country</option>`;

        data.countries.forEach((country) => {
            const option = document.createElement("option");
            option.value = country.name;
            option.textContent = country.name;
            countrySelect.appendChild(option);
        });

    } catch (error) {
        console.error("Load countries error:", error);
        countrySelect.innerHTML = `<option value="">Network error</option>`;
    }
}
function getFreelancerSetupPayload() {
    return {
        fullName: getValue('input[name="fullName"]'),
        email: getValue('input[name="email"]'),
        dob: getValue('input[name="dob"]'),
        phone: getValue('input[name="phone"]'),
        country: getValue('select[name="country"]'),
        state: getValue('select[name="state"]'),
        city: getValue('input[name="city"]'),
        cvFile: cvUpload?.files?.[0]?.name || "",

        categories: getCheckedValues("category"),
        skills: getCheckedValues("skills"),
        otherSkills: getValue('textarea[name="otherSkills"]'),

        workExperience: getWorkExperiencePayload(),
        education: getEducationPayload(),

        experienceLevel: getValue('select[name="experienceLevel"]'),
        hourlyRate: getValue('input[name="hourlyRate"]'),
        availability: getValue('select[name="availability"]'),
        portfolio: getValue('input[name="portfolio"]'),
        bio: getValue('textarea[name="bio"]')
    };
}
function getWorkExperiencePayload() {
    const cards = document.querySelectorAll("#experienceList .dynamic-card");

    return [...cards]
        .map((card) => {
            return {
                jobTitle: card.querySelector('input[name="jobTitle[]"]')?.value.trim() || "",
                company: card.querySelector('input[name="company[]"]')?.value.trim() || "",
                startDate: card.querySelector('input[name="workStart[]"]')?.value.trim() || "",
                endDate: card.querySelector('input[name="workEnd[]"]')?.value.trim() || "",
                description: card.querySelector('textarea[name="workDescription[]"]')?.value.trim() || ""
            };
        })
        .filter((item) => {
            return (
                item.jobTitle ||
                item.company ||
                item.startDate ||
                item.endDate ||
                item.description
            );
        });
}

function getEducationPayload() {
    const cards = document.querySelectorAll("#schoolList .dynamic-card");

    return [...cards]
        .map((card) => {
            return {
                schoolName: card.querySelector('input[name="schoolName[]"]')?.value.trim() || "",
                course: card.querySelector('input[name="course[]"]')?.value.trim() || "",
                startDate: card.querySelector('input[name="schoolStart[]"]')?.value.trim() || "",
                endDate: card.querySelector('input[name="schoolEnd[]"]')?.value.trim() || "",
                note: card.querySelector('textarea[name="schoolNote[]"]')?.value.trim() || ""
            };
        })
        .filter((item) => {
            return (
                item.schoolName ||
                item.course ||
                item.startDate ||
                item.endDate ||
                item.note
            );
        });
}

function validateFreelancerPayload(data) {
    const errors = [];

    if (!data.fullName) errors.push("Full name is missing");
    if (!data.email) errors.push("Email is missing");
    if (!data.dob) errors.push("Date of birth is missing");
    if (!data.phone) errors.push("Phone number is missing");
    if (!data.country) errors.push("Country is missing");
    if (!data.state) errors.push("State is missing");
    if (!data.city) errors.push("City is missing");

    if (!Array.isArray(data.categories) || data.categories.length < 1) {
        errors.push("Select at least one job category");
    }

    if (!Array.isArray(data.skills) || data.skills.length < 1) {
        errors.push("Select at least one skill");
    }

    if (!data.experienceLevel) errors.push("Experience level is missing");

    if (!data.hourlyRate || Number(data.hourlyRate) <= 0) {
        errors.push("Valid hourly rate is missing");
    }

    if (!data.availability) errors.push("Availability is missing");
    if (!data.bio) errors.push("Short bio is missing");

    data.workExperience.forEach((item, index) => {
        const hasAny =
            item.jobTitle ||
            item.company ||
            item.startDate ||
            item.endDate ||
            item.description;

        if (!hasAny) return;

        if (!item.jobTitle) errors.push(`Work experience ${index + 1}: job title is missing`);
        if (!item.company) errors.push(`Work experience ${index + 1}: company is missing`);
        if (!item.startDate) errors.push(`Work experience ${index + 1}: start date is missing`);
        if (!item.endDate) errors.push(`Work experience ${index + 1}: end date is missing`);

        // description is optional
    });

    data.education.forEach((item, index) => {
        const hasAny =
            item.schoolName ||
            item.course ||
            item.startDate ||
            item.endDate ||
            item.note;

        if (!hasAny) return;

        if (!item.schoolName) errors.push(`Education ${index + 1}: school name is missing`);
        if (!item.course) errors.push(`Education ${index + 1}: course is missing`);
        if (!item.startDate) errors.push(`Education ${index + 1}: start date is missing`);
        if (!item.endDate) errors.push(`Education ${index + 1}: end date is missing`);

        // note/description is optional
    });

    return errors;
}
function clearValidationErrors() {
    document.querySelectorAll(".field-error").forEach((el) => el.remove());
    document.querySelectorAll(".input-error").forEach((el) => {
        el.classList.remove("input-error");
    });
}

function showFieldError(selector, message) {
    const input = document.querySelector(selector);
    if (!input) return false;

    input.classList.add("input-error");

    const old = input.parentElement.querySelector(".field-error");
    if (old) old.remove();

    const error = document.createElement("div");
    error.className = "field-error";
    error.textContent = message;

    input.parentElement.appendChild(error);
    return true;
}

function validateCurrentStep() {
    clearValidationErrors();

    let valid = true;

    // STEP 1 BASIC INFO
    if (currentStep === 0) {
        if (!getValue('input[name="dob"]')) {
            showFieldError('input[name="dob"]', "Date of birth is required");
            valid = false;
        }

        if (!getValue('input[name="phone"]')) {
            showFieldError('input[name="phone"]', "Phone number is required");
            valid = false;
        }

        if (!getValue('select[name="country"]')) {
            showFieldError('select[name="country"]', "Select country");
            valid = false;
        }

        if (!getValue('select[name="state"]')) {
            showFieldError('select[name="state"]', "Select state");
            valid = false;
        }

        if (!getValue('input[name="city"]')) {
            showFieldError('input[name="city"]', "City is required");
            valid = false;
        }
    }

    // STEP 2 CV
    if (currentStep === 1) {
        if (!cvUpload?.files?.length) {
            showFieldError("#cvUpload", "Upload your CV first");
            valid = false;
        }
    }

    // STEP 3 CATEGORY
    if (currentStep === 2) {
        if (!getCheckedValues("category").length) {
            const box = document.querySelector(".option-grid");
            if (box) {
                box.insertAdjacentHTML(
                    "afterend",
                    `<div class="field-error">Select at least one category</div>`
                );
            }
            valid = false;
        }
    }

    // STEP 4 SKILLS
    if (currentStep === 3) {
        if (!getCheckedValues("skills").length) {
            const box = document.querySelector(".skill-box");
            if (box) {
                box.insertAdjacentHTML(
                    "afterend",
                    `<div class="field-error">Select at least one skill</div>`
                );
            }
            valid = false;
        }
    }

    // STEP 7 PROFILE
    if (currentStep === 6) {
        if (!getValue('select[name="experienceLevel"]')) {
            showFieldError(
                'select[name="experienceLevel"]',
                "Select experience level"
            );
            valid = false;
        }

        if (!getValue('input[name="hourlyRate"]')) {
            showFieldError(
                'input[name="hourlyRate"]',
                "Hourly rate is required"
            );
            valid = false;
        }

        if (!getValue('select[name="availability"]')) {
            showFieldError(
                'select[name="availability"]',
                "Select availability"
            );
            valid = false;
        }

        if (!getValue('textarea[name="bio"]')) {
            showFieldError(
                'textarea[name="bio"]',
                "Short bio is required"
            );
            valid = false;
        }
    }

    return valid;
}
function showReviewErrors(errors) {
    let oldBox = document.querySelector(".review-error-box");
    if (oldBox) oldBox.remove();

    const box = document.createElement("div");
    box.className = "review-error-box";

    box.innerHTML = `
        <div class="review-error-head">
            <i class="fa-solid fa-circle-exclamation"></i>
            <div>
                <h3>Some details are missing</h3>
                <p>Please fix these before saving your freelancer profile.</p>
            </div>
        </div>

        <ul>
            ${errors.map(error => `<li>${escapeHtml(error)}</li>`).join("")}
        </ul>
    `;

    reviewGrid.prepend(box);
    box.scrollIntoView({ behavior: "smooth", block: "start" });
}
updateStep();