const API_URL = "https://ai-impact-server.vercel.app";

let allJobs = [];
let filteredJobs = [];

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
   PAGE LOAD
========================= */
document.addEventListener("DOMContentLoaded", async function () {
  const auth = await AuthenticateUser();

  if (!auth.success) {
    window.location.href = "../../signin";
    return;
  }

  initFindJobs(auth.user);
});

/* =========================
   INIT PAGE
========================= */
function initFindJobs(user) {
  updateProfileAvatar(user);
  bindFilterEvents();
  loadFreelancerJobs();
}

/* =========================
   LOAD JOBS FROM SERVER
========================= */
async function loadFreelancerJobs() {
  showLoadingState();

  try {
    const response = await fetch(`${API_URL}/api/load-freelancer-jobs`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      showErrorState(data.message || "Failed to load jobs from server");
      return;
    }

    allJobs = Array.isArray(data.jobs) ? data.jobs : [];
    filteredJobs = [...allJobs];

    updateAvailableCount(filteredJobs.length);
    renderJobs(filteredJobs);

  } catch (error) {
    console.error("Load freelancer jobs error:", error);
    showErrorState("Network error. Please check your connection and try again.");
  }
}

/* =========================
   PROFILE AVATAR
========================= */
function updateProfileAvatar(user) {
  const profile = document.querySelector(".client-profile");
  if (!profile) return;

  const savedUser = JSON.parse(localStorage.getItem("impactech_user") || "{}");

  const name =
    user?.fullname ||
    savedUser?.fullname ||
    user?.email ||
    savedUser?.email ||
    "F";

  profile.innerHTML = `<span>${String(name).trim().charAt(0).toUpperCase() || "F"}</span>`;
}

/* =========================
   FILTER EVENTS
========================= */
function bindFilterEvents() {
  const searchInput = document.getElementById("jobSearchInput");
  const filterBtn = document.getElementById("filterJobsBtn");
  const categoryFilter = document.getElementById("categoryFilter");
  const budgetFilter = document.getElementById("budgetFilter");
  const experienceFilter = document.getElementById("experienceFilter");
  const sortJobs = document.getElementById("sortJobs");
  const quickFilters = document.querySelectorAll(".quick-filter");

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }

  if (filterBtn) {
    filterBtn.addEventListener("click", applyFilters);
  }

  if (categoryFilter) {
    categoryFilter.addEventListener("change", applyFilters);
  }

  if (budgetFilter) {
    budgetFilter.addEventListener("change", applyFilters);
  }

  if (experienceFilter) {
    experienceFilter.addEventListener("change", applyFilters);
  }

  if (sortJobs) {
    sortJobs.addEventListener("change", applyFilters);
  }

  quickFilters.forEach((filter) => {
    filter.addEventListener("change", applyFilters);
  });
}

