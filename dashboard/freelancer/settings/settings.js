const API_URL = "https://backend.impactacademy.site";

/* =========================
   AUTHENTICATE USER
========================= */

async function AuthenticateUser() {
  try {
    const response = await fetch(`${API_URL}/api/auth/validate-session`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });

    const data = await response.json().catch(() => ({}));

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
   PAGE LOAD
========================= */

document.addEventListener("DOMContentLoaded", async function () {
  const auth = await AuthenticateUser();

  if (!auth.success) {
    window.location.href = "../../../signin/";
    return;
  }

  var userType = (auth.user?.accountType || "").toLowerCase().trim();
  if (userType !== "freelancer") {
    window.location.href = "../../../404.html";
    return;
  }

  initSettingsPage(auth.user);
});

/* =========================
   STATE
========================= */

let CURRENT_USER    = null;
let SETTINGS_DATA   = null;
let CURRENT_SKILLS  = [];
let ORIGINAL_SETTINGS = {};

/* =========================
   INIT
========================= */

function initSettingsPage(user) {
  CURRENT_USER = user;

  renderTopbarProfile(user);
  bindTabNav();
  bindPasswordToggles();
  bindPasswordStrength();
  bindBioCounter();
  bindSkillInput();
  bindAvatarInput();
  bindDeleteConfirm();
  bind2FAToggle();

  loadSettings();
}

/* =========================
   LOAD ALL SETTINGS (GET)
========================= */

async function loadSettings() {
  try {
    const response = await fetch(`${API_URL}/api/freelancer/settings`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      showToast(data.message || "Failed to load settings", "error");
      return;
    }

    SETTINGS_DATA = data.data;
    ORIGINAL_SETTINGS = JSON.parse(JSON.stringify(data.data));

    populateProfile(data.data.profile);
    populateAccount(data.data.account);
    populateNotifications(data.data.notifications);
    populatePayment(data.data.payoutMethods, data.data.payoutPreferences);
    populatePrivacy(data.data.privacy);
    populateHeroStats(data.data);

  } catch (error) {
    console.error("loadSettings error:", error);
    showToast("Network error loading settings", "error");
  }
}

/* =========================
   POPULATE — HERO STATS
========================= */

function populateHeroStats(data) {
  const pct = data.profileComplete || 0;

  const statProfile = document.getElementById("statProfileComplete");
  const statSecure  = document.getElementById("statAccountSecure");
  const statAlerts  = document.getElementById("statAlertsActive");

  if (statProfile) statProfile.textContent = pct + "%";
  if (statSecure)  statSecure.textContent  = data.accountSecure ? "Yes" : "No";
  if (statAlerts)  statAlerts.textContent  = data.alertsActive || 0;

  updateProfileRing(pct);
}

function updateProfileRing(pct) {
  const bar  = document.getElementById("profileRingBar");
  const label = document.getElementById("profileRingPct");

  if (bar)   bar.setAttribute("stroke-dasharray", `${pct} ${100 - pct}`);
  if (label) label.textContent = pct + "%";
}

/* =========================
   POPULATE — PROFILE
========================= */

function populateProfile(profile) {
  if (!profile) return;

  const nameParts = (profile.firstName || "").split(" ");

  setValue("fieldFirstName",  profile.firstName  || "");
  setValue("fieldLastName",   profile.lastName   || "");
  setValue("fieldTitle",      profile.title      || "");
  setValue("fieldHourlyRate", profile.hourlyRate || "");
  setValue("fieldLocation",   profile.location   || "");
  setValue("fieldBio",        profile.bio        || "");
  setValue("fieldWebsite",    profile.links?.website   || "");
  setValue("fieldGithub",     profile.links?.github    || "");
  setValue("fieldLinkedin",   profile.links?.linkedin  || "");
  setValue("fieldPortfolio",  profile.links?.portfolio || "");

  updateBioCount();

  CURRENT_SKILLS = Array.isArray(profile.skills) ? [...profile.skills] : [];
  renderSkills();

  renderAvatarPreview(profile.photoURL || "");

  document.getElementById("saveProfileBtn")?.addEventListener("click", saveProfile);
  document.getElementById("discardProfileBtn")?.addEventListener("click", () => {
    populateProfile(ORIGINAL_SETTINGS.profile);
    showToast("Changes discarded", "info");
  });

  document.getElementById("removeAvatarBtn")?.addEventListener("click", removeAvatar);
}

/* =========================
   POPULATE — ACCOUNT
========================= */

function populateAccount(account) {
  if (!account) return;

  const emailEl   = document.getElementById("fieldCurrentEmail");
  const badgeEl   = document.getElementById("emailVerifiedBadge");
  const twoFaEl   = document.getElementById("twoFaToggle");
  const methodEls = document.querySelectorAll("input[name='twofa']");

  if (emailEl)  emailEl.value   = account.email || "";
  if (badgeEl)  badgeEl.style.display = account.emailVerified ? "inline-flex" : "none";
  if (twoFaEl)  twoFaEl.checked = !!account.twoFaEnabled;

  methodEls.forEach(el => {
    el.checked = el.value === (account.twoFaMethod || "app");
  });

  renderSessions(account.activeSessions || []);

  document.getElementById("updateEmailBtn")?.addEventListener("click", updateEmail);
  document.getElementById("updatePasswordBtn")?.addEventListener("click", updatePassword);
  document.getElementById("revokeAllBtn")?.addEventListener("click", revokeAllSessions);

  toggleTwoFaOptions(!!account.twoFaEnabled);
}

/* =========================
   POPULATE — NOTIFICATIONS
========================= */

function populateNotifications(notifs) {
  if (!notifs) return;

  const keys = [
    "notifJobMatches", "notifContracts", "notifPayment", "notifMessages",
    "notifProfileViews", "notifWeeklyReport", "notifNews",
    "pushMessages", "pushBidStatus", "pushPayment"
  ];

  keys.forEach(key => {
    const el = document.getElementById(key);
    if (el) el.checked = !!notifs[key];
  });

  const freq = document.getElementById("digestFrequency");
  if (freq) freq.value = notifs.digestFrequency || "daily";

  document.getElementById("saveNotifBtn")?.addEventListener("click", saveNotifications);
  document.getElementById("resetNotifBtn")?.addEventListener("click", () => {
    populateNotifications(ORIGINAL_SETTINGS.notifications);
    showToast("Notifications reset to saved values", "info");
  });
}

/* =========================
   POPULATE — PAYMENT
========================= */

function populatePayment(methods, prefs) {
  renderPayoutMethods(methods || []);

  if (prefs) {
    setValue("fieldPayoutSchedule", prefs.schedule  || "biweekly");
    setValue("fieldMinPayout",      prefs.minPayout || "");
    setValue("fieldCurrency",       prefs.currency  || "USD");
  }

  document.getElementById("addMethodBtn")?.addEventListener("click", openAddMethodModal);
  document.getElementById("savePaymentBtn")?.addEventListener("click", savePayoutPreferences);
  document.getElementById("discardPaymentBtn")?.addEventListener("click", () => {
    populatePayment(ORIGINAL_SETTINGS.payoutMethods, ORIGINAL_SETTINGS.payoutPreferences);
    showToast("Changes discarded", "info");
  });
}

/* =========================
   POPULATE — PRIVACY
========================= */

function populatePrivacy(privacy) {
  if (!privacy) return;

  const vis = document.querySelector(`input[name="visibility"][value="${privacy.visibility || "public"}"]`);
  if (vis) vis.checked = true;

  const toggles = {
    privShowRate:     privacy.showRate,
    privShowEarnings: privacy.showEarnings,
    privShowOnline:   privacy.showOnline,
    privSearchable:   privacy.searchable,
    privDirectMsg:    privacy.allowDirectMsg
  };

  Object.entries(toggles).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  });

  document.getElementById("savePrivacyBtn")?.addEventListener("click", savePrivacy);
  document.getElementById("discardPrivacyBtn")?.addEventListener("click", () => {
    populatePrivacy(ORIGINAL_SETTINGS.privacy);
    showToast("Changes discarded", "info");
  });
  document.getElementById("exportDataBtn")?.addEventListener("click", () => {
    showToast("Data export request submitted. You'll receive an email within 48 hours.", "success");
  });

  bindDangerZone();
}

