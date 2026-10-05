/* =====================================================
   BUD N' BUDDER — include.js
   Fetches header.html and footer.html and injects them
   into the page, then fires "partials:loaded" so every
   other script knows it's safe to run.
   ===================================================== */
(function () {
  'use strict';

  function loadPartial(url, targetSelector) {
    return fetch(url)
      .then((res) => res.text())
      .then((html) => {
        const target = document.querySelector(targetSelector);
        if (target) target.innerHTML = html;
      })
      .catch((err) => console.error('Could not load partial: ' + url, err));
  }

  document.addEventListener('DOMContentLoaded', () => {
    Promise.all([
      loadPartial('partials/header.html', '#siteHeaderInclude'),
      loadPartial('partials/footer.html', '#siteFooterInclude')
    ]).then(() => {
      document.dispatchEvent(new Event('partials:loaded'));
    });
  });
})();