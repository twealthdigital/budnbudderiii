/* =====================================================
   BUD N' BUDDER — ADMIN — admin-main.js
   Shared behavior for every admin page: mobile sidebar
   toggle, account dropdown, and marking the active nav
   link. Exposes window.AdminUI so page-specific scripts
   (dashboard.js, products.js, orders.js…) can hook in.
   ===================================================== */

(function () {
  "use strict";

  const API_BASE_URL = "http://https://budnbudder-backend.onrender.com";

  function initSidebar() {
    const sidebar = document.getElementById("adminSidebar");
    const toggleBtn = document.getElementById("adminSidebarToggle");
    const closeBtn = document.getElementById("adminSidebarClose");
    const scrim = document.getElementById("adminScrim");
    if (!sidebar) return;

    function open() {
      sidebar.classList.add("is-open");
      if (scrim) scrim.classList.add("is-open");
    }
    function close() {
      sidebar.classList.remove("is-open");
      if (scrim) scrim.classList.remove("is-open");
    }

    toggleBtn && toggleBtn.addEventListener("click", open);
    closeBtn && closeBtn.addEventListener("click", close);
    scrim && scrim.addEventListener("click", close);

    // Close the off-canvas sidebar automatically if the viewport
    // grows back past the breakpoint where it's docked.
    window.addEventListener("resize", function () {
      if (window.innerWidth > 980) close();
    });
  }

  // On mobile, dropdown panels switch to position:fixed (see
  // admin-base.css) so they can't overflow the viewport. This sets
  // an exact `top` in px, measured from the toggle button's real
  // position, so the panel always lands directly under it instead
  // of relying on a guessed CSS value. No-op on desktop, where the
  // panel stays absolutely positioned under its toggle via CSS.
  const MOBILE_QUERY = "(max-width: 640px)";
  const DROPDOWN_GUTTER = 16; // must match the CSS gutter in the mobile media query
  function positionDropdown(toggleEl, menuEl) {
    if (!toggleEl || !menuEl) return;
    if (!window.matchMedia(MOBILE_QUERY).matches) {
      menuEl.style.top = "";
      menuEl.style.left = "";
      menuEl.style.width = "";
      return;
    }
    const rect = toggleEl.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    menuEl.style.top = Math.round(rect.bottom + 8) + "px";
    menuEl.style.left = DROPDOWN_GUTTER + "px";
    menuEl.style.width = Math.round(viewportWidth - DROPDOWN_GUTTER * 2) + "px";
  }

  // Closes every topbar panel (notif bell, account menu) except the one
  // currently being opened, so only one can ever be visible at a time.
  function closeOtherPanels(exceptEl) {
    ["adminNotif", "adminAccount"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el && el !== exceptEl) el.classList.remove("is-open");
    });
  }

  function initAccountDropdown() {
    const account = document.getElementById("adminAccount");
    const toggle = document.getElementById("adminAccountToggle");
    const menu = account ? account.querySelector(".admin-account__menu") : null;
    if (!account || !toggle) return;

    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      const opening = !account.classList.contains("is-open");
      if (opening) closeOtherPanels(account);
      account.classList.toggle("is-open");
      if (opening) positionDropdown(toggle, menu);
    });

    document.addEventListener("click", function (e) {
      if (!account.contains(e.target)) account.classList.remove("is-open");
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") account.classList.remove("is-open");
    });

    window.addEventListener("resize", function () {
      if (account.classList.contains("is-open")) positionDropdown(toggle, menu);
    });
  }

  async function handleAdminLogout() {
  try {
    await fetch(
      API_BASE_URL + "/api/admin/auth/logout",
      {
        method: "POST",
        credentials: "include"
      }
    );
  } catch (err) {
    console.error("Admin logout error:", err);
  } finally {
    window.location.href = "admin-auth.html?mode=logout";
  }
}

function initLogoutButtons() {
  document
    .querySelectorAll("#adminLogoutBtn, #adminAccountLogout")
    .forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();

        if (btn.dataset.loggingOut === "true") {
          return;
        }

        btn.dataset.loggingOut = "true";
        btn.disabled = true;

        handleAdminLogout();
      });
    });
}

  // Marks the nav link whose data-page matches the page's
  // body[data-page] attribute as active — set once per HTML
  // file (e.g. <body class="admin" data-page="dashboard">).
  function markActiveNav() {
    const current = document.body.getAttribute("data-page");
    if (!current) return;
    document.querySelectorAll(".admin-nav__link").forEach(function (link) {
      if (link.getAttribute("data-page") === current) {
        link.classList.add("is-active");
        link.setAttribute("aria-current", "page");
      }
    });
  }

  async function checkAdminAuthentication() {
  try {
    const response = await fetch(
      API_BASE_URL + "/api/admin/auth/me",
      {
        method: "GET",
        credentials: "include",
        headers: {
          "Accept": "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error("Not authenticated");
    }

    const data = await response.json();

    if (!data || !data.admin) {
      throw new Error("Invalid admin session");
    }

    /*
     * Store the authenticated admin information in memory only.
     * Do not put the admin token into localStorage/sessionStorage.
     */
    window.AdminUI.admin = data.admin;

    document.documentElement.classList.add("admin-authenticated");

    return true;

  } catch (err) {
    console.warn("Admin authentication check failed:", err);

    window.location.replace(
      "admin-auth.html?mode=signin"
    );

    return false;
  }
}

  async function init() {
  const authenticated = await checkAdminAuthentication();

  if (!authenticated) {
    return;
  }

  initSidebar();
  initAccountDropdown();
  markActiveNav();
  initLogoutButtons();
}

  document.addEventListener("DOMContentLoaded", init);

  window.AdminUI = {
  init: init,
  positionDropdown: positionDropdown,
  closeOtherPanels: closeOtherPanels,
  checkAdminAuthentication: checkAdminAuthentication,
  handleAdminLogout: handleAdminLogout,
  admin: null
};
})();

/* =====================================================
   BUSY-BUTTON SYSTEM (reusable loading spinner)
   ===================================================== */
(function () {
  "use strict";

  window.AdminUI = window.AdminUI || {};

  function setBusy(btn, on) {
    if (!btn) return;

    if (on) {
      if (btn.classList.contains("is-busy")) return;

      const cs = getComputedStyle(btn);

      btn.style.setProperty("--busy-color", cs.color);

      const size = Math.round(
        Math.min(btn.offsetWidth, btn.offsetHeight) * 0.5
      );
      btn.style.setProperty(
        "--busy-size",
        Math.max(12, Math.min(18, size)) + "px"
      );

      if (cs.position === "static") {
        btn.style.position = "relative";
        btn.dataset.busyPos = "1";
      }

      btn.classList.add("is-busy");
      btn.setAttribute("aria-busy", "true");
      return;
    }

    btn.classList.remove("is-busy");
    btn.removeAttribute("aria-busy");
    btn.style.removeProperty("--busy-color");
    btn.style.removeProperty("--busy-size");

    if (btn.dataset.busyPos) {
      btn.style.position = "";
      delete btn.dataset.busyPos;
    }
  }

  async function withBusy(btn, task) {
    if (!btn) return task();
    if (btn.classList.contains("is-busy")) return; // ignore double-clicks

    setBusy(btn, true);

    try {
      return await task();
    } finally {
      setBusy(btn, false);
    }
  }

  window.AdminUI.setBusy = setBusy;
  window.AdminUI.withBusy = withBusy;
})();