/* =========================
   TOPBAR PROFILE
========================= */

function renderTopbarProfile(user) {
  const el = document.getElementById("profileInitial");
  if (!el) return;

  const photo = user?.profile?.photoURL || user?.photoURL || "";
  const name  = user?.profile?.fullname || user?.fullname || "U";

  if (photo) {
    el.innerHTML = `<img src="${escHTML(photo)}" alt="${escHTML(name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    el.classList.add("has-image");
  } else {
    el.innerHTML = `<span>${getInitials(name)}</span>`;
    el.classList.remove("has-image");
  }
}

/* =========================
   AVATAR
========================= */

function bindAvatarInput() {
  const input = document.getElementById("avatarInput");
  if (!input) return;

  input.addEventListener("change", async function () {
    const file = this.files[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      showToast("Only JPG, PNG or WEBP images are allowed", "error");
      return;
    }

    if (file.size > 1.5 * 1024 * 1024) {
      showToast("Image must be under 1.5 MB", "error");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    renderAvatarPreview(previewUrl);

    const formData = new FormData();
    formData.append("avatar", file);

    const btn = document.querySelector("label[for='avatarInput']");
    if (btn) { btn.style.opacity = "0.6"; btn.style.pointerEvents = "none"; }

    try {
      const response = await fetch(`${API_URL}/api/freelancer/settings/avatar`, {
        method: "POST",
        credentials: "include",
        body: formData
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        showToast(data.message || "Failed to upload photo", "error");
        return;
      }

      showToast("Profile photo updated", "success");
      renderAvatarPreview(data.photoURL);
      renderTopbarProfile({ profile: { photoURL: data.photoURL, fullname: CURRENT_USER?.profile?.fullname || "" } });

    } catch (error) {
      console.error("avatar upload error:", error);
      showToast("Network error uploading photo", "error");
    } finally {
      if (btn) { btn.style.opacity = ""; btn.style.pointerEvents = ""; }
      this.value = "";
    }
  });
}

async function removeAvatar() {
  if (!confirm("Remove your profile photo?")) return;

  try {
    const response = await fetch(`${API_URL}/api/freelancer/settings/avatar`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      showToast(data.message || "Failed to remove photo", "error");
      return;
    }

    renderAvatarPreview("");
    showToast("Profile photo removed", "success");

  } catch (error) {
    console.error("removeAvatar error:", error);
    showToast("Network error", "error");
  }
}

function renderAvatarPreview(url) {
  const el = document.getElementById("avatarPreview");
  if (!el) return;

  if (url) {
    el.innerHTML = `<img src="${escHTML(url)}" alt="Profile photo" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
  } else {
    el.innerHTML = `<i class="fa-solid fa-user"></i>`;
  }
}

