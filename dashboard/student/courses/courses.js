var API_URL = "https://backend.impactacademy.site";

var COURSE_COLORS = [
    "linear-gradient(135deg, #2563eb, #06b6d4)",
    "linear-gradient(135deg, #8b5cf6, #ec4899)",
    "linear-gradient(135deg, #f59e0b, #ef4444)",
    "linear-gradient(135deg, #10b981, #059669)",
    "linear-gradient(135deg, #06b6d4, #2563eb)",
    "linear-gradient(135deg, #6366f1, #8b5cf6)",
    "linear-gradient(135deg, #ec4899, #f43f5e)",
    "linear-gradient(135deg, #14b8a6, #0ea5e9)"
];

var COURSE_ICONS = [
    "fa-solid fa-code",
    "fa-solid fa-palette",
    "fa-solid fa-robot",
    "fa-solid fa-bullhorn",
    "fa-solid fa-briefcase",
    "fa-solid fa-mobile-screen-button",
    "fa-solid fa-pen-nib",
    "fa-solid fa-chart-line",
    "fa-solid fa-database",
    "fa-solid fa-shield-halved",
    "fa-solid fa-lightbulb",
    "fa-solid fa-cube"
];

var CATEGORY_MAP = {
    "tech": { icon: "fa-solid fa-code", color: "#2563eb", bg: "#eff6ff" },
    "technology": { icon: "fa-solid fa-code", color: "#2563eb", bg: "#eff6ff" },
    "web development": { icon: "fa-solid fa-code", color: "#2563eb", bg: "#eff6ff" },
    "design": { icon: "fa-solid fa-palette", color: "#8b5cf6", bg: "#f5f3ff" },
    "ui/ux": { icon: "fa-solid fa-palette", color: "#8b5cf6", bg: "#f5f3ff" },
    "business": { icon: "fa-solid fa-briefcase", color: "#06b6d4", bg: "#ecfeff" },
    "marketing": { icon: "fa-solid fa-bullhorn", color: "#10b981", bg: "#ecfdf5" },
    "ai": { icon: "fa-solid fa-robot", color: "#f59e0b", bg: "#fffbeb" },
    "automation": { icon: "fa-solid fa-robot", color: "#f59e0b", bg: "#fffbeb" },
    "writing": { icon: "fa-solid fa-pen-nib", color: "#ec4899", bg: "#fdf2f8" },
    "finance": { icon: "fa-solid fa-chart-line", color: "#14b8a6", bg: "#f0fdfa" },
    "data": { icon: "fa-solid fa-database", color: "#6366f1", bg: "#eef2ff" },
    "security": { icon: "fa-solid fa-shield-halved", color: "#ef4444", bg: "#fef2f2" }
};

/* =========================
   AUTH
========================= */

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

/* =========================
   API FETCHERS
========================= */

async function fetchStudentCourses() {
    try {
        var urlParams = new URLSearchParams(window.location.search);
        var searchQuery = urlParams.get("search") || "";
        var url = API_URL + "/api/student/courses";
        if (searchQuery) url += "?search=" + encodeURIComponent(searchQuery);

        var res = await fetch(url, { credentials: "include", cache: "no-store" });
        var data = await res.json();
        return data;
    } catch (err) {
        console.error("fetchStudentCourses error:", err);
        return { success: false, message: "Network error. Please try again." };
    }
}

async function fetchDashboard() {
    try {
        var res = await fetch(API_URL + "/api/student/dashboard", {
            credentials: "include"
        });
        var data = await res.json();
        return data;
    } catch (err) {
        console.error("fetchDashboard error:", err);
        return { success: false, message: "Network error. Please try again." };
    }
}

/* =========================
   HELPERS
========================= */

