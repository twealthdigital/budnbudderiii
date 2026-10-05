
/* =====================================================
   BUD N' BUDDER — header.js
   Shared header behavior + backend cart/auth integration.
   ===================================================== */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  /*
   * Backend API
   *
   * Override this before header.js if the API lives elsewhere:
   * window.BNB_API_BASE_URL = 'https://api.example.com/api';
   *
   * Local development defaults to the backend project:
   * http://https://budnbudder-backend.onrender.com/api
   */
  const API_BASE =
    window.BNB_API_BASE_URL ||
    'http://https://budnbudder-backend.onrender.com/api';

  const money = (n) => {
    const value = Number(n);
    return '$' + (Number.isFinite(value) ? value : 0).toFixed(2);
  };

  let cartState = {
    items: []
  };

  let currentUser = null;

  /*
   * =====================================================
   * API HELPER
   * =====================================================
   */

  async function apiRequest(path, options = {}) {
    const config = {
      credentials: 'include',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    };

    let response;

    try {
      response = await fetch(`${API_BASE}${path}`, config);
    } catch (error) {
      console.error('BNB API connection error:', error);

      throw new Error(
        'Unable to connect to the Bud N\' Budder server.'
      );
    }

    let data = null;

    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      const message =
        data?.message ||
        `Request failed with status ${response.status}.`;

      const error = new Error(message);
      error.status = response.status;
      error.data = data;

      throw error;
    }

    return data;
  }

  /*
   * =====================================================
   * PRODUCT COMPATIBILITY
   * =====================================================
   */