/* =========================
   SAVE PROFILE
========================= */

async function saveProfile() {
  const btn = document.getElementById("saveProfileBtn");
  setBtnLoading(btn, true, "Saving…");

  const body = {
    firstName:  val("fieldFirstName"),
    lastName:   val("fieldLastName"),
    title:      val("fieldTitle"),
    hourlyRate: val("fieldHourlyRate"),
    location:   val("fieldLocation"),
    bio:        val("fieldBio"),
    website:    val("fieldWebsite"),
    github:     val("fieldGithub"),
    linkedin:   val("fieldLinkedin"),
    portfolio:  val("fieldPortfolio")
  };

  if (!body.firstName && !body.lastName) {
    showToast("First or last name is required", "error");
    setBtnLoading(btn, false, '<i class="fa-solid fa-floppy-disk"></i> Save Profile');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/freelancer/settings/profile`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      showToast(data.message || "Failed to save profile", "error");
      return;
    }

    showToast("Profile saved successfully", "success");
    ORIGINAL_SETTINGS.profile = { ...ORIGINAL_SETTINGS.profile, ...body };
    await saveSkills();

  } catch (error) {
    console.error("saveProfile error:", error);
    showToast("Network error", "error");
  } finally {
    setBtnLoading(btn, false, '<i class="fa-solid fa-floppy-disk"></i> Save Profile');
  }
}

/* =========================
   SKILLS
========================= */

function bindSkillInput() {
  const input = document.getElementById("skillInput");
  if (!input) return;

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      const skill = this.value.trim();
      if (!skill) return;

      if (CURRENT_SKILLS.length >= 15) {
        showToast("Maximum 15 skills allowed", "error");
        return;
      }

      if (CURRENT_SKILLS.map(s => s.toLowerCase()).includes(skill.toLowerCase())) {
        showToast("Skill already added", "error");
        return;
      }

      CURRENT_SKILLS.push(skill);
      renderSkills();
      this.value = "";
    }
  });
}

function renderSkills() {
  const list = document.getElementById("skillsList");
  if (!list) return;

  if (!CURRENT_SKILLS.length) {
    list.innerHTML = `<p style="color:var(--muted);font-size:13px;">No skills added yet. Type a skill above and press Enter.</p>`;
    return;
  }

  list.innerHTML = CURRENT_SKILLS.map((skill, i) => `
    <span class="skill-tag">
      ${escHTML(skill)}
      <button type="button" class="skill-remove" onclick="removeSkill(${i})" aria-label="Remove ${escHTML(skill)}">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </span>
  `).join("");
}

function removeSkill(index) {
  CURRENT_SKILLS.splice(index, 1);
  renderSkills();
}

async function saveSkills() {
  if (!CURRENT_SKILLS.length) return;

  try {
    const response = await fetch(`${API_URL}/api/freelancer/settings/skills`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skills: CURRENT_SKILLS })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      showToast(data.message || "Skills not saved", "error");
    }
  } catch (error) {
    console.error("saveSkills error:", error);
  }
}

/* =========================
   BIO COUNTER
========================= */

function bindBioCounter() {
  const bio = document.getElementById("fieldBio");
  if (!bio) return;
  bio.addEventListener("input", updateBioCount);
}

function updateBioCount() {
  const bio   = document.getElementById("fieldBio");
  const count = document.getElementById("bioCount");
  if (bio && count) count.textContent = bio.value.length;
}

/* =========================
   UPDATE EMAIL
========================= */

async function updateEmail() {
  const newEmail = val("fieldNewEmail");

  if (!newEmail || !/^\S+@\S+\.\S+$/.test(newEmail)) {
    showToast("Enter a valid new email address", "error");
    return;
  }

  const btn = document.getElementById("updateEmailBtn");
  setBtnLoading(btn, true, "Sending…");

  try {
    const response = await fetch(`${API_URL}/api/freelancer/settings/email`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      showToast(data.message || "Failed to update email", "error");
      return;
    }

    showToast(data.message || "Verification email sent. Check your new inbox.", "success");
    setValue("fieldNewEmail", "");

  } catch (error) {
    console.error("updateEmail error:", error);
    showToast("Network error", "error");
  } finally {
    setBtnLoading(btn, false, '<i class="fa-solid fa-envelope"></i> Update Email');
  }
}

/* =========================
   CHANGE PASSWORD
========================= */

function bindPasswordStrength() {
  const input = document.getElementById("fieldNewPass");
  if (!input) return;

  input.addEventListener("input", function () {
    const strength = measurePasswordStrength(this.value);
    renderStrengthBars(strength);
  });
}

function measurePasswordStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

function renderStrengthBars(score) {
  const bars  = document.querySelectorAll(".strength-bars span");
  const label = document.getElementById("strengthLabel");
  const levels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "#ef4444", "#f59e0b", "#3b82f6", "#16a34a"];

  bars.forEach((bar, i) => {
    bar.style.background = i < score ? colors[score] : "#e2e8f0";
  });

  if (label) {
    label.textContent = score === 0 ? "Enter a password" : levels[score];
    label.style.color = colors[score] || "var(--muted)";
  }
}

async function updatePassword() {
  const currentPassword = val("fieldCurrentPass");
  const newPassword     = val("fieldNewPass");
  const confirmPassword = val("fieldConfirmPass");

  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast("All password fields are required", "error");
    return;
  }

  if (newPassword.length < 8) {
    showToast("New password must be at least 8 characters", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast("New passwords do not match", "error");
    return;
  }

  const btn = document.getElementById("updatePasswordBtn");
  setBtnLoading(btn, true, "Updating…");

  try {
    const response = await fetch(`${API_URL}/api/freelancer/settings/password`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      showToast(data.message || "Failed to update password", "error");
      return;
    }

    showToast("Password updated successfully", "success");
    setValue("fieldCurrentPass", "");
    setValue("fieldNewPass", "");
    setValue("fieldConfirmPass", "");
    renderStrengthBars(0);

  } catch (error) {
    console.error("updatePassword error:", error);
    showToast("Network error", "error");
  } finally {
    setBtnLoading(btn, false, '<i class="fa-solid fa-key"></i> Update Password');
  }
}

/* =========================
   PASSWORD SHOW/HIDE
========================= */

function bindPasswordToggles() {
  document.querySelectorAll(".toggle-pass").forEach(btn => {
    btn.addEventListener("click", function () {
      const input = this.parentElement.querySelector("input");
      if (!input) return;

      const isPass = input.type === "password";
      input.type   = isPass ? "text" : "password";
      const icon   = this.querySelector("i");
      if (icon) {
        icon.className = isPass ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
      }
    });
  });
}

/* =========================
   TWO-FACTOR AUTH
========================= */

function bind2FAToggle() {
  const toggle = document.getElementById("twoFaToggle");
  if (!toggle) return;

  toggle.addEventListener("change", function () {
    toggleTwoFaOptions(this.checked);
    save2FA(this.checked);
  });

  document.querySelectorAll("input[name='twofa']").forEach(radio => {
    radio.addEventListener("change", function () {
      if (document.getElementById("twoFaToggle")?.checked) {
        save2FA(true);
      }
    });
  });
}

function toggleTwoFaOptions(enabled) {
  const options = document.querySelector(".twofa-options");
  if (options) options.style.opacity = enabled ? "1" : "0.4";
}

async function save2FA(enabled) {
  const method = document.querySelector("input[name='twofa']:checked")?.value || "app";

  try {
    const response = await fetch(`${API_URL}/api/freelancer/settings/2fa`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, method })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      showToast(data.message || "Failed to update 2FA", "error");
      return;
    }

    showToast(data.message || (enabled ? "2FA enabled" : "2FA disabled"), "success");

  } catch (error) {
    console.error("save2FA error:", error);
    showToast("Network error", "error");
  }
}

/* =========================
   SESSIONS
========================= */

function renderSessions(sessions) {
  const list = document.getElementById("sessionList");
  if (!list) return;

  if (!sessions.length) {
    list.innerHTML = `<p style="color:var(--muted);font-size:13px;">No active sessions found.</p>`;
    return;
  }

  list.innerHTML = sessions.map(s => `
    <div class="session-item">
      <div class="session-icon">
        <i class="fa-solid fa-${/mobile|android|iphone/i.test(s.userAgent) ? "mobile-screen-button" : "laptop"}"></i>
      </div>
      <div class="session-info">
        <strong>${escHTML(formatUserAgent(s.userAgent))}</strong>
        <small>IP: ${escHTML(s.ip || "Unknown")} · ${s.createdAtISO ? formatDate(s.createdAtISO) : "Unknown time"}</small>
      </div>
      ${s.isCurrent
        ? `<span class="session-current-badge">Current</span>`
        : `<button class="btn-ghost-sm" onclick="revokeSession('${escHTML(s.sessionHash)}')">
             <i class="fa-solid fa-xmark"></i> Revoke
           </button>`
      }
    </div>
  `).join("");
}

async function revokeSession(sessionHash) {
  if (!confirm("Sign out this device?")) return;

  try {
    const response = await fetch(`${API_URL}/api/freelancer/settings/sessions/${encodeURIComponent(sessionHash)}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      showToast(data.message || "Could not revoke session", "error");
      return;
    }

    showToast("Device signed out", "success");
    await loadSettings();

  } catch (error) {
    console.error("revokeSession error:", error);
    showToast("Network error", "error");
  }
}