/* =========================
   APPLY FILTERS
========================= */
function applyFilters() {
  const searchValue = getValue("jobSearchInput").toLowerCase();
  const categoryValue = getValue("categoryFilter").toLowerCase();
  const budgetValue = getValue("budgetFilter").toLowerCase();
  const experienceValue = getValue("experienceFilter").toLowerCase();
  const sortValue = getValue("sortJobs");

  const checkedQuickFilters = Array.from(document.querySelectorAll(".quick-filter:checked"))
    .map((input) => input.value);

  filteredJobs = allJobs.filter((job) => {
    const title = getJobTitle(job).toLowerCase();
    const category = getJobCategory(job).toLowerCase();
    const description = getJobDescription(job).toLowerCase();
    const skills = getJobSkills(job).join(" ").toLowerCase();
    const budgetType = getBudgetType(job).toLowerCase();
    const experience = getExperienceLevel(job).toLowerCase();
    const location = getLocationPreference(job).toLowerCase();

    const searchMatch =
      !searchValue ||
      title.includes(searchValue) ||
      category.includes(searchValue) ||
      description.includes(searchValue) ||
      skills.includes(searchValue);

    const categoryMatch =
      !categoryValue ||
      category.includes(categoryValue);

    const budgetMatch =
      !budgetValue ||
      budgetType.includes(budgetValue);

    const experienceMatch =
      !experienceValue ||
      experience.includes(experienceValue);

    const quickMatch = checkedQuickFilters.every((filter) => {
      if (filter === "fixed") return budgetType.includes("fixed");
      if (filter === "hourly") return budgetType.includes("hourly");
      if (filter === "beginner") return experience.includes("beginner");
      if (filter === "remote") return location.includes("remote") || location.includes("anywhere") || location.includes("worldwide");
      if (filter === "recent") return isRecentJob(job);
      return true;
    });

    return searchMatch && categoryMatch && budgetMatch && experienceMatch && quickMatch;
  });

  if (sortValue === "highest_budget") {
    filteredJobs.sort((a, b) => getBudgetAmount(b) - getBudgetAmount(a));
  } else if (sortValue === "best_match") {
    filteredJobs.sort((a, b) => getJobSkills(b).length - getJobSkills(a).length);
  } else {
    filteredJobs.sort((a, b) => getPostedAt(b) - getPostedAt(a));
  }

  updateAvailableCount(filteredJobs.length);
  renderJobs(filteredJobs);
}

/* =========================
   RENDER JOBS
========================= */
function renderJobs(jobs) {
  const list = document.getElementById("jobCardList");
  const subtitle = document.getElementById("jobsSubtitle");

  hideLoadingState();

  if (!list) return;

  list.innerHTML = "";

  if (!Array.isArray(jobs) || jobs.length < 1) {
    showEmptyState();

    if (subtitle) {
      subtitle.textContent = allJobs.length
        ? "No jobs match your current filters."
        : "No approved jobs are available right now.";
    }

    return;
  }

  hideEmptyState();

  if (subtitle) {
    subtitle.textContent = `${jobs.length} approved job${jobs.length === 1 ? "" : "s"} available for freelancers.`;
  }

  list.innerHTML = jobs.map((job, index) => {
    let html = createJobCard(job);

    if ((index + 1) % 4 === 0) {
      html += createSponsoredAdCard(index);
    }

    return html;
  }).join("");
}

function createSponsoredAdCard(index = 0) {
  const adId = `adsterra-slot-${index}`;

  setTimeout(() => {
    const container = document.getElementById(adId);

    if (!container || container.dataset.loaded) return;

    container.dataset.loaded = "true";

    const optionsScript = document.createElement("script");

    optionsScript.innerHTML = `
      atOptions = {
        'key' : '1861361b791c986f9a927974e0eef766',
        'format' : 'iframe',
        // make iframe responsive to its container
        'height' : '100%',
        'width' : '100%',
        'params' : {}
      };
    `;

    const invokeScript = document.createElement("script");

    invokeScript.src = "https://www.highperformanceformat.com/1861361b791c986f9a927974e0eef766/invoke.js";
    invokeScript.async = true;

    container.appendChild(optionsScript);
    container.appendChild(invokeScript);

  }, 100);

  return `
    <article class="sponsored-ad-card">

      <div class="sponsored-top">
        <span>
          <i class="fa-solid fa-bullhorn"></i>
          Sponsored
        </span>

        <small>Ad</small>
      </div>

      <div class="sponsored-body">

        <div class="monetag-ad-slot">

          <div 
            id="${adId}" 
            class="adsterra-container"
          ></div>

        </div>

      </div>

    </article>
  `;
}

