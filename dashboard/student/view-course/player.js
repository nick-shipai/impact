/* =============================================
   CUSTOM VIDEO PLAYER
   Premium video player with full controls
============================================= */

function createVideoPlayer(container, options) {
    options = options || {};

    var video = container.querySelector("video");
    if (!video) return null;

    /* Remove default controls */
    video.removeAttribute("controls");
    video.preload = "metadata";

    /* State */
    var state = {
        playing: false,
        muted: false,
        volume: 1,
        speed: 1,
        fullscreen: false,
        controlsVisible: true,
        hideTimer: null,
        seekTimer: null,
        lastTap: 0,
        lastTapSide: null,
        speedMenuOpen: false,
        duration: 0,
        currentTime: 0,
        bufferEnd: 0
    };

    var speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

    /* =============================================
       BUILD DOM
    ============================================= */

    function build() {
        container.classList.add("vc-player");
        container.setAttribute("tabindex", "0");

        /* Loading spinner */
        var loading = document.createElement("div");
        loading.className = "vc-player-loading";
        loading.innerHTML = '<div class="vc-player-spinner"></div>';
        container.appendChild(loading);

        /* Big play button */
        var bigPlay = document.createElement("div");
        bigPlay.className = "vc-player-big-play";
        bigPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
        container.appendChild(bigPlay);

        /* Replay button */
        var replay = document.createElement("div");
        replay.className = "vc-player-replay";
        replay.innerHTML = '<i class="fa-solid fa-rotate-right"></i>';
        container.appendChild(replay);

        /* Seek indicators */
        var seekLeft = document.createElement("div");
        seekLeft.className = "vc-player-seek-indicator left";
        seekLeft.innerHTML = '<i class="fa-solid fa-backward"></i><span>10s</span>';
        container.appendChild(seekLeft);

        var seekRight = document.createElement("div");
        seekRight.className = "vc-player-seek-indicator right";
        seekRight.innerHTML = '<i class="fa-solid fa-forward"></i><span>10s</span>';
        container.appendChild(seekRight);

        /* Top gradient */
        var topGrad = document.createElement("div");
        topGrad.className = "vc-player-top-gradient";
        container.appendChild(topGrad);

        /* Controls bar */
        var controls = document.createElement("div");
        controls.className = "vc-player-controls";
        controls.innerHTML =
            /* Progress */
            '<div class="vc-player-progress-wrap">' +
                '<div class="vc-player-progress-track">' +
                    '<div class="vc-player-progress-buffered"></div>' +
                    '<div class="vc-player-progress-filled"></div>' +
                    '<div class="vc-player-progress-thumb"></div>' +
                '</div>' +
                '<div class="vc-player-progress-tooltip">0:00</div>' +
            '</div>' +
            /* Controls row */
            '<div class="vc-player-row">' +
                '<div class="vc-player-row-left">' +
                    /* Play/Pause */
                    '<button class="vc-player-btn" data-action="play"><i class="fa-solid fa-play"></i></button>' +
                    /* Volume */
                    '<div class="vc-player-volume-wrap">' +
                        '<button class="vc-player-btn" data-action="mute"><i class="fa-solid fa-volume-high"></i></button>' +
                        '<div class="vc-player-volume-slider-wrap">' +
                            '<input type="range" class="vc-player-volume-slider" min="0" max="1" step="0.05" value="1">' +
                        '</div>' +
                    '</div>' +
                    /* Time */
                    '<div class="vc-player-time">' +
                        '<span class="vc-player-current">0:00</span>' +
                        '<span class="vc-player-time-separator">/</span>' +
                        '<span class="vc-player-duration">0:00</span>' +
                    '</div>' +
                '</div>' +
                '<div class="vc-player-row-right">' +
                    /* Speed */
                    '<div class="vc-player-speed-wrap">' +
                        '<button class="vc-player-btn" data-action="speed"><span style="font-size:0.75rem;font-weight:700;">1x</span></button>' +
                        '<div class="vc-player-speed-menu"></div>' +
                    '</div>' +
                    /* PiP */
                    '<button class="vc-player-btn hide-mobile" data-action="pip"><i class="fa-solid fa-window-restore"></i></button>' +
                    /* Fullscreen */
                    '<button class="vc-player-btn" data-action="fullscreen"><i class="fa-solid fa-expand"></i></button>' +
                '</div>' +
            '</div>';
        container.appendChild(controls);

        /* Build speed menu */
        var speedMenu = controls.querySelector(".vc-player-speed-menu");
        speeds.forEach(function (s) {
            var opt = document.createElement("div");
            opt.className = "vc-player-speed-option" + (s === 1 ? " active" : "");
            opt.setAttribute("data-speed", s);
            opt.textContent = s === 1 ? "Normal" : s + "x";
            speedMenu.appendChild(opt);
        });

        return {
            loading: loading,
            bigPlay: bigPlay,
            replay: replay,
            seekLeft: seekLeft,
            seekRight: seekRight,
            controls: controls,
            progressWrap: controls.querySelector(".vc-player-progress-wrap"),
            progressBuffered: controls.querySelector(".vc-player-progress-buffered"),
            progressFilled: controls.querySelector(".vc-player-progress-filled"),
            progressThumb: controls.querySelector(".vc-player-progress-thumb"),
            progressTooltip: controls.querySelector(".vc-player-progress-tooltip"),
            playBtn: controls.querySelector('[data-action="play"]'),
            muteBtn: controls.querySelector('[data-action="mute"]'),
            volumeSlider: controls.querySelector(".vc-player-volume-slider"),
            currentTime: controls.querySelector(".vc-player-current"),
            duration: controls.querySelector(".vc-player-duration"),
            speedBtn: controls.querySelector('[data-action="speed"]'),
            speedMenu: speedMenu,
            pipBtn: controls.querySelector('[data-action="pip"]'),
            fullscreenBtn: controls.querySelector('[data-action="fullscreen"]')
        };
    }

    var ui = build();

    /* =============================================
       HELPERS
    ============================================= */

    function formatTime(sec) {
        if (!isFinite(sec) || sec < 0) return "0:00";
        var h = Math.floor(sec / 3600);
        var m = Math.floor((sec % 3600) / 60);
        var s = Math.floor(sec % 60);
        if (h > 0) return h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
        return m + ":" + (s < 10 ? "0" : "") + s;
    }

    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    /* =============================================
       PLAY / PAUSE
    ============================================= */

    function togglePlay() {
        if (video.ended) {
            video.currentTime = 0;
        }
        if (video.paused) {
            video.play().catch(function () {});
        } else {
            video.pause();
        }
    }

    function updatePlayState() {
        state.playing = !video.paused;
        var icon = ui.playBtn.querySelector("i");
        if (state.playing) {
            icon.className = "fa-solid fa-pause";
            ui.bigPlay.classList.add("hidden");
            ui.replay.classList.remove("visible");
            startHideTimer();
        } else {
            icon.className = "fa-solid fa-play";
            showControls();
            clearHideTimer();
        }
    }

    /* =============================================
       VOLUME
    ============================================= */

    function setVolume(val) {
        state.volume = clamp(val, 0, 1);
        video.volume = state.volume;
        video.muted = false;
        state.muted = false;
        updateVolumeIcon();
        ui.volumeSlider.value = state.volume;
    }

    function toggleMute() {
        if (state.muted || video.volume === 0) {
            video.muted = false;
            state.muted = false;
            if (video.volume === 0) video.volume = 0.5;
            state.volume = video.volume;
        } else {
            video.muted = true;
            state.muted = true;
        }
        updateVolumeIcon();
        ui.volumeSlider.value = state.muted ? 0 : state.volume;
    }

    function updateVolumeIcon() {
        var icon = ui.muteBtn.querySelector("i");
        if (state.muted || video.volume === 0) {
            icon.className = "fa-solid fa-volume-xmark";
        } else if (video.volume < 0.5) {
            icon.className = "fa-solid fa-volume-low";
        } else {
            icon.className = "fa-solid fa-volume-high";
        }
    }

    /* =============================================
       PROGRESS / SEEKING
    ============================================= */

    function updateProgress() {
        if (!video.duration) return;
        var pct = (video.currentTime / video.duration) * 100;
        ui.progressFilled.style.width = pct + "%";
        ui.progressThumb.style.left = pct + "%";
        ui.currentTime.textContent = formatTime(video.currentTime);
    }

    function updateBuffered() {
        if (video.buffered.length > 0 && video.duration) {
            var end = video.buffered.end(video.buffered.length - 1);
            ui.progressBuffered.style.width = (end / video.duration) * 100 + "%";
        }
    }

    function seekTo(e) {
        var rect = ui.progressWrap.getBoundingClientRect();
        var pct = clamp((e.clientX - rect.left) / rect.width, 0, 1);
        video.currentTime = pct * video.duration;
    }

    function showTooltip(e) {
        var rect = ui.progressWrap.getBoundingClientRect();
        var pct = clamp((e.clientX - rect.left) / rect.width, 0, 1);
        var time = pct * (video.duration || 0);
        ui.progressTooltip.textContent = formatTime(time);
        ui.progressTooltip.style.left = (pct * 100) + "%";
    }

    /* =============================================
       SPEED
    ============================================= */

    function setSpeed(s) {
        state.speed = s;
        video.playbackRate = s;
        ui.speedBtn.querySelector("span").textContent = s === 1 ? "1x" : s + "x";
        ui.speedMenu.querySelectorAll(".vc-player-speed-option").forEach(function (opt) {
            opt.classList.toggle("active", parseFloat(opt.getAttribute("data-speed")) === s);
        });
    }

    function toggleSpeedMenu() {
        state.speedMenuOpen = !state.speedMenuOpen;
        ui.speedMenu.classList.toggle("visible", state.speedMenuOpen);
    }

    function closeSpeedMenu() {
        state.speedMenuOpen = false;
        ui.speedMenu.classList.remove("visible");
    }

    /* =============================================
       FULLSCREEN
    ============================================= */

    function toggleFullscreen() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            var el = container.requestFullscreen || container.webkitRequestFullscreen;
            if (el) el.call(container);
        } else {
            var exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (exit) exit.call(document);
        }
    }

    function updateFullscreenIcon() {
        var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        state.fullscreen = isFs;
        var icon = ui.fullscreenBtn.querySelector("i");
        icon.className = isFs ? "fa-solid fa-compress" : "fa-solid fa-expand";
    }

    /* =============================================
       PICTURE-IN-PICTURE
    ============================================= */

    function togglePiP() {
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(function () {});
        } else if (video.requestPictureInPicture) {
            video.requestPictureInPicture().catch(function () {});
        }
    }

    /* =============================================
       CONTROLS VISIBILITY
    ============================================= */

    function showControls() {
        state.controlsVisible = true;
        ui.controls.classList.remove("hidden");
        ui.controls.classList.add("visible");
        container.style.cursor = "default";
    }

    function hideControls() {
        if (!state.playing) return;
        if (state.speedMenuOpen) return;
        state.controlsVisible = false;
        ui.controls.classList.add("hidden");
        ui.controls.classList.remove("visible");
        container.style.cursor = "none";
    }

    function startHideTimer() {
        clearHideTimer();
        state.hideTimer = setTimeout(hideControls, 3000);
    }

    function clearHideTimer() {
        if (state.hideTimer) {
            clearTimeout(state.hideTimer);
            state.hideTimer = null;
        }
    }

    function resetHideTimer() {
        showControls();
        if (state.playing) startHideTimer();
    }

    /* =============================================
       DOUBLE TAP SEEK (mobile)
    ============================================= */

    function handleTap(e) {
        var now = Date.now();
        var rect = container.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var side = x < rect.width / 2 ? "left" : "right";

        if (now - state.lastTap < 300 && side === state.lastTapSide) {
            /* Double tap */
            e.preventDefault();
            if (side === "left") {
                video.currentTime = Math.max(0, video.currentTime - 10);
                showSeekIndicator("left");
            } else {
                video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
                showSeekIndicator("right");
            }
            state.lastTap = 0;
        } else {
            state.lastTap = now;
            state.lastTapSide = side;
        }
    }

    function showSeekIndicator(side) {
        var el = side === "left" ? ui.seekLeft : ui.seekRight;
        el.classList.add("visible");
        setTimeout(function () {
            el.classList.remove("visible");
        }, 500);
    }

    /* =============================================
       KEYBOARD SHORTCUTS
    ============================================= */

    function handleKeydown(e) {
        var tag = (e.target.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea") return;

        switch (e.key) {
            case " ":
            case "k":
                e.preventDefault();
                togglePlay();
                resetHideTimer();
                break;
            case "ArrowLeft":
                e.preventDefault();
                video.currentTime = Math.max(0, video.currentTime - 10);
                showSeekIndicator("left");
                resetHideTimer();
                break;
            case "ArrowRight":
                e.preventDefault();
                video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
                showSeekIndicator("right");
                resetHideTimer();
                break;
            case "ArrowUp":
                e.preventDefault();
                setVolume(state.volume + 0.1);
                resetHideTimer();
                break;
            case "ArrowDown":
                e.preventDefault();
                setVolume(state.volume - 0.1);
                resetHideTimer();
                break;
            case "m":
            case "M":
                e.preventDefault();
                toggleMute();
                resetHideTimer();
                break;
            case "f":
            case "F":
                e.preventDefault();
                toggleFullscreen();
                break;
            case "Escape":
                closeSpeedMenu();
                break;
        }
    }

    /* =============================================
       EVENT LISTENERS
    ============================================= */

    /* Video events */
    video.addEventListener("play", updatePlayState);
    video.addEventListener("pause", updatePlayState);
    video.addEventListener("ended", function () {
        state.playing = false;
        ui.playBtn.querySelector("i").className = "fa-solid fa-play";
        ui.replay.classList.add("visible");
        showControls();
        clearHideTimer();
    });

    video.addEventListener("timeupdate", updateProgress);
    video.addEventListener("progress", updateBuffered);

    video.addEventListener("loadedmetadata", function () {
        state.duration = video.duration;
        ui.duration.textContent = formatTime(video.duration);
        ui.loading.classList.remove("visible");
    });

    video.addEventListener("waiting", function () {
        ui.loading.classList.add("visible");
    });

    video.addEventListener("canplay", function () {
        ui.loading.classList.remove("visible");
    });

    video.addEventListener("error", function () {
        ui.loading.classList.remove("visible");
    });

    /* Click on video to play/pause */
    video.addEventListener("click", function (e) {
        e.stopPropagation();
        togglePlay();
        resetHideTimer();
    });

    /* Double tap for mobile */
    video.addEventListener("touchend", function (e) {
        handleTap(e);
    });

    /* Big play button */
    ui.bigPlay.addEventListener("click", function (e) {
        e.stopPropagation();
        togglePlay();
    });

    /* Replay button */
    ui.replay.addEventListener("click", function (e) {
        e.stopPropagation();
        video.currentTime = 0;
        video.play().catch(function () {});
    });

    /* Play/Pause button */
    ui.playBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        togglePlay();
    });

    /* Volume */
    ui.muteBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleMute();
    });

    ui.volumeSlider.addEventListener("input", function (e) {
        e.stopPropagation();
        setVolume(parseFloat(this.value));
    });

    ui.volumeSlider.addEventListener("click", function (e) {
        e.stopPropagation();
    });

    /* Progress bar */
    var isDragging = false;

    ui.progressWrap.addEventListener("mousedown", function (e) {
        e.preventDefault();
        isDragging = true;
        seekTo(e);
    });

    document.addEventListener("mousemove", function (e) {
        if (isDragging) {
            seekTo(e);
        }
        showTooltip(e);
    });

    document.addEventListener("mouseup", function () {
        isDragging = false;
    });

    ui.progressWrap.addEventListener("mousemove", showTooltip);

    /* Touch progress */
    ui.progressWrap.addEventListener("touchstart", function (e) {
        isDragging = true;
        var touch = e.touches[0];
        seekTo(touch);
    }, { passive: true });

    ui.progressWrap.addEventListener("touchmove", function (e) {
        if (isDragging) {
            var touch = e.touches[0];
            seekTo(touch);
        }
    }, { passive: true });

    ui.progressWrap.addEventListener("touchend", function () {
        isDragging = false;
    });

    /* Speed */
    ui.speedBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleSpeedMenu();
    });

    ui.speedMenu.addEventListener("click", function (e) {
        e.stopPropagation();
        var opt = e.target.closest(".vc-player-speed-option");
        if (opt) {
            setSpeed(parseFloat(opt.getAttribute("data-speed")));
            closeSpeedMenu();
        }
    });

    /* PiP */
    ui.pipBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        togglePiP();
    });

    /* Fullscreen */
    ui.fullscreenBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleFullscreen();
    });

    document.addEventListener("fullscreenchange", updateFullscreenIcon);
    document.addEventListener("webkitfullscreenchange", updateFullscreenIcon);

    /* Mouse movement over player */
    container.addEventListener("mousemove", resetHideTimer);
    container.addEventListener("mouseleave", function () {
        if (state.playing) startHideTimer();
    });

    /* Keyboard */
    container.addEventListener("keydown", handleKeydown);

    /* Click outside speed menu closes it */
    document.addEventListener("click", function () {
        closeSpeedMenu();
    });

    /* =============================================
       PUBLIC API
    ============================================= */

    return {
        video: video,
        play: function () { video.play(); },
        pause: function () { video.pause(); },
        togglePlay: togglePlay,
        setVolume: setVolume,
        setSpeed: setSpeed,
        seek: function (t) { video.currentTime = t; },
        showControls: showControls,
        destroy: function () {
            clearHideTimer();
        }
    };
}