async function revokeAllSessions() {
  if (!confirm("Sign out all other devices? You will stay logged in here.")) return;

  const btn = document.getElementById("revokeAllBtn");
  setBtnLoading(btn, true, "Signing out…");

  try {
    const response = await fetch(`${API_URL}/api/freelancer/settings/sessions`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      showToast(data.message || "Failed to sign out devices", "error");
      return;
    }

    showToast(data.message || "All other devices signed out", "success");
    await loadSettings();

  } catch (error) {
    console.error("revokeAllSessions error:", error);
    showToast("Network error", "error");
  } finally {
    setBtnLoading(btn, false, '<i class="fa-solid fa-right-from-bracket"></i> Sign Out All Other Devices');
  }
}

/* =========================
   NOTIFICATIONS
========================= */

async function saveNotifications() {
  const btn = document.getElementById("saveNotifBtn");
  setBtnLoading(btn, true, "Saving…");

  const body = {
    notifJobMatches:   checked("notifJobMatches"),
    notifContracts:    checked("notifContracts"),
    notifPayment:      checked("notifPayment"),
    notifMessages:     checked("notifMessages"),
    notifProfileViews: checked("notifProfileViews"),
    notifWeeklyReport: checked("notifWeeklyReport"),
    notifNews:         checked("notifNews"),
    pushMessages:      checked("pushMessages"),
    pushBidStatus:     checked("pushBidStatus"),
    pushPayment:       checked("pushPayment"),
    digestFrequency:   val("digestFrequency")
  };

  try {
    const response = await fetch(`${API_URL}/api/freelancer/settings/notifications`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      showToast(data.message || "Failed to save notifications", "error");
      return;
    }

    ORIGINAL_SETTINGS.notifications = { ...body };
    showToast("Notification preferences saved", "success");

  } catch (error) {
    console.error("saveNotifications error:", error);
    showToast("Network error", "error");
  } finally {
    setBtnLoading(btn, false, '<i class="fa-solid fa-floppy-disk"></i> Save Preferences');
  }
}

