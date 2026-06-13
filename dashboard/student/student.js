var API_URL = "https://backend.impactacademy.site";

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */

function esc(str) {
    if (!str) return "";
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

function getInitials(name) {
    if (!name) return "?";
    var parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
}

/* ═══════════════════════════════════════════════
   SEARCH POPUP (shared with courses page)
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
    recentCache: null
};

function initSearchPopup() {
    SearchPopup.overlay = document.getElementById("searchOverlay");
    SearchPopup.popup = document.getElementById("searchPopup");
    SearchPopup.input = document.getElementById("searchPopupInput");
    SearchPopup.clearBtn = document.getElementById("searchClearBtn");
    SearchPopup.submitBtn = document.getElementById("searchSubmitBtn");
    SearchPopup.closeBtn = document.getElementById("searchCloseBtn");

    if (!SearchPopup.input) return;

    /* Bind home page search input to open popup */
    var homeSearchInput = document.getElementById("homeSearchInput");
    if (homeSearchInput) {
        homeSearchInput.addEventListener("focus", function (e) {
            e.preventDefault();
            homeSearchInput.blur();
            openSearchPopup(homeSearchInput);
        });
        homeSearchInput.addEventListener("click", function (e) {
            e.preventDefault();
            openSearchPopup(homeSearchInput);
        });
        homeSearchInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                var q = (homeSearchInput.value || "").trim();
                if (q) {
                    SearchPopup.input.value = q;
                    submitSearch();
                } else {
                    openSearchPopup(homeSearchInput);
                }
            }
        });
    }

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
    SearchPopup.overlay.classList.add("active");
    SearchPopup.popup.classList.add("active");
    document.body.style.overflow = "hidden";

    /* Pre-fill from source input */
    var val = "";
    if (sourceEl && sourceEl.value) {
        val = sourceEl.value;
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

/* ── Search Submission (redirects to courses page) ── */

function submitSearch() {
    var q = (SearchPopup.input.value || "").trim();
    if (!q) return;

    saveRecentSearch(q);
    closeSearchPopup();
    window.location.href = "./courses/?search=" + encodeURIComponent(q);
}

/* ── Recent Searches ── */

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
            saveRecentSearch(course.title);
            window.location.href = "./courses/../view-course/?cid=" + encodeURIComponent(course.courseId);
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
        window.location.href = "./courses/../view-course/?cid=" + encodeURIComponent(course.courseId);
    });

    return el;
}

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

function populateHero(d) {
    var loading = document.getElementById("heroLoading");
    if (loading) {
        loading.classList.add("hidden");
        setTimeout(function () { if (loading.parentNode) loading.parentNode.removeChild(loading); }, 400);
    }

    var el = function (id) { return document.getElementById(id); };

    if (el("greetingText")) el("greetingText").textContent = d.greeting + ",";
    if (el("heroName")) el("heroName").textContent = d.user.firstname + "! \u{1F44B}";
    if (el("pendingLessons")) el("pendingLessons").textContent = d.pendingLessons;
    if (el("nextClassTime")) el("nextClassTime").textContent = d.nextClassTime || "No classes today";
    if (el("streakNum")) el("streakNum").textContent = d.streak.count || 0;

    /* streak dots */
    var dotsContainer = document.getElementById("streakDots");
    if (dotsContainer && d.streak.days) {
        dotsContainer.innerHTML = "";
        var dayLabels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
        dayLabels.forEach(function (label) {
            var dot = document.createElement("span");
            dot.className = "sh-streak-dot" + (d.streak.days.indexOf(label) !== -1 ? " done" : "");
            dot.title = label;
            dotsContainer.appendChild(dot);
        });
    }
}

function populateStats(d) {
    var s = d.stats;
    setText("statCourses", s.courses);
    setText("statHours", s.hours);
    setText("statAssignments", s.assignments);
    setText("statCertificates", s.certificates);
}

