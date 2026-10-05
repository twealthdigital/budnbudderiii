/* =====================================================
   BUD N' BUDDER — main.js
   Page-level chrome that isn't already owned by
   header.js / footer.js (those handle the mobile menu,
   header scroll shadow, cart drawer toggle, search
   overlay toggle, and back-to-top now that header/footer
   are loaded as partials).

   Everything here waits for "partials:loaded" (fired by
   include.js) instead of DOMContentLoaded, because
   #browseProductsBtn's dependency (window.BNB.openSearch)
   is only guaranteed to exist once header.js has run, and
   .reveal elements living inside footer.html don't exist
   in the DOM until the footer partial is injected.
   ===================================================== */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  /* ---------- "BROWSE PRODUCTS" -> OPEN SEARCH ---------- */
  function initBrowseProductsTrigger() {
    const browseBtn = $('#browseProductsBtn');
    if (!browseBtn) return;
    browseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.BNB && window.BNB.openSearch) window.BNB.openSearch();
    });
  }

  /* ---------- SCROLL REVEAL ---------- */
  function initRevealAnimations() {
    const items = document.querySelectorAll('.reveal');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -60px 0px' });
    items.forEach((el) => io.observe(el));
  }

  /* ---------- INIT ---------- */
  document.addEventListener('partials:loaded', () => {
    initBrowseProductsTrigger();
    initRevealAnimations();
  });
})();

/* =====================================================
   BUSY-BUTTON SYSTEM (reusable loading spinner)
   ===================================================== */
(function () {
  'use strict';

  window.BNB = window.BNB || {};

  function setBusy(btn, on) {
    if (!btn) return;

    if (on) {
      if (btn.classList.contains('is-busy')) return;

      const cs = getComputedStyle(btn);

      /* Spinner takes the button's own text colour */
      btn.style.setProperty('--busy-color', cs.color);

      /* Spinner scales with the button (12px – 18px) */
      const size = Math.round(
        Math.min(btn.offsetWidth, btn.offsetHeight) * 0.5
      );
      btn.style.setProperty(
        '--busy-size',
        Math.max(12, Math.min(18, size)) + 'px'
      );

      /* The spinner is absolutely positioned inside the button */
      if (cs.position === 'static') {
        btn.style.position = 'relative';
        btn.dataset.busyPos = '1';
      }

      btn.classList.add('is-busy');
      btn.setAttribute('aria-busy', 'true');
      return;
    }

    btn.classList.remove('is-busy');
    btn.removeAttribute('aria-busy');
    btn.style.removeProperty('--busy-color');
    btn.style.removeProperty('--busy-size');

    if (btn.dataset.busyPos) {
      btn.style.position = '';
      delete btn.dataset.busyPos;
    }
  }

  /* Shows the spinner while `task` (a function returning a promise) runs */
  async function withBusy(btn, task) {
    if (!btn) return task();
    if (btn.classList.contains('is-busy')) return; // ignore double-clicks

    setBusy(btn, true);

    try {
      return await task();
    } finally {
      setBusy(btn, false);
    }
  }

  window.BNB.setBusy = setBusy;
  window.BNB.withBusy = withBusy;

  /* Back/forward cache: never come back to a stuck spinner */
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    document.querySelectorAll('.is-busy').forEach((b) => setBusy(b, false));
  });
})();