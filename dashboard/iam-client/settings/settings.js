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

  initSettingsPage(auth.user);
  console.log("Authenticated user:", auth.user);
});

function initSettingsPage(user) {
  createHiddenPhotoInput();
  bindPhotoUploadButton();
  bindSaveChangesButton();
  loadProfilePhoto(user);
  loadClientSettings();
  initSettingsTabs();
}

async function loadClientSettings() {
  try {
    const response = await fetch(`${API_URL}/api/client/settings`, {
      method: "GET",
      credentials: "include"
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to load settings");
    }

    const profile = data.profile || {};

    document.getElementById("firstNameInput").value = profile.firstname || "";
    document.getElementById("lastNameInput").value = profile.lastname || "";
    document.getElementById("emailInput").value = profile.email || "";
    document.getElementById("phoneInput").value = profile.phone || "";
    document.getElementById("companyInput").value = profile.companyName || "";
    document.getElementById("bioInput").value = profile.bio || "";

  } catch (error) {
    console.error("LOAD SETTINGS ERROR:", error);
    showSettingsToast(error.message || "Failed to load profile details", "error");
  }
}

function bindSaveChangesButton() {
  const saveBtn = document.querySelector(".save-btn");
  if (!saveBtn) return;

  saveBtn.addEventListener("click", async function (e) {
    e.preventDefault();
    await saveClientSettings(saveBtn);
  });
}

async function saveClientSettings(saveBtn) {
  const oldHTML = saveBtn.innerHTML;

  const payload = {
    firstname: document.getElementById("firstNameInput")?.value.trim() || "",
    lastname: document.getElementById("lastNameInput")?.value.trim() || "",
    phone: document.getElementById("phoneInput")?.value.trim() || "",
    companyName: document.getElementById("companyInput")?.value.trim() || "",
    bio: document.getElementById("bioInput")?.value.trim() || ""
  };

  try {
    saveBtn.classList.add("saving");
    saveBtn.innerHTML = `
      <span class="save-roller"></span>
      Saving Changes...
    `;

    const response = await fetch(`${API_URL}/api/client/settings`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to save settings");
    }

    showSettingsToast("Settings saved successfully", "success");
    await loadClientSettings();

  } catch (error) {
    console.error("SAVE SETTINGS ERROR:", error);
    showSettingsToast(error.message || "Failed to save settings", "error");

  } finally {
    saveBtn.classList.remove("saving");
    saveBtn.innerHTML = oldHTML;
  }
}

function createHiddenPhotoInput() {
  if (document.getElementById("profilePhotoInput")) return;

  const input = document.createElement("input");
  input.type = "file";
  input.id = "profilePhotoInput";
  input.accept = "image/png,image/jpeg,image/webp";
  input.hidden = true;

  document.body.appendChild(input);

  input.addEventListener("change", handleProfilePhotoChange);
}

function bindPhotoUploadButton() {
  const buttons = document.querySelectorAll(".outline-btn");

  buttons.forEach((btn) => {
    if (btn.textContent.trim().toLowerCase().includes("change photo")) {
      btn.id = "changePhotoBtn";

      btn.addEventListener("click", function () {
        document.getElementById("profilePhotoInput").click();
      });
    }
  });
}

async function handleProfilePhotoChange(event) {
  const file = event.target.files[0];

  if (!file) return;

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    showSettingsToast("Only JPG, PNG, or WEBP images are allowed", "error");
    event.target.value = "";
    return;
  }

  if (file.size > 1.5 * 1024 * 1024) {
    showSettingsToast("Image must be less than 1.5MB", "error");
    event.target.value = "";
    return;
  }

  const previewUrl = URL.createObjectURL(file);
  updateAllAvatars(previewUrl, "image");

  const btn = document.getElementById("changePhotoBtn");
  const oldText = btn ? btn.innerHTML : "";

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading...`;
    }

    const formData = new FormData();
    formData.append("photo", file);

    const response = await fetch(`${API_URL}/api/upload-profile-photo`, {
      method: "POST",
      credentials: "include",
      body: formData
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to upload photo");
    }

    updateAllAvatars(data.profilePic, "image");
    showSettingsToast("Profile photo updated successfully", "success");

  } catch (error) {
    console.error("PHOTO UPLOAD ERROR:", error);
    showSettingsToast(error.message || "Failed to upload photo", "error");
    loadProfilePhoto();

  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = oldText || "Change Photo";
    }

    event.target.value = "";
    URL.revokeObjectURL(previewUrl);
  }
}

async function loadProfilePhoto(user = {}) {
  try {
    const response = await fetch(`${API_URL}/api/get-user-pic`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const data = await response.json().catch(() => ({}));

    const username =
      data?.username ||
      user?.fullname ||
      user?.firstname ||
      user?.email ||
      "Client";

    updateProfileTexts(username);

    if (response.ok && data.success && data.profilePic) {
      updateAllAvatars(data.profilePic, "image");
      return;
    }

    updateAllAvatars(username.trim().charAt(0).toUpperCase(), "letter");

  } catch (error) {
    console.error("LOAD PROFILE PHOTO ERROR:", error);

    const username =
      user?.fullname ||
      user?.firstname ||
      user?.email ||
      "Client";

    updateProfileTexts(username);
    updateAllAvatars(username.trim().charAt(0).toUpperCase(), "letter");
  }
}

function updateProfileTexts(username) {
  const profileTitle = document.querySelector(".profile-preview h3");
  const profileSubtitle = document.querySelector(".profile-preview p");

  if (profileTitle) profileTitle.textContent = username || "Client Account";
  if (profileSubtitle) profileSubtitle.textContent = "Upload or update your profile photo.";
}

function updateAllAvatars(value, type = "letter") {
  const smallProfile = document.querySelector(".client-profile");
  const bigAvatar = document.querySelector(".avatar-big");

  const cleanValue = String(value || "").trim();

  if (smallProfile) {
    smallProfile.innerHTML = "";

    if (type === "image" && cleanValue) {
      smallProfile.innerHTML = `
        <img 
          src="${cleanValue}" 
          alt="Profile" 
          class="profile-avatar-img"
          onerror="this.remove(); this.parentElement.innerHTML='<span>C</span>';"
        >
      `;
    } else {
      smallProfile.innerHTML = `<span>${escapeHtml(cleanValue || "C")}</span>`;
    }
  }

  if (bigAvatar) {
    bigAvatar.innerHTML = "";

    if (type === "image" && cleanValue) {
      bigAvatar.classList.add("has-image");
      bigAvatar.innerHTML = `
        <img 
          src="${cleanValue}" 
          alt="Profile" 
          class="avatar-big-img"
          onerror="this.remove(); this.parentElement.classList.remove('has-image'); this.parentElement.textContent='C';"
        >
      `;
    } else {
      bigAvatar.classList.remove("has-image");
      bigAvatar.textContent = cleanValue || "C";
    }
  }
}

function showSettingsToast(message, type = "success") {
  const oldToast = document.querySelector(".settings-toast");
  if (oldToast) oldToast.remove();

  const toast = document.createElement("div");
  toast.className = `settings-toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === "success" ? "fa-circle-check" : "fa-triangle-exclamation"}"></i>
    <span>${escapeHtml(message)}</span>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 50);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
