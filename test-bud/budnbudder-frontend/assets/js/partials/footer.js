/* =====================================================
   BUD N' BUDDER — footer.js
   Footer partial behavior: back to top button.
   ===================================================== */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  function initBackToTop() {
    const btn = $('#backToTop');
    if (!btn) return;
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  document.addEventListener('partials:loaded', () => {
    initBackToTop();
  });
})();