/* =========================
   PAYOUT METHODS
========================= */

function renderPayoutMethods(methods) {
  const list = document.getElementById("payoutMethodsList");
  if (!list) return;

  if (!methods.length) {
    list.innerHTML = `
      <div class="empty-payout">
        <i class="fa-solid fa-wallet"></i>
        <p>No payout methods added yet. Add one to receive your earnings.</p>
      </div>`;
    return;
  }

  list.innerHTML = methods.map(m => `
    <div class="payout-method-item ${m.isDefault ? "is-default" : ""}" data-method-id="${escHTML(m.id || m.methodId)}">
      <div class="payout-method-icon">
        <i class="fa-solid fa-${m.type === "paypal" ? "paypal fa-brands" : m.type === "crypto" ? "coins" : "building-columns"}"></i>
      </div>
      <div class="payout-method-info">
        <strong>${escHTML(m.label)}</strong>
        <small>${escHTML(m.accountDetail)}</small>
      </div>
      <div class="payout-method-actions">
        ${m.isDefault
          ? `<span class="default-badge"><i class="fa-solid fa-star"></i> Default</span>`
          : `<button class="btn-ghost-sm" onclick="setDefaultMethod('${escHTML(m.id || m.methodId)}')">Set Default</button>`
        }
        <button class="btn-ghost-sm danger" onclick="deleteMethod('${escHTML(m.id || m.methodId)}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `).join("");
}