function esc(str) {
    if (!str) return "";
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

function getInitials(name) {
    if (!name) return "?";
    var parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return parts[0].charAt(0).toUpperCase();
}

function getCategoryKey(category) {
    if (!category) return "";
    return category.toLowerCase().trim();
}

function getCourseColor(index) {
    return COURSE_COLORS[index % COURSE_COLORS.length];
}

function getCourseIcon(index) {
    return COURSE_ICONS[index % COURSE_ICONS.length];
}

function getTagColor(category) {
    var key = getCategoryKey(category);
    for (var k in CATEGORY_MAP) {
        if (key.includes(k)) {
            return "background:" + CATEGORY_MAP[k].bg + ";color:" + CATEGORY_MAP[k].color + ";";
        }
    }
    return "";
}

function formatStatNumber(num) {
    if (!num || num === 0) return "0";
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(num);
}

/* =========================
   HERO STATS
========================= */

function updateHeroStats(courseCount) {
    var courseCountEl = document.getElementById("heroCourseCount");
    if (courseCountEl) {
        courseCountEl.textContent = courseCount + "+";
    }
}

/* =========================
   ENROLLED COURSES RENDER
========================= */

function renderEnrolledCourses(courses) {
    var container = document.getElementById("enrolledList");
    if (!container) return;

    if (!courses || !courses.length) {
        container.innerHTML =
            '<div class="crs-empty-state">' +
            '<div class="crs-empty-icon"><i class="fa-solid fa-book-open"></i></div>' +
            '<h3>No courses in progress</h3>' +
            '<p>Browse our course catalog and enroll in your first course to start learning.</p>' +
            '<a href="#all-courses" class="sh-empty-btn"><i class="fa-solid fa-compass"></i> Browse Courses</a>' +
            '</div>';
        return;
    }

    container.innerHTML = "";

    courses.forEach(function (course, i) {
        var progress = course.progress || 0;
        var totalLessons = course.totalLessons || 0;
        var completedLessons = course.completedLessons || 0;
        var category = course.category || "";
        var thumbStyle = course.thumbnail
            ? 'background-image:url(' + esc(course.thumbnail) + ');background-size:cover;background-position:center;'
            : 'background:' + getCourseColor(i) + ';';
        var thumbContent = course.thumbnail
            ? ""
            : '<i class="' + getCourseIcon(i) + '"></i>';

        var card = document.createElement("div");
        card.className = "crs-progress-card";
        card.setAttribute("data-category", getCategoryKey(category));
        card.innerHTML =
            '<div class="crs-progress-thumb" style="' + thumbStyle + '">' +
            thumbContent +
            '</div>' +
            '<div class="crs-progress-info">' +
            '<div class="crs-progress-tags">' +
            (category ? '<span class="sh-tag" style="' + getTagColor(category) + '">' + esc(category) + '</span>' : '') +
            '<span class="sh-tag pending">In Progress</span>' +
            '</div>' +
            '<h3>' + esc(course.title || "Untitled Course") + '</h3>' +
            '<p>' + esc(course.subtitle || course.description || "") + '</p>' +
            '<div class="sh-progress-bar">' +
            '<div class="sh-progress-fill" style="width:' + progress + '%"></div>' +
            '</div>' +
            '<div class="sh-progress-meta">' +
            '<span><i class="fa-solid fa-clock"></i> ' + completedLessons + '/' + totalLessons + ' lessons</span>' +
            '<span><i class="fa-solid fa-trophy"></i> ' + progress + '% complete</span>' +
            '</div>' +
            '</div>' +
            '<button class="sh-resume-btn" title="Continue"><i class="fa-solid fa-play"></i></button>';

        container.appendChild(card);
    });

    initProgressAnimations();
}

/* =========================
   BROWSE COURSES RENDER
========================= */

function formatTimeAgo(dateStr) {
    if (!dateStr) return "";
    var now = Date.now();
    var then = new Date(dateStr).getTime();
    if (isNaN(then)) return "";
    var diff = Math.floor((now - then) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function renderBrowseCourses(courses) {
    var container = document.getElementById("browseGrid");
    if (!container) return;

    if (!courses || !courses.length) {
        container.innerHTML =
            '<div class="crs-empty-state full-width">' +
            '<div class="crs-empty-icon"><i class="fa-solid fa-layer-group"></i></div>' +
            '<h3>No courses available yet</h3>' +
            '<p>Our course library is being updated. Check back soon for new offerings.</p>' +
            '</div>';
        return;
    }

    container.innerHTML = "";

    courses.forEach(function (course, i) {
        var category = course.category || "";
        var tags = Array.isArray(course.tags) ? course.tags : [];
        var description = course.description || course.subtitle || "";
        var accessType = String(course.accessType || "").toLowerCase().trim();
        var isPaid = accessType === "paid";
        var isSubscription = accessType === "subscription";
        var isFree = accessType === "free" || accessType === "";
        console.log("[COURSE CARD] courseId=" + course.courseId + " raw_accessType=" + JSON.stringify(course.accessType) + " normalized=" + JSON.stringify(accessType));
        var timeAgo = formatTimeAgo(course.createdAt);

        var teacherName = "Unknown";
        var teacherInitials = "?";
        var teacherAvatarHtml = "";
        if (course.teacher) {
            teacherName = course.teacher.fullname || "Unknown";
            teacherInitials = getInitials(teacherName);
            if (course.teacher.photoURL) {
                teacherAvatarHtml = '<img src="' + esc(course.teacher.photoURL) + '" alt="' + esc(teacherName) + '">';
            } else {
                teacherAvatarHtml = esc(teacherInitials);
            }
        }

        var thumbHtml = "";
        if (course.thumbnail) {
            thumbHtml = '<img src="' + esc(course.thumbnail) + '" alt="' + esc(course.title || "") + '">';
        } else {
            thumbHtml = '<div class="crs-feed-thumb-placeholder" style="background:' + getCourseColor(i) + '"><i class="' + getCourseIcon(i) + '"></i></div>';
        }

        var videoBadge = "";
        if (course.promoVideoMeta) {
            videoBadge =
                '<div class="crs-feed-video-bottom">' +
                '<span class="crs-feed-promo-label"><i class="fa-solid fa-play"></i> Promotional Video</span>' +
                '</div>';
        }

        var playBtn = '<button class="crs-feed-play-btn"><i class="fa-solid fa-play"></i></button>';

        var tagHtml = "";
        var maxTags = 3;
        var shownTags = tags.slice(0, maxTags);
        var extraTags = tags.length - maxTags;
        shownTags.forEach(function (t) {
            tagHtml += '<span class="crs-feed-tag" style="' + getTagColor(t) + '">' + esc(t) + '</span>';
        });
        if (extraTags > 0) {
            tagHtml += '<span class="crs-feed-tag crs-feed-tag-more">+' + extraTags + ' more</span>';
        }
        if (!tagHtml && category) {
            tagHtml = '<span class="crs-feed-tag" style="' + getTagColor(category) + '">' + esc(category) + '</span>';
        }

        var catInfo = CATEGORY_MAP[getCategoryKey(category)] || { color: "#64748b", bg: "#f1f5f9" };

        var SVG = {
            verified: '<svg class="crs-svg-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.5924 3.20027C9.34888 3.4078 9.22711 3.51158 9.09706 3.59874C8.79896 3.79854 8.46417 3.93721 8.1121 4.00672C7.95851 4.03705 7.79903 4.04977 7.48008 4.07522C6.6787 4.13918 6.278 4.17115 5.94371 4.28923C5.17051 4.56233 4.56233 5.17051 4.28923 5.94371C4.17115 6.278 4.13918 6.6787 4.07522 7.48008C4.04977 7.79903 4.03705 7.95851 4.00672 8.1121C3.93721 8.46417 3.79854 8.79896 3.59874 9.09706C3.51158 9.22711 3.40781 9.34887 3.20027 9.5924C2.67883 10.2043 2.4181 10.5102 2.26522 10.8301C1.91159 11.57 1.91159 12.43 2.26522 13.1699C2.41811 13.4898 2.67883 13.7957 3.20027 14.4076C3.40778 14.6511 3.51158 14.7729 3.59874 14.9029C3.79854 15.201 3.93721 15.5358 4.00672 15.8879C4.03705 16.0415 4.04977 16.201 4.07522 16.5199C4.13918 17.3213 4.17115 17.722 4.28923 18.0563C4.56233 18.8295 5.17051 19.4377 5.94371 19.7108C6.278 19.8288 6.6787 19.8608 7.48008 19.9248C7.79903 19.9502 7.95851 19.963 8.1121 19.9933C8.46417 20.0628 8.79896 20.2015 9.09706 20.4013C9.22711 20.4884 9.34887 20.5922 9.5924 20.7997C10.2043 21.3212 10.5102 21.5819 10.8301 21.7348C11.57 22.0884 12.43 22.0884 13.1699 21.7348C13.4898 21.5819 13.7957 21.3212 14.4076 20.7997C14.6511 20.5922 14.7729 20.4884 14.9029 20.4013C15.201 20.2015 15.5358 20.0628 15.8879 19.9933C16.0415 19.963 16.201 19.9502 16.5199 19.9248C17.3213 19.8608 17.722 19.8288 18.0563 19.7108C18.8295 19.4377 19.4377 18.8295 19.7108 18.0563C19.8288 17.722 19.8608 17.3213 19.9248 16.5199C19.9502 16.201 19.963 16.0415 19.9933 15.8879C20.0628 15.5358 20.2015 15.201 20.4013 14.9029C20.4884 14.7729 20.5922 14.6511 20.7997 14.4076C21.3212 13.7957 21.5819 13.4898 21.7348 13.1699C22.0884 12.43 22.0884 11.57 21.7348 10.8301C21.5819 10.5102 21.3212 10.2043 20.7997 9.5924C20.5922 9.34887 20.4884 9.22711 20.4013 9.09706C20.2015 8.79896 20.0628 8.46417 19.9933 8.1121C19.963 7.95851 19.9502 7.79903 19.9248 7.48008C19.8608 6.6787 19.8288 6.278 19.7108 5.94371C19.4377 5.17051 18.8295 4.56233 18.0563 4.28923C17.722 4.17115 17.3213 4.13918 16.5199 4.07522C16.201 4.04977 16.0415 4.03705 15.8879 4.00672C15.5358 3.93721 15.201 3.79854 14.9029 3.59874C14.7729 3.51158 14.6511 3.40781 14.4076 3.20027C13.7957 2.67883 13.4898 2.41811 13.1699 2.26522C12.43 1.91159 11.57 1.91159 10.8301 2.26522C10.5102 2.4181 10.2043 2.67883 9.5924 3.20027ZM16.3735 9.86314C16.6913 9.5453 16.6913 9.03 16.3735 8.71216C16.0557 8.39433 15.5403 8.39433 15.2225 8.71216L10.3723 13.5624L8.77746 11.9676C8.45963 11.6498 7.94432 11.6498 7.62649 11.9676C7.30866 12.2854 7.30866 12.8007 7.62649 13.1186L9.79678 15.2889C10.1146 15.6067 10.6299 15.6067 10.9478 15.2889L16.3735 9.86314Z" fill="currentColor"></path></svg>',
            share: '<svg class="crs-svg-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M13.803 5.33333C13.803 3.49238 15.3022 2 17.1515 2C19.0008 2 20.5 3.49238 20.5 5.33333C20.5 7.17428 19.0008 8.66667 17.1515 8.66667C16.2177 8.66667 15.3738 8.28596 14.7671 7.67347L10.1317 10.8295C10.1745 11.0425 10.197 11.2625 10.197 11.4872C10.197 11.9322 10.109 12.3576 9.94959 12.7464L15.0323 16.0858C15.6092 15.6161 16.3473 15.3333 17.1515 15.3333C19.0008 15.3333 20.5 16.8257 20.5 18.6667C20.5 20.5076 19.0008 22 17.1515 22C15.3022 22 13.803 20.5076 13.803 18.6667C13.803 18.1845 13.9062 17.7255 14.0917 17.3111L9.05007 13.9987C8.46196 14.5098 7.6916 14.8205 6.84848 14.8205C4.99917 14.8205 3.5 13.3281 3.5 11.4872C3.5 9.64623 4.99917 8.15385 6.84848 8.15385C7.9119 8.15385 8.85853 8.64725 9.47145 9.41518L13.9639 6.35642C13.8594 6.03359 13.803 5.6896 13.803 5.33333Z" fill="currentColor"></path></svg>',
            views: '<svg class="crs-svg-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.75 12C9.75 10.7574 10.7574 9.75 12 9.75C13.2426 9.75 14.25 10.7574 14.25 12C14.25 13.2426 13.2426 14.25 12 14.25C10.7574 14.25 9.75 13.2426 9.75 12Z" fill="currentColor"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M2 12C2 13.6394 2.42496 14.1915 3.27489 15.2957C4.97196 17.5004 7.81811 20 12 20C16.1819 20 19.028 17.5004 20.7251 15.2957C21.575 14.1915 22 13.6394 22 12C22 10.3606 21.575 9.80853 20.7251 8.70433C19.028 6.49956 16.1819 4 12 4C7.81811 4 4.97196 6.49956 3.27489 8.70433C2.42496 9.80853 2 10.3606 2 12ZM12 8.25C9.92893 8.25 8.25 9.92893 8.25 12C8.25 14.0711 9.92893 15.75 12 15.75C14.0711 15.75 15.75 14.0711 15.75 12C15.75 9.92893 14.0711 8.25 12 8.25Z" fill="currentColor"></path></svg>',
            students: '<svg class="crs-svg-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path opacity="0.4" d="M17.5291 7.77C17.4591 7.76 17.3891 7.76 17.3191 7.77C15.7691 7.72 14.5391 6.45 14.5391 4.89C14.5391 3.3 15.8291 2 17.4291 2C19.0191 2 20.3191 3.29 20.3191 4.89C20.3091 6.45 19.0791 7.72 17.5291 7.77Z" fill="currentColor"></path><path opacity="0.4" d="M20.7896 14.6999C19.6696 15.4499 18.0996 15.7299 16.6496 15.5399C17.0296 14.7199 17.2296 13.8099 17.2396 12.8499C17.2396 11.8499 17.0196 10.8999 16.5996 10.0699C18.0796 9.86992 19.6496 10.1499 20.7796 10.8999C22.3596 11.9399 22.3596 13.6499 20.7896 14.6999Z" fill="currentColor"></path><path opacity="0.4" d="M6.44039 7.77C6.51039 7.76 6.58039 7.76 6.65039 7.77C8.20039 7.72 9.43039 6.45 9.43039 4.89C9.43039 3.3 8.14039 2 6.54039 2C4.95039 2 3.65039 3.29 3.65039 4.89C3.66039 6.45 4.89039 7.72 6.44039 7.77Z" fill="currentColor"></path><path opacity="0.4" d="M6.54914 12.8501C6.54914 13.8201 6.75914 14.7401 7.13914 15.5701C5.72914 15.7201 4.25914 15.4201 3.17914 14.7101C1.59914 13.6601 1.59914 11.9501 3.17914 10.9001C4.24914 10.1801 5.75914 9.8901 7.17914 10.0501C6.76914 10.8901 6.54914 11.8401 6.54914 12.8501Z" fill="currentColor"></path><path d="M12.1208 15.87C12.0408 15.86 11.9508 15.86 11.8608 15.87C10.0208 15.81 8.55078 14.3 8.55078 12.44C8.55078 10.54 10.0808 9 11.9908 9C13.8908 9 15.4308 10.54 15.4308 12.44C15.4308 14.3 13.9708 15.81 12.1208 15.87Z" fill="currentColor"></path><path d="M8.87078 17.9399C7.36078 18.9499 7.36078 20.6099 8.87078 21.6099C10.5908 22.7599 13.4108 22.7599 15.1308 21.6099C16.6408 20.5999 16.6408 18.9399 15.1308 17.9399C13.4208 16.7899 10.6008 16.7899 8.87078 17.9399Z" fill="currentColor"></path></svg>',
            book: '<svg class="crs-svg-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M418,101 C415.791,101 414,102.791 414,105 L414,126 C414,128.209 415.885,129.313 418,130 L429,133 L429,104 C423.988,102.656 418,101 418,101 L418,101 Z M442,101 C442,101 436.212,102.594 430.951,104 L431,104 L431,133 C436.617,131.501 442,130 442,130 C444.053,129.469 446,128.209 446,126 L446,105 C446,102.791 444.209,101 442,101 L442,101 Z" fill="currentColor" transform="translate(-414, -101)"></path></svg>',
            education: '<svg class="crs-svg-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.05 2.53004L4.03002 6.46004C2.10002 7.72004 2.10002 10.54 4.03002 11.8L10.05 15.73C11.13 16.44 12.91 16.44 13.99 15.73L19.98 11.8C21.9 10.54 21.9 7.73004 19.98 6.47004L13.99 2.54004C12.91 1.82004 11.13 1.82004 10.05 2.53004Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M5.63 13.08L5.62 17.77C5.62 19.04 6.6 20.4 7.8 20.8L10.99 21.86C11.54 22.04 12.45 22.04 13.01 21.86L16.2 20.8C17.4 20.4 18.38 19.04 18.38 17.77V13.13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M21.4 15V9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
        };

        var students = course.students || 0;
        var views = course.views || 0;
        var lessonCount = course.lessonCount || 0;
        var rating = course.rating || 0;
        var teacherStatus = (course.teacher && course.teacher.status === "active") ? "Verified Teacher" : "Teacher";

        var card = document.createElement("div");
        card.className = "crs-feed-card";
        card.setAttribute("data-category", getCategoryKey(category));
        card.setAttribute("data-course-id", course.courseId || "");
        card.setAttribute("data-teacher-uid", (course.teacher && course.teacher.uid) || "");
        card.innerHTML =
            '<div class="crs-feed-header">' +
            '<div class="crs-feed-teacher">' +
            '<div class="crs-feed-avatar">' + teacherAvatarHtml + '</div>' +
            '<div class="crs-feed-teacher-info">' +
            '<div class="crs-feed-teacher-name">' +
            '<span>' + esc(teacherName) + '</span>' +
            SVG.verified +
            '</div>' +
            '<span class="crs-feed-teacher-meta">' + esc(teacherStatus) + (timeAgo ? ' &middot; ' + esc(timeAgo) : '') + '</span>' +
            '</div>' +
            '</div>' +
            '<div class="crs-feed-header-right">' +
            '<span class="crs-feed-cat-badge" style="background:' + catInfo.bg + ';color:' + catInfo.color + ';">' + esc(category || "General") + '</span>' +
            '<button class="crs-feed-menu-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button>' +
            '</div>' +
            '</div>' +
            '<div class="crs-feed-media">' +
            thumbHtml +
            playBtn +
            videoBadge +
            '</div>' +
            '<div class="crs-feed-body">' +
            '<div class="crs-feed-title-row">' +
            '<h3 class="crs-feed-title">' + esc(course.title || "Untitled Course") + '</h3>' +
            '<span class="crs-feed-access-badge' + (isPaid || isSubscription ? ' paid' : '') + '">' + (isSubscription ? 'Subscription' : isPaid ? 'Paid' : 'Free') + '</span>' +
            '</div>' +
            (description ? '<p class="crs-feed-desc">' + esc(description) + '</p>' : '') +
            '<div class="crs-feed-tags">' + tagHtml + '</div>' +
            '</div>' +
            '<div class="crs-feed-stats">' +
            '<div class="crs-feed-stat">' +
            SVG.students +
            '<div><strong>' + formatStatNumber(students) + '</strong><span>Students</span></div>' +
            '</div>' +
            '<div class="crs-feed-stat">' +
            SVG.views +
            '<div><strong>' + formatStatNumber(views) + '</strong><span>Views</span></div>' +
            '</div>' +
            '<div class="crs-feed-stat">' +
            SVG.book +
            '<div><strong>' + formatStatNumber(lessonCount) + '</strong><span>Lessons</span></div>' +
            '</div>' +
            '<div class="crs-feed-stat">' +
            '<i class="fa-solid fa-star"></i>' +
            '<div><strong>' + (rating > 0 ? rating.toFixed(1) : '0') + '</strong><span>' + (rating > 0 ? 'Rating' : 'No ratings') + '</span></div>' +
            '</div>' +
            '</div>' +
            '<div class="crs-feed-actions">' +
            '<button class="crs-feed-action-btn primary">' + SVG.education + ' Join Course</button>' +
            '<button class="crs-feed-action-btn"><i class="fa-regular fa-bookmark"></i> Save</button>' +
            '<button class="crs-feed-action-btn">' + SVG.share + ' Share</button>' +
            '<button class="crs-feed-action-btn">Details <i class="fa-solid fa-arrow-right"></i></button>' +
            '</div>';

        container.appendChild(card);
    });

    initFilterButtons();
    initSearch();
    initCardClicks();
}

/* =========================
   CARD CLICK → VIEW COURSE
========================= */

function initCardClicks() {
    var cards = document.querySelectorAll(".crs-feed-card[data-course-id]");
    cards.forEach(function (card) {
        card.addEventListener("click", function (e) {
            /* Ignore clicks on Save, Share, and menu buttons */
            if (e.target.closest(".crs-feed-menu-btn")) return;
            if (e.target.closest(".crs-feed-action-btn") && !e.target.closest(".crs-feed-action-btn.primary")) {
                var btnText = e.target.closest(".crs-feed-action-btn").textContent || "";
                if (btnText.indexOf("Save") !== -1 || btnText.indexOf("Share") !== -1) return;
            }
            var cid = card.getAttribute("data-course-id");
            if (cid) {
                window.location.href = "../view-course/?cid=" + encodeURIComponent(cid);
            }
        });
        card.style.cursor = "pointer";
    });
}

/* =========================
   CATEGORIES RENDER
========================= */

function renderCategories(courses) {
    var container = document.getElementById("categoriesGrid");
    if (!container) return;

    var counts = {};
    courses.forEach(function (c) {
        var cat = (c.category || "General").trim();
        counts[cat] = (counts[cat] || 0) + 1;
    });

    var cats = Object.keys(counts).sort(function (a, b) {
        return counts[b] - counts[a];
    });

    if (!cats.length) {
        container.innerHTML =
            '<div class="crs-empty-state full-width">' +
            '<div class="crs-empty-icon"><i class="fa-solid fa-folder-open"></i></div>' +
            '<h3>No categories yet</h3>' +
            '<p>Categories will appear once courses are published.</p>' +
            '</div>';
        return;
    }

    container.innerHTML = "";

    cats.forEach(function (cat) {
        var key = getCategoryKey(cat);
        var info = CATEGORY_MAP[key] || { icon: "fa-solid fa-book", color: "#64748b", bg: "#f1f5f9" };
        var card = document.createElement("div");
        card.className = "crs-category-card";
        card.style.setProperty("--cat-color", info.color);
        card.style.setProperty("--cat-bg", info.bg);
        card.setAttribute("data-category", key);
        card.innerHTML =
            '<div class="crs-cat-icon"><i class="' + info.icon + '"></i></div>' +
            '<h3>' + esc(cat) + '</h3>' +
            '<p>' + counts[cat] + ' Course' + (counts[cat] !== 1 ? 's' : '') + '</p>';
        container.appendChild(card);
    });

    container.querySelectorAll(".crs-category-card").forEach(function (card) {
        card.addEventListener("click", function () {
            var cat = this.getAttribute("data-category");
            var filterBtns = document.querySelectorAll(".sh-course-filter .sh-filter-btn");
            var quickTags = document.querySelectorAll(".crs-quick-tag");
            filterBtns.forEach(function (b) {
                b.classList.remove("active");
                if (b.getAttribute("data-filter") === cat) b.classList.add("active");
            });
            quickTags.forEach(function (t) {
                t.classList.remove("active");
                if (t.getAttribute("data-filter") === cat) t.classList.add("active");
            });
            applyFilter(cat);
        });
    });
}

/* =========================
   FILTER / SEARCH
========================= */

function initFilterButtons() {
    var filterBtns = document.querySelectorAll(".sh-course-filter .sh-filter-btn");
    var quickTags = document.querySelectorAll(".crs-quick-tag");

    filterBtns.forEach(function (btn) {
        btn.addEventListener("click", function () {
            filterBtns.forEach(function (b) { b.classList.remove("active"); });
            this.classList.add("active");
            var filter = this.getAttribute("data-filter");
            quickTags.forEach(function (t) {
                t.classList.remove("active");
                if (t.getAttribute("data-filter") === filter) t.classList.add("active");
            });
            applyFilter(filter);
        });
    });

    quickTags.forEach(function (tag) {
        tag.addEventListener("click", function () {
            quickTags.forEach(function (t) { t.classList.remove("active"); });
            this.classList.add("active");
            var filter = this.getAttribute("data-filter");
            filterBtns.forEach(function (b) {
                b.classList.remove("active");
                if (b.getAttribute("data-filter") === filter) b.classList.add("active");
            });
            applyFilter(filter);
        });
    });
}

function applyFilter(filter) {
    var cards = document.querySelectorAll(".crs-feed-card");
    cards.forEach(function (card) {
        var cat = card.getAttribute("data-category") || "";
        if (filter === "all" || cat === filter || cat.includes(filter)) {
            card.style.display = "";
            card.style.animation = "none";
            card.offsetHeight;
            card.style.animation = "";
        } else {
            card.style.display = "none";
        }
    });
}

function initSearch() {
    var navSearchInput = document.getElementById("courseSearchInput");
    var heroSearchInput = document.getElementById("mainSearchInput");
    var heroSearchBtn = heroSearchInput ? heroSearchInput.parentElement.querySelector(".crs-search-btn") : null;

    function bindToPopup(el) {
        if (!el) return;
        el.addEventListener("focus", function (e) {
            e.preventDefault();
            el.blur();
            openSearchPopup(el);
        });
        el.addEventListener("click", function (e) {
            e.preventDefault();
            openSearchPopup(el);
        });
    }

    bindToPopup(navSearchInput);
    bindToPopup(heroSearchInput);

    /* Hero search button opens popup and submits */
    if (heroSearchBtn) {
        heroSearchBtn.addEventListener("click", function (e) {
            e.preventDefault();
            var q = (heroSearchInput.value || "").trim();
            if (q) {
                SearchPopup.input.value = q;
                syncSourceInputs(q);
                submitSearch();
            } else {
                openSearchPopup(heroSearchInput);
            }
        });
    }

    /* Hero input Enter key submits directly */
    if (heroSearchInput) {
        heroSearchInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                var q = (heroSearchInput.value || "").trim();
                if (q) {
                    SearchPopup.input.value = q;
                    syncSourceInputs(q);
                    submitSearch();
                } else {
                    openSearchPopup(heroSearchInput);
                }
            }
        });
    }
}