const SETTINGS_TABS = [
  "profile",
  "security",
  "notifications",
  "billing",
  "jobs",
  "privacy",
  "appearance",
  "support"
];

function initSettingsTabs() {
  const tabLinks = document.querySelectorAll("[data-settings-tab]");
  const pages = document.querySelectorAll("[data-settings-page]");

  function getHashTab() {
    const hash = window.location.hash.replace("#/", "").trim();
    return SETTINGS_TABS.includes(hash) ? hash : "profile";
  }

  function switchSettingsTab(tabName, updateHash = true) {
    if (!SETTINGS_TABS.includes(tabName)) {
      tabName = "profile";
    }

    tabLinks.forEach((link) => {
      link.classList.toggle("active", link.dataset.settingsTab === tabName);
    });

    pages.forEach((page) => {
      page.classList.toggle("active", page.dataset.settingsPage === tabName);
    });

    if (updateHash) {
      history.replaceState(null, "", `#/${tabName}`);
    }

    const breadcrumbLast = document.querySelector(".breadcrumb p:last-child");
    if (breadcrumbLast) {
      breadcrumbLast.textContent = formatSettingsTitle(tabName);
    }
  }

  tabLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      switchSettingsTab(this.dataset.settingsTab, true);
    });
  });

  window.addEventListener("hashchange", function () {
    switchSettingsTab(getHashTab(), false);
  });

  switchSettingsTab(getHashTab(), false);
}

function formatSettingsTitle(tabName) {
  const titles = {
    profile: "Profile Settings",
    security: "Security",
    notifications: "Notifications",
    billing: "Billing & Payments",
    jobs: "Job Preferences",
    privacy: "Privacy",
    appearance: "Appearance",
    support: "Support"
  };

  return titles[tabName] || "Settings";
}