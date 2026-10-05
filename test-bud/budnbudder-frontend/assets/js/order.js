/* =====================================================
   BUD N' BUDDER — order.js

   "My Orders" page.

   Backend is the source of truth.

   Registered customers:
     GET /api/orders/my-orders

   Guests:
     GET /api/orders/guest/:id

   The checkout page stores the most recently created
   MongoDB order ID in:

     sessionStorage:
       bnb_last_order_id
   ===================================================== */

(function () {
  'use strict';

  const $ = (sel, ctx) =>
    (ctx || document).querySelector(sel);

  const $$ = (sel, ctx) =>
    Array.from(
      (ctx || document).querySelectorAll(sel)
    );

  const API_BASE =
    window.BNB_API_BASE_URL ||
    'http://https://budnbudder-backend.onrender.com/api';

  const LAST_ORDER_ID_KEY =
    'bnb_last_order_id';

  const VARIANT_BY_TYPE = {
    flower: '3.5g',
    prerolls: '1 pre-roll',
    edibles: '100mg',
    vapes: '1 device',
    accessories: '1pc'
  };

  /* =====================================================
     HELPERS
     ===================================================== */

  function money(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return '$0.00';
    }

    return '$' + number.toFixed(2);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(dateValue) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleDateString(
      'en-US',
      {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }
    );
  }

  function getProductById(id) {
    if (
      !window.BNB ||
      typeof window.BNB.getProducts !== 'function'
    ) {
      return null;
    }

    return (
      window.BNB
        .getProducts()
        .find((product) => product.id === id) ||
      null
    );
  }

  /* =====================================================
     API
     ===================================================== */

  async function apiRequest(path, options) {
    const config = {
      credentials: 'include',
      ...(options || {})
    };

    config.headers = {
      Accept: 'application/json',
      ...(config.body
        ? {
            'Content-Type':
              'application/json'
          }
        : {}),
      ...(options && options.headers
        ? options.headers
        : {})
    };

    const response = await fetch(
      API_BASE + path,
      config
    );

    let data = null;

    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (
      !response.ok ||
      !data ||
      data.success === false
    ) {
      throw new Error(
        data?.message ||
          `Request failed (${response.status})`
      );
    }

    return data;
  }

  /* =====================================================
     AUTH CHECK
     ===================================================== */

  async function getCurrentUser() {
    try {
      const data =
        await apiRequest('/auth/me');

      return data?.user || null;
    } catch (error) {
      /*
       * 401 simply means the visitor is a guest.
       */
      return null;
    }
  }

  /* =====================================================
     LOAD REGISTERED CUSTOMER ORDERS
     ===================================================== */

  async function loadMyOrders() {
    const data =
      await apiRequest(
        '/orders/my-orders'
      );

    return Array.isArray(data?.orders)
      ? data.orders
      : [];
  }

  /* =====================================================
     LOAD GUEST ORDER
     ===================================================== */

  async function loadGuestOrder() {
    let orderId = null;

    try {
      orderId = sessionStorage.getItem(LAST_ORDER_ID_KEY) || localStorage.getItem(LAST_ORDER_ID_KEY);
    } catch (error) {
      console.warn(
        'Unable to read guest order ID:',
        error
      );
    }

    if (!orderId) {
      return [];
    }

    const data =
      await apiRequest(
        `/orders/guest/${encodeURIComponent(orderId)}`
      );

    if (!data?.order) {
      return [];
    }

    return [data.order];
  }

  /* =====================================================
     NORMALIZE ORDER ITEM
     ===================================================== */

  function getItemProduct(item) {
    if (!item) {
      return null;
    }

    /*
     * Backend populates items.product.
     */
    if (
      item.product &&
      typeof item.product === 'object'
    ) {
      return item.product;
    }

    /*
     * Fallback for older/local data.
     */
    if (
      item.product &&
      typeof item.product !== 'object'
    ) {
      return getProductById(
        item.product
      );
    }

    return null;
  }

  function getItemQuantity(item) {
    /*
     * Backend order items use quantity.
     */
    if (
      Number.isFinite(
        Number(item?.quantity)
      )
    ) {
      return Number(item.quantity);
    }

    /*
     * Fallback for the old localStorage
     * order structure.
     */
    if (
      Number.isFinite(
        Number(item?.qty)
      )
    ) {
      return Number(item.qty);
    }

    return 0;
  }

  function getItemPrice(item) {
    const product =
      getItemProduct(item);

    if (
      Number.isFinite(
        Number(item?.price)
      )
    ) {
      return Number(item.price);
    }

    if (
      product &&
      Number.isFinite(
        Number(product.price)
      )
    ) {
      return Number(product.price);
    }

    return 0;
  }

  function getItemName(item) {
    const product =
      getItemProduct(item);

    return (
      item?.name ||
      product?.name ||
      'Product'
    );
  }

  function getItemImage(item) {
    const product =
      getItemProduct(item);

    return (
      item?.image ||
      product?.image ||
      'assets/images/products/placeholder.png'
    );
  }

  /* =====================================================
     ADDRESS
     ===================================================== */

  function addressLine(order) {
    const address =
      order?.shippingAddress ||
      order?.address ||
      {};

    if (
      order?.shippingMethod ===
      'pickup'
    ) {
      return 'Pickup — Astoria, NY';
    }

    if (!address.address1) {
      return '—';
    }

    const parts = [
      address.address1
    ];

    if (address.address2) {
      parts.push(
        address.address2
      );
    }

    if (address.city) {
      parts.push(
        address.city
      );
    }

    const stateZip = [
      address.state,
      address.zip
    ]
      .filter(Boolean)
      .join(' ');

    if (stateZip) {
      parts.push(stateZip);
    }

    return parts.join(', ');
  }

  /* =====================================================
     PAYMENT
     ===================================================== */

  function paymentLine(order) {
    /*
     * Stripe orders created by the current
     * backend use paymentMethod: "Stripe".
     */
    if (
      String(
        order?.paymentMethod || ''
      ).toLowerCase() === 'stripe'
    ) {
      return 'Stripe';
    }

    if (
      order?.paymentMethod === 'card'
    ) {
      return `Card ending in ${
        order.cardLast4 || '••••'
      }`;
    }

    if (
      order?.paymentMethod ===
      'applepay'
    ) {
      return 'Apple Pay';
    }

    if (
      order?.paymentMethod ===
      'googlepay'
    ) {
      return 'Google Pay';
    }

    if (
      order?.paymentMethod ===
      'pickup'
    ) {
      return 'Pay at pickup';
    }

    return order?.paymentMethod || '—';
  }

  /* =====================================================
     STATUS
     ===================================================== */

  function getOrderStatus(order) {
    const paymentStatus =
      String(
        order?.paymentStatus || ''
      ).toLowerCase();

    const status =
      String(
        order?.status || ''
      ).toLowerCase();

    if (
      paymentStatus === 'paid'
    ) {
      if (status === 'processing') {
        return 'Processing';
      }

      if (status === 'shipped') {
        return 'Shipped';
      }

      if (status === 'delivered') {
        return 'Delivered';
      }

      if (status === 'cancelled') {
        return 'Cancelled';
      }

      return 'Paid';
    }

    if (
      paymentStatus === 'failed'
    ) {
      return 'Payment Failed';
    }

    if (
      paymentStatus === 'pending'
    ) {
      return 'Payment Pending';
    }

    if (status) {
      return (
        status.charAt(0).toUpperCase() +
        status.slice(1)
      );
    }

    return 'Order Placed';
  }

  /* =====================================================
     RENDER ORDER CARD
     ===================================================== */

  function renderOrderCard(order) {
    const itemsHtml =
      (order.items || [])
        .map((item) => {
          const product =
            getItemProduct(item);

          const image =
            getItemImage(item);

          const name =
            getItemName(item);

          const quantity =
            getItemQuantity(item);

          const price =
            getItemPrice(item);

          const productType =
            product?.type || '';

          const variant =
            VARIANT_BY_TYPE[
              productType
            ] || '';

          return `
            <div class="order-card__item">

              <div class="order-card__item-thumb">
                <img
                  src="${escapeHtml(image)}"
                  alt="${escapeHtml(name)}"
                  loading="lazy"
                >
              </div>

              <div class="order-card__item-info">

                <div class="order-card__item-name">
                  ${escapeHtml(name)}
                </div>

                <div class="order-card__item-meta">
                  ${
                    variant
                      ? escapeHtml(
                          variant
                        ) + ' · '
                      : ''
                  }
                  Qty ${quantity}
                </div>

              </div>

              <div class="order-card__item-price">
                ${money(
                  price * quantity
                )}
              </div>

            </div>
          `;
        })
        .join('');

    const status = getOrderStatus(order);
    const paymentStatus = String(order?.paymentStatus || '').toLowerCase();
    const isZelle = String(order?.paymentMethod || '').toLowerCase() === 'zelle';
    const paymentNotice = isZelle && paymentStatus !== 'paid'
      ? '<div class="order-card__payment-notice" role="status"><strong>Awaiting store verification</strong><p>Your Zelle payment is not confirmed yet. The store will update this order after verifying receipt. You can leave this page and return later.</p></div>'
      : (isZelle && paymentStatus === 'paid'
        ? '<div class="order-card__payment-notice order-card__payment-notice--paid" role="status"><strong>Payment verified</strong><p>The store has verified your Zelle payment. Your order status is shown above.</p></div>'
        : '');

    const orderNumber =
      order.orderNumber ||
      order._id ||
      '—';

    const placedAt =
      order.placedAt ||
      order.createdAt;

    const total =
      Number(order.total || 0);

    return `
      <article class="order-card">

        <div class="order-card__head">

          <div>

            <div class="order-card__id">
              Order #${escapeHtml(
                orderNumber
              )}
            </div>

            <div class="order-card__date">
              Placed ${escapeHtml(
                formatDate(
                  placedAt
                )
              )}
            </div>

          </div>

          <span class="order-card__status">
            ${escapeHtml(status)}
          </span>

        </div>

        ${paymentNotice}

        <div class="order-card__items">
          ${itemsHtml}
        </div>

        <div class="order-card__foot">

          <div class="order-card__total">

            <div class="order-card__total-label">
              Total
            </div>

            <div class="order-card__total-value">
              ${money(total)}
            </div>

          </div>

        </div>

      </article>
    `;
  }

  /* =====================================================
     RENDER ORDERS
     ===================================================== */

  function renderOrders(orders) {
    const emptyEl =
      $('#ordersEmpty');

    const sectionEl =
      $('#ordersSection');

    const listEl =
      $('#ordersList');

    if (
      !emptyEl ||
      !sectionEl ||
      !listEl
    ) {
      return;
    }

    if (
      !Array.isArray(orders) ||
      !orders.length
    ) {
      emptyEl.hidden = false;
      sectionEl.hidden = true;
      listEl.innerHTML = '';
      return;
    }

    emptyEl.hidden = true;
    sectionEl.hidden = false;

    listEl.innerHTML =
      orders
        .map(renderOrderCard)
        .join('');
  }

  /* =====================================================
     LOAD ORDERS
     ===================================================== */

  async function loadOrders() {
    try {
      const user =
        await getCurrentUser();

      let orders = [];

      if (user) {
        /*
         * Registered customer.
         */
        orders =
          await loadMyOrders();
      } else {
        /*
         * Guest customer.
         */
        orders =
          await loadGuestOrder();
      }

      renderOrders(orders);

    } catch (error) {
      console.error(
        'Unable to load orders:',
        error
      );

      /*
       * A missing guest order simply results
       * in the normal empty state.
       */
      renderOrders([]);
    }
  }

  /* =====================================================
     NAV FIX
     ===================================================== */

  function fixHomeLink() {
    $$('.main-nav__link, .mobile-menu a')
      .filter(
        (link) =>
          link.textContent.trim() ===
          'Home'
      )
      .forEach(
        (link) =>
          link.setAttribute(
            'href',
            'index.html'
          )
      );
  }

  /* =====================================================
     INIT
     ===================================================== */

  function safe(fn) {
    try {
      fn();
    } catch (error) {
      console.error(
        'order.js init failed at ' +
          fn.name +
          ':',
        error
      );
    }
  }

  document.addEventListener(
    'partials:loaded',
    () => {
      safe(fixHomeLink);

      // Load immediately and refresh status while the customer keeps this page open.
      loadOrders();
      if (!window.__bnbOrderRefreshTimer) {
        window.__bnbOrderRefreshTimer = window.setInterval(loadOrders, 15000);
      }
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) loadOrders();
      });
    }
  );

})();