/* =========================
   CREATE JOB CARD
========================= */
function createJobCard(job) {
  const jobId = job.jobId || "";
  const title = getJobTitle(job);
  const category = getJobCategory(job);
  const description = truncateText(getJobDescription(job), 190);
  const skills = getJobSkills(job).slice(0, 6);
  const budgetAmount = getBudgetAmount(job);
  const budgetType = getBudgetType(job);
  const currency = getCurrency(job);
  const timeline = getTimeline(job);
  const experience = getExperienceLevel(job);
  const postedText = formatPostedDate(getPostedAt(job));

  return `
    <article class="job-card" data-job-id="${escapeHTML(jobId)}">
      <div class="job-card-top">
        <div>
          <span class="job-pill normal">${escapeHTML(category || "Approved Job")}</span>

          <h3>${escapeHTML(title)}</h3>

          <p>${escapeHTML(description)}</p>
        </div>

        <button class="save-btn" type="button" title="Save job">
          <i class="fa-regular fa-bookmark"></i>
        </button>
      </div>

      <div class="job-tags">
        ${skills.length
      ? skills.map((skill) => `<span>${escapeHTML(skill)}</span>`).join("")
      : `<span>No skills listed</span>`
    }
      </div>

      <div class="job-info-grid">
        <div>
          <i class="fa-solid fa-money-bill-wave"></i>
          <strong>${escapeHTML(formatBudget(budgetAmount, currency, budgetType))}</strong>
          <small>${escapeHTML(budgetType || "Budget")}</small>
        </div>

        <div>
          <i class="fa-solid fa-clock"></i>
          <strong>${escapeHTML(timeline || "Not set")}</strong>
          <small>Timeline</small>
        </div>

        <div>
          <i class="fa-solid fa-signal"></i>
          <strong>${escapeHTML(experience || "Any level")}</strong>
          <small>Experience</small>
        </div>
      </div>

      <div class="job-card-footer">
        <span>
          <i class="fa-solid fa-circle-check"></i>
          Approved · ${escapeHTML(postedText)}
        </span>

        <a href="../view-job/?id=${encodeURIComponent(jobId)}" class="apply-btn">
          View Job
          <i class="fa-solid fa-arrow-right"></i>
        </a>
      </div>
    </article>
  `;
}

/* =========================
   STATES
========================= */
function showLoadingState() {
  const loading = document.getElementById("jobsLoadingState");
  const empty = document.getElementById("jobsEmptyState");
  const list = document.getElementById("jobCardList");
  const subtitle = document.getElementById("jobsSubtitle");
  const count = document.getElementById("availableJobsCount");
  const profile = document.querySelector(".client-profile");

  if (loading) {
    loading.style.display = "none";
    loading.classList.remove("active");
  }

  if (empty) {
    empty.style.display = "none";
    empty.classList.remove("active");
  }

  if (count) {
    count.innerHTML = `<span class="skeleton-line short"></span>`;
  }

  if (profile) {
    profile.innerHTML = `<span class="profile-skeleton"></span>`;
  }

  if (list) {
    list.innerHTML = `
      <div class="job-skeleton-list">
        
        <div class="job-skeleton-row">
          <span class="skeleton-pill"></span>

          <div>
            <span class="skeleton-line title"></span>
            <span class="skeleton-line"></span>
            <span class="skeleton-line"></span>
            <span class="skeleton-line small"></span>
          </div>

          <div>
            <span class="skeleton-line title"></span>
            <span class="skeleton-line short"></span>
          </div>

          <div>
            <span class="skeleton-button"></span>
          </div>
        </div>

        <div class="job-skeleton-row">
          <span class="skeleton-pill"></span>

          <div>
            <span class="skeleton-line title"></span>
            <span class="skeleton-line"></span>
            <span class="skeleton-line"></span>
            <span class="skeleton-line small"></span>
          </div>

          <div>
            <span class="skeleton-line title"></span>
            <span class="skeleton-line short"></span>
          </div>

          <div>
            <span class="skeleton-button"></span>
          </div>
        </div>

        <div class="job-skeleton-row">
          <span class="skeleton-pill"></span>

          <div>
            <span class="skeleton-line title"></span>
            <span class="skeleton-line"></span>
            <span class="skeleton-line"></span>
            <span class="skeleton-line small"></span>
          </div>

          <div>
            <span class="skeleton-line title"></span>
            <span class="skeleton-line short"></span>
          </div>

          <div>
            <span class="skeleton-button"></span>
          </div>
        </div>

      </div>
    `;
  }

  if (subtitle) {
    subtitle.textContent = "Loading approved client jobs...";
  }
}