async function setDefaultMethod(methodId) {
  try {
    const response = await fetch(`${API_URL}/api/freelancer/settings/payment-methods/${encodeURIComponent(methodId)}/default`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      showToast(data.message || "Failed to update default method", "error");
      return;
    }

    showToast("Default payout method updated", "success");
    await loadSettings();

  } catch (error) {
    console.error("setDefaultMethod error:", error);
    showToast("Network error", "error");
  }
}

async function deleteMethod(methodId) {
  if (!confirm("Remove this payout method?")) return;

  try {
    const response = await fetch(`${API_URL}/api/freelancer/settings/payment-methods/${encodeURIComponent(methodId)}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      showToast(data.message || "Failed to remove method", "error");
      return;
    }

    showToast("Payout method removed", "success");
    await loadSettings();

  } catch (error) {
    console.error("deleteMethod error:", error);
    showToast("Network error", "error");
  }
}

/* =========================
   ADD METHOD MODAL
========================= */

function openAddMethodModal() {
  const existing = document.getElementById("addMethodModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "addMethodModal";
  modal.className = "settings-modal-overlay";
  modal.innerHTML = `
    <div class="settings-modal">
      <div class="settings-modal-header">
        <h3><i class="fa-solid fa-wallet"></i> Add Payout Method</h3>
        <button class="modal-close-btn" onclick="closeAddMethodModal()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="settings-modal-body">
        <div class="form-group">
          <label>Method Type</label>
          <div class="input-wrap">
            <i class="fa-solid fa-layer-group"></i>
            <select id="newMethodType">
              <option value="paypal">PayPal</option>
              <option value="bank">Bank Transfer</option>
              <option value="crypto">Cryptocurrency</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Label / Nickname</label>
          <div class="input-wrap">
            <i class="fa-solid fa-tag"></i>
            <input type="text" id="newMethodLabel" placeholder="e.g. My PayPal, Main Bank" />
          </div>
        </div>
        <div class="form-group">
          <label>Account Detail (email / account number / wallet address)</label>
          <div class="input-wrap">
            <i class="fa-solid fa-id-card"></i>
            <input type="text" id="newMethodDetail" placeholder="Enter your account info" />
          </div>
        </div>
      </div>
      <div class="settings-modal-footer">
        <button class="btn-ghost" onclick="closeAddMethodModal()">Cancel</button>
        <button class="post-job-btn" id="submitAddMethodBtn" onclick="submitAddMethod()">
          <i class="fa-solid fa-plus"></i> Add Method
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener("click", function (e) {
    if (e.target === modal) closeAddMethodModal();
  });
}

function closeAddMethodModal() {
  document.getElementById("addMethodModal")?.remove();
}

async function submitAddMethod() {
  const type          = val("newMethodType");
  const label         = val("newMethodLabel");
  const accountDetail = val("newMethodDetail");

  if (!label)         { showToast("Label is required", "error"); return; }
  if (!accountDetail) { showToast("Account detail is required", "error"); return; }

  const btn = document.getElementById("submitAddMethodBtn");
  setBtnLoading(btn, true, "Adding…");

  try {
    const response = await fetch(`${API_URL}/api/freelancer/settings/payment-methods`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, label, accountDetail })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      showToast(data.message || "Failed to add method", "error");
      setBtnLoading(btn, false, '<i class="fa-solid fa-plus"></i> Add Method');
      return;
    }

    showToast("Payout method added", "success");
    closeAddMethodModal();
    await loadSettings();

  } catch (error) {
    console.error("submitAddMethod error:", error);
    showToast("Network error", "error");
    setBtnLoading(btn, false, '<i class="fa-solid fa-plus"></i> Add Method');
  }
}