/* =========================
   SKELETON LOADING
========================= */

function showEnrolledSkeleton() {
    var container = document.getElementById("enrolledList");
    if (!container) return;
    container.innerHTML =
        '<div class="crs-skeleton-progress">' +
        '<div class="crs-skeleton-thumb sh-skeleton"></div>' +
        '<div class="crs-skeleton-info">' +
        '<div class="sh-skeleton sh-skeleton-title w-30"></div>' +
        '<div class="sh-skeleton sh-skeleton-title w-70" style="margin-top:8px"></div>' +
        '<div class="sh-skeleton sh-skeleton-text w-50" style="margin-top:6px"></div>' +
        '<div class="sh-skeleton sh-skeleton-bar" style="margin-top:12px"></div>' +
        '<div class="sh-skeleton sh-skeleton-text w-40" style="margin-top:8px"></div>' +
        '</div>' +
        '</div>' +
        '<div class="crs-skeleton-progress">' +
        '<div class="crs-skeleton-thumb sh-skeleton"></div>' +
        '<div class="crs-skeleton-info">' +
        '<div class="sh-skeleton sh-skeleton-title w-25"></div>' +
        '<div class="sh-skeleton sh-skeleton-title w-60" style="margin-top:8px"></div>' +
        '<div class="sh-skeleton sh-skeleton-text w-45" style="margin-top:6px"></div>' +
        '<div class="sh-skeleton sh-skeleton-bar" style="margin-top:12px"></div>' +
        '<div class="sh-skeleton sh-skeleton-text w-35" style="margin-top:8px"></div>' +
        '</div>' +
        '</div>';
}

