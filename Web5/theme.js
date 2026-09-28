/* =========================================================
   DIGITAL CIRCUITS SUITE - BULLETPROOF THEME SYSTEM
   - Multi-layer persistence: URL parameter, localStorage, sessionStorage, cookie
   - Instant zero-flash FOUC application (runs in <head>)
   - Automatic cross-page link synchronization & click delegation
   - Seamless navigation across Home, Web1, Web2, Web3 sub-tabs
========================================================= */

(function () {
    const THEME_KEY = "dc_theme_preference";

    function getThemeFromUrl() {
        try {
            const params = new URLSearchParams(window.location.search);
            const t = params.get("theme");
            if (t === "dark" || t === "light") return t;
        } catch (e) { }
        return null;
    }

    function getPreferredTheme() {
        // 1. URL parameter (highest priority for cross-page navigation)
        const urlTheme = getThemeFromUrl();
        if (urlTheme) return urlTheme;

        // 2. LocalStorage
        try {
            const stored = localStorage.getItem(THEME_KEY);
            if (stored === "dark" || stored === "light") return stored;
        } catch (e) { }

        // 3. SessionStorage
        try {
            const sess = sessionStorage.getItem(THEME_KEY);
            if (sess === "dark" || sess === "light") return sess;
        } catch (e) { }

        // 4. Document Cookie
        try {
            const match = document.cookie.match(new RegExp("(^| )" + THEME_KEY + "=([^;]+)"));
            if (match && (match[2] === "dark" || match[2] === "light")) return match[2];
        } catch (e) { }

        // 5. System/Default preference
        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
            return "light";
        }
        return "dark"; // Default to dark mode
    }

    function saveTheme(theme) {
        try { localStorage.setItem(THEME_KEY, theme); } catch (e) { }
        try { sessionStorage.setItem(THEME_KEY, theme); } catch (e) { }
        try { document.cookie = `${THEME_KEY}=${theme};path=/;max-age=31536000;SameSite=Lax`; } catch (e) { }
        syncNavLinks(theme);
    }

    function updateThemeUrlParam(theme) {
        try {
            if (window.history && window.history.replaceState) {
                const url = new URL(window.location.href);
                url.searchParams.set("theme", theme);
                window.history.replaceState(null, "", url.toString());
            }
        } catch (e) { }
    }

    function syncNavLinks(theme) {
        if (!theme) return;
        document.querySelectorAll("a[href]").forEach(link => {
            const href = link.getAttribute("href");
            if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")) {
                return;
            }
            try {
                const url = new URL(href, window.location.href);
                url.searchParams.set("theme", theme);
                if (href.startsWith(".")) {
                    const cleanPath = href.split("?")[0].split("#")[0];
                    const hash = href.includes("#") ? "#" + href.split("#")[1] : "";
                    link.setAttribute("href", `${cleanPath}?theme=${theme}${hash}`);
                } else if (!href.includes("://")) {
                    const cleanPath = href.split("?")[0].split("#")[0];
                    const hash = href.includes("#") ? "#" + href.split("#")[1] : "";
                    link.setAttribute("href", `${cleanPath}?theme=${theme}${hash}`);
                } else {
                    link.setAttribute("href", url.toString());
                }
            } catch (e) { }
        });
    }

    function applyTheme(theme) {
        if (theme !== "dark" && theme !== "light") theme = "dark";
        document.documentElement.setAttribute("data-theme", theme);
        saveTheme(theme);
        updateThemeUrlParam(theme);

        const toggleBtns = document.querySelectorAll(".theme-toggle-btn");
        toggleBtns.forEach((btn) => {
            btn.innerHTML = theme === "dark" 
                ? "☀️ <span class=\"theme-label\">Light Mode</span>" 
                : "🌙 <span class=\"theme-label\">Dark Mode</span>";
            btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
            btn.setAttribute("title", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
        });
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute("data-theme") || getPreferredTheme();
        const next = current === "dark" ? "light" : "dark";
        applyTheme(next);
    }

    // Apply immediately to prevent FOUC
    const initialTheme = getPreferredTheme();
    document.documentElement.setAttribute("data-theme", initialTheme);
    saveTheme(initialTheme);
    updateThemeUrlParam(initialTheme);

    document.addEventListener("DOMContentLoaded", () => {
        const activeTheme = document.documentElement.getAttribute("data-theme") || getPreferredTheme();
        applyTheme(activeTheme);
        document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
            btn.addEventListener("click", toggleTheme);
        });
        syncNavLinks(activeTheme);
    });

    // Global click listener ensuring dynamic or static links always pass the theme
    document.addEventListener("click", (e) => {
        const link = e.target.closest && e.target.closest("a[href]");
        if (!link) return;
        const href = link.getAttribute("href");
        if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")) {
            return;
        }
        const currentTheme = document.documentElement.getAttribute("data-theme") || getPreferredTheme();
        try {
            const cleanPath = href.split("?")[0].split("#")[0];
            const hash = href.includes("#") ? "#" + href.split("#")[1] : "";
            link.setAttribute("href", `${cleanPath}?theme=${currentTheme}${hash}`);
        } catch (err) { }
    }, true);

    // Cross-tab theme sync
    window.addEventListener("storage", (e) => {
        if (e.key === THEME_KEY && (e.newValue === "dark" || e.newValue === "light")) {
            applyTheme(e.newValue);
        }
    });

    window.toggleSiteTheme = toggleTheme;
    window.applySiteTheme = applyTheme;
})();
