/* =====================================================
   BUD N' BUDDER — age-gate.js
   Blocks the site until the visitor confirms they're 21+.
   Runs on its own (not "partials:loaded") so it fires
   immediately, before header/footer even fetch.
   ===================================================== */
(function () {
  'use strict';

  const gate = document.getElementById('ageGate');
  if (!gate) return;

  /* Skip the gate if this browser session already confirmed 21+.
     sessionStorage survives reloads/navigation within the same
     tab/session, but clears once the browser/tab is closed — so
     a fresh visit shows the gate again. */
  if (sessionStorage.getItem('bnb_age_verified') === 'true') {
    gate.remove();
    return;
  }

  document.documentElement.classList.add('age-gate-active');
  document.body.classList.add('age-gate-active');

  function blockScroll(e) { e.preventDefault(); }
  const SCROLL_KEYS = [' ', 'PageUp', 'PageDown', 'End', 'Home', 'ArrowUp', 'ArrowDown'];
  function blockScrollKeys(e) {
    if (SCROLL_KEYS.includes(e.key)) e.preventDefault();
  }
  window.addEventListener('wheel', blockScroll, { passive: false });
  window.addEventListener('touchmove', blockScroll, { passive: false });
  window.addEventListener('keydown', blockScrollKeys, { passive: false });

  const yesBtn = document.getElementById('ageGateYes');
  const noBtn = document.getElementById('ageGateNo');
  const box = gate.querySelector('.age-gate__box');

  function unlockScroll() {
    document.documentElement.classList.remove('age-gate-active');
    document.body.classList.remove('age-gate-active');
    window.removeEventListener('wheel', blockScroll);
    window.removeEventListener('touchmove', blockScroll);
    window.removeEventListener('keydown', blockScrollKeys);
  }

  if (yesBtn) {
    yesBtn.addEventListener('click', () => {
      sessionStorage.setItem('bnb_age_verified', 'true');
      unlockScroll();
      gate.remove();
    });
  }

  if (noBtn) {
    noBtn.addEventListener('click', () => {
      box.innerHTML = `
        <h2>Sorry</h2>
        <p>You must be 21 or older to access this site.</p>
      `;
      box.classList.add('age-gate__blocked');
      setTimeout(() => { window.location.href = 'https://www.google.com'; }, 2500);
    });
  }
})();