function showBrowseSkeleton() {
    var container = document.getElementById("browseGrid");
    if (!container) return;
    var html = "";
    for (var i = 0; i < 4; i++) {
        html +=
            '<div class="crs-skeleton-feed-card">' +
            '<div class="crs-skel-feed-header">' +
            '<div class="sh-skeleton" style="width:36px;height:36px;border-radius:50%;flex-shrink:0"></div>' +
            '<div style="flex:1">' +
            '<div class="sh-skeleton sh-skeleton-title" style="width:140px;height:12px"></div>' +
            '<div class="sh-skeleton sh-skeleton-text" style="width:100px;height:10px;margin-top:5px"></div>' +
            '</div>' +
            '<div class="sh-skeleton" style="width:70px;height:24px;border-radius:999px"></div>' +
            '<div class="sh-skeleton" style="width:24px;height:24px;border-radius:6px"></div>' +
            '</div>' +
            '<div class="sh-skeleton" style="width:calc(100% - 28px);height:160px;border-radius:12px;margin:0 14px"></div>' +
            '<div class="crs-skel-feed-body">' +
            '<div class="sh-skeleton sh-skeleton-title" style="width:60%;height:16px"></div>' +
            '<div class="sh-skeleton sh-skeleton-text" style="width:85%;height:11px;margin-top:8px"></div>' +
            '<div class="sh-skeleton sh-skeleton-text" style="width:65%;height:11px;margin-top:5px"></div>' +
            '<div style="display:flex;gap:6px;margin-top:10px">' +
            '<div class="sh-skeleton" style="width:70px;height:22px;border-radius:999px"></div>' +
            '<div class="sh-skeleton" style="width:60px;height:22px;border-radius:999px"></div>' +
            '<div class="sh-skeleton" style="width:55px;height:22px;border-radius:999px"></div>' +
            '</div>' +
            '</div>' +
            '<div class="crs-skel-feed-stats">' +
            '<div class="sh-skeleton" style="width:60px;height:28px;border-radius:8px"></div>' +
            '<div class="sh-skeleton" style="width:60px;height:28px;border-radius:8px"></div>' +
            '<div class="sh-skeleton" style="width:60px;height:28px;border-radius:8px"></div>' +
            '<div class="sh-skeleton" style="width:60px;height:28px;border-radius:8px"></div>' +
            '</div>' +
            '<div class="crs-skel-feed-actions">' +
            '<div class="sh-skeleton" style="width:110px;height:34px;border-radius:10px"></div>' +
            '<div class="sh-skeleton" style="width:70px;height:34px;border-radius:10px"></div>' +
            '<div class="sh-skeleton" style="width:70px;height:34px;border-radius:10px"></div>' +
            '<div class="sh-skeleton" style="width:90px;height:34px;border-radius:10px"></div>' +
            '</div>' +
            '</div>';
    }
    container.innerHTML = html;
}

function showCategoriesSkeleton() {
    var container = document.getElementById("categoriesGrid");
    if (!container) return;
    var html = "";
    for (var i = 0; i < 6; i++) {
        html +=
            '<div class="crs-skeleton-category">' +
            '<div class="sh-skeleton" style="width:60px;height:60px;border-radius:20px;margin:0 auto 12px"></div>' +
            '<div class="sh-skeleton sh-skeleton-title w-50" style="margin:0 auto 6px"></div>' +
            '<div class="sh-skeleton sh-skeleton-text w-30" style="margin:0 auto"></div>' +
            '</div>';
    }
    container.innerHTML = html;
}

function hideSkeletons() {
    document.querySelectorAll(".crs-skeleton-progress, .crs-skeleton-feed-card, .crs-skeleton-category").forEach(function (el) {
        el.remove();
    });
}

/* =========================
   ERROR STATE
========================= */

function showError(containerId, message) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML =
        '<div class="crs-error-state">' +
        '<div class="crs-error-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>' +
        '<h3>Something went wrong</h3>' +
        '<p>' + esc(message || "Failed to load data. Please try again.") + '</p>' +
        '<button class="sh-empty-btn" onclick="location.reload()"><i class="fa-solid fa-rotate-right"></i> Retry</button>' +
        '</div>';
}

/* =========================
   PROGRESS BAR ANIMATIONS
========================= */

function initProgressAnimations() {
    var progressFills = document.querySelectorAll(".sh-progress-fill");
    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                var fill = entry.target;
                var width = fill.style.width;
                fill.style.width = "0%";
                setTimeout(function () {
                    fill.style.width = width;
                }, 100);
                observer.unobserve(fill);
            }
        });
    }, { threshold: 0.5 });
    progressFills.forEach(function (fill) {
        observer.observe(fill);
    });
}

/* =========================
   CLICK EFFECTS
========================= */

function initClickEffects() {
    document.addEventListener("click", function (e) {
        var resumeBtn = e.target.closest(".sh-resume-btn");
        if (resumeBtn) {
            e.stopPropagation();
            resumeBtn.style.transform = "scale(0.9)";
            setTimeout(function () {
                resumeBtn.style.transform = "scale(1.1)";
                setTimeout(function () { resumeBtn.style.transform = ""; }, 150);
            }, 100);
        }

        var playBtn = e.target.closest(".crs-card-play");
        if (playBtn) {
            e.stopPropagation();
            playBtn.style.transform = "scale(0.85)";
            setTimeout(function () {
                playBtn.style.transform = "scale(1.15)";
                setTimeout(function () { playBtn.style.transform = ""; }, 150);
            }, 100);
        }
    });
}

/* =========================
   VIEW TRACKING
========================= */

var VIEW_TRACKER = {
    timers: {},
    DEBOUNCE_MS: 1500,

    sendView: function (courseId, teacherUid) {
        if (!courseId || !teacherUid) {
            console.log("[VIEW TRACKER] SKIP: missing courseId or teacherUid");
            return;
        }

        var self = this;
        clearTimeout(this.timers[courseId]);
        this.timers[courseId] = setTimeout(function () {
            console.log("[VIEW TRACKER] SENDING: courseId=" + courseId + " teacherUid=" + teacherUid);
            fetch(API_URL + "/api/course/view", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseId: courseId, teacherUid: teacherUid })
            }).then(function (res) {
                return res.json();
            }).then(function (data) {
                console.log("[VIEW TRACKER] RESPONSE:", JSON.stringify(data));
                if (data.success) {
                    var card = document.querySelector('.crs-feed-card[data-course-id="' + courseId + '"]');
                    if (card && typeof data.views === "number") {
                        var viewsEl = card.querySelector(".crs-feed-stat:nth-child(2) strong");
                        if (viewsEl) {
                            viewsEl.textContent = formatStatNumber(data.views);
                            console.log("[VIEW TRACKER] UPDATED DOM: courseId=" + courseId + " views=" + data.views);
                        }
                    }
                }
            }).catch(function (err) {
                console.log("[VIEW TRACKER] FETCH ERROR:", err.message);
            });
        }, self.DEBOUNCE_MS);
    }
};

