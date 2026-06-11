/* =============================================
   VIEW COURSE - View Course Detail Page
   Fetches real data from backend API
============================================= */

(function () {
    "use strict";

    var API_BASE = "https://backend.impactacademy.site";

    /* Get course ID from URL */
    var params = new URLSearchParams(window.location.search);
    var courseId = params.get("cid");

    if (!courseId) {
        window.location.href = "../courses/";
        return;
    }

    /* State */
    var courseData = null;

    /* =============================================
       UTILITIES
    ============================================= */

    function showToast(message, type) {
        type = type || "info";
        var existing = document.querySelector(".vc-toast");
        if (existing) existing.remove();
        var toast = document.createElement("div");
        toast.className = "vc-toast " + type;
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                toast.classList.add("show");
            });
        });
        setTimeout(function () {
            toast.classList.remove("show");
            setTimeout(function () { toast.remove(); }, 400);
        }, 3000);
    }

    function esc(s) {
        var d = document.createElement("div");
        d.appendChild(document.createTextNode(s || ""));
        return d.innerHTML;
    }

    function formatNumber(n) {
        n = Number(n) || 0;
        if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
        if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
        return String(n);
    }

    function timeAgo(dateStr) {
        if (!dateStr) return "";
        var now = Date.now();
        var then = new Date(dateStr).getTime();
        var diff = now - then;
        var mins = Math.floor(diff / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return mins + "m ago";
        var hrs = Math.floor(mins / 60);
        if (hrs < 24) return hrs + "h ago";
        var days = Math.floor(hrs / 24);
        if (days < 30) return days + "d ago";
        var months = Math.floor(days / 30);
        if (months < 12) return months + "mo ago";
        return Math.floor(months / 12) + "y ago";
    }

    /* =============================================
       LOADING / ERROR STATES
    ============================================= */

    function showLoading() {
        var el = document.getElementById("vcLoadingScreen");
        if (el) el.style.display = "flex";
        var content = document.getElementById("vcCourseContent");
        if (content) content.style.display = "none";
        var err = document.getElementById("vcErrorScreen");
        if (err) err.style.display = "none";
    }

    function showError(title, msg) {
        var el = document.getElementById("vcLoadingScreen");
        if (el) el.style.display = "none";
        var content = document.getElementById("vcCourseContent");
        if (content) content.style.display = "none";
        var err = document.getElementById("vcErrorScreen");
        if (err) err.style.display = "flex";
        var t = document.getElementById("vcErrorTitle");
        if (t) t.textContent = title || "Course not found";
        var m = document.getElementById("vcErrorMsg");
        if (m) m.textContent = msg || "The course you're looking for doesn't exist or has been removed.";
    }

    function showContent() {
        var el = document.getElementById("vcLoadingScreen");
        if (el) el.style.display = "none";
        var err = document.getElementById("vcErrorScreen");
        if (err) err.style.display = "none";
        var content = document.getElementById("vcCourseContent");
        if (content) content.style.display = "block";
    }

    /* =============================================
       FETCH COURSE DATA
    ============================================= */

    function fetchCourse() {
        showLoading();

        fetch(API_BASE + "/api/course/" + encodeURIComponent(courseId), {
            method: "GET",
            credentials: "include",
            headers: { "Accept": "application/json" },
            cache: "no-store"
        })
        .then(function (res) {
            if (res.status === 401) {
                window.location.href = "../login/";
                throw new Error("Unauthorized");
            }
            if (!res.ok) {
                throw new Error("Course not found");
            }
            return res.json();
        })
        .then(function (data) {
            console.log("[VIEW COURSE] API response:", data);
            if (!data.success || !data.course) {
                showError("Course not found", data.message || "This course doesn't exist or has been removed.");
                return;
            }
            courseData = data.course;
            console.log("[VIEW COURSE] course.promoVideo:", courseData.promoVideo ? courseData.promoVideo.substring(0, 80) + "..." : "null");
            console.log("[VIEW COURSE] course.trailerVideo:", courseData.trailerVideo ? courseData.trailerVideo.substring(0, 80) + "..." : "null");
            console.log("[VIEW COURSE] course.thumbnail:", courseData.thumbnail ? courseData.thumbnail.substring(0, 80) + "..." : "null");
            renderCourse(courseData);
            showContent();
            initReveal();
            checkFollowStatus();
        })
        .catch(function (err) {
            console.error("[VIEW COURSE] Fetch error:", err);
            showError("Failed to load course", "Please check your connection and try again.");
        });
    }

    /* =============================================
       RENDER COURSE DATA
    ============================================= */

    function renderCourse(c) {
        /* Page title */
        document.title = esc(c.title || "Course") + " | IMPACTECH ACADEMY";

        /* Thumbnail */
        renderThumbnail(c.thumbnail);

        /* Breadcrumb category */
        var bcCat = document.getElementById("vcBreadcrumbCat");
        if (bcCat) bcCat.textContent = c.category || "General";

        /* Title & subtitle */
        var titleEl = document.getElementById("vcTitle");
        if (titleEl) titleEl.textContent = c.title || "Untitled Course";
        var subEl = document.getElementById("vcSubtitle");
        if (subEl) subEl.textContent = c.subtitle || "";

        /* Access badge */
        var badge = document.getElementById("vcAccessBadge");
        if (badge) {
            var access = String(c.accessType || "free").toLowerCase();
            badge.textContent = access === "subscription" ? "Subscription" : access === "paid" ? "Paid" : "Free";
            badge.className = "vc-access-badge" + (access !== "free" ? " " + access : "");
        }

        /* Teacher */
        renderTeacher(c.teacher);

        /* Stats */
        var sStudents = document.getElementById("vcStatStudents");
        var sViews = document.getElementById("vcStatViews");
        var sLessons = document.getElementById("vcStatLessons");
        var sRating = document.getElementById("vcStatRating");
        if (sStudents) sStudents.textContent = formatNumber(c.students);
        if (sViews) sViews.textContent = formatNumber(c.views);
        if (sLessons) sLessons.textContent = formatNumber(c.lessonCount);
        if (sRating) sRating.textContent = (Number(c.rating) || 0).toFixed(1);

        /* Videos */
        renderVideoSection("Promo", c.promoVideo, c.promoVideoMeta);
        renderVideoSection("Trailer", c.trailerVideo, c.trailerVideoMeta);

        /* Description */
        renderDescription(c.description);

        /* Tags */
        renderTags(c.tags);

        /* Outcomes */
        renderOutcomes(c.outcomes);

        /* Curriculum placeholder (will be loaded separately later) */
        renderCurriculumPlaceholder(c.lessonCount);

        /* Requirements */
        renderRequirements(c.requirements);

        /* Price */
        renderPrice(c.price, c.accessType);
    }

    /* =============================================
       THUMBNAIL
    ============================================= */

    function renderThumbnail(url) {
        var placeholder = document.getElementById("vcThumbPlaceholder");
        var img = document.getElementById("vcThumbImg");

        console.log("[VIEW COURSE] renderThumbnail:", url ? url.substring(0, 80) + "..." : "null");

        if (!url) {
            if (placeholder) placeholder.style.display = "flex";
            if (img) img.style.display = "none";
            return;
        }
        if (img) {
            img.onload = function () {
                img.style.display = "block";
                if (placeholder) placeholder.style.display = "none";
            };
            img.onerror = function () {
                console.log("[VIEW COURSE] Thumbnail failed to load");
                img.style.display = "none";
                if (placeholder) placeholder.style.display = "flex";
            };
            img.src = url;
        }
    }

    /* =============================================
       TEACHER
    ============================================= */

    function renderTeacher(teacher) {
        if (!teacher) return;
        var nameEl = document.getElementById("vcTeacherName");
        var statusEl = document.getElementById("vcTeacherStatus");
        var avatarEl = document.getElementById("vcTeacherAvatar");

        if (nameEl) nameEl.textContent = teacher.fullname || "Unknown Teacher";
        if (statusEl) {
            var statusText = teacher.verified ? "Verified Instructor" : "Instructor";
            var timeStr = courseData && courseData.createdAt ? " \u00B7 " + timeAgo(courseData.createdAt) : "";
            statusEl.textContent = statusText + timeStr;
        }

        if (avatarEl && teacher.photoURL) {
            avatarEl.innerHTML = '<img src="' + esc(teacher.photoURL) + '" alt="' + esc(teacher.fullname) + '">';
        }
    }

    /* =============================================
       VIDEO SECTIONS
    ============================================= */

    function renderVideoSection(type, url, meta) {
        var sectionId = type === "Promo" ? "vcPromoSection" : "vcTrailerSection";
        var embedId = type === "Promo" ? "vcPromoEmbed" : "vcTrailerEmbed";
        var placeholderId = type === "Promo" ? "vcPromoPlaceholder" : "vcTrailerPlaceholder";

        var section = document.getElementById(sectionId);
        var embed = document.getElementById(embedId);
        var placeholder = document.getElementById(placeholderId);

        console.log("[VIEW COURSE] renderVideoSection(" + type + "):", url ? "url present (len=" + url.length + ", starts=" + url.substring(0, 40) + ")" : "null");

        if (!url) {
            if (section) section.style.display = "none";
            return;
        }

        if (section) section.style.display = "block";

        /* Check if it's a data URL (base64) */
        var isDataUrl = url.indexOf("data:") === 0;

        /* Check if YouTube/Vimeo URL */
        var youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?#]+)/);
        var vimeoMatch = url.match(/vimeo\.com\/(\d+)/);

        if (youtubeMatch) {
            console.log("[VIEW COURSE] Detected YouTube video");
            if (embed) {
                embed.style.display = "block";
                embed.innerHTML = '<iframe src="https://www.youtube.com/embed/' + youtubeMatch[1] + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
            }
            if (placeholder) placeholder.style.display = "none";
        } else if (vimeoMatch) {
            console.log("[VIEW COURSE] Detected Vimeo video");
            if (embed) {
                embed.style.display = "block";
                embed.innerHTML = '<iframe src="https://player.vimeo.com/video/' + vimeoMatch[1] + '" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
            }
            if (placeholder) placeholder.style.display = "none";
        } else {
            /* Direct video (data URL or streaming URL) — use custom player */
            console.log("[VIEW COURSE] Creating custom player for", isDataUrl ? "data URL" : "streaming URL");

            if (placeholder) placeholder.style.display = "none";
            if (embed) {
                embed.style.display = "block";
                embed.innerHTML = "";

                /* Create custom player container */
                var playerContainer = document.createElement("div");
                playerContainer.className = "vc-player-container";
                playerContainer.style.width = "100%";
                playerContainer.style.borderRadius = "16px";
                playerContainer.style.overflow = "hidden";

                /* Create video element */
                var vid = document.createElement("video");
                vid.preload = "metadata";
                vid.playsInline = true;
                vid.setAttribute("playsinline", "");

                var src = document.createElement("source");
                src.src = url;
                var mimeType = (meta && meta.mimeType) ? meta.mimeType : (isDataUrl ? url.split(";")[0].replace("data:", "") : "video/mp4");
                src.type = mimeType;
                vid.appendChild(src);

                playerContainer.appendChild(vid);
                embed.appendChild(playerContainer);

                /* Initialize custom player */
                vid.addEventListener("loadeddata", function () {
                    createVideoPlayer(playerContainer);
                });

                /* Fallback if loadeddata doesn't fire */
                vid.addEventListener("error", function () {
                    console.log("[VIEW COURSE] Video failed to load");
                    embed.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#0f172a;border-radius:16px;"><p style="color:rgba(255,255,255,0.5);font-size:0.9rem;">Failed to load video</p></div>';
                });
            }
        }
    }

    /* =============================================
       DESCRIPTION
    ============================================= */

    function renderDescription(desc) {
        var el = document.getElementById("vcDescription");
        var readMoreBtn = document.getElementById("vcReadMore");
        if (!el) return;

        if (!desc) {
            el.innerHTML = "<p>No description available for this course.</p>";
            if (readMoreBtn) readMoreBtn.style.display = "none";
            return;
        }

        /* Split by paragraphs */
        var paragraphs = desc.split(/\n\n+/);
        el.innerHTML = paragraphs.map(function (p) {
            return "<p>" + esc(p.trim()) + "</p>";
        }).join("");

        /* Read more toggle */
        if (readMoreBtn) {
            if (el.scrollHeight > 160) {
                readMoreBtn.style.display = "inline-flex";
                var expanded = false;
                el.style.maxHeight = "140px";
                el.style.overflow = "hidden";
                el.style.transition = "max-height 0.4s ease";

                readMoreBtn.onclick = function () {
                    expanded = !expanded;
                    if (expanded) {
                        el.style.maxHeight = el.scrollHeight + "px";
                        readMoreBtn.classList.add("expanded");
                        readMoreBtn.innerHTML = 'Show less <i class="fa-solid fa-chevron-up"></i>';
                    } else {
                        el.style.maxHeight = "140px";
                        readMoreBtn.classList.remove("expanded");
                        readMoreBtn.innerHTML = 'Read more <i class="fa-solid fa-chevron-down"></i>';
                    }
                };
            } else {
                readMoreBtn.style.display = "none";
            }
        }
    }

    /* =============================================
       TAGS
    ============================================= */

    function renderTags(tags) {
        var container = document.getElementById("vcTags");
        var section = document.getElementById("vcTagsSection");
        if (!container || !section) return;

        if (!tags || !tags.length) {
            section.style.display = "none";
            return;
        }

        section.style.display = "block";
        container.innerHTML = tags.map(function (t) {
            return '<span class="vc-tag" data-tag="' + esc(t) + '">' + esc(t) + '</span>';
        }).join("");

        /* Click to search */
        container.querySelectorAll(".vc-tag").forEach(function (tag) {
            tag.addEventListener("click", function () {
                window.location.href = "../courses/?search=" + encodeURIComponent(tag.getAttribute("data-tag"));
            });
        });
    }

    /* =============================================
       OUTCOMES
    ============================================= */

    function renderOutcomes(outcomes) {
        var container = document.getElementById("vcOutcomes");
        var section = document.getElementById("vcOutcomesSection");
        if (!container || !section) return;

        if (!outcomes || !outcomes.length) {
            section.style.display = "none";
            return;
        }

        section.style.display = "block";
        container.innerHTML = outcomes.map(function (o) {
            return '<div class="vc-outcome"><i class="fa-solid fa-check-circle"></i> <span>' + esc(o) + '</span></div>';
        }).join("");
    }

    /* =============================================
       CURRICULUM PLACEHOLDER
    ============================================= */

    function renderCurriculumPlaceholder(lessonCount) {
        var container = document.getElementById("vcCurriculum");
        var section = document.getElementById("vcCurriculumSection");
        if (!container || !section) return;

        section.style.display = "block";
        var count = Number(lessonCount) || 0;

        container.innerHTML =
            '<div class="vc-curriculum-placeholder">' +
                '<div class="vc-curriculum-placeholder-icon"><i class="fa-solid fa-lock"></i></div>' +
                '<h3>Course Curriculum</h3>' +
                '<p>' + (count > 0 ? count + ' lessons available after enrollment' : 'Curriculum details coming soon') + '</p>' +
                '<span class="vc-curriculum-note">Enroll to access all lessons and materials</span>' +
            '</div>';
    }

    /* =============================================
       REQUIREMENTS
    ============================================= */

    function renderRequirements(requirements) {
        var container = document.getElementById("vcRequirements");
        var section = document.getElementById("vcRequirementsSection");
        if (!container || !section) return;

        if (!requirements || !requirements.length) {
            section.style.display = "none";
            return;
        }

        section.style.display = "block";
        container.innerHTML = requirements.map(function (r) {
            return '<div class="vc-req-item"><i class="fa-solid fa-check"></i> ' + esc(r) + '</div>';
        }).join("");
    }

    /* =============================================
       PRICE / ENROLL
    ============================================= */

    function renderPrice(price, accessType) {
        var priceEl = document.getElementById("vcPriceDisplay");
        var btnEl = document.getElementById("vcEnrollBtn");
        var noteEl = document.querySelector(".vc-enroll-note");

        var access = String(accessType || "free").toLowerCase();

        if (access === "paid" && price) {
            if (priceEl) priceEl.textContent = "$" + Number(price).toFixed(2);
            if (noteEl) noteEl.textContent = "One-time payment for lifetime access";
        } else if (access === "subscription") {
            if (priceEl) priceEl.textContent = "Subscription";
            if (priceEl) priceEl.style.fontSize = "1.3rem";
            if (noteEl) noteEl.textContent = "Requires an active subscription plan";
        } else {
            if (priceEl) priceEl.textContent = "Free";
            if (noteEl) noteEl.textContent = "Get instant access to all course materials";
        }
    }

    /* =============================================
       SCROLL REVEAL
    ============================================= */

    function initReveal() {
        var els = document.querySelectorAll(".vc-reveal");
        if (!els.length) return;
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        els.forEach(function (el) { observer.observe(el); });
    }

    /* =============================================
       SHARE BUTTONS
    ============================================= */

    function initShare() {
        var buttons = document.querySelectorAll(".vc-share-btn");
        buttons.forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                var title = courseData ? courseData.title : "Course";
                var url = window.location.href;

                if (btn.querySelector(".fa-link")) {
                    navigator.clipboard.writeText(url).then(function () {
                        showToast("Link copied!", "success");
                    }).catch(function () {
                        showToast("Failed to copy link", "error");
                    });
                } else if (btn.querySelector(".fa-x-twitter")) {
                    window.open("https://twitter.com/intent/tweet?text=" + encodeURIComponent(title) + "&url=" + encodeURIComponent(url), "_blank");
                } else if (btn.querySelector(".fa-facebook-f")) {
                    window.open("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url), "_blank");
                } else if (btn.querySelector(".fa-whatsapp")) {
                    window.open("https://wa.me/?text=" + encodeURIComponent(title + " " + url), "_blank");
                }
            });
        });
    }

    /* =============================================
       ENROLL BUTTON
    ============================================= */

    var CHECK_SVG = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';

    function showUpgradeModal() {
        var existing = document.getElementById("vcUpgradeOverlay");
        if (existing) existing.remove();

        var overlay = document.createElement("div");
        overlay.className = "vc-upgrade-overlay";
        overlay.id = "vcUpgradeOverlay";

        overlay.innerHTML =
            '<div class="vc-upgrade-modal">' +
                '<button class="vc-upgrade-close" id="vcUpgradeClose">&times;</button>' +
                '<div class="vc-upgrade-top">' +
                    '<div class="vc-upgrade-badge">' +
                        '<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' +
                    '</div>' +
                    '<h2>Subscription Required</h2>' +
                    '<p>You need an active subscription to enroll in this course. Upgrade to unlock all courses and premium features.</p>' +
                '</div>' +
                '<div class="vc-upgrade-body">' +
                    '<ul class="vc-upgrade-benefits">' +
                        '<li>' + CHECK_SVG + ' Access all courses instantly</li>' +
                        '<li>' + CHECK_SVG + ' Premium learning experience</li>' +
                        '<li>' + CHECK_SVG + ' certificates of completion</li>' +
                        '<li>' + CHECK_SVG + ' Priority support and updates</li>' +
                    '</ul>' +
                    '<div class="vc-upgrade-divider"></div>' +
                '</div>' +
                '<div class="vc-upgrade-footer">' +
                    '<div class="vc-upgrade-actions">' +
                        '<button class="vc-upgrade-btn secondary" id="vcUpgradeLater">Maybe Later</button>' +
                        '<button class="vc-upgrade-btn primary" id="vcUpgradeNow">Upgrade Now</button>' +
                    '</div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        overlay.querySelector("#vcUpgradeClose").addEventListener("click", function () {
            closeUpgradeModal(overlay);
        });

        overlay.querySelector("#vcUpgradeLater").addEventListener("click", function () {
            closeUpgradeModal(overlay);
        });

        overlay.querySelector("#vcUpgradeNow").addEventListener("click", function () {
            closeUpgradeModal(overlay);
            window.location.href = "../pricing/index.html";
        });

        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) {
                closeUpgradeModal(overlay);
            }
        });

        requestAnimationFrame(function () {
            overlay.classList.add("show");
        });
    }

    function closeUpgradeModal(overlay) {
        overlay.classList.remove("show");
        setTimeout(function () {
            overlay.remove();
        }, 300);
    }

    function handleEnroll() {
        if (!courseData) return;

        var access = String(courseData.accessType || "free").toLowerCase();

        /* Free courses — enroll directly */
        if (access === "free") {
            showToast("Enrollment coming soon!", "info");
            return;
        }

        /* Paid courses — check subscription */
        if (access === "paid" || access === "subscription") {
            fetch(API_BASE + "/api/auth/validate-session", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                cache: "no-store"
            })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.success && data.user) {
                    var user = data.user;
                    if (user.isPro || user.isElite) {
                        /* User has subscription — proceed with enrollment */
                        showToast("Enrollment coming soon!", "info");
                    } else {
                        /* No subscription — show upgrade modal */
                        showUpgradeModal();
                    }
                } else {
                    window.location.href = "../login/";
                }
            })
            .catch(function (err) {
                console.log("[VIEW COURSE] Subscription check failed:", err);
                showToast("Please check your connection", "error");
            });
            return;
        }

        showToast("Enrollment coming soon!", "info");
    }

    function initEnroll() {
        var btn = document.getElementById("vcEnrollBtn");
        if (!btn) return;
        btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            handleEnroll();
        });
    }

    /* =============================================
       FOLLOW BUTTON
    ============================================= */

    var followState = {
        following: false,
        followerCount: 0,
        loading: false
    };

    function checkFollowStatus() {
        if (!courseData || !courseData.teacher || !courseData.teacher.uid) return;

        fetch(API_BASE + "/api/teacher/" + encodeURIComponent(courseData.teacher.uid) + "/follow-status", {
            method: "GET",
            credentials: "include",
            headers: { "Accept": "application/json" },
            cache: "no-store"
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (data.success) {
                followState.following = data.following;
                followState.followerCount = data.followerCount || 0;
                updateFollowUI();
            }
        })
        .catch(function (err) {
            console.log("[VIEW COURSE] Follow status check failed:", err);
        });
    }

    function toggleFollow() {
        if (followState.loading) return;
        if (!courseData || !courseData.teacher || !courseData.teacher.uid) return;

        followState.loading = true;
        updateFollowUI();

        var action = followState.following ? "unfollow" : "follow";

        fetch(API_BASE + "/api/teacher/" + action, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ teacherUid: courseData.teacher.uid })
        })
        .then(function (res) {
            if (res.status === 401) {
                window.location.href = "../login/";
                throw new Error("Unauthorized");
            }
            return res.json();
        })
        .then(function (data) {
            followState.loading = false;
            if (data.success) {
                followState.following = data.following;
                followState.followerCount = data.followerCount || 0;
                updateFollowUI();
                showToast(data.following ? "Following " + (courseData.teacher.fullname || "teacher") : "Unfollowed", "success");
            } else {
                showToast(data.message || "Action failed", "error");
                updateFollowUI();
            }
        })
        .catch(function (err) {
            followState.loading = false;
            updateFollowUI();
            console.log("[VIEW COURSE] Follow toggle error:", err);
        });
    }

    function updateFollowUI() {
        var btn = document.getElementById("vcFollowBtn");
        var countEl = document.getElementById("vcFollowerCount");
        if (!btn) return;

        if (followState.loading) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Please wait...';
            return;
        }

        btn.disabled = false;
        if (followState.following) {
            btn.className = "vc-follow-btn following";
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Following';
        } else {
            btn.className = "vc-follow-btn";
            btn.innerHTML = '<i class="fa-solid fa-plus"></i> Follow';
        }

        if (countEl) {
            countEl.textContent = formatNumber(followState.followerCount) + " followers";
        }
    }

    function initFollow() {
        var btn = document.getElementById("vcFollowBtn");
        if (!btn) return;
        btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            toggleFollow();
        });
    }

    /* =============================================
       INIT
    ============================================= */

    document.addEventListener("DOMContentLoaded", function () {
        fetchCourse();
        initShare();
        initEnroll();
        initFollow();
    });

})();