function populateProgress(d) {
    var container = document.getElementById("progressList");
    if (!container) return;
    container.innerHTML = "";

    var list = d.courses || [];
    if (!list.length) {
        showEmptyState(container, {
            icon: "fa-book-open",
            pulse: true,
            title: "You don\u2019t have any courses yet",
            message: "It looks like you\u2019re a new student. Your enrolled courses will appear here once they become available.",
            btnText: "Browse Courses",
            btnHref: "#courses",
            btnIcon: "fa-compass"
        });
        return;
    }

    list.forEach(function (course) {
        var card = document.createElement("div");
        card.className = "sh-progress-card";
        card.innerHTML =
            '<div class="sh-progress-thumb" style="background:' + (course.color || "#2563eb") + '20">' +
                '<i class="fa-solid ' + (course.icon || "fa-book") + '" style="color:' + (course.color || "#2563eb") + '"></i>' +
            '</div>' +
            '<div class="sh-progress-info">' +
                '<h4>' + esc(course.title) + '</h4>' +
                '<p>' + esc(course.instructor || "") + '</p>' +
                '<div class="sh-progress-bar">' +
                    '<div class="sh-progress-fill" style="width:' + (course.progress || 0) + '%"></div>' +
                '</div>' +
                '<span class="sh-progress-pct">' + (course.progress || 0) + '% complete</span>' +
            '</div>';
        container.appendChild(card);
    });
}

function populateCourses(d) {
    var container = document.getElementById("courseGrid");
    if (!container) return;
    container.innerHTML = "";

    var list = d.browseCourses || [];
    if (!list.length) {
        showEmptyState(container, {
            icon: "fa-layer-group",
            title: "No courses available right now",
            message: "Our course library is being updated. Check back soon for new offerings.",
            pulse: false
        });
        return;
    }

    list.slice(0, 4).forEach(function (course) {
        var card = document.createElement("div");
        card.className = "sh-course-card";
        card.innerHTML =
            '<div class="sh-course-thumb" style="background:' + (course.color || "#6366f1") + '">' +
                '<span class="sh-course-badge">' + esc(course.category || "General") + '</span>' +
            '</div>' +
            '<div class="sh-course-body">' +
                '<h4>' + esc(course.title) + '</h4>' +
                '<p>' + esc(course.shortDesc || "") + '</p>' +
                '<div class="sh-course-meta">' +
                    '<span><i class="fa-regular fa-clock"></i> ' + esc(course.duration || "") + '</span>' +
                    '<span><i class="fa-solid fa-signal"></i> ' + esc(course.level || "All levels") + '</span>' +
                '</div>' +
            '</div>';
        container.appendChild(card);
    });
}

function populateSchedule(d) {
    if (document.getElementById("scheduleDate")) {
        var now = new Date();
        var opts = { weekday: "long", month: "long", day: "numeric" };
        document.getElementById("scheduleDate").textContent = now.toLocaleDateString("en-US", opts);
    }

    var container = document.getElementById("scheduleList");
    if (!container) return;
    container.innerHTML = "";

    var list = d.schedule || [];
    if (!list.length) {
        showEmptyState(container, {
            icon: "fa-calendar-check",
            title: "No classes scheduled today",
            message: "Enjoy your free time! Your next class will show up here when it\u2019s scheduled.",
            pulse: false
        });
        return;
    }

    list.forEach(function (item) {
        var div = document.createElement("div");
        div.className = "sh-schedule-item" + (item.type === "live" ? " live" : "");
        div.innerHTML =
            '<div class="sh-sched-time">' +
                '<span>' + esc(item.time || "") + '</span>' +
                '<small>' + esc(item.duration || "") + '</small>' +
            '</div>' +
            '<div class="sh-sched-line"><div class="sh-sched-dot"></div></div>' +
            '<div class="sh-sched-info">' +
                '<h4>' + esc(item.title) + '</h4>' +
                '<p><i class="fa-solid fa-chalkboard-user"></i> ' + esc(item.instructor || "") + '</p>' +
            '</div>';
        container.appendChild(div);
    });
}

