/* =====================================================
   BUD N' BUDDER — checkout.js
   Backend-integrated checkout.

   Responsibilities:
   - Load the real backend cart
   - Render the checkout summary
   - Populate US states
   - Validate checkout fields
   - Submit customer/shipping data to the backend
   - Create a real Stripe PaymentIntent
   - Confirm payment with Stripe.js
   - Redirect to success.html after successful payment

   The backend remains the source of truth for:
   - Cart contents
   - Product prices
   - Stock
   - Tax
   - Shipping
   - Order total
   - Order creation
   - Stripe PaymentIntent creation
   ===================================================== */

(function () {
  'use strict';

  const $ = (selector, context) =>
    (context || document).querySelector(selector);

  const $$ = (selector, context) =>
    Array.from(
      (context || document).querySelectorAll(selector)
    );

  const API_BASE =
    window.BNB_API_BASE_URL ||
    'http://https://budnbudder-backend.onrender.com/api';

  const TAX_RATE_DISPLAY = 0.0875;

  const state = {
  cart: null,
  cartItems: [],
  subtotal: 0,
  tax: 0,
  shipping: 0,
  total: 0,
  loading: false,
  submitting: false
};

  /* =====================================================
     US STATES
     ===================================================== */

  const US_STATES = [
    { abbr: 'AL', name: 'Alabama' },
    { abbr: 'AK', name: 'Alaska' },
    { abbr: 'AZ', name: 'Arizona' },
    { abbr: 'AR', name: 'Arkansas' },
    { abbr: 'CA', name: 'California' },
    { abbr: 'CO', name: 'Colorado' },
    { abbr: 'CT', name: 'Connecticut' },
    { abbr: 'DE', name: 'Delaware' },
    { abbr: 'FL', name: 'Florida' },
    { abbr: 'GA', name: 'Georgia' },
    { abbr: 'HI', name: 'Hawaii' },
    { abbr: 'ID', name: 'Idaho' },
    { abbr: 'IL', name: 'Illinois' },
    { abbr: 'IN', name: 'Indiana' },
    { abbr: 'IA', name: 'Iowa' },
    { abbr: 'KS', name: 'Kansas' },
    { abbr: 'KY', name: 'Kentucky' },
    { abbr: 'LA', name: 'Louisiana' },
    { abbr: 'ME', name: 'Maine' },
    { abbr: 'MD', name: 'Maryland' },
    { abbr: 'MA', name: 'Massachusetts' },
    { abbr: 'MI', name: 'Michigan' },
    { abbr: 'MN', name: 'Minnesota' },
    { abbr: 'MS', name: 'Mississippi' },
    { abbr: 'MO', name: 'Missouri' },
    { abbr: 'MT', name: 'Montana' },
    { abbr: 'NE', name: 'Nebraska' },
    { abbr: 'NV', name: 'Nevada' },
    { abbr: 'NH', name: 'New Hampshire' },
    { abbr: 'NJ', name: 'New Jersey' },
    { abbr: 'NM', name: 'New Mexico' },
    { abbr: 'NY', name: 'New York' },
    { abbr: 'NC', name: 'North Carolina' },
    { abbr: 'ND', name: 'North Dakota' },
    { abbr: 'OH', name: 'Ohio' },
    { abbr: 'OK', name: 'Oklahoma' },
    { abbr: 'OR', name: 'Oregon' },
    { abbr: 'PA', name: 'Pennsylvania' },
    { abbr: 'RI', name: 'Rhode Island' },
    { abbr: 'SC', name: 'South Carolina' },
    { abbr: 'SD', name: 'South Dakota' },
    { abbr: 'TN', name: 'Tennessee' },
    { abbr: 'TX', name: 'Texas' },
    { abbr: 'UT', name: 'Utah' },
    { abbr: 'VT', name: 'Vermont' },
    { abbr: 'VA', name: 'Virginia' },
    { abbr: 'WA', name: 'Washington' },
    { abbr: 'WV', name: 'West Virginia' },
    { abbr: 'WI', name: 'Wisconsin' },
    { abbr: 'WY', name: 'Wyoming' }
  ];

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

  function normalizeCart(data) {
    if (!data) {
      return {
        items: []
      };
    }

    if (data.cart) {
      return data.cart;
    }

    return data;
  }

  function getCartItems(cart) {
    if (!cart || !Array.isArray(cart.items)) {
      return [];
    }

    return cart.items.filter(
      (item) =>
        item &&
        item.product &&
        Number(item.quantity) > 0
    );
  }

  function getProduct(item) {
    if (!item || !item.product) {
      return null;
    }

    return typeof item.product === 'object'
      ? item.product
      : null;
  }

  /* =====================================================
     API REQUEST
     ===================================================== */

  async function apiRequest(path, options) {
    const config = {
      credentials: 'include',
      ...(options || {})
    };

    config.headers = {
      Accept: 'application/json',
      ...(config.body
        ? { 'Content-Type': 'application/json' }
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
     POPULATE STATES
     ===================================================== */

  function populateStates() {
    const select = $('#state');

    if (!select) {
      return;
    }

    const currentValue = select.value;

    select.innerHTML = '';

    const placeholder =
      document.createElement('option');

    placeholder.value = '';
    placeholder.textContent = 'Select';
    placeholder.disabled = true;
    placeholder.selected = !currentValue;

    select.appendChild(placeholder);

    US_STATES.forEach((item) => {
      const option =
        document.createElement('option');

      option.value = item.abbr;
      option.textContent = item.name;

      select.appendChild(option);
    });

    if (currentValue) {
      select.value = currentValue;
    }
  }

  /* =====================================================
     AUTH / USER PREFILL
     ===================================================== */

  async function loadCurrentUser() {
    try {
      const data =
        await apiRequest('/auth/me');

      const user =
        data?.user || null;

      if (!user) {
        return null;
      }

      return user;
    } catch (error) {
      /*
       * A 401 here simply means the customer is not
       * authenticated. Guest checkout remains valid.
       */
      return null;
    }
  }

  async function autoFillUser() {
    const user =
      await loadCurrentUser();

    if (!user) {
      return;
    }

    const firstName =
      $('#firstName');

    const lastName =
      $('#lastName');

    const email =
      $('#email');

    const signedInNote =
      $('#signedInNote');

    const signedInName =
      $('#signedInName');

    const guestNote =
      $('#guestNote');

    const emailHint =
      $('#emailHint');

    if (firstName && !firstName.value) {
      firstName.value =
        user.firstName ||
        user.name?.split(' ')?.[0] ||
        '';
    }

    if (lastName && !lastName.value) {
      lastName.value =
        user.lastName ||
        '';
    }

    if (email) {
      email.value =
        user.email || '';

      /*
       * We don't need to make this read-only.
       * The backend still validates the submitted
       * customer information.
       */
      email.classList.add(
        'is-account-email'
      );
    }

    if (signedInNote) {
      signedInNote.hidden = false;
    }

    if (signedInName) {
      signedInName.textContent =
        user.name ||
        `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
        user.email ||
        'Customer';
    }

    if (guestNote) {
      guestNote.hidden = true;
    }

    if (emailHint) {
      emailHint.hidden = false;
    }
  }

  /* =====================================================
     PHONE FORMATTING
     ===================================================== */

  function initPhoneFormatting() {
    const input = $('#phone');

    if (!input) {
      return;
    }

    input.addEventListener(
      'input',
      function () {
        let digits =
          this.value.replace(/\D/g, '');

        if (digits.length > 10) {
          digits =
            digits.slice(0, 10);
        }

        let formatted = '';

        if (digits.length > 0) {
          formatted =
            '(' +
            digits.slice(0, 3);

          if (digits.length > 3) {
            formatted +=
              ') ' +
              digits.slice(3, 6);

            if (digits.length > 6) {
              formatted +=
                '-' +
                digits.slice(6, 10);
            }
          }
        }

        this.value = formatted;
      }
    );
  }

  /* =====================================================
     ZIP FORMATTING
     ===================================================== */

  function initZipFormatting() {
    const input = $('#zip');

    if (!input) {
      return;
    }

    input.addEventListener(
      'input',
      function () {
        let digits =
          this.value.replace(/\D/g, '');

        if (digits.length > 9) {
          digits =
            digits.slice(0, 9);
        }

        if (digits.length > 5) {
          this.value =
            digits.slice(0, 5) +
            '-' +
            digits.slice(5, 9);
        } else {
          this.value = digits;
        }
      }
    );
  }

  /* =====================================================
     NOTES COUNTER
     ===================================================== */

  function initNotesCounter() {
    const textarea = $('#notes');
    const counter = $('#notesCount');

    if (!textarea || !counter) {
      return;
    }

    const update = () => {
      counter.textContent =
        `${textarea.value.length}/200`;
    };

    textarea.addEventListener(
      'input',
      update
    );

    update();
  }

  /* =====================================================
     VALIDATION
     ===================================================== */

  const VALIDATORS = {
    firstName(value) {
      const valid =
        /^[A-Za-zÀ-ÖØ-öø-ÿ\s\-']{2,40}$/
          .test(value.trim());

      return {
        valid,
        message:
          'Please enter a valid first name.'
      };
    },

    lastName(value) {
      const valid =
        /^[A-Za-zÀ-ÖØ-öø-ÿ\s\-']{2,40}$/
          .test(value.trim());

      return {
        valid,
        message:
          'Please enter a valid last name.'
      };
    },

    email(value) {
      const trimmed =
        value.trim();

      const valid =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          .test(trimmed) &&
        trimmed.length <= 120;

      return {
        valid,
        message:
          'Please enter a valid email address.'
      };
    },

    phone(value) {
      const digits =
        value.replace(/\D/g, '');

      const valid =
        digits.length === 10;

      return {
        valid,
        message:
          'Please enter a valid 10-digit phone number.'
      };
    },

    address1(value) {
      const trimmed =
        value.trim();

      const valid =
        /^[A-Za-z0-9\s\-#.,'\/]{3,80}$/
          .test(trimmed);

      return {
        valid,
        message:
          'Please enter a valid street address.'
      };
    },

    city(value) {
      const valid =
        /^[A-Za-zÀ-ÖØ-öø-ÿ\s\-']{2,50}$/
          .test(value.trim());

      return {
        valid,
        message:
          'Please enter a valid city.'
      };
    },

    state(value) {
      const valid =
        US_STATES.some(
          (item) =>
            item.abbr === value
        );

      return {
        valid,
        message:
          'Please select a state.'
      };
    },

    zip(value) {
      const cleaned =
        value.replace(/\s/g, '');

      const valid =
        /^[0-9]{5}(?:-[0-9]{4})?$/
          .test(cleaned);

      return {
        valid,
        message:
          'Please enter a valid ZIP code.'
      };
    }
  };

  function setFieldError(
    input,
    message
  ) {
    if (!input) {
      return;
    }

    const field =
      input.closest('.form-field');

    if (!field) {
      return;
    }

    const error =
      field.querySelector(
        '.form-error'
      );

    field.classList.add(
      'has-error'
    );

    if (error) {
      error.textContent =
        message || '';
    }
  }

  function clearFieldError(input) {
    if (!input) {
      return;
    }

    const field =
      input.closest('.form-field');

    if (!field) {
      return;
    }

    const error =
      field.querySelector(
        '.form-error'
      );

    field.classList.remove(
      'has-error'
    );

    if (error) {
      error.textContent = '';
    }
  }

  function validateField(input) {
    if (!input) {
      return true;
    }

    const validator =
      VALIDATORS[input.id];

    if (!validator) {
      return true;
    }

    const result =
      validator(input.value);

    if (!result.valid) {
      setFieldError(
        input,
        result.message
      );

      return false;
    }

    clearFieldError(input);

    return true;
  }

  function validateForm() {
    let valid = true;

    const ids = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'address1',
      'city',
      'state',
      'zip'
    ];

    ids.forEach((id) => {
      const input = $('#' + id);

      if (
        input &&
        !validateField(input)
      ) {
        valid = false;
      }
    });

    return valid;
  }

  function initValidation() {
    const ids = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'address1',
      'city',
      'state',
      'zip'
    ];

    ids.forEach((id) => {
      const input = $('#' + id);

      if (!input) {
        return;
      }

      input.addEventListener(
        'blur',
        () => validateField(input)
      );

      input.addEventListener(
        'input',
        () => {
          if (
            input.closest(
              '.form-field'
            )?.classList.contains(
              'has-error'
            )
          ) {
            validateField(input);
          }
        }
      );

      if (
        input.tagName === 'SELECT'
      ) {
        input.addEventListener(
          'change',
          () => validateField(input)
        );
      }
    });
  }

  /* =====================================================
     BANNER
     ===================================================== */

  function showBanner(message) {
    const banner =
      $('#formErrorBanner');

    const text =
      $('#formErrorBannerText');

    if (text) {
      text.textContent =
        message;
    }

    if (banner) {
      banner.hidden = false;
    }
  }

  function hideBanner() {
    const banner =
      $('#formErrorBanner');

    if (banner) {
      banner.hidden = true;
    }
  }

  /* =====================================================
     EMPTY CART
     ===================================================== */

  function showEmptyCart() {
    const empty =
      $('#checkoutEmpty');

    const content =
      $('#checkoutContent');

    if (empty) {
      empty.hidden = false;
    }

    if (content) {
      content.hidden = true;
    }
  }

  function showCheckoutContent() {
    const empty =
      $('#checkoutEmpty');

    const content =
      $('#checkoutContent');

    if (empty) {
      empty.hidden = true;
    }

    if (content) {
      content.hidden = false;
    }
  }

  /* =====================================================
     CART
     ===================================================== */

  async function loadCart() {
    state.loading = true;

    try {
      let data;

      /*
       * Prefer the shared BNB API helper from header.js.
       */
      if (
        window.BNB &&
        typeof window.BNB.apiRequest ===
          'function'
      ) {
        data =
          await window.BNB.apiRequest(
            '/cart'
          );
      } else {
        data =
          await apiRequest(
            '/cart'
          );
      }

      state.cart =
        normalizeCart(data);

      state.cartItems =
        getCartItems(state.cart);

      if (!state.cartItems.length) {
        showEmptyCart();
        return;
      }

      showCheckoutContent();

      calculateDisplayTotals();
      renderOrderSummary();

    } catch (error) {
      console.error(
        'Checkout cart load failed:',
        error
      );

      showEmptyCart();

      showBanner(
        error.message ||
        'Unable to load your cart.'
      );

    } finally {
      state.loading = false;
    }
  }

  /* =====================================================
     DISPLAY TOTALS
     ===================================================== */

  async function loadPaymentMethodAvailability() {
    try {
      const response = await fetch(API_BASE + '/payment-config');
      const data = await response.json();
      const venmo = document.querySelector('input[name="paymentMethod"][value="Venmo"]');
      const zelle = document.querySelector('input[name="paymentMethod"][value="Zelle"]');
      if (venmo && !data.venmoEnabled) { venmo.disabled = true; venmo.closest('label')?.setAttribute('title', 'Venmo is temporarily unavailable.'); }
      if (zelle && !data.zelleEnabled) { zelle.disabled = true; zelle.closest('label')?.setAttribute('title', 'Zelle is temporarily unavailable.'); }
    } catch (error) { console.warn('Unable to load payment method availability:', error); }
  }

  function getSelectedPaymentMethod() {
    return document.querySelector('input[name="paymentMethod"]:checked')?.value || 'Stripe';
  }

  function calculateDisplayTotals() {
    let subtotal = 0;

    state.cartItems.forEach(
      (item) => {
        const product =
          getProduct(item);

        if (!product) {
          return;
        }

        const price =
          Number(product.price || 0);

        const quantity =
          Number(item.quantity || 0);

        subtotal +=
          price * quantity;
      }
    );

    subtotal =
      Math.round(
        subtotal * 100
      ) / 100;

    const tax =
      Math.round(
        subtotal *
        TAX_RATE_DISPLAY *
        100
      ) / 100;

    const shipping = subtotal >= 250 ? 0 : 19.95;

    const total =
      Math.round(
        (subtotal +
          tax +
          shipping) *
          100
      ) / 100;

    state.subtotal = subtotal;
    state.tax = tax;
    state.shipping = shipping;
    state.total = total;
  }

  /* =====================================================
     ORDER SUMMARY
     ===================================================== */

  function renderOrderSummary() {
    const itemsEl =
      $('#summaryItems');

    const countEl =
      $('#summaryCount');

    const subtotalEl =
      $('#summarySubtotal');

    const totalEl =
      $('#summaryTotal');

    if (!itemsEl) {
      return;
    }

    let itemCount = 0;

    itemsEl.innerHTML =
      state.cartItems
        .map((item) => {
          const product =
            getProduct(item);

          if (!product) {
            return '';
          }

          const quantity =
            Number(item.quantity || 0);

          const price =
            Number(product.price || 0);

          const lineTotal =
            price * quantity;

          itemCount +=
            quantity;

          const image =
            product.image || '';

          const imageMarkup =
            image
              ? `<img src="${escapeHtml(
                  image
                )}" alt="${escapeHtml(
                  product.name || ''
                )}" loading="lazy">`
              : `<div class="media-frame__placeholder" aria-hidden="true"></div>`;

          return `
            <div class="checkout-summary-item">
              <div class="checkout-summary-item__thumb">
                ${imageMarkup}
                <span class="checkout-summary-item__qty">
                  ${quantity}
                </span>
              </div>

              <div class="checkout-summary-item__info">
                <span class="checkout-summary-item__name">
                  ${escapeHtml(
                    product.name ||
                    'Product'
                  )}
                </span>
              </div>

              <span class="checkout-summary-item__price">
                ${money(lineTotal)}
              </span>
            </div>
          `;
        })
        .join('');

    if (countEl) {
      countEl.textContent =
        itemCount;
    }

    if (subtotalEl) {
      subtotalEl.textContent =
        money(state.subtotal);
    }

    const shippingEl = $('#summaryShipping');
    const taxEl = $('#summaryTax');
    if (shippingEl) shippingEl.textContent = money(state.shipping);
    if (taxEl) taxEl.textContent = money(state.tax);
    if (totalEl) {
      totalEl.textContent =
        money(state.total);
    }
  }

  /* =====================================================
     FORM DATA
     ===================================================== */

  function getFormData() {
    return {
      customer: {
        firstName:
          $('#firstName')?.value
            .trim() || '',

        lastName:
          $('#lastName')?.value
            .trim() || '',

        email:
          $('#email')?.value
            .trim()
            .toLowerCase() || '',

        phone:
          $('#phone')?.value
            .trim() || ''
      },

      shippingAddress: {
        address1:
          $('#address1')?.value
            .trim() || '',

        address2:
          $('#address2')?.value
            .trim() || '',

        city:
          $('#city')?.value
            .trim() || '',

        state:
          $('#state')?.value || '',

        zip:
          $('#zip')?.value
            .trim() || '',

        country:
          $('#country')?.value ||
          'US'
      },

      notes:
        $('#notes')?.value
          .trim() || '',

      paymentMethod: getSelectedPaymentMethod()
    };
  }

  /* =====================================================
     PROCESSING UI
     ===================================================== */

  function showProcessing() {
    const overlay =
      $('#checkoutProcessing');

    if (overlay) {
      overlay.classList.add(
        'is-active'
      );
    }
  }

  function hideProcessing() {
    const overlay =
      $('#checkoutProcessing');

    if (overlay) {
      overlay.classList.remove(
        'is-active'
      );
    }
  }

  function setSubmitLoading(
    loading
  ) {
    const button =
      $('#proceedPaymentBtn');

    if (!button) {
      return;
    }

    const label =
      button.querySelector(
        '.btn-label'
      );

    if (loading) {
      button.disabled = true;

      button.classList.add(
        'is-loading'
      );

      if (label) {
        label.textContent =
          'Preparing Payment...';
      }

      return;
    }

    button.disabled = false;

    button.classList.remove(
      'is-loading'
    );

    if (label) {
      label.textContent =
        'Proceed to Payment';
    }
  }

  /* =====================================================
     CREATE PAYMENT INTENT
     ===================================================== */

  async function createPaymentSession(formData) {
    const method = formData.paymentMethod;
    let endpoint = '/create-payment-intent';
    if (method === 'Venmo') endpoint = '/create-venmo-order';
    if (method === 'Zelle') endpoint = '/create-zelle-order';

    return apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        customer: formData.customer,
        shippingAddress: formData.shippingAddress,
        notes: formData.notes
      })
    });
  }

  /* =====================================================
     CHECKOUT SUBMISSION
     ===================================================== */

  async function handleCheckoutSubmit(event) {
  if (event) {
    event.preventDefault();
  }

  if (state.submitting) {
    return;
  }

  hideBanner();

  /*
   * ------------------------------------------
   * STEP 1: Validate checkout fields
   * ------------------------------------------
   */

  if (!validateForm()) {
    showBanner(
      'Please fix the highlighted fields before continuing.'
    );

    const firstError =
      document.querySelector(
        '.form-field.has-error'
      );

    if (firstError) {
      firstError.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      const input =
        firstError.querySelector(
          'input, select, textarea'
        );

      if (input) {
        input.focus();
      }
    }

    return;
  }

  /*
   * ------------------------------------------
   * STEP 2: Refresh cart
   * ------------------------------------------
   */

  try {
    const cartData =
      await apiRequest('/cart');

    state.cart =
      normalizeCart(cartData);

    state.cartItems =
      getCartItems(state.cart);

    if (!state.cartItems.length) {
      showEmptyCart();

      showBanner(
        'Your cart is empty. Please add items before checking out.'
      );

      return;
    }

    calculateDisplayTotals();
    renderOrderSummary();

  } catch (error) {
    console.error(
      'Unable to refresh cart:',
      error
    );

    showBanner(
      error.message ||
      'Unable to verify your cart. Please try again.'
    );

    return;
  }

  /*
   * ------------------------------------------
   * STEP 4: Create PaymentIntent
   * ------------------------------------------
   */

  const formData =
    getFormData();

  state.submitting = true;

  showProcessing();
  setSubmitLoading(true);

  try {
    const payment =
      await createPaymentSession(
        formData
      );

    if (!payment || !payment.orderId || !payment.orderNumber) {
      throw new Error('The payment session could not be created.');
    }

    /*
     * Save order information
     */

    try {
      if (payment.orderNumber) {
        sessionStorage.setItem('bnb_last_order_number', payment.orderNumber);
        localStorage.setItem('bnb_last_order_number', payment.orderNumber);
      }

      if (payment.orderId) {
        sessionStorage.setItem('bnb_last_order_id', String(payment.orderId));
        // Keep a persistent guest order reference so closing the tab does not lose the order.
        localStorage.setItem('bnb_last_order_id', String(payment.orderId));
      }

      sessionStorage.setItem('bnb_checkout_amount', String(payment.amount));
      sessionStorage.setItem('bnb_payment_method', formData.paymentMethod);
      localStorage.setItem('bnb_payment_method', formData.paymentMethod);
      if (payment.clientSecret) sessionStorage.setItem('bnb_checkout_client_secret', payment.clientSecret);
      if (payment.paypalOrderId) sessionStorage.setItem('bnb_paypal_order_id', payment.paypalOrderId);
      if (payment.paypalClientId) sessionStorage.setItem('bnb_paypal_client_id', payment.paypalClientId);
      if (payment.paypalEnvironment) sessionStorage.setItem('bnb_paypal_environment', payment.paypalEnvironment);
      if (payment.transactionId) sessionStorage.setItem('bnb_payment_transaction_id', String(payment.transactionId));
      if (payment.recipient) sessionStorage.setItem('bnb_zelle_recipient', payment.recipient);
      if (payment.instructions) sessionStorage.setItem('bnb_zelle_instructions', payment.instructions);

      sessionStorage.setItem(
        'bnb_checkout_summary',
        JSON.stringify({
          items: state.cartItems.map((item) => {
            const product = getProduct(item);

            return {
              name: product?.name || 'Product',
              image: product?.image || '',
              price: Number(product?.price || 0),
              quantity: Number(item.quantity || 0)
            };
          }),
          subtotal: state.subtotal,
          tax: state.tax,
          shipping: state.shipping,
          total: state.total
        })
      );
    } catch (_) {}

    /*
     * Payment details are entered on payment.html.
     */

    window.location.href = 'payment.html';

  } catch (error) {
    console.error(
      'Checkout initialization error:',
      error
    );

    hideProcessing();
    setSubmitLoading(false);

    state.submitting = false;

    showBanner(
      error.message ||
      'Something went wrong while preparing your payment.'
    );

    return;
  }
}

  /* =====================================================
     HOME LINK
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
        'checkout.js init failed at ' +
          fn.name +
          ':',
        error
      );
    }
  }

  function initSubmitButton() {
    const form =
      $('#checkoutForm');

    const button =
      $('#proceedPaymentBtn');

    if (!form || !button) {
      return;
    }

    /*
     * Listen to the form itself so pressing Enter
     * inside an input also works.
     */
    form.addEventListener(
      'submit',
      handleCheckoutSubmit
    );

    /*
     * The existing HTML uses a type="button"
     * payment button, so retain explicit click
     * handling as well.
     */
    button.addEventListener(
      'click',
      handleCheckoutSubmit
    );
  }

  async function initialize() {
    safe(fixHomeLink);
    safe(populateStates);
    safe(initPhoneFormatting);
    safe(initZipFormatting);
    safe(initNotesCounter);
    safe(initValidation);
    safe(initSubmitButton);
    safe(loadPaymentMethodAvailability);

    /*
     * User information is optional.
     * Failure here must never block guest checkout.
     */
    try {
      await autoFillUser();
    } catch (error) {
      console.warn(
        'Unable to prefill customer information:',
        error
      );
    }

    /*
     * Load the actual backend cart.
     */
    await loadCart();
  }

  document.addEventListener(
    'partials:loaded',
    () => {
      initialize();
    },
    { once: true }
  );
})();