/* =========================
   PAYOUT PREFERENCES
========================= */

async function savePayoutPreferences() {
  const btn = document.getElementById("savePaymentBtn");
  setBtnLoading(btn, true, "Saving…");

  const body = {
    schedule:  val("fieldPayoutSchedule"),
    minPayout: val("fieldMinPayout"),
    currency:  val("fieldCurrency")
  };

  try {
    const response = await fetch(`${API_URL}/api/freelancer/settings/payout-preferences`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      showToast(data.message || "Failed to save preferences", "error");
      return;
    }

    showToast("Payout preferences saved", "success");
    ORIGINAL_SETTINGS.payoutPreferences = { ...body };

  } catch (error) {
    console.error("savePayoutPreferences error:", error);
    showToast("Network error", "error");
  } finally {
    setBtnLoading(btn, false, '<i class="fa-solid fa-floppy-disk"></i> Save Preferences');
  }
}

/* =========================
   PRIVACY
========================= */

async function savePrivacy() {
  const btn = document.getElementById("savePrivacyBtn");
  setBtnLoading(btn, true, "Saving…");

  const body = {
    visibility:     document.querySelector("input[name='visibility']:checked")?.value || "public",
    showRate:       checked("privShowRate"),
    showEarnings:   checked("privShowEarnings"),
    showOnline:     checked("privShowOnline"),
    searchable:     checked("privSearchable"),
    allowDirectMsg: checked("privDirectMsg")
  };

  try {
    const response = await fetch(`${API_URL}/api/freelancer/settings/privacy`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      showToast(data.message || "Failed to save privacy settings", "error");
      return;
    }

    showToast("Privacy settings saved", "success");
    ORIGINAL_SETTINGS.privacy = { ...body };

  } catch (error) {
    console.error("savePrivacy error:", error);
    showToast("Network error", "error");
  } finally {
    setBtnLoading(btn, false, '<i class="fa-solid fa-floppy-disk"></i> Save Privacy Settings');
  }
}

/* =========================
   DANGER ZONE
========================= */

function bindDangerZone() {
  const pauseBtn = document.getElementById("pauseAccountBtn");
  if (pauseBtn) pauseBtn.addEventListener("click", togglePauseAccount);

  const deleteConfirmInput = document.getElementById("deleteConfirm");
  const deleteBtn          = document.getElementById("deleteAccountBtn");

  if (deleteConfirmInput && deleteBtn) {
    deleteConfirmInput.addEventListener("input", function () {
      deleteBtn.disabled = this.value.toUpperCase() !== "DELETE";
    });

    deleteBtn.addEventListener("click", deleteAccount);
  }
}

function bindDeleteConfirm() {
  const input = document.getElementById("deleteConfirm");
  const btn   = document.getElementById("deleteAccountBtn");
  if (input && btn) {
    input.addEventListener("input", function () {
      btn.disabled = this.value.toUpperCase() !== "DELETE";
    });
  }
}