function populateAchievements(d) {
    var container = document.getElementById("achievementsList");
    if (!container) return;
    container.innerHTML = "";

    var list = d.achievements || [];
    if (!list.length) {
        showEmptyState(container, {
            icon: "fa-trophy",
            title: "No badges earned yet",
            message: "Complete courses and assignments to unlock achievements and show off your progress.",
            pulse: false
        });
        return;
    }

    list.forEach(function (a) {
        var div = document.createElement("div");
        div.className = "sh-achievement";
        div.innerHTML =
            '<div class="sh-achievement-icon" style="background:' + (a.color || "#f59e0b") + '20;color:' + (a.color || "#f59e0b") + '">' +
                '<i class="fa-solid ' + (a.icon || "fa-trophy") + '"></i>' +
            '</div>' +
            '<div>' +
                '<strong>' + esc(a.title) + '</strong>' +
                '<p>' + esc(a.description || "") + '</p>' +
            '</div>';
        container.appendChild(div);
    });
}

function populateAnnouncements(d) {
    var container = document.getElementById("announceList");
    if (!container) return;
    container.innerHTML = "";

    var list = d.announcements || [];
    if (!list.length) {
        showEmptyState(container, {
            icon: "fa-bullhorn",
            title: "No announcements yet",
            message: "Your instructors haven\u2019t posted anything yet. We\u2019ll notify you when they do.",
            pulse: false
        });
        return;
    }

    list.forEach(function (a) {
        var div = document.createElement("div");
        div.className = "sh-announce-item";
        div.innerHTML =
            '<div class="sh-announce-dot"></div>' +
            '<div class="sh-announce-body">' +
                '<h4>' + esc(a.title) + '</h4>' +
                '<p>' + esc(a.message || "") + '</p>' +
                '<small>' + esc(a.date || "") + ' &middot; ' + esc(a.instructor || "") + '</small>' +
            '</div>';
        container.appendChild(div);
    });
}

function populateCertificates(d) {
    var container = document.getElementById("certGrid");
    if (!container) return;
    container.innerHTML = "";

    var list = d.certificates || [];
    if (!list.length) {
        showEmptyState(container, {
            icon: "fa-award",
            title: "No certificates earned yet",
            message: "Finish a course to earn your first certificate and showcase your achievement.",
            pulse: true
        });
        return;
    }

    list.forEach(function (c) {
        var div = document.createElement("div");
        div.className = "sh-cert-card";
        div.innerHTML =
            '<div class="sh-cert-img" style="background:' + (c.color || "#10b981") + '15">' +
                '<i class="fa-solid fa-award" style="color:' + (c.color || "#10b981") + ';font-size:2rem"></i>' +
            '</div>' +
            '<div class="sh-cert-body">' +
                '<h4>' + esc(c.title) + '</h4>' +
                '<p>' + esc(c.issuer || "IMPACTECH ACADEMY") + '</p>' +
                '<span>' + esc(c.date || "") + '</span>' +
            '</div>';
        container.appendChild(div);
    });
}

function showEmptyState(container, opts) {
    if (!container) return;
    container.innerHTML =
        '<div class="sh-empty-state">' +
            '<div class="sh-empty-icon' + (opts.pulse ? " pulse" : "") + '">' +
                '<i class="fa-solid ' + (opts.icon || "fa-box-open") + '"></i>' +
            '</div>' +
            '<h3>' + esc(opts.title || "Nothing here yet") + '</h3>' +
            '<p>' + esc(opts.message || "") + '</p>' +
            (opts.btnText && opts.btnHref
                ? '<a href="' + esc(opts.btnHref) + '" class="sh-empty-btn">' +
                      '<i class="fa-solid ' + (opts.btnIcon || "fa-compass") + '"></i> ' +
                      esc(opts.btnText) +
                  '</a>'
                : "") +
        '</div>';
}

function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val != null ? val : "0";
}