function initViewTracking() {
    try { localStorage.removeItem("crs_viewed_session"); } catch (e) { }

    if (!("IntersectionObserver" in window)) {
        console.log("[VIEW TRACKER] IntersectionObserver not supported");
        return;
    }

    var cards = document.querySelectorAll(".crs-feed-card[data-course-id]");
    console.log("[VIEW TRACKER] Found " + cards.length + " cards to observe");

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                var card = entry.target;
                var courseId = card.getAttribute("data-course-id");
                var teacherUid = card.getAttribute("data-teacher-uid");
                console.log("[VIEW TRACKER] CARD IN VIEW: courseId=" + courseId + " teacherUid=" + teacherUid);
                if (courseId && teacherUid) {
                    VIEW_TRACKER.sendView(courseId, teacherUid);
                } else {
                    console.log("[VIEW TRACKER] MISSING ATTRS");
                }
                observer.unobserve(card);
            }
        });
    }, { threshold: 0.5 });

    cards.forEach(function (card) {
        observer.observe(card);
    });
}

/* =========================
   UPGRADE MODAL
========================= */

var UpgradeModal = {
    STORAGE_KEY: "crs_upgrade永久",

    shouldShow: function () {
        try {
            var val = localStorage.getItem(this.STORAGE_KEY);
            if (val === "dismissed") return false;
            return true;
        } catch (e) {
            return true;
        }
    },

    dismiss: function () {
        try {
            localStorage.setItem(this.STORAGE_KEY, "dismissed");
        } catch (e) {}
    },

    create: function () {
        var self = this;
        var overlay = document.createElement("div");
        overlay.className = "crs-upgrade-overlay";
        overlay.id = "crsUpgradeOverlay";

        var CHECK = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';

        overlay.innerHTML =
            '<div class="crs-upgrade-modal">' +
                '<button class="crs-upgrade-close" id="crsUpgradeClose">&times;</button>' +
                '<div class="crs-upgrade-top">' +
                    '<div class="crs-upgrade-badge">' +
                        '<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' +
                    '</div>' +
                    '<h2>Upgrade Your Account</h2>' +
                    '<p>Unlock premium features and get more out of Impact Academy.</p>' +
                '</div>' +
                '<div class="crs-upgrade-body">' +
                    '<ul class="crs-upgrade-benefits">' +
                        '<li>' + CHECK + ' Access exclusive features</li>' +
                        '<li>' + CHECK + ' Higher limits and better visibility</li>' +
                        '<li>' + CHECK + ' Premium learning experience</li>' +
                        '<li>' + CHECK + ' Priority access to new features</li>' +
                    '</ul>' +
                    '<div class="crs-upgrade-divider"></div>' +
                '</div>' +
                '<div class="crs-upgrade-footer">' +
                    '<div class="crs-upgrade-dont-ask">' +
                        '<input type="checkbox" id="crsUpgradeDontAsk">' +
                        '<span>Don\'t ask me again</span>' +
                    '</div>' +
                    '<div class="crs-upgrade-actions">' +
                        '<button class="crs-upgrade-btn secondary" id="crsUpgradeLater">Maybe Later</button>' +
                        '<button class="crs-upgrade-btn primary" id="crsUpgradeNow">Upgrade Now</button>' +
                    '</div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        var dontAsk = overlay.querySelector("#crsUpgradeDontAsk");

        overlay.querySelector("#crsUpgradeClose").addEventListener("click", function () {
            if (dontAsk.checked) self.dismiss();
            self.close(overlay);
        });

        overlay.querySelector("#crsUpgradeLater").addEventListener("click", function () {
            if (dontAsk.checked) self.dismiss();
            self.close(overlay);
        });

        overlay.querySelector("#crsUpgradeNow").addEventListener("click", function () {
            if (dontAsk.checked) self.dismiss();
            self.close(overlay);
            window.location.href = "../pricing/index.html";
        });

        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) {
                if (dontAsk.checked) self.dismiss();
                self.close(overlay);
            }
        });

        requestAnimationFrame(function () {
            overlay.classList.add("show");
        });
    },

    close: function (overlay) {
        overlay.classList.remove("show");
        setTimeout(function () {
            overlay.remove();
        }, 300);
    },

    check: function (user) {
        if (!user) return;
        if (user.isPro || user.isElite) return;
        if (!this.shouldShow()) return;

        var self = this;
        setTimeout(function () {
            self.create();
        }, 1500);
    }
};

function initViewTracking() {
    try { localStorage.removeItem("crs_viewed_session"); } catch (e) {}

    if (!("IntersectionObserver" in window)) return;

    var cards = document.querySelectorAll(".crs-feed-card[data-course-id]");
    console.log("[VIEW TRACKER] Found " + cards.length + " cards to observe");

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                var card = entry.target;
                var courseId = card.getAttribute("data-course-id");
                var teacherUid = card.getAttribute("data-teacher-uid");
                if (courseId && teacherUid) {
                    VIEW_TRACKER.sendView(courseId, teacherUid);
                }
                observer.unobserve(card);
            }
        });
    }, { threshold: 0.5 });

    cards.forEach(function (card) {
        observer.observe(card);
    });
}


/* =========================
   MOBILE MENU
========================= */

function initMobileMenu() {
    var hamburger = document.getElementById("shHamburger");
    var mobileMenu = document.getElementById("shMobileMenu");
    if (hamburger && mobileMenu) {
        hamburger.addEventListener("click", function () {
            mobileMenu.classList.toggle("open");
        });
    }
}

/* =========================
   MAIN INIT
========================= */

document.addEventListener("DOMContentLoaded", async function () {
    initMobileMenu();
    initClickEffects();

    /* Auth */
    var auth = await AuthenticateUser();
    if (!auth.success) {
        window.location.href = "../../../signin/";
        return;
    }

    var user = auth.user;
    if (user) {
        var avatar = document.getElementById("navAvatar");
        if (avatar) {
            var name = user.fullname || user.full_name || user.name || user.username || user.email || "S";
            avatar.textContent = name.trim().charAt(0).toUpperCase();
        }
    }

    var allowedStudentTypes = ["student", "va-student"];
    var userType = (user?.accountType || "").toLowerCase().trim();
    if (!allowedStudentTypes.includes(userType)) {
        window.location.href = "../../../404.html";
        return;
    }

    /* Redirect to setup if not completed */
    if (user.setupCompleted === false) {
        window.location.href = "../set-up/";
        return;
    }

    /* Check subscription and show upgrade modal if needed */
    UpgradeModal.check(user);

    /* =========================
       PAYMENT VERIFICATION POLLING
       Uses GET /api/student/pending-subscription to find active payment
       from the database, then polls POST /api/payment/verify/:paymentId.
    ========================= */

    var _payPollInterval = null;
    var _payPollActive = false;

    async function pollPaymentVerification() {
        if (_payPollActive) return;
        _payPollActive = true;

        try {
            /* 1. Ask backend for ALL pending payments */
            var pendingRes = await fetch(API_URL + "/api/student/pending-subscription", {
                credentials: "include",
                cache: "no-store"
            });
            var pendingData = await pendingRes.json().catch(function () { return {}; });

            if (!pendingRes.ok || !pendingData.success) {
                console.log("[PAYMENT] pending-subscription failed: status=" + pendingRes.status);
                _payPollActive = false;
                return;
            }

            var payments = pendingData.pendingPayments || [];
            if (payments.length === 0) {
                console.log("[PAYMENT] No pending payments found.");
                if (_payPollInterval) {
                    clearInterval(_payPollInterval);
                    _payPollInterval = null;
                }
                _payPollActive = false;
                return;
            }

            console.log("[PAYMENT] Found " + payments.length + " pending payment(s). Verifying...");

            var anyPaid = false;

            /* Verify each pending payment */
            for (var i = 0; i < payments.length; i++) {
                var p = payments[i];
                console.log("[PAYMENT] Checking paymentId=" + p.paymentId + " plan=" + p.plan + " status=" + p.status);

                try {
                    var verifyRes = await fetch(API_URL + "/api/payment/verify/" + encodeURIComponent(p.paymentId), {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" }
                    });
                    var verifyData = await verifyRes.json().catch(function () { return {}; });

                    console.log("[PAYMENT] Verify response: paymentId=" + p.paymentId + " status=" + verifyData.status);

                    if (verifyData.status === "paid") {
                        anyPaid = true;
                    }
                } catch (e) {
                    console.log("[PAYMENT] Verify error for " + p.paymentId + ": " + e.message);
                }
            }

            if (anyPaid) {
                /* Stop polling */
                if (_payPollInterval) {
                    clearInterval(_payPollInterval);
                    _payPollInterval = null;
                }

                console.log("[PAYMENT] At least one payment confirmed! Refreshing user data...");

                /* Refresh user data */
                var authRes = await fetch(API_URL + "/api/auth/validate-session", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" }
                });
                var authData = await authRes.json().catch(function () { return {}; });
                if (authData.success && authData.user) {
                    localStorage.setItem("impactech_user", JSON.stringify(authData.user));

                    /* Hide upgrade modal */
                    var overlay = document.getElementById("crsUpgradeOverlay");
                    if (overlay) {
                        overlay.classList.remove("show");
                        setTimeout(function () { overlay.remove(); }, 300);
                    }

                    /* Update avatar */
                    var avatar = document.getElementById("navAvatar");
                    if (avatar && authData.user.fullname) {
                        avatar.textContent = authData.user.fullname.trim().charAt(0).toUpperCase();
                    }
                }
            }
        } catch (e) {
            console.log("[PAYMENT] Poll error:", e.message);
        }

        _payPollActive = false;
    }

    /* Start polling if user has a pending subscription */
    async function initPaymentPolling() {
        try {
            var res = await fetch(API_URL + "/api/student/pending-subscription", {
                credentials: "include",
                cache: "no-store"
            });
            var data = await res.json().catch(function () { return {}; });
            var payments = data.pendingPayments || [];
            if (payments.length > 0) {
                console.log("[PAYMENT] Found " + payments.length + " pending payment(s) on courses page, starting poll...");
                pollPaymentVerification();
                _payPollInterval = setInterval(pollPaymentVerification, 30000);
            } else {
                console.log("[PAYMENT] No pending payments on courses page.");
            }
        } catch (e) {}
    }

    initPaymentPolling();
    window.addEventListener("beforeunload", function () {
        if (_payPollInterval) clearInterval(_payPollInterval);
    });

    /* Show skeletons */
    showEnrolledSkeleton();
    showBrowseSkeleton();
    showCategoriesSkeleton();

    /* Show search loader if ?search= in URL on page load */
    var urlSearchParam = new URLSearchParams(window.location.search).get("search");
    if (urlSearchParam) {
        SearchLoader.show(urlSearchParam);
        syncSourceInputs(urlSearchParam);
    }

    /* Fetch both endpoints in parallel */
    var results = await Promise.allSettled([fetchStudentCourses(), fetchDashboard()]);
    var coursesResult = results[0].status === "fulfilled" ? results[0].value : { success: false, courses: [] };
    var dashResult = results[1].status === "fulfilled" ? results[1].value : { success: false };

    hideSkeletons();

    /* Handle courses catalog error */
    if (!coursesResult.success) {
        showError("browseGrid", coursesResult.message || "Failed to load courses.");
        if (urlSearchParam) SearchLoader.hide("error");
    } else {
        renderBrowseCourses(coursesResult.courses || []);
        renderCategories(coursesResult.courses || []);
        updateHeroStats(coursesResult.total || (coursesResult.courses || []).length);
        initViewTracking();
        /* Show search status if ?search= was in URL on load */
        if (urlSearchParam) {
            updateSearchStatus(urlSearchParam, coursesResult);
            SearchLoader.hide("done", urlSearchParam);
            setTimeout(function () {
                scrollToBrowseSection();
            }, 500);
        }
    }

    /* Handle enrolled / dashboard error */
    if (!dashResult.success) {
        showError("enrolledList", dashResult.message || "Failed to load your courses.");
    } else {
        renderEnrolledCourses(dashResult.courses || []);
    }

    /* ── Initialize Search Popup ── */
    initSearchPopup();
});