function hideLoadingState() {
  const loading = document.getElementById("jobsLoadingState");

  if (loading) {
    loading.style.display = "none";
    loading.classList.remove("active");
  }
}

function showEmptyState() {
  const empty = document.getElementById("jobsEmptyState");

  if (empty) {
    empty.style.display = "grid";
    empty.classList.add("active");
  }
}

function hideEmptyState() {
  const empty = document.getElementById("jobsEmptyState");

  if (empty) {
    empty.style.display = "none";
    empty.classList.remove("active");
  }
}

function showErrorState(message) {
  hideLoadingState();

  const empty = document.getElementById("jobsEmptyState");
  const subtitle = document.getElementById("jobsSubtitle");
  const list = document.getElementById("jobCardList");

  if (list) {
    list.innerHTML = "";
  }

  if (subtitle) {
    subtitle.textContent = "Something went wrong while loading jobs.";
  }

  if (empty) {
    empty.style.display = "grid";
    empty.classList.add("active");

    empty.innerHTML = `
      <div class="empty-icon error-icon">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>

      <h3>Could not load jobs</h3>

      <p>${escapeHTML(message)}</p>

      <button class="retry-btn" type="button" onclick="loadFreelancerJobs()">
        <i class="fa-solid fa-rotate-right"></i>
        Try Again
      </button>
    `;
  }
}

/* =========================
   HELPERS
========================= */
function updateAvailableCount(count) {
  const countEl = document.getElementById("availableJobsCount");
  if (countEl) countEl.textContent = Number(count || 0);
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || "").trim() : "";
}

function getJobTitle(job) {
  return job?.basic?.jobTitle || job?.jobTitle || job?.title || "Untitled Job";
}

function getJobCategory(job) {
  return job?.basic?.category || job?.category || "General";
}

function getJobDescription(job) {
  return job?.details?.description || job?.description || "No description provided.";
}

function getJobSkills(job) {
  const skills =
    job?.skills?.requiredSkills ||
    job?.requiredSkills ||
    job?.skills ||
    [];

  return Array.isArray(skills) ? skills.filter(Boolean) : [];
}

function getBudgetAmount(job) {
  return Number(job?.budget?.budgetAmount || job?.budgetAmount || job?.amount || 0);
}

function getBudgetType(job) {
  return job?.budget?.budgetType || job?.budgetType || "Fixed Price";
}

function getCurrency(job) {
  return job?.budget?.currency || job?.currency || "USD";
}

function getTimeline(job) {
  return job?.budget?.timeline || job?.timeline || "Not set";
}

function getExperienceLevel(job) {
  return job?.freelancerPreference?.experienceLevel || job?.experienceLevel || "Any level";
}

function getLocationPreference(job) {
  return job?.freelancerPreference?.locationPreference || job?.locationPreference || "";
}

function getPostedAt(job) {
  return Number(job?.status?.postedAt || job?.postedAt || job?.createdAt || 0);
}

function isRecentJob(job) {
  const postedAt = getPostedAt(job);
  if (!postedAt) return false;

  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - postedAt <= sevenDays;
}

function formatBudget(amount, currency, type) {
  const symbol = String(currency || "USD").toUpperCase() === "USD" ? "$" : `${currency} `;

  if (!amount || amount <= 0) {
    return "Not specified";
  }

  if (String(type || "").toLowerCase().includes("hour")) {
    return `${symbol}${amount}/hr`;
  }

  return `${symbol}${Number(amount).toLocaleString()}`;
}

function formatPostedDate(timestamp) {
  if (!timestamp) return "Recently posted";

  const diff = Date.now() - Number(timestamp);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr ago`;
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  return new Date(Number(timestamp)).toLocaleDateString();
}

function truncateText(text, max) {
  const clean = String(text || "").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trim() + "...";
}

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}