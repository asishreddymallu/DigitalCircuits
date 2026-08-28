/* =========================================================
   DIGITAL CIRCUITS SUITE - STUDIO FX & AUDIO ENGINE
   - Synthesized Web Audio API sound effects (Relay, Switch, Tick, Chime)
   - Interactive Mouse Spotlight & Particle PCB Background
   - Keyboard Shortcuts Modal (HUD)
   - Persistent Sound Preference
========================================================= */

(function () {
    const SOUND_KEY = "dc_sound_enabled";
    let soundEnabled = localStorage.getItem(SOUND_KEY) !== "false"; // Default: ON
    let audioCtx = null;

    function getAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === "suspended") {
            audioCtx.resume();
        }
        return audioCtx;
    }

    // Sound Synthesizers (100% self-contained Web Audio API)
    const SFX = {
        // Crisp mechanical click for switches & toggles
        click(isHigh = true) {
            if (!soundEnabled) return;
            const ctx = getAudioContext();
            if (!ctx) return;
            try {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = isHigh ? "triangle" : "sine";
                osc.frequency.setValueAtTime(isHigh ? 900 : 600, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(isHigh ? 1800 : 300, ctx.currentTime + 0.035);

                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.035);
            } catch (e) { }
        },

        // Heavy relay click for gate activation
        relay() {
            if (!soundEnabled) return;
            const ctx = getAudioContext();
            if (!ctx) return;
            try {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "square";
                osc.frequency.setValueAtTime(220, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.04);

                gain.gain.setValueAtTime(0.05, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.04);
            } catch (e) { }
        },

        // Clean clock tick for decade / hex counter
        tick() {
            if (!soundEnabled) return;
            const ctx = getAudioContext();
            if (!ctx) return;
            try {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(1200, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.025);

                gain.gain.setValueAtTime(0.06, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.025);
            } catch (e) { }
        },

        // Harmonious chord for successful solve / verification
        success() {
            if (!soundEnabled) return;
            const ctx = getAudioContext();
            if (!ctx) return;
            try {
                const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
                notes.forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);

                    gain.gain.setValueAtTime(0.05, ctx.currentTime + i * 0.06);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.35);

                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(ctx.currentTime + i * 0.06);
                    osc.stop(ctx.currentTime + i * 0.06 + 0.35);
                });
            } catch (e) { }
        }
    };

    function updateSoundButton() {
        const btns = document.querySelectorAll(".sound-toggle-btn");
        btns.forEach(b => {
            b.innerHTML = soundEnabled ? "🔊 <span class=\"sound-label\">Sound: ON</span>" : "🔇 <span class=\"sound-label\">Sound: OFF</span>";
            b.setAttribute("title", soundEnabled ? "Mute audio effects" : "Unmute audio effects");
            b.classList.toggle("muted", !soundEnabled);
        });
    }

    function toggleSound() {
        soundEnabled = !soundEnabled;
        localStorage.setItem(SOUND_KEY, soundEnabled ? "true" : "false");
        updateSoundButton();
        if (soundEnabled) SFX.click(true);
    }

    // Interactive mouse spotlight background effect
    function initSpotlight() {
        let ticking = false;
        window.addEventListener("mousemove", (e) => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    document.documentElement.style.setProperty("--mouse-x", `${e.clientX}px`);
                    document.documentElement.style.setProperty("--mouse-y", `${e.clientY}px`);
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    // Keyboard Shortcuts Modal HUD
    function initShortcutsHUD() {
        const modal = document.createElement("div");
        modal.id = "shortcutsModal";
        modal.className = "shortcuts-modal-overlay hidden";
        modal.innerHTML = `
            <div class="shortcuts-card">
                <div class="shortcuts-header">
                    <div class="shortcuts-title">
                        <span>⌨️ Keyboard Shortcuts</span>
                    </div>
                    <button type="button" class="shortcuts-close" id="closeShortcutsBtn">&times;</button>
                </div>
                <div class="shortcuts-grid">
                    <div class="shortcut-row">
                        <span class="shortcut-desc">Open / Close Shortcuts Help</span>
                        <div class="shortcut-keys"><kbd>?</kbd></div>
                    </div>
                    <div class="shortcut-row">
                        <span class="shortcut-desc">Toggle Dark / Light Theme</span>
                        <div class="shortcut-keys"><kbd>T</kbd></div>
                    </div>
                    <div class="shortcut-row">
                        <span class="shortcut-desc">Toggle Audio Effects</span>
                        <div class="shortcut-keys"><kbd>M</kbd></div>
                    </div>
                    <div class="shortcut-row">
                        <span class="shortcut-desc">Solve / Execute (Solver)</span>
                        <div class="shortcut-keys"><kbd>Enter</kbd></div>
                    </div>
                    <div class="shortcut-row">
                        <span class="shortcut-desc">Start / Stop Clock (Counter)</span>
                        <div class="shortcut-keys"><kbd>Space</kbd></div>
                    </div>
                    <div class="shortcut-row">
                        <span class="shortcut-desc">Direct Hex Input (7-Segment)</span>
                        <div class="shortcut-keys"><kbd>0</kbd>–<kbd>9</kbd> / <kbd>A</kbd>–<kbd>F</kbd></div>
                    </div>
                    <div class="shortcut-row">
                        <span class="shortcut-desc">Navigate Hub Pages</span>
                        <div class="shortcut-keys"><kbd>Alt</kbd> + <kbd>1</kbd>–<kbd>4</kbd></div>
                    </div>
                </div>
                <div class="shortcuts-footer">
                    <span>Press <kbd>Esc</kbd> or click outside to dismiss</span>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const closeBtn = document.getElementById("closeShortcutsBtn");
        closeBtn?.addEventListener("click", () => modal.classList.add("hidden"));

        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.classList.add("hidden");
        });

        window.addEventListener("keydown", (e) => {
            // Ignore when focused inside text inputs
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") {
                if (e.key === "Enter" && document.getElementById("solveButton")) {
                    document.getElementById("solveButton").click();
                }
                return;
            }

            if (e.key === "?" || (e.shiftKey && e.key === "/")) {
                e.preventDefault();
                modal.classList.toggle("hidden");
                SFX.click(true);
            } else if (e.key === "Escape") {
                modal.classList.add("hidden");
            } else if (e.key === "t" || e.key === "T") {
                if (window.toggleSiteTheme) {
                    window.toggleSiteTheme();
                    SFX.click(true);
                }
            } else if (e.key === "m" || e.key === "M") {
                toggleSound();
            } else if (e.altKey && (e.key === "1" || e.key === "2" || e.key === "3" || e.key === "4")) {
                const urls = { "1": "/Web1/index.html", "2": "/Web2/index.html", "3": "/Web3/index.html", "4": "/Web4/index.html" };
                const isSub = window.location.pathname.includes("/Web");
                const prefix = isSub ? ".." : ".";
                window.location.href = prefix + urls[e.key];
            }
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        updateSoundButton();
        document.querySelectorAll(".sound-toggle-btn").forEach(b => {
            b.addEventListener("click", toggleSound);
        });
        initSpotlight();
        initShortcutsHUD();
    });

    // Global Export
    window.StudioFX = SFX;
    window.toggleSiteSound = toggleSound;
})();