/* ═══════════════════════════════════════════════
   SEARCH POPUP
═══════════════════════════════════════════════ */

var SearchPopup = {
    overlay: null,
    popup: null,
    input: null,
    clearBtn: null,
    submitBtn: null,
    closeBtn: null,
    isOpen: false,
    debounceTimer: null,
    recCache: null,
    trendingCache: null,
    categoriesCache: null,
    recentCache: null,
    sourceInput: null
};

function initSearchPopup() {
    SearchPopup.overlay = document.getElementById("searchOverlay");
    SearchPopup.popup = document.getElementById("searchPopup");
    SearchPopup.input = document.getElementById("searchPopupInput");
    SearchPopup.clearBtn = document.getElementById("searchClearBtn");
    SearchPopup.submitBtn = document.getElementById("searchSubmitBtn");
    SearchPopup.closeBtn = document.getElementById("searchCloseBtn");

    if (!SearchPopup.input) return;

    /* Close buttons */
    if (SearchPopup.closeBtn) SearchPopup.closeBtn.addEventListener("click", closeSearchPopup);
    if (SearchPopup.overlay) SearchPopup.overlay.addEventListener("click", closeSearchPopup);

    /* Clear button */
    if (SearchPopup.clearBtn) {
        SearchPopup.clearBtn.addEventListener("click", function () {
            SearchPopup.input.value = "";
            SearchPopup.input.focus();
            updateClearBtn();
            showDefaultState();
        });
    }

    /* Input events: live search */
    SearchPopup.input.addEventListener("input", function () {
        updateClearBtn();
        var q = SearchPopup.input.value.trim();
        syncSourceInputs(q);
        if (q.length >= 2) {
            showLiveResults(q);
        } else {
            showDefaultState();
        }
    });

    /* Submit on Enter */
    SearchPopup.input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            e.preventDefault();
            submitSearch();
        }
    });

    /* Submit on button click */
    if (SearchPopup.submitBtn) {
        SearchPopup.submitBtn.addEventListener("click", function (e) {
            e.preventDefault();
            submitSearch();
        });
    }

    /* Global ESC */
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && SearchPopup.isOpen) {
            closeSearchPopup();
        }
    });

    /* Clear recent searches button */
    var clearRecentBtn = document.getElementById("clearRecentBtn");
    if (clearRecentBtn) {
        clearRecentBtn.addEventListener("click", function () {
            clearAllRecentSearches();
        });
    }
}

function openSearchPopup(sourceEl) {
    SearchPopup.isOpen = true;
    SearchPopup.sourceInput = sourceEl || null;
    SearchPopup.overlay.classList.add("active");
    SearchPopup.popup.classList.add("active");
    document.body.style.overflow = "hidden";

    /* Pre-fill from source input, URL, or nav input */
    var val = "";
    if (sourceEl && sourceEl.value) {
        val = sourceEl.value;
    } else {
        var urlParams = new URLSearchParams(window.location.search);
        val = urlParams.get("search") || "";
        if (!val) {
            var navInput = document.getElementById("courseSearchInput");
            var heroInput = document.getElementById("mainSearchInput");
            if (navInput && navInput.value) val = navInput.value;
            else if (heroInput && heroInput.value) val = heroInput.value;
        }
    }
    SearchPopup.input.value = val;
    updateClearBtn();
    if (val && val.length >= 2) {
        showLiveResults(val);
    } else {
        showDefaultState();
    }
    setTimeout(function () { SearchPopup.input.focus(); }, 300);
    loadRecentSearches();
    loadTrendingSearches();
    loadCategories();
    loadRecommendations();
}

function closeSearchPopup() {
    SearchPopup.isOpen = false;
    SearchPopup.overlay.classList.remove("active");
    SearchPopup.popup.classList.remove("active");
    document.body.style.overflow = "";
    SearchPopup.input.value = "";
    updateClearBtn();
}

/* ── Sync both page inputs ── */

function syncSourceInputs(val) {
    var navInput = document.getElementById("courseSearchInput");
    var heroInput = document.getElementById("mainSearchInput");
    if (navInput) navInput.value = val;
    if (heroInput) heroInput.value = val;
}

function updateClearBtn() {
    if (SearchPopup.clearBtn) {
        SearchPopup.clearBtn.classList.toggle("visible", SearchPopup.input.value.length > 0);
    }
}

/* ── State Management ── */

function hideAllStates() {
    ["searchDefaultState", "searchLiveState", "searchLoadingState", "searchEmptyState"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = "none";
    });
}

function showDefaultState() {
    hideAllStates();
    var def = document.getElementById("searchDefaultState");
    if (def) def.style.display = "";
}

function showLiveResults(query) {
    hideAllStates();
    var live = document.getElementById("searchLiveState");
    if (live) live.style.display = "";

    var title = document.getElementById("searchLiveTitle");
    if (title) title.textContent = "Searching...";

    var list = document.getElementById("searchLiveList");
    if (list) list.innerHTML = '<div class="crs-search-loading"><i class="fa-solid fa-spinner"></i> Searching...</div>';

    clearTimeout(SearchPopup.debounceTimer);
    SearchPopup.debounceTimer = setTimeout(function () {
        fetch(API_URL + "/api/student/courses/search?q=" + encodeURIComponent(query) + "&limit=8", {
            credentials: "include",
            cache: "no-store"
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (title) title.textContent = data.success ? (data.total + " result" + (data.total !== 1 ? "s" : "")) : "No results";
            if (list) {
                if (data.success && data.courses && data.courses.length > 0) {
                    list.innerHTML = "";
                    data.courses.forEach(function (course, i) {
                        list.appendChild(buildLiveResultItem(course, i));
                    });
                } else {
                    list.innerHTML = '<div class="crs-search-empty" style="padding:24px 0"><div class="crs-search-empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div><h3>No results found</h3><p>Try different keywords or browse the categories below.</p></div>';
                }
            }
        })
        .catch(function () {
            if (title) title.textContent = "Search failed";
            if (list) list.innerHTML = '<div class="crs-search-empty" style="padding:24px 0"><p>Something went wrong. Please try again.</p></div>';
        });
    }, 300);
}

function showLoading() {
    hideAllStates();
    var el = document.getElementById("searchLoadingState");
    if (el) el.style.display = "";
}

function showEmpty() {
    hideAllStates();
    var el = document.getElementById("searchEmptyState");
    if (el) el.style.display = "";
}

/* ── Search Submission ── */

function submitSearch() {
    var q = (SearchPopup.input.value || "").trim();
    if (!q) return;

    saveRecentSearch(q);

    /* Show global search loader */
    SearchLoader.show(q);

    /* Update URL */
    var url = new URL(window.location);
    url.searchParams.set("search", q);
    window.history.replaceState({}, "", url);

    /* Sync both page inputs */
    syncSourceInputs(q);

    /* Close popup */
    closeSearchPopup();

    /* Reload courses with search */
    loadCoursesWithSearch(q);
}

function loadCoursesWithSearch(query) {
    showBrowseSkeleton();
    showCategoriesSkeleton();

    var url = API_URL + "/api/student/courses";
    if (query) url += "?search=" + encodeURIComponent(query);

    fetch(url, { credentials: "include", cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
        hideSkeletons();
        if (!data.success) {
            showError("browseGrid", data.message || "Failed to load courses.");
            SearchLoader.hide("error");
        } else {
            renderBrowseCourses(data.courses || []);
            renderCategories(data.courses || []);
            updateHeroStats(data.total || (data.courses || []).length);
            initViewTracking();
            SearchLoader.hide("done", query);
        }
        updateSearchStatus(query, data);
        /* Auto-scroll to results */
        if (query) {
            setTimeout(function () {
                scrollToBrowseSection();
            }, 500);
        }
    })
    .catch(function () {
        hideSkeletons();
        showError("browseGrid", "Network error. Please try again.");
        SearchLoader.hide("error");
    });
}

