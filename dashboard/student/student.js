var API_URL = "https://backend.impactacademy.site";

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
        window.location.href = "../../../signin/";
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
        window.location.href = "../set-up/";
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
                        '<a href="../../../signin/" class="sh-empty-btn">' +
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
}