function esc(str) {
    if (!str) return "";
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

document.addEventListener("DOMContentLoaded", async function () {
    var auth = await AuthenticateUser();

    if (!auth.success) {
        window.location.href = "../../signin/";
        return;
    }
    console.log("Authenticated user:", auth.user);

    var allowedStudentTypes = ["student", "va-student"];
    var userType = (auth.user?.accountType || "").toLowerCase().trim();
    if (!allowedStudentTypes.includes(userType)) {
        window.location.href = "../../404.html";
        return;
    }

    if (auth.user?.setupCompleted === false) {
        window.location.href = "./set-up/";
        return;
    }

    initStudentPage(auth.user);
});

function initStudentPage(user) {
    if (user) {
        var avatar = document.getElementById("navAvatar");
        if (avatar) {
            var name = user.fullname || user.full_name || user.name || user.username || user.email || "S";
            avatar.textContent = name.trim().charAt(0).toUpperCase();
        }
    }

    var hamburger = document.getElementById("shHamburger");
    var mobileMenu = document.getElementById("shMobileMenu");

    if (hamburger && mobileMenu) {
        hamburger.addEventListener("click", function () {
            mobileMenu.classList.toggle("open");
        });
    }

    document.querySelectorAll(".sh-filter-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            document.querySelectorAll(".sh-filter-btn").forEach(function (b) {
                b.classList.remove("active");
            });
            this.classList.add("active");
        });
    });

    document.querySelectorAll(".sh-nav-links a, .sh-mobile-menu a:not(.logout-link)").forEach(function (link) {
        link.addEventListener("click", function () {
            document.querySelectorAll(".sh-nav-links a, .sh-mobile-menu a").forEach(function (l) {
                l.classList.remove("active");
            });
            this.classList.add("active");
        });
    });

    fetchDashboard().then(function (d) {
        if (!d || !d.success) {
            var msg = d && d.message ? d.message : "Failed to load dashboard.";
            var container = document.getElementById("dashboardContent");
            if (container) {
                container.innerHTML =
                    '<div class="sh-error-state">' +
                        '<div class="sh-empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>' +
                        '<h3>Access Denied</h3>' +
                        '<p>' + esc(msg) + '</p>' +
                        '<a href="../../signin/" class="sh-empty-btn">' +
                            '<i class="fa-solid fa-arrow-right-to-bracket"></i> Switch Account</a>' +
                    '</div>';
            }
            return;
        }
        populateHero(d);
        populateStats(d);
        populateProgress(d);
        populateCourses(d);
        populateSchedule(d);
        populateAchievements(d);
        populateAnnouncements(d);
        populateCertificates(d);
    });

    /* =========================
       PAYMENT VERIFICATION POLLING
    ========================= */

    var _payPollInterval = null;
    var _payPollActive = false;

    async function pollPaymentVerification() {
        if (_payPollActive) return;
        _payPollActive = true;

        try {
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
                console.log("[PAYMENT] No pending payments.");
                if (_payPollInterval) {
                    clearInterval(_payPollInterval);
                    _payPollInterval = null;
                }
                _payPollActive = false;
                return;
            }

            console.log("[PAYMENT] Found " + payments.length + " pending payment(s). Verifying...");

            var anyPaid = false;

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
                if (_payPollInterval) {
                    clearInterval(_payPollInterval);
                    _payPollInterval = null;
                }

                console.log("[PAYMENT] At least one payment confirmed! Refreshing...");

                var authRes = await fetch(API_URL + "/api/auth/validate-session", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" }
                });
                var authData = await authRes.json().catch(function () { return {}; });
                if (authData.success && authData.user) {
                    localStorage.setItem("impactech_user", JSON.stringify(authData.user));

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

    async function initPaymentPolling() {
        try {
            var res = await fetch(API_URL + "/api/student/pending-subscription", {
                credentials: "include",
                cache: "no-store"
            });
            var data = await res.json().catch(function () { return {}; });
            var payments = data.pendingPayments || [];
            if (payments.length > 0) {
                console.log("[PAYMENT] Found " + payments.length + " pending payment(s) on home page, starting poll...");
                pollPaymentVerification();
                _payPollInterval = setInterval(pollPaymentVerification, 30000);
            } else {
                console.log("[PAYMENT] No pending payments on home page.");
            }
        } catch (e) {}
    }

    initPaymentPolling();
    window.addEventListener("beforeunload", function () {
        if (_payPollInterval) clearInterval(_payPollInterval);
    });

    /* ── Initialize Search Popup ── */
    initSearchPopup();
}