function updateSearchStatus(query, data) {
    var feedSection = document.getElementById("browseGrid");
    var existingStatus = document.getElementById("crs-search-status");
    if (existingStatus) existingStatus.remove();

    if (!query) return;

    var total = (data.courses || []).length;
    var statusEl = document.createElement("div");
    statusEl.id = "crs-search-status";
    statusEl.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:10px 16px;margin-bottom:16px;border-radius:12px;background:var(--light);border:1px solid var(--border);";

    var text = document.createElement("span");
    text.style.cssText = "font-size:14px;font-weight:600;color:var(--text);";
    text.textContent = total + " result" + (total !== 1 ? "s" : "") + " for \"" + query + "\"";

    var clearBtn = document.createElement("button");
    clearBtn.style.cssText = "padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--white);color:var(--muted);font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;transition:all 0.15s;";
    clearBtn.textContent = "Clear search";
    clearBtn.addEventListener("mouseenter", function () { this.style.borderColor = "var(--primary)"; this.style.color = "var(--primary)"; });
    clearBtn.addEventListener("mouseleave", function () { this.style.borderColor = "var(--border)"; this.style.color = "var(--muted)"; });
    clearBtn.addEventListener("click", function () {
        var url = new URL(window.location);
        url.searchParams.delete("search");
        window.history.replaceState({}, "", url);
        syncSourceInputs("");
        loadCoursesWithSearch("");
    });

    statusEl.appendChild(text);
    statusEl.appendChild(clearBtn);
    if (feedSection) feedSection.parentNode.insertBefore(statusEl, feedSection);
}

/* ── Scroll to Browse Section ── */

function scrollToBrowseSection() {
    requestAnimationFrame(function () {
        var browseSection = document.querySelector(".crs-browse-section");
        if (!browseSection) return;

        var navbar = document.querySelector(".sh-navbar");
        var navbarHeight = navbar ? navbar.offsetHeight : 72;
        var offset = navbarHeight + 16;

        var rect = browseSection.getBoundingClientRect();
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        var targetTop = rect.top + scrollTop - offset;

        window.scrollTo({ top: targetTop, behavior: "smooth" });
    });
}

function loadRecentSearches() {
    var section = document.getElementById("searchRecentSection");
    var list = document.getElementById("searchRecentList");
    if (!section || !list) return;

    fetch(API_URL + "/api/student/search/recent?limit=10", {
        credentials: "include",
        cache: "no-store"
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
        if (data.success && data.searches && data.searches.length > 0) {
            SearchPopup.recentCache = data.searches;
            section.style.display = "";
            list.innerHTML = "";
            data.searches.forEach(function (item) {
                var chip = document.createElement("div");
                chip.className = "crs-search-recent-chip";
                chip.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> ' + esc(item.query) +
                    '<button class="crs-search-recent-remove" data-query="' + esc(item.query) + '"><i class="fa-solid fa-xmark"></i></button>';

                chip.addEventListener("click", function (e) {
                    if (e.target.closest(".crs-search-recent-remove")) return;
                    SearchPopup.input.value = item.query;
                    updateClearBtn();
                    submitSearch();
                });

                var removeBtn = chip.querySelector(".crs-search-recent-remove");
                if (removeBtn) {
                    removeBtn.addEventListener("click", function (e) {
                        e.stopPropagation();
                        removeRecentSearch(item.query, chip);
                    });
                }

                list.appendChild(chip);
            });
        } else {
            section.style.display = "none";
        }
    })
    .catch(function () {
        section.style.display = "none";
    });
}

function saveRecentSearch(query) {
    fetch(API_URL + "/api/student/search/recent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query })
    }).catch(function () {});
}

function removeRecentSearch(query, chipEl) {
    fetch(API_URL + "/api/student/search/recent/" + encodeURIComponent(query), {
        method: "DELETE",
        credentials: "include"
    })
    .then(function () {
        if (chipEl) chipEl.remove();
        var section = document.getElementById("searchRecentSection");
        var list = document.getElementById("searchRecentList");
        if (section && list && list.children.length === 0) {
            section.style.display = "none";
        }
    })
    .catch(function () {});
}

function clearAllRecentSearches() {
    fetch(API_URL + "/api/student/search/recent", {
        method: "DELETE",
        credentials: "include"
    })
    .then(function () {
        var section = document.getElementById("searchRecentSection");
        var list = document.getElementById("searchRecentList");
        if (section) section.style.display = "none";
        if (list) list.innerHTML = "";
        SearchPopup.recentCache = null;
    })
    .catch(function () {});
}

/* ── Trending Searches ── */

function loadTrendingSearches() {
    if (SearchPopup.trendingCache) {
        renderTrendingTags(SearchPopup.trendingCache);
        return;
    }

    fetch(API_URL + "/api/student/courses/trending", {
        credentials: "include",
        cache: "no-store"
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
        if (data.success) {
            SearchPopup.trendingCache = data;
            renderTrendingTags(data);
        }
    })
    .catch(function () {});
}

var TRENDING_TAG_ICONS = ["fa-fire", "fa-arrow-trend-up", "fa-bolt", "fa-star", "fa-heart"];

function renderTrendingTags(data) {
    var container = document.getElementById("searchTrendingTags");
    if (!container || !data.trending) return;

    container.innerHTML = "";
    data.trending.forEach(function (item, i) {
        var tag = document.createElement("button");
        tag.className = "crs-search-tag";
        tag.innerHTML = '<i class="fa-solid ' + (TRENDING_TAG_ICONS[i % TRENDING_TAG_ICONS.length]) + '"></i> ' + esc(item.category);
        tag.addEventListener("click", function () {
            SearchPopup.input.value = item.category;
            updateClearBtn();
            submitSearch();
        });
        container.appendChild(tag);
    });
}

/* ── Categories ── */

function loadCategories() {
    if (SearchPopup.categoriesCache) {
        renderCategoryCards(SearchPopup.categoriesCache);
        return;
    }

    fetch(API_URL + "/api/student/courses/categories", {
        credentials: "include",
        cache: "no-store"
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
        if (data.success && data.categories) {
            SearchPopup.categoriesCache = data.categories;
            renderCategoryCards(data.categories);
        }
    })
    .catch(function () {});
}

var CAT_ICONS = {
    "ai": "fa-robot", "technology": "fa-microchip", "tech": "fa-microchip",
    "design": "fa-pen-nib", "business": "fa-briefcase", "marketing": "fa-bullhorn",
    "finance": "fa-coins", "health": "fa-heart-pulse", "education": "fa-graduation-cap",
    "development": "fa-code", "programming": "fa-code", "web": "fa-globe",
    "default": "fa-folder"
};

var CAT_COLORS = [
    "rgba(37,99,235,0.10)", "rgba(6,182,212,0.10)", "rgba(245,158,11,0.10)", "rgba(168,85,247,0.10)",
    "rgba(239,68,68,0.10)", "rgba(34,197,94,0.10)", "rgba(236,72,153,0.10)", "rgba(99,102,241,0.10)"
];

function renderCategoryCards(categories) {
    var grid = document.getElementById("searchCategoriesGrid");
    if (!grid) return;

    grid.innerHTML = "";
    categories.forEach(function (cat, i) {
        var key = cat.category.toLowerCase();
        var icon = CAT_ICONS["default"];
        Object.keys(CAT_ICONS).forEach(function (k) {
            if (key.includes(k)) icon = CAT_ICONS[k];
        });

        var card = document.createElement("div");
        card.className = "crs-search-cat-card";
        card.innerHTML =
            '<div class="crs-search-cat-icon" style="background:' + (CAT_COLORS[i % CAT_COLORS.length]) + '">' +
            '<i class="fa-solid ' + icon + '"></i>' +
            '</div>' +
            '<div class="crs-search-cat-info">' +
            '<div class="crs-search-cat-name">' + esc(cat.category) + '</div>' +
            '<div class="crs-search-cat-count">' + cat.count + ' courses</div>' +
            '</div>';
        card.addEventListener("click", function () {
            SearchPopup.input.value = cat.category;
            updateClearBtn();
            submitSearch();
        });
        grid.appendChild(card);
    });
}

/* ── Recommendations ── */

function loadRecommendations() {
    if (SearchPopup.recCache) {
        renderRecommendations(SearchPopup.recCache);
        return;
    }

    var grid = document.getElementById("searchRecGrid");
    if (!grid) return;

    fetch(API_URL + "/api/student/recommended-courses?limit=8", {
        credentials: "include",
        cache: "no-store"
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
        if (data.success && data.courses && data.courses.length > 0) {
            SearchPopup.recCache = data.courses;
            renderRecommendations(data.courses);
        } else {
            loadFallbackRecommendations();
        }
    })
    .catch(function () {
        loadFallbackRecommendations();
    });
}

function loadFallbackRecommendations() {
    fetch(API_URL + "/api/student/courses", {
        credentials: "include",
        cache: "no-store"
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
        if (data.success && data.courses && data.courses.length > 0) {
            var top = data.courses.slice(0, 8);
            SearchPopup.recCache = top;
            renderRecommendations(top);
        } else {
            var grid = document.getElementById("searchRecGrid");
            if (grid) grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--muted);font-size:14px;padding:32px 0;">No recommendations available yet.</p>';
        }
    })
    .catch(function () {
        var grid = document.getElementById("searchRecGrid");
        if (grid) grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--muted);font-size:14px;padding:32px 0;">Could not load recommendations.</p>';
    });
}

var REC_PLACEHOLDER_COLORS = ["#2563eb","#06b6d4","#f59e0b","#a855f7","#ef4444","#22c55e","#ec4899","#6366f1"];
var REC_PLACEHOLDER_ICONS = ["fa-robot","fa-code","fa-bullhorn","fa-pen-nib","fa-headset","fa-file-lines","fa-calculator","fa-lightbulb"];

