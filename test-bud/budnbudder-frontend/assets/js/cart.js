/* =====================================================
   BUD N' BUDDER — cart.js

   Cart page integration:
   - Uses the backend cart as the source of truth.
   - Supports both guest and authenticated carts.
   - Uses the HTTP-only guestCartId/token cookies through
     the shared window.BNB API.
   - Keeps the cart page and header drawer synchronized.
   - Uses real MongoDB product IDs from the backend.
   - Preserves the existing cart.html structure/classes.
   ===================================================== */

(function () {
  'use strict';

  const $ = (selector, context) =>
    (context || document).querySelector(selector);

  const money = (value) => {
    const number = Number(value) || 0;
    return '$' + number.toFixed(2);
  };

  let currentCart = null;
  let initialized = false;
  let loading = false;

  /* =====================================================
     SHARED BNB API
     ===================================================== */

  function getBNB() {
    if (!window.BNB) {
      throw new Error('Bud N Budder shared API is not available.');
    }

    return window.BNB;
  }

  function getCartFromBNB() {
    const BNB = getBNB();

    if (typeof BNB.getCart === 'function') {
      return BNB.getCart();
    }

    return null;
  }

  /*
   * The integrated header exposes the backend request layer.
   * Keep the actual HTTP calls here so this page does not
   * maintain a second cart implementation.
   */
  async function apiRequest(path, options) {
    const BNB = getBNB();

    if (typeof BNB.apiRequest !== 'function') {
      throw new Error(
        'The shared BNB API request function is unavailable. ' +
        'Make sure the integrated header.js is loaded before cart.js.'
      );
    }

    return BNB.apiRequest(path, options);
  }

  /* =====================================================
     CART NORMALIZATION
     ===================================================== */

  function getCartItems(cart) {
    if (!cart || !Array.isArray(cart.items)) {
      return [];
    }

    return cart.items.filter((item) => {
      return item && item.product;
    });
  }

  function getProductId(product) {
    if (!product) return '';

    if (typeof product === 'string') {
      return product;
    }

    return product._id || product.id || '';
  }

  function getProductCategory(product) {
    if (!product) return '';

    if (typeof product.category === 'object' && product.category) {
      return (
        product.category.name ||
        product.category.slug ||
        ''
      );
    }

    return '';
  }

  function getProductImage(product) {
    if (!product || !product.image) {
      return '';
    }

    return product.image;
  }

  function getProductName(product) {
    return product && product.name
      ? product.name
      : 'Product';
  }

  function getProductPrice(product) {
    return Number(product && product.price) || 0;
  }

  function getProductStock(product) {
    const stock = Number(product && product.stock);

    if (!Number.isFinite(stock)) {
      return null;
    }

    return Math.max(0, Math.floor(stock));
  }

  function getProductTag(product) {
    if (!product) return '';

    return (
      product.tagLabel ||
      product.tagType ||
      ''
    );
  }

  /* =====================================================
     SUMMARY
     ===================================================== */

  function calculateTotals(items) {
    let subtotal = 0;
    let itemCount = 0;

    items.forEach((item) => {
      const product = item.product;
      const quantity = Math.max(
        0,
        Number(item.quantity) || 0
      );

      subtotal += getProductPrice(product) * quantity;
      itemCount += quantity;
    });

    return {
      subtotal,
      itemCount
    };
  }

  function updateSummary(subtotal, itemCount) {
    const countEl = $('#summaryCount');
    const subtotalEl = $('#summarySubtotal');
    const totalEl = $('#summaryTotal');

    if (countEl) {
      countEl.textContent = String(itemCount);
    }

    if (subtotalEl) {
      subtotalEl.textContent = money(subtotal);
    }

    if (totalEl) {
      /*
       * Shipping is deliberately not added here because the
       * cart.html states that shipping is calculated at checkout.
       */
      totalEl.textContent = money(subtotal);
    }
  }

  /* =====================================================
     EMPTY / LOADING STATES
     ===================================================== */

  function showEmptyCart() {
    const table = $('#cartTable');
    const empty = $('#cartEmpty');
    const continueBtn = $('#continueShoppingBtn');
    const checkoutBtn = $('#pageCheckoutBtn');

    if (table) {
      table.hidden = true;
    }

    if (empty) {
      empty.hidden = false;
    }

    if (continueBtn) {
      continueBtn.hidden = true;
    }

    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.setAttribute('aria-disabled', 'true');
    }

    updateSummary(0, 0);
  }

  function showCartContent() {
    const table = $('#cartTable');
    const empty = $('#cartEmpty');
    const continueBtn = $('#continueShoppingBtn');
    const checkoutBtn = $('#pageCheckoutBtn');

    if (table) {
      table.hidden = false;
    }

    if (empty) {
      empty.hidden = true;
    }

    if (continueBtn) {
      continueBtn.hidden = false;
    }

    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.removeAttribute('aria-disabled');
    }
  }

  function setLoadingState(isLoading) {
    loading = isLoading;

    const checkoutBtn = $('#pageCheckoutBtn');

    if (checkoutBtn) {
      checkoutBtn.disabled = isLoading || !getCartItems(currentCart).length;
    }

    const body = $('#cartTableBody');

    if (body) {
      body.setAttribute(
        'aria-busy',
        isLoading ? 'true' : 'false'
      );
    }
  }

  function showCartError(message) {
    const body = $('#cartTableBody');

    if (!body) return;

    body.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty__icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3V13"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
            <circle
              cx="12"
              cy="17.5"
              r="1"
              fill="currentColor"
            />
            <path
              d="M10.2 3.8L2.9 18.1C2.2 19.5 3.2 21.2 4.8 21.2H19.2C20.8 21.2 21.8 19.5 21.1 18.1L13.8 3.8C13.1 2.4 10.9 2.4 10.2 3.8Z"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <h3>Unable to load your cart</h3>
        <p>${escapeHtml(message)}</p>
        <button
          type="button"
          class="btn btn--primary"
          id="cartRetryBtn"
        >
          Try Again
        </button>
      </div>
    `;

    const table = $('#cartTable');
    const empty = $('#cartEmpty');
    const continueBtn = $('#continueShoppingBtn');

    if (table) {
      table.hidden = true;
    }

    if (empty) {
      empty.hidden = true;
    }

    if (continueBtn) {
      continueBtn.hidden = true;
    }

    const retryBtn = $('#cartRetryBtn');

    if (retryBtn) {
      retryBtn.addEventListener('click', loadCart);
    }
  }

  /* =====================================================
     HTML ESCAPING
     ===================================================== */

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* =====================================================
     IMAGE PATH
     ===================================================== */

  function resolveImagePath(image) {
    if (!image) {
      return '';
    }

    /*
     * Backend image values may already be absolute URLs or
     * root-relative paths. Leave those untouched.
     */
    if (
      image.startsWith('http://') ||
      image.startsWith('https://') ||
      image.startsWith('/')
    ) {
      return image;
    }

    /*
     * Product images stored as frontend-relative paths should
     * work from cart.html without modification.
     */
    return image;
  }

  /* =====================================================
     VARIANT / META DISPLAY
     ===================================================== */

  function getVariantLabel(product) {
    if (!product) {
      return '';
    }

    /*
     * The backend Product model does not currently contain
     * the old frontend "type" field. Do not invent one.
     *
     * tagLabel/tagType are safe display metadata when present.
     */
    return getProductTag(product);
  }

  /* =====================================================
     RENDER CART
     ===================================================== */

  function renderCartPage(cart) {
    const body = $('#cartTableBody');

    if (!body) {
      return;
    }

    currentCart = cart || {
      items: []
    };

    const items = getCartItems(currentCart);

    if (!items.length) {
      body.innerHTML = '';
      showEmptyCart();
      return;
    }

    showCartContent();

    let html = '';

    items.forEach((item) => {
      const product = item.product;

      const productId = getProductId(product);
      const name = getProductName(product);
      const price = getProductPrice(product);
      const quantity = Math.max(
        1,
        Number(item.quantity) || 1
      );

      const stock = getProductStock(product);
      const category = getProductCategory(product);
      const image = resolveImagePath(
        getProductImage(product)
      );

      const variant = getVariantLabel(product);
      const lineTotal = price * quantity;

      const canIncrease =
        stock === null || quantity < stock;

      html += `
        <div
          class="cart-row"
          data-id="${escapeHtml(productId)}"
        >
          <div class="cart-row__product">

            <div class="cart-row__thumb">
              ${
                image
                  ? `
                    <img
                      src="${escapeHtml(image)}"
                      alt="${escapeHtml(name)}"
                      loading="lazy"
                    >
                  `
                  : `
                    <div
                      aria-hidden="true"
                      style="width:100%;height:100%;"
                    ></div>
                  `
              }
            </div>

            <div class="cart-row__info">

              <span class="cart-row__name">
                ${escapeHtml(name)}
              </span>

              ${
                variant
                  ? `
                    <span class="cart-row__variant">
                      ${escapeHtml(variant)}
                    </span>
                  `
                  : ''
              }

              ${
                category
                  ? `
                    <span class="cart-row__cat">
                      Category: ${escapeHtml(category)}
                    </span>
                  `
                  : ''
              }

              <button
                type="button"
                class="cart-row__remove"
                data-page-remove="${escapeHtml(productId)}"
                ${
                  loading
                    ? 'disabled'
                    : ''
                }
              >
                Remove
              </button>

            </div>
          </div>

          <div
            class="cart-row__price"
            data-label="Price"
          >
            ${money(price)}
          </div>

          <div
            class="cart-row__qty"
            data-label="Quantity"
          >
            <div class="cart-row__qty-controls">

              <button
                type="button"
                data-page-qty-down="${escapeHtml(productId)}"
                aria-label="Decrease quantity of ${escapeHtml(name)}"
                ${
                  quantity <= 1 || loading
                    ? 'disabled'
                    : ''
                }
              >
                −
              </button>

              <span aria-live="polite">
                ${quantity}
              </span>

              <button
                type="button"
                data-page-qty-up="${escapeHtml(productId)}"
                aria-label="Increase quantity of ${escapeHtml(name)}"
                ${
                  !canIncrease || loading
                    ? 'disabled'
                    : ''
                }
              >
                +
              </button>

            </div>
          </div>

          <div
            class="cart-row__total"
            data-label="Total"
          >
            ${money(lineTotal)}
          </div>
        </div>
      `;
    });

    body.innerHTML = html;

    const totals = calculateTotals(items);

    updateSummary(
      totals.subtotal,
      totals.itemCount
    );
  }

  /* =====================================================
     BACKEND CART REQUEST
     ===================================================== */

  async function fetchCart() {
    const response = await apiRequest('/cart', {
      method: 'GET'
    });

    if (!response) {
      throw new Error('No response received from the cart API.');
    }

    if (response.success === false) {
      throw new Error(
        response.message ||
        'Unable to retrieve your cart.'
      );
    }

    return response.cart || {
      items: []
    };
  }

  /* =====================================================
     LOAD CART
     ===================================================== */

  async function loadCart() {
    if (loading) {
      return;
    }

    setLoadingState(true);

    try {
      const cart = await fetchCart();

      currentCart = cart;

      renderCartPage(cart);

      /*
       * Keep the shared header/drawer synchronized when the
       * integrated header exposes a refresh function.
       */
      const BNB = getBNB();

      if (typeof BNB.setCart === 'function') {
        BNB.setCart(cart);
      }

      if (typeof BNB.refreshCart === 'function') {
        await BNB.refreshCart(cart);
      }

      if (typeof BNB.renderCart === 'function') {
        BNB.renderCart(cart);
      }

    } catch (error) {
      console.error('Cart load error:', error);

      showCartError(
        error.message ||
        'Please try again in a moment.'
      );

    } finally {
      setLoadingState(false);
    }
  }

  /* =====================================================
     UPDATE CART ITEM
     ===================================================== */

  async function updateItemQuantity(productId, quantity) {
    if (!productId) {
      return;
    }

    const numericQuantity = Number(quantity);

    if (
      !Number.isInteger(numericQuantity) ||
      numericQuantity < 1
    ) {
      return;
    }

    if (loading) {
      return;
    }

    setLoadingState(true);

    try {
      const response = await apiRequest(
        '/cart/items/' +
          encodeURIComponent(productId),
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            quantity: numericQuantity
          })
        }
      );

      if (!response || response.success === false) {
        throw new Error(
          (response && response.message) ||
          'Unable to update cart quantity.'
        );
      }

      currentCart =
        response.cart || {
          items: []
        };

      renderCartPage(currentCart);

      syncSharedCart(currentCart);

    } catch (error) {
      console.error(
        'Cart quantity update error:',
        error
      );

      alert(
        error.message ||
        'Unable to update the cart.'
      );

      /*
       * Reload from backend after an error so the UI cannot
       * remain out of sync with the actual cart.
       */
      try {
        const freshCart = await fetchCart();

        currentCart = freshCart;

        renderCartPage(freshCart);

        syncSharedCart(freshCart);
      } catch (reloadError) {
        console.error(
          'Cart recovery error:',
          reloadError
        );
      }

    } finally {
      setLoadingState(false);

      /*
       * Re-render after loading is cleared so quantity buttons
       * correctly reflect stock/loading state.
       */
      if (currentCart) {
        renderCartPage(currentCart);
      }
    }
  }

  /* =====================================================
     REMOVE CART ITEM
     ===================================================== */

  async function removeItem(productId, triggerButton) {
    if (!productId || loading) {
      return;
    }

    const confirmed = window.confirm(
      'Remove this product from your cart?'
    );

    if (!confirmed) {
      return;
    }

    if (triggerButton) {
      window.BNB.setBusy(triggerButton, true);
    }

    setLoadingState(true);

    try {
      const response = await apiRequest(
        '/cart/items/' +
          encodeURIComponent(productId),
        {
          method: 'DELETE'
        }
      );

      if (!response || response.success === false) {
        throw new Error(
          (response && response.message) ||
          'Unable to remove this product.'
        );
      }

      currentCart =
        response.cart || {
          items: []
        };

      renderCartPage(currentCart);

      syncSharedCart(currentCart);

    } catch (error) {
      console.error(
        'Cart remove error:',
        error
      );

      alert(
        error.message ||
        'Unable to remove the product.'
      );

      await loadCart();

    } finally {
      setLoadingState(false);

      if (currentCart) {
        renderCartPage(currentCart);
      }
    }
  }

  /* =====================================================
     CLEAR CART
     ===================================================== */

  async function clearCart() {
    if (loading) {
      return;
    }

    const items = getCartItems(currentCart);

    if (!items.length) {
      return;
    }

    const confirmed = window.confirm(
      'Remove all products from your cart?'
    );

    if (!confirmed) {
      return;
    }

    setLoadingState(true);

    try {
      const response = await apiRequest('/cart', {
        method: 'DELETE'
      });

      if (!response || response.success === false) {
        throw new Error(
          (response && response.message) ||
          'Unable to clear your cart.'
        );
      }

      currentCart = {
        items: []
      };

      renderCartPage(currentCart);

      syncSharedCart(currentCart);

    } catch (error) {
      console.error(
        'Clear cart error:',
        error
      );

      alert(
        error.message ||
        'Unable to clear your cart.'
      );

      await loadCart();

    } finally {
      setLoadingState(false);

      if (currentCart) {
        renderCartPage(currentCart);
      }
    }
  }

  /* =====================================================
     SHARED CART SYNCHRONIZATION
     ===================================================== */

  function syncSharedCart(cart) {
    const BNB = getBNB();

    /*
     * These methods are optional because the integrated
     * header may already update itself after its own request.
     * We only call them when available.
     */

    if (typeof BNB.setCart === 'function') {
      BNB.setCart(cart);
    }

    if (typeof BNB.refreshCart === 'function') {
      /*
       * Do not await this. The page has already received the
       * authoritative cart response.
       */
      Promise.resolve(
        BNB.refreshCart(cart)
      ).catch((error) => {
        console.error(
          'Shared cart refresh error:',
          error
        );
      });

      return;
    }

    if (typeof BNB.renderCart === 'function') {
      try {
        BNB.renderCart(cart);
      } catch (error) {
        console.error(
          'Shared cart render error:',
          error
        );
      }
    }
  }

  /* =====================================================
     ROW INTERACTIONS
     ===================================================== */

  function initRowInteractions() {
    const body = $('#cartTableBody');

    if (!body) {
      return;
    }

    body.addEventListener('click', async (event) => {
      const upButton =
        event.target.closest(
          '[data-page-qty-up]'
        );

      if (upButton) {
        event.preventDefault();

        const productId =
          upButton.getAttribute(
            'data-page-qty-up'
          );

        const item =
          getCartItems(currentCart).find(
            (cartItem) =>
              getProductId(cartItem.product) ===
              productId
          );

        if (!item) {
          return;
        }

        const currentQuantity =
          Number(item.quantity) || 1;

        const stock =
          getProductStock(item.product);

        if (
          stock !== null &&
          currentQuantity >= stock
        ) {
          alert(
            'You have reached the available stock for this product.'
          );
          return;
        }

        await window.BNB.withBusy(upButton, () =>
          updateItemQuantity(productId, currentQuantity + 1)
        );

        return;
      }

      const downButton =
        event.target.closest(
          '[data-page-qty-down]'
        );

      if (downButton) {
        event.preventDefault();

        const productId =
          downButton.getAttribute(
            'data-page-qty-down'
          );

        const item =
          getCartItems(currentCart).find(
            (cartItem) =>
              getProductId(cartItem.product) ===
              productId
          );

        if (!item) {
          return;
        }

        const currentQuantity =
          Number(item.quantity) || 1;

        if (currentQuantity <= 1) {
          return;
        }

        await window.BNB.withBusy(downButton, () =>
          updateItemQuantity(productId, currentQuantity - 1)
        );

        return;
      }

      const removeButton =
        event.target.closest(
          '[data-page-remove]'
        );

      if (removeButton) {
        event.preventDefault();

        const productId =
          removeButton.getAttribute(
            'data-page-remove'
          );

        await removeItem(productId, removeButton);
      }
    });
  }

  /* =====================================================
     CHECKOUT
     ===================================================== */

  function initCheckoutButton() {
    const button = $('#pageCheckoutBtn');

    if (!button) {
      return;
    }

    button.addEventListener('click', async () => {
      if (loading) {
        return;
      }

      const items = getCartItems(currentCart);

      if (!items.length) {
        alert(
          'Your cart is empty. Please add a product before checking out.'
        );
        return;
      }

      /*
       * Do not create an order here.
       *
       * checkout.js/order integration will handle order
       * creation and Stripe payment against the backend.
       */
      window.BNB.setBusy(button, true);
      window.location.href = 'checkout.html';
    });
  }

  /* =====================================================
     SEARCH OVERLAY
     ===================================================== */

  function initSearchOverlayResults() {
    const input = $('#searchInput');
    const results = $('#searchResults');

    if (!input || !results) {
      return;
    }

    /*
     * Search belongs to the shared header/shop flow.
     * cart.js should not maintain a second product catalog.
     *
     * If header.js provides search rendering, let it handle it.
     */
    if (
      typeof window.BNB !== 'undefined' &&
      typeof window.BNB.initSearch === 'function'
    ) {
      return;
    }
  }

  /* =====================================================
     HOME LINK
     ===================================================== */

  function fixHomeLink() {
    document
      .querySelectorAll(
        '.main-nav__link, .mobile-menu a'
      )
      .forEach((link) => {
        if (
          link.textContent.trim().toLowerCase() ===
          'home'
        ) {
          link.setAttribute(
            'href',
            'index.html'
          );
        }
      });
  }

  /* =====================================================
     OPTIONAL CLEAR CART CONTROL
     ===================================================== */

  function initClearCartControl() {
    /*
     * cart.html currently does not contain a dedicated
     * "Clear Cart" button.
     *
     * This delegated listener intentionally supports one
     * later without requiring another rewrite of cart.js.
     */
    document.addEventListener('click', (event) => {
      const clearButton =
        event.target.closest(
          '[data-cart-clear]'
        );

      if (!clearButton) {
        return;
      }

      event.preventDefault();

      clearCart();
    });
  }

  /* =====================================================
     SHARED CART EVENTS
     ===================================================== */

  function initSharedCartEvents() {
    /*
     * The integrated header can notify other pages when
     * another component changes the backend cart.
     */
    document.addEventListener(
      'bnb:cart-updated',
      (event) => {
        if (
          event.detail &&
          event.detail.cart
        ) {
          currentCart =
            event.detail.cart;

          renderCartPage(
            currentCart
          );
        } else {
          loadCart();
        }
      }
    );
  }

  /* =====================================================
     INITIALIZATION
     ===================================================== */

  async function init() {
    if (initialized) {
      return;
    }

    initialized = true;

    fixHomeLink();
    initRowInteractions();
    initCheckoutButton();
    initClearCartControl();
    initSharedCartEvents();
    initSearchOverlayResults();

    /*
     * The header partial is loaded asynchronously by
     * include.js. The integrated header.js is expected to
     * expose window.BNB by the time partials:loaded fires.
     */
    try {
      getBNB();
    } catch (error) {
      console.error(
        'Cart initialization error:',
        error
      );

      showCartError(
        'The shared site components have not finished loading.'
      );

      return;
    }

    await loadCart();
  }

  document.addEventListener(
    'partials:loaded',
    init
  );

  /*
   * Safety fallback for cases where this script is loaded
   * after partials:loaded has already fired.
   */
  if (
    document.readyState !== 'loading' &&
    document.querySelector('#cartTableBody') &&
    window.BNB
  ) {
    init();
  }

})();