async function getProducts(options = {}) {
  const params = new URLSearchParams();

  if (options.search) {
    params.set('search', options.search);
  }

  if (options.category) {
    params.set('category', options.category);
  }

  if (options.status) {
    params.set('status', options.status);
  }

  if (options.sort) {
    params.set('sort', options.sort);
  }

  if (options.page) {
    params.set('page', options.page);
  }

  if (options.limit) {
    params.set('limit', options.limit);
  }

  if (options.minPrice !== undefined && options.minPrice !== '') {
    params.set('minPrice', options.minPrice);
  }

  if (options.maxPrice !== undefined && options.maxPrice !== '') {
    params.set('maxPrice', options.maxPrice);
  }

  const query = params.toString();

  const response = await apiRequest(
    `/products${query ? `?${query}` : ''}`
  );

  return response;
}

  /*
   * =====================================================
   * CART
   * =====================================================
   *
   * Backend endpoints:
   *
   * GET    /api/cart
   * POST   /api/cart/items
   * PATCH  /api/cart/items/:productId
   * DELETE /api/cart/items/:productId
   * DELETE /api/cart
   *
   * The backend owns the actual cart.
   */

  function normalizeCart(cart) {
    if (!cart || !Array.isArray(cart.items)) {
      return {
        ...cart,
        items: []
      };
    }

    return cart;
  }

  async function loadCart(options = {}) {
    try {
      const response = await apiRequest('/cart');

      cartState = normalizeCart(response.cart);

      renderCart();

      /*
       * Let other frontend files know that the backend cart
       * is ready.
       */
      document.dispatchEvent(
        new CustomEvent('bnb:cart-loaded', {
          detail: {
            cart: cartState,
            silent: !!options.silent
          }
        })
      );

      return cartState;
    } catch (error) {
      console.error('Unable to load cart:', error);

      cartState = {
        items: []
      };

      renderCart();

      document.dispatchEvent(
        new CustomEvent('bnb:cart-error', {
          detail: {
            error
          }
        })
      );

      return cartState;
    }
  }

    /*
   * =====================================================
   * GUEST CART MERGE
   * =====================================================
   *
   * Called immediately after a guest successfully logs in
   * or registers.
   *
   * The browser automatically sends:
   * - guestCartId cookie
   * - authenticated token cookie
   *
   * The backend then merges the guest cart into the
   * authenticated user's cart.
   */
  async function mergeGuestCart() {
    try {
      const response = await apiRequest('/cart/merge', {
        method: 'POST'
      });

      cartState = normalizeCart(response.cart);

      renderCart();

      document.dispatchEvent(
        new CustomEvent('bnb:cart-updated', {
          detail: {
            cart: cartState,
            action: 'merge'
          }
        })
      );

      return cartState;
    } catch (error) {
      console.error(
        'Unable to merge guest cart:',
        error
      );

      /*
       * Do not destroy the authenticated session if the
       * merge itself fails.
       *
       * The caller can still continue to the website.
       */
      return null;
    }
  }

  /*
   * Compatibility getter.
   *
   * Older frontend files expect an object such as:
   * {
   *   productId: quantity
   * }
   *
   * We expose the backend cart in that shape without using it
   * as the source of truth.
   */
  function getCart() {
    const cart = {};

    if (!cartState || !Array.isArray(cartState.items)) {
      return cart;
    }

    cartState.items.forEach((item) => {
      const product = item.product;

      if (!product) return;

      const id = product._id || product.id;

      if (id) {
        cart[id] = Number(item.quantity) || 0;
      }
    });

    return cart;
  }

  function getCartItems() {
    return Array.isArray(cartState.items)
      ? cartState.items
      : [];
  }

  function getCartItem(productId) {
    return getCartItems().find((item) => {
      const id = item.product?._id || item.product?.id;
      return String(id) === String(productId);
    });
  }

  function cartCount(cart = null) {
    /*
     * Backend cart is authoritative.
     *
     * Count total units, not distinct products.
     */
    if (!cart && cartState) {
      return getCartItems().filter(
        (item) => (Number(item.quantity) || 0) > 0
      ).length;
    }

    if (cart && typeof cart === 'object') {
      return Object.values(cart).filter(
        (quantity) => (Number(quantity) || 0) > 0
      ).length;
    }

    return 0;
  }

  async function addToCart(productId, quantity = 1) {
    if (!productId) return;

    /*
     * The backend expects a real MongoDB Product _id.
     *
     * If an old demo ID such as "bs1" is still passed,
     * fail gracefully instead of sending a guaranteed bad
     * request to MongoDB.
     */
    if (
  typeof productId === 'string' &&
  !/^[a-fA-F0-9]{24}$/.test(productId)
) {
  console.warn(
    `Invalid product ID "${productId}".`
  );

  showCartMessage(
    'Unable to add this product to the cart.'
  );

  return;
}

    try {
      const response = await apiRequest('/cart/items', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          quantity
        })
      });

      cartState = normalizeCart(response.cart);

      renderCart();

      document.dispatchEvent(
        new CustomEvent('bnb:cart-updated', {
          detail: {
            cart: cartState,
            action: 'add',
            productId
          }
        })
      );

      return cartState;
    } catch (error) {
      console.error('Unable to add item to cart:', error);

      showCartMessage(error.message);

      throw error;
    }
  }

  async function changeQty(productId, delta) {
    const item = getCartItem(productId);

    if (!item) return;

    const currentQuantity =
      Number(item.quantity) || 0;

    const newQuantity =
      currentQuantity + Number(delta);

    if (newQuantity <= 0) {
      return removeFromCart(productId);
    }

    try {
      const response = await apiRequest(
        `/cart/items/${encodeURIComponent(productId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            quantity: newQuantity
          })
        }
      );

      cartState = normalizeCart(response.cart);

      renderCart();

      document.dispatchEvent(
        new CustomEvent('bnb:cart-updated', {
          detail: {
            cart: cartState,
            action: 'quantity',
            productId,
            quantity: newQuantity
          }
        })
      );

      return cartState;
    } catch (error) {
      console.error(
        'Unable to update cart quantity:',
        error
      );

      showCartMessage(error.message);

      throw error;
    }
  }

  async function removeFromCart(productId) {
    if (!productId) return;

    try {
      const response = await apiRequest(
        `/cart/items/${encodeURIComponent(productId)}`,
        {
          method: 'DELETE'
        }
      );

      cartState = normalizeCart(response.cart);

      renderCart();

      document.dispatchEvent(
        new CustomEvent('bnb:cart-updated', {
          detail: {
            cart: cartState,
            action: 'remove',
            productId
          }
        })
      );

      return cartState;
    } catch (error) {
      console.error(
        'Unable to remove cart item:',
        error
      );

      showCartMessage(error.message);

      throw error;
    }
  }

  async function clearCart() {
    try {
      const response = await apiRequest('/cart', {
        method: 'DELETE'
      });

      cartState = normalizeCart(response.cart);

      renderCart();

      document.dispatchEvent(
        new CustomEvent('bnb:cart-updated', {
          detail: {
            cart: cartState,
            action: 'clear'
          }
        })
      );

      return cartState;
    } catch (error) {
      console.error(
        'Unable to clear cart:',
        error
      );

      showCartMessage(error.message);

      throw error;
    }
  }

  /*
   * =====================================================
   * CART RENDERING
   * =====================================================
   */

  function getProductImage(product) {
    if (!product) return '';

    const image = product.image || '';

    if (!image) return '';

    /*
     * Backend may eventually return:
     * /uploads/products/file.png
     *
     * Keep absolute URLs untouched.
     */
    if (/^https?:\/\//i.test(image)) {
      return image;
    }

    /*
     * Root-relative backend paths.
     */
    if (image.startsWith('/')) {
      try {
        return new URL(image, API_BASE).href;
      } catch (_) {
        return image;
      }
    }

    return image;
  }

  function renderCart() {
    const badge = $('#cartBadge');
    const itemsWrap = $('#cartItems');
    const subtotalEl = $('#cartSubtotal');

    const items = getCartItems();

    if (badge) {
      badge.textContent = String(cartCount());
      badge.hidden = cartCount() === 0;
    }

    if (!itemsWrap) return;

    if (!items.length) {
      itemsWrap.innerHTML =
        '<div class="cart-empty">' +
        'Your cart is empty.<br>' +
        'Add some products to get started.' +
        '</div>';

      if (subtotalEl) {
        subtotalEl.textContent = money(0);
      }

      return;
    }

    let subtotal = 0;

    const html = items
      .filter((item) => item.product)
      .map((item) => {
        const product = item.product;
        const quantity =
          Number(item.quantity) || 0;

        const price =
          Number(product.price) || 0;

        subtotal += price * quantity;

        const productId =
          product._id || product.id;

        const categoryName =
          product.category?.name ||
          product.category?.slug ||
          '';

        const image =
          getProductImage(product);

        return `
          <div
            class="cart-line"
            data-id="${escapeHtml(productId)}"
          >
            <div class="cart-line__thumb">
              ${
                image
                  ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name || 'Product')}">`
                  : ''
              }
            </div>

            <div class="cart-line__info">
              <span class="cart-line__name">
                ${escapeHtml(product.name || 'Product')}
              </span>

              <span class="cart-line__meta">
                ${money(price)}
                ${categoryName ? ` / ${escapeHtml(categoryName)}` : ''}
              </span>

              <div class="cart-line__row">
                <div class="cart-line__qty">
                  <button
                    type="button"
                    data-qty-down="${escapeHtml(productId)}"
                    aria-label="Decrease quantity"
                  >−</button>

                  <span>${quantity}</span>

                  <button
                    type="button"
                    data-qty-up="${escapeHtml(productId)}"
                    aria-label="Increase quantity"
                  >+</button>
                </div>

                <button
                  type="button"
                  class="cart-line__remove"
                  data-remove="${escapeHtml(productId)}"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    itemsWrap.innerHTML = html;

    if (subtotalEl) {
      subtotalEl.textContent = money(subtotal);
    }
  }

  function showCartMessage(message) {
    /*
     * Keep this deliberately non-invasive because the current
     * header has no dedicated notification component.
     */
    if (!message) return;

    console.warn(`Bud N' Budder: ${message}`);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /*
   * =====================================================
   * CART INTERACTIONS
   * =====================================================
   */

  function initCartInteractions() {
    document.addEventListener('click', async (e) => {
      const addBtn =
        e.target.closest('[data-add]');

      if (addBtn) {
        const productId =
          addBtn.getAttribute('data-add');

        try {
          await window.BNB.withBusy(addBtn, () => addToCart(productId));

          addBtn.classList.add('is-added');

          setTimeout(() => {
            addBtn.classList.remove('is-added');
          }, 1300);
        } catch (_) {
          // Error already displayed/logged.
        }

        return;
      }

      const upBtn =
        e.target.closest('[data-qty-up]');

      if (upBtn) {
        const productId =
          upBtn.getAttribute('data-qty-up');

        try {
          await window.BNB.withBusy(upBtn, () => changeQty(productId, 1));
        } catch (_) {}

        return;
      }

      const downBtn =
        e.target.closest('[data-qty-down]');

      if (downBtn) {
        const productId =
          downBtn.getAttribute('data-qty-down');

        try {
          await window.BNB.withBusy(downBtn, () => changeQty(productId, -1));
        } catch (_) {}

        return;
      }

      const removeBtn =
        e.target.closest('[data-remove]');

      if (removeBtn) {
        const productId =
          removeBtn.getAttribute('data-remove');

        try {
          await window.BNB.withBusy(removeBtn, () => removeFromCart(productId));
        } catch (_) {}

        return;
      }
    });

    const checkoutBtn = $('#checkoutBtn');

    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => {
        if (cartCount() <= 0) return;

        window.BNB.setBusy(checkoutBtn, true);
        window.location.href = 'cart.html';
      });
    }
  }

  /*
   * =====================================================
   * MOBILE MENU
   * =====================================================
   */

  function initMobileMenu() {
    const burger = $('#burgerToggle');
    const menu = $('#mobileMenu');

    if (!burger || !menu) return;

    burger.addEventListener('click', (e) => {
      e.stopPropagation();

      menu.classList.toggle('is-open');
    });

    menu
      .querySelectorAll('a')
      .forEach((a) => {
        a.addEventListener('click', () => {
          menu.classList.remove('is-open');
        });
      });

    document.addEventListener('click', (e) => {
      if (
        menu.classList.contains('is-open') &&
        !menu.contains(e.target) &&
        !burger.contains(e.target)
      ) {
        menu.classList.remove('is-open');
      }
    });
  }

  /*
   * =====================================================
   * HEADER SCROLL
   * =====================================================
   */

  function initHeaderScroll() {
    const header = $('#siteHeader');

    if (!header) return;

    window.addEventListener('scroll', () => {
      header.style.boxShadow =
        window.scrollY > 8
          ? '0 4px 18px rgba(0,0,0,0.35)'
          : 'none';
    });
  }

  /*
   * =====================================================
   * CART DRAWER
   * =====================================================
   */

  function openCart() {
    const drawer = $('#cartDrawer');
    const scrim = $('#overlayScrim');

    if (drawer) {
      drawer.classList.add('is-open');
    }

    if (scrim) {
      scrim.classList.add('is-open');
    }

    /*
     * Refresh whenever the drawer opens so the user sees
     * the current server-side cart.
     */
    loadCart({ silent: true });
  }

  function closeCart() {
    const drawer = $('#cartDrawer');
    const scrim = $('#overlayScrim');

    if (drawer) {
      drawer.classList.remove('is-open');
    }

    if (scrim) {
      scrim.classList.remove('is-open');
    }
  }

  function initCartDrawerToggle() {
    const cartToggle = $('#cartToggle');
    const cartClose = $('#cartClose');
    const scrim = $('#overlayScrim');

    if (cartToggle) {
      cartToggle.addEventListener(
        'click',
        openCart
      );
    }

    if (cartClose) {
      cartClose.addEventListener(
        'click',
        closeCart
      );
    }

    if (scrim) {
      scrim.addEventListener(
        'click',
        closeCart
      );
    }
  }

  /*
   * =====================================================
   * CART DRAWER SWIPE
   * =====================================================
   */

  function initCartDrawerSwipe() {
    const drawer = $('#cartDrawer');

    if (!drawer) return;

    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let tracking = false;
    let dragging = false;

    const DIRECTION_THRESHOLD = 10;

    drawer.addEventListener(
      'touchstart',
      (e) => {
        startX =
          e.touches[0].clientX;

        startY =
          e.touches[0].clientY;

        currentX = 0;
        tracking = true;
        dragging = false;
      },
      { passive: true }
    );

    drawer.addEventListener(
      'touchmove',
      (e) => {
        if (!tracking) return;

        const dx =
          e.touches[0].clientX - startX;

        const dy =
          e.touches[0].clientY - startY;

        if (!dragging) {
          if (
            Math.abs(dx) <
              DIRECTION_THRESHOLD &&
            Math.abs(dy) <
              DIRECTION_THRESHOLD
          ) {
            return;
          }

          if (
            Math.abs(dx) >
              Math.abs(dy) &&
            dx > 0
          ) {
            dragging = true;
            drawer.style.transition = 'none';
          } else {
            tracking = false;
            return;
          }
        }

        e.preventDefault();

        currentX =
          dx < 0 ? 0 : dx;

        drawer.style.transform =
          `translateX(${currentX}px)`;
      },
      { passive: false }
    );

    drawer.addEventListener(
      'touchend',
      () => {
        tracking = false;

        if (!dragging) return;

        dragging = false;

        drawer.style.transition = '';
        drawer.style.transform = '';

        if (currentX > 90) {
          closeCart();
        }

        currentX = 0;
      }
    );
  }

  /*
   * =====================================================
   * SEARCH
   * =====================================================
   */

  function initSearchToggle() {
    const toggle = $('#searchToggle');
    const overlay = $('#searchOverlay');
    const closeBtn = $('#searchClose');
    const input = $('#searchInput');

    if (!toggle || !overlay) return;

    function open() {
      overlay.classList.add('is-open');

      setTimeout(() => {
        if (input) input.focus();
      }, 50);
    }

    function close() {
      overlay.classList.remove('is-open');

      if (input) {
        input.value = '';
        input.dispatchEvent(
          new Event('input')
        );
      }
    }

    toggle.addEventListener('click', open);

    if (closeBtn) {
      closeBtn.addEventListener(
        'click',
        close
      );
    }

    overlay.addEventListener(
      'click',
      (e) => {
        if (e.target === overlay) {
          close();
        }
      }
    );

    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') {
          close();
        }
      }
    );

    window.BNB.closeSearch = close;
    window.BNB.openSearch = open;
  }

  /*
   * =====================================================
   * AUTH
   * =====================================================
   *
   * Backend uses an HTTP-only "token" cookie.
   *
   * We intentionally do NOT read or store that cookie in JS.
   */

  async function loadCurrentUser() {
    try {
      const response =
        await apiRequest('/auth/me');

      currentUser =
        response.user || null;

      refreshAccountUI();

      document.dispatchEvent(
        new CustomEvent('bnb:auth-loaded', {
          detail: {
            user: currentUser
          }
        })
      );

      return currentUser;
    } catch (error) {
      /*
       * 401 simply means the visitor is not logged in.
       * It is not a frontend error.
       */
      if (error.status === 401) {
        currentUser = null;
      } else {
        console.error(
          'Unable to determine authentication state:',
          error
        );

        currentUser = null;
      }

      refreshAccountUI();

      document.dispatchEvent(
        new CustomEvent('bnb:auth-loaded', {
          detail: {
            user: null
          }
        })
      );

      return null;
    }
  }

  function getCurrentUser() {
    return currentUser;
  }

  async function logout() {
    try {
      await apiRequest('/auth/logout', {
        method: 'POST'
      });
    } catch (error) {
      /*
       * Still clear the frontend state if the server reports
       * an error, because there is no safe client-side token
       * to keep using.
       */
      console.error(
        'Logout request failed:',
        error
      );
    }

    currentUser = null;

    refreshAccountUI();

    document.dispatchEvent(
      new CustomEvent('bnb:auth-changed', {
        detail: {
          user: null
        }
      })
    );
  }

  function displayUserName(user) {
    if (!user) return '';

    const fullName = [
      user.firstName,
      user.lastName
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    return fullName || user.email || 'Account';
  }

  function refreshAccountUI() {
    const wrap = $('#accountDropdown');

    if (!wrap) return;

    const loggedIn = !!currentUser;

    const signinLink =
      wrap.querySelector(
        '[data-account="signin"]'
      );

    const signupLink =
      wrap.querySelector(
        '[data-account="signup"]'
      );

    const usernameEl =
      wrap.querySelector(
        '[data-account="username"]'
      );

    const ordersLink =
      wrap.querySelector(
        '[data-account="orders"]'
      );

    const logoutBtn =
      wrap.querySelector(
        '[data-account="logout"]'
      );

    if (signinLink) {
      signinLink.hidden = loggedIn;
    }

    if (signupLink) {
      signupLink.hidden = loggedIn;
    }

    if (usernameEl) {
      usernameEl.hidden = !loggedIn;

      if (loggedIn) {
        usernameEl.textContent =
          displayUserName(currentUser);
      }
    }

    if (ordersLink) {
      ordersLink.hidden = !loggedIn;
    }

    if (logoutBtn) {
      logoutBtn.hidden = !loggedIn;
    }

    const mSignin =
      document.querySelector(
        '[data-account="mobile-signin"]'
      );

    const mSignup =
      document.querySelector(
        '[data-account="mobile-signup"]'
      );

    const mUsername =
      document.querySelector(
        '[data-account="mobile-username"]'
      );

    const mOrders =
      document.querySelector(
        '[data-account="mobile-orders"]'
      );

    const mLogout =
      document.querySelector(
        '[data-account="mobile-logout"]'
      );

    if (mSignin) {
      mSignin.hidden = loggedIn;
    }

    if (mSignup) {
      mSignup.hidden = loggedIn;
    }

    if (mUsername) {
      mUsername.hidden = !loggedIn;

      if (loggedIn) {
        mUsername.textContent =
          displayUserName(currentUser);
      }
    }

    if (mOrders) {
      mOrders.hidden = !loggedIn;
    }

    if (mLogout) {
      mLogout.hidden = !loggedIn;
    }
  }

  function initAccountDropdown() {
    const wrap =
      $('#accountDropdown');

    const toggle =
      $('#accountToggle');

    if (!wrap || !toggle) return;

    toggle.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();

        wrap.classList.toggle(
          'is-open'
        );

        toggle.setAttribute(
          'aria-expanded',
          wrap.classList.contains(
            'is-open'
          )
        );
      }
    );

    document.addEventListener(
      'click',
      (e) => {
        if (!wrap.contains(e.target)) {
          wrap.classList.remove(
            'is-open'
          );

          toggle.setAttribute(
            'aria-expanded',
            'false'
          );
        }
      }
    );

    const logoutBtn =
      wrap.querySelector(
        '[data-account="logout"]'
      );

    if (logoutBtn) {
      logoutBtn.addEventListener(
        'click',
        async (e) => {
          e.preventDefault();

          await logout();

          wrap.classList.remove(
            'is-open'
          );

          window.location.href =
            'index.html';
        }
      );
    }

    const mobileLogoutBtn =
      document.querySelector(
        '[data-account="mobile-logout"]'
      );

    if (mobileLogoutBtn) {
      mobileLogoutBtn.addEventListener(
        'click',
        async (e) => {
          e.preventDefault();

          await logout();

          const menu =
            document.getElementById(
              'mobileMenu'
            );

          if (menu) {
            menu.classList.remove(
              'is-open'
            );
          }

          window.location.href =
            'index.html';
        }
      );
    }

    refreshAccountUI();
  }

  function initMobileAccountToggle() {
    const wrap =
      document.getElementById(
        'mobileAccount'
      );

    const toggle =
      document.getElementById(
        'mobileAccountToggle'
      );

    if (!wrap || !toggle) return;

    toggle.addEventListener(
      'click',
      () => {
        wrap.classList.toggle(
          'is-open'
        );

        toggle.setAttribute(
          'aria-expanded',
          wrap.classList.contains(
            'is-open'
          )
        );
      }
    );
  }

  /*
   * =====================================================
   * NAVIGATION
   * =====================================================
   */

  function fixHomeLink(path) {
    if (
      path === 'index.html' ||
      path === ''
    ) {
      return;
    }

    $$('.main-nav__link, .mobile-menu a')
      .filter(
        (a) =>
          a.textContent.trim() ===
          'Home'
      )
      .forEach(
        (a) =>
          a.setAttribute(
            'href',
            'index.html'
          )
      );
  }

  function initActiveNav() {
    const path =
      window.location.pathname
        .split('/')
        .pop() ||
      'index.html';

    fixHomeLink(path);

    $$('.main-nav__link, .mobile-menu a')
      .forEach((a) =>
        a.classList.remove(
          'is-active'
        )
      );

    const accountToggle =
      $('#accountToggle');

    if (accountToggle) {
      accountToggle.classList.remove(
        'is-active'
      );
    }

    if (path === 'auth.html') {
      if (accountToggle) {
        accountToggle.classList.add(
          'is-active'
        );
      }

      const mobileAccountToggle =
        $('#mobileAccountToggle');

      if (mobileAccountToggle) {
        mobileAccountToggle.classList.add(
          'is-active'
        );
      }

      return;
    }

    const NAV_MATCH = {
      'index.html': 'Home',
      '': 'Home',
      'shop.html': 'Shop',
      'about.html': 'About'
    };

    const activeLabel =
      NAV_MATCH[path];

    if (!activeLabel) return;

    $$('.main-nav__link, .mobile-menu a')
      .forEach((a) => {
        if (
          a.textContent.trim() ===
          activeLabel
        ) {
          a.classList.add(
            'is-active'
          );
        }
      });

    if (path === 'about.html') {
      initContactScrollSpy();
    }
  }

  function initContactScrollSpy() {
    const contactSection =
      document.getElementById(
        'contact-form'
      );

    if (
      !contactSection ||
      !('IntersectionObserver' in window)
    ) {
      return;
    }

    const aboutLinks =
      $$('.main-nav__link, .mobile-menu a')
        .filter(
          (a) =>
            a.textContent.trim() ===
            'About'
        );

    const contactLinks =
      $$('.main-nav__link, .mobile-menu a')
        .filter(
          (a) =>
            a.textContent.trim() ===
            'Contact'
        );

    const io =
      new IntersectionObserver(
        (entries) => {
          entries.forEach(
            (entry) => {
              if (
                entry.isIntersecting
              ) {
                aboutLinks.forEach(
                  (a) =>
                    a.classList.remove(
                      'is-active'
                    )
                );

                contactLinks.forEach(
                  (a) =>
                    a.classList.add(
                      'is-active'
                    )
                );
              } else {
                contactLinks.forEach(
                  (a) =>
                    a.classList.remove(
                      'is-active'
                    )
                );

                aboutLinks.forEach(
                  (a) =>
                    a.classList.add(
                      'is-active'
                    )
                );
              }
            }
          );
        },
        {
          threshold: 0.4
        }
      );

    io.observe(contactSection);
  }

  /*
   * =====================================================
   * PUBLIC API
   * =====================================================
   */

  window.BNB =
    window.BNB || {};

  window.BNB.API_BASE =
    API_BASE;

  window.BNB.apiRequest =
    apiRequest;

  window.BNB.getProducts =
    getProducts;

  window.BNB.getCart =
    getCart;

  window.BNB.getCartItems =
    getCartItems;

  window.BNB.loadCart =
    loadCart;

  window.BNB.addToCart =
    addToCart;

    window.BNB.mergeGuestCart =
    mergeGuestCart;

  window.BNB.changeQty =
    changeQty;

  window.BNB.removeFromCart =
    removeFromCart;

  window.BNB.clearCart =
    clearCart;

  window.BNB.renderCart =
    renderCart;

  window.BNB.cartCount =
    cartCount;

  window.BNB.getCurrentUser =
    getCurrentUser;

  window.BNB.loadCurrentUser =
    loadCurrentUser;

  window.BNB.logout =
    logout;

  window.BNB.openCart =
    openCart;

  window.BNB.closeCart =
    closeCart;

  /*
   * =====================================================
   * INITIALIZATION
   * =====================================================
   */

  document.addEventListener(
    'partials:loaded',
    async () => {
      initMobileMenu();
      initHeaderScroll();
      initCartDrawerToggle();
      initCartDrawerSwipe();
      initSearchToggle();
      initCartInteractions();
      initAccountDropdown();
      initMobileAccountToggle();
      initActiveNav();

      /*
       * These are intentionally loaded independently.
       * A failure in auth must not break the cart and
       * vice versa.
       */
      await Promise.allSettled([
        loadCart(),
        loadCurrentUser()
      ]);
    }
  );
})();