function renderRecommendations(courses) {
    var grid = document.getElementById("searchRecGrid");
    if (!grid || !courses || courses.length === 0) return;

    grid.innerHTML = "";
    courses.forEach(function (course, i) {
        var card = document.createElement("div");
        card.className = "crs-search-rec-card";
        card.setAttribute("data-course-id", course.courseId);

        var thumbHtml = "";
        if (course.thumbnail) {
            thumbHtml = '<img src="' + esc(course.thumbnail) + '" alt="">';
        } else {
            thumbHtml = '<div class="crs-search-rec-thumb-placeholder" style="background:' + REC_PLACEHOLDER_COLORS[i % REC_PLACEHOLDER_COLORS.length] + '">' +
                '<i class="fa-solid ' + (REC_PLACEHOLDER_ICONS[i % REC_PLACEHOLDER_ICONS.length]) + '"></i></div>';
        }

        var accessType = String(course.accessType || "free").toLowerCase();
        var accessLabel = accessType === "paid" ? "Paid" : accessType === "subscription" ? "Pro" : "Free";

        var teacherName = course.teacher?.fullname || "Unknown";
        var teacherPhoto = course.teacher?.photoURL || "";
        var teacherMeta = "";
        if (teacherPhoto) {
            teacherMeta = '<img src="' + esc(teacherPhoto) + '" alt="">';
        } else {
            teacherMeta = '<div class="crs-search-rec-meta-placeholder">' + getInitials(teacherName) + '</div>';
        }

        var reason = course.recommendationReason;
        var reasonHtml = "";
        if (reason && reason.text) {
            var reasonIcon = "fa-sparkles";
            var rType = String(reason.type || "").toLowerCase();
            if (rType === "interest" || rType === "category") reasonIcon = "fa-bullseye";
            else if (rType === "follow" || rType === "viewed_teacher" || rType === "enrolled_teacher") reasonIcon = "fa-user-check";
            else if (rType === "viewed") reasonIcon = "fa-eye";
            else if (rType === "learning") reasonIcon = "fa-graduation-cap";
            else if (rType === "tag") reasonIcon = "fa-tags";
            else if (rType === "popular") reasonIcon = "fa-fire";
            else if (rType === "new") reasonIcon = "fa-certificate";
            else if (rType === "free") reasonIcon = "fa-gift";
            else if (rType === "recommended") reasonIcon = "fa-wand-magic-sparkles";
            reasonHtml = '<div class="crs-search-rec-reason"><i class="fa-solid ' + reasonIcon + '"></i><span>' + esc(reason.text) + '</span></div>';
        }

        card.innerHTML =
            '<div class="crs-search-rec-thumb">' + thumbHtml +
            '<span class="crs-search-rec-access">' + accessLabel + '</span>' +
            '</div>' +
            '<div class="crs-search-rec-info">' +
            '<div class="crs-search-rec-title">' + esc(course.title) + '</div>' +
            '<div class="crs-search-rec-meta">' + teacherMeta + '<span>' + esc(teacherName) + '</span></div>' +
            reasonHtml +
            '</div>';

        card.addEventListener("click", function () {
            window.location.href = "../view-course/?cid=" + encodeURIComponent(course.courseId);
        });

        grid.appendChild(card);
    });
}

/* ── Live Result Item Builder ── */

var LIVE_PLACEHOLDER_COLORS = ["#2563eb","#06b6d4","#f59e0b","#a855f7","#ef4444","#22c55e"];
var LIVE_PLACEHOLDER_ICONS = ["fa-robot","fa-code","fa-bullhorn","fa-pen-nib","fa-headset","fa-file-lines"];

function buildLiveResultItem(course, index) {
    var el = document.createElement("div");
    el.className = "crs-search-live-item";

    var thumbHtml = "";
    if (course.thumbnail) {
        thumbHtml = '<img src="' + esc(course.thumbnail) + '" alt="">';
    } else {
        thumbHtml = '<div class="crs-search-live-thumb-placeholder" style="background:' + LIVE_PLACEHOLDER_COLORS[index % LIVE_PLACEHOLDER_COLORS.length] + '">' +
            '<i class="fa-solid ' + (LIVE_PLACEHOLDER_ICONS[index % LIVE_PLACEHOLDER_ICONS.length]) + '"></i></div>';
    }

    var accessType = String(course.accessType || "free").toLowerCase();
    var badgeClass = "crs-search-live-badge";
    if (accessType === "paid") badgeClass += " paid";
    var badgeText = accessType === "paid" ? "Paid" : accessType === "subscription" ? "Pro" : "Free";

    el.innerHTML =
        '<div class="crs-search-live-thumb">' + thumbHtml + '</div>' +
        '<div class="crs-search-live-info">' +
        '<div class="crs-search-live-title">' + esc(course.title) + '</div>' +
        '<div class="crs-search-live-meta">' + esc(course.teacher?.fullname || "Unknown") + ' &middot; ' + esc(course.category || "") + '</div>' +
        '</div>' +
        '<span class="crs-search-live-badge ' + badgeClass + '">' + badgeText + '</span>';

    el.addEventListener("click", function () {
        saveRecentSearch(course.title);
        window.location.href = "../view-course/?cid=" + encodeURIComponent(course.courseId);
    });

    return el;
}

/* ═══════════════════════════════════════════════
   GLOBAL SEARCH LOADER
   ═══════════════════════════════════════════════ */

var SearchLoader = {
    overlay: null,
    card: null,
    iconWrap: null,
    textEl: null,
    subtextEl: null,
    dotsEl: null,
    rotateTimer: null,
    forceTimer: null,
    doneTimer: null,
    _active: false,

    MESSAGES: [
        "Searching courses...",
        "Finding the best matches...",
        "Looking through categories...",
        "Checking recommendations...",
        "Preparing results...",
        "Scanning instructors...",
        "Filtering by relevance..."
    ],

    init: function () {
        if (this.overlay) return;

        this.overlay = document.createElement("div");
        this.overlay.className = "crs-search-loader-overlay";

        this.card = document.createElement("div");
        this.card.className = "crs-search-loader-card";

        this.iconWrap = document.createElement("div");
        this.iconWrap.className = "crs-search-loader-icon-wrap";
        this.iconWrap.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';

        this.textEl = document.createElement("div");
        this.textEl.className = "crs-search-loader-text";
        this.textEl.textContent = "Searching...";

        this.subtextEl = document.createElement("div");
        this.subtextEl.className = "crs-search-loader-subtext";
        this.subtextEl.textContent = this.MESSAGES[0];

        this.dotsEl = document.createElement("div");
        this.dotsEl.className = "crs-search-loader-dots";
        this.dotsEl.innerHTML = "<span></span><span></span><span></span>";

        this.card.appendChild(this.iconWrap);
        this.card.appendChild(this.textEl);
        this.card.appendChild(this.subtextEl);
        this.card.appendChild(this.dotsEl);
        this.overlay.appendChild(this.card);
        document.body.appendChild(this.overlay);
    },

    show: function (query) {
        this.init();
        var self = this;
        this._active = true;

        /* Reset to loading state */
        this.iconWrap.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
        this.iconWrap.className = "crs-search-loader-icon-wrap";
        this.textEl.textContent = "Searching...";
        this.subtextEl.textContent = this.MESSAGES[0];
        this.dotsEl.style.display = "";

        /* Show overlay */
        requestAnimationFrame(function () {
            self.overlay.classList.add("show");
        });

        /* Rotate subtext messages */
        var msgIdx = 0;
        clearInterval(this.rotateTimer);
        this.rotateTimer = setInterval(function () {
            if (!self._active) { clearInterval(self.rotateTimer); return; }
            msgIdx = (msgIdx + 1) % self.MESSAGES.length;
            self.subtextEl.style.opacity = "0";
            setTimeout(function () {
                self.subtextEl.textContent = self.MESSAGES[msgIdx];
                self.subtextEl.style.opacity = "1";
            }, 200);
        }, 2200);

        /* Force cleanup after 12s max */
        clearTimeout(this.forceTimer);
        this.forceTimer = setTimeout(function () {
            if (self._active) self.hide("done");
        }, 12000);
    },

    hide: function (state, query) {
        if (!this.overlay || !this._active) return;
        var self = this;
        this._active = false;

        clearInterval(this.rotateTimer);
        clearTimeout(this.forceTimer);

        /* Show done state briefly */
        if (state === "done") {
            this.iconWrap.innerHTML = '<i class="fa-solid fa-check"></i>';
            this.iconWrap.className = "crs-search-loader-done-icon";
            this.textEl.textContent = query ? 'Found results for "' + query + '"' : "Results ready";
            this.subtextEl.textContent = "Loading your courses";
            this.dotsEl.style.display = "none";
        } else if (state === "error") {
            this.iconWrap.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
            this.iconWrap.className = "crs-search-loader-done-icon";
            this.iconWrap.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
            this.textEl.textContent = "Search failed";
            this.subtextEl.textContent = "Please check your connection and try again";
            this.dotsEl.style.display = "none";
        }

        /* Fade out after brief delay */
        clearTimeout(this.doneTimer);
        var delay = (state === "error") ? 1800 : 800;
        this.doneTimer = setTimeout(function () {
            self.overlay.classList.add("fade-out");
            setTimeout(function () {
                self.overlay.classList.remove("show", "fade-out");
                /* Reset for next use */
                self.iconWrap.className = "crs-search-loader-icon-wrap";
                self.iconWrap.style.background = "";
            }, 400);
        }, delay);
    },

    abort: function () {
        this._active = false;
        clearInterval(this.rotateTimer);
        clearTimeout(this.forceTimer);
        clearTimeout(this.doneTimer);
        if (this.overlay) {
            this.overlay.classList.remove("show", "fade-out");
        }
    }
};