async function togglePauseAccount() {
  const btn = document.getElementById("pauseAccountBtn");
  const isPaused = btn?.textContent?.includes("Reactivate");

  const route  = isPaused ? "unpause" : "pause";
  const action = isPaused ? "reactivate" : "pause";

  if (!confirm(`Are you sure you want to ${action} your account?`)) return;

  setBtnLoading(btn, true, isPaused ? "Reactivating…" : "Pausing…");

  try {
    const response = await fetch(`${API_URL}/api/freelancer/settings/${route}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      showToast(data.message || `Failed to ${action} account`, "error");
      return;
    }

    showToast(data.message, "success");

    if (isPaused) {
      btn.innerHTML = `<i class="fa-solid fa-pause"></i> Pause My Account`;
    } else {
      btn.innerHTML = `<i class="fa-solid fa-play"></i> Reactivate My Account`;
    }

  } catch (error) {
    console.error("togglePauseAccount error:", error);
    showToast("Network error", "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function deleteAccount() {
  const confirmText = val("deleteConfirm");

  if (confirmText.toUpperCase() !== "DELETE") {
    showToast("Type DELETE to confirm", "error");
    return;
  }

  if (!confirm("This will permanently delete your account and all your data. This CANNOT be undone. Are you absolutely sure?")) return;

  const btn = document.getElementById("deleteAccountBtn");
  setBtnLoading(btn, true, "Deleting…");

  try {
    const response = await fetch(`${API_URL}/api/freelancer/settings/account`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmText: "DELETE" })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      showToast(data.message || "Failed to delete account", "error");
      setBtnLoading(btn, false, '<i class="fa-solid fa-trash-can"></i> Delete My Account');
      return;
    }

    showToast("Account permanently deleted. Redirecting…", "success");
    setTimeout(() => { window.location.href = "../../../signin/"; }, 2000);

  } catch (error) {
    console.error("deleteAccount error:", error);
    showToast("Network error", "error");
    setBtnLoading(btn, false, '<i class="fa-solid fa-trash-can"></i> Delete My Account');
  }
}

/* =========================
   TAB NAVIGATION
========================= */

function bindTabNav() {
  const navItems = document.querySelectorAll(".settings-nav-item[data-tab]");
  const panels   = document.querySelectorAll(".settings-panel");

  navItems.forEach(item => {
    item.addEventListener("click", function (e) {
      e.preventDefault();

      navItems.forEach(n => n.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));

      this.classList.add("active");

      const panel = document.getElementById(`panel-${this.dataset.tab}`);
      if (panel) panel.classList.add("active");

      window.history.replaceState(null, "", `#${this.dataset.tab}`);
    });
  });

  const hash = window.location.hash.replace("#", "");
  if (hash) {
    const target = document.querySelector(`.settings-nav-item[data-tab="${hash}"]`);
    if (target) target.click();
  }
}

/* =========================
   TOAST NOTIFICATIONS
========================= */

function showToast(message, type = "info") {
  const existing = document.getElementById("settingsToast");
  if (existing) existing.remove();

  const colors = {
    success: "#16a34a",
    error:   "#dc2626",
    info:    "#2563eb",
    warning: "#d97706"
  };

  const icons = {
    success: "fa-circle-check",
    error:   "fa-circle-xmark",
    info:    "fa-circle-info",
    warning: "fa-triangle-exclamation"
  };

  const toast = document.createElement("div");
  toast.id = "settingsToast";
  toast.style.cssText = `
    position: fixed;
    bottom: 28px;
    right: 28px;
    z-index: 99999;
    background: white;
    border: 1px solid ${colors[type] || colors.info}40;
    border-left: 4px solid ${colors[type] || colors.info};
    border-radius: 16px;
    padding: 14px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 16px 40px rgba(15,23,42,0.14);
    font-size: 14px;
    font-weight: 700;
    color: #1e293b;
    max-width: 380px;
    animation: toastIn .22s ease;
  `;

  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info}" style="color:${colors[type]};font-size:16px;flex-shrink:0;"></i>
    <span>${escHTML(message)}</span>
    <button onclick="this.parentElement.remove()" style="margin-left:auto;border:none;background:none;cursor:pointer;color:#94a3b8;font-size:16px;padding:0;">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  if (!document.getElementById("toastKeyframes")) {
    const style = document.createElement("style");
    style.id = "toastKeyframes";
    style.textContent = `@keyframes toastIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);
  setTimeout(() => toast?.remove(), 4500);
}

/* =========================
   HELPERS
========================= */

function val(id) {
  return (document.getElementById(id)?.value || "").trim();
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function checked(id) {
  return !!document.getElementById(id)?.checked;
}

function escHTML(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getInitials(name) {
  const parts = String(name || "").trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : (parts[0]?.[0] || "U").toUpperCase();
}

function setBtnLoading(btn, loading, originalHTML) {
  if (!btn) return;
  btn.disabled      = loading;
  if (loading) {
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${originalHTML}`;
  } else {
    btn.innerHTML = originalHTML || btn.dataset.originalHtml || "";
  }
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function formatUserAgent(ua) {
  if (!ua) return "Unknown Device";
  if (/chrome/i.test(ua) && /mobile/i.test(ua))  return "Chrome on Mobile";
  if (/chrome/i.test(ua))                         return "Chrome on Desktop";
  if (/safari/i.test(ua) && /mobile/i.test(ua))  return "Safari on iPhone/iPad";
  if (/safari/i.test(ua))                         return "Safari on Mac";
  if (/firefox/i.test(ua))                        return "Firefox";
  if (/edge/i.test(ua))                           return "Microsoft Edge";
  return ua.substring(0, 48) + (ua.length > 48 ? "…" : "");
}
