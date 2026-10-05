/* =====================================================
   BUD N' BUDDER — shop.js
   Backend-integrated Shop page

   Backend:
     GET /api/products
     GET /api/categories

   Cart:
     window.BNB.addToCart(productId)

   Product model:
     _id
     name
     category
     status
     price
     stock
     image
     tagType
     tagLabel
     createdAt
   ===================================================== */

(function () {
  'use strict';

  /* =====================================================
     CONFIG
     ===================================================== */

  const API_BASE =
    window.BNB_API_BASE_URL ||
    'http://https://budnbudder-backend.onrender.com/api';

  const $ = (selector, context) =>
    (context || document).querySelector(selector);

  const $$ = (selector, context) =>
    Array.from(
      (context || document).querySelectorAll(selector)
    );

  const money = (value) => {
    const amount = Number(value);

    return Number.isFinite(amount)
      ? '$' + amount.toFixed(2)
      : '$0.00';
  };

  /* =====================================================
     STATE
     ===================================================== */

  const state = {
    products: [],
    categories: [],

    search: '',
    cats: new Set(),

    priceMin: null,
    priceMax: null,

    sort: 'default',

    page: 1,
    perPage: 9,

    totalProducts: 0,
    totalPages: 1,

    loading: false,

    /*
     * Used only by special client-side sorts.
     */
    specialSortProducts: null,

    /*
     * Prevent older API responses from overwriting
     * newer filter/search requests.
     */
    requestId: 0
  };

  let priceBounds = {
    min: 0,
    max: 100
  };

  let priceBoundsLoaded = false;

  /* =====================================================
     SORT OPTIONS
     ===================================================== */

  const SORT_LABELS = {
    default: 'Sort by: Default',
    'price-asc': 'Price: Low to High',
    'price-desc': 'Price: High to Low',
    bestsellers: 'Best Sellers',
    newest: 'Newest',
    hot: 'Hot'
  };

  /* =====================================================
     API HELPER
     ===================================================== */

  async function apiRequest(path, options) {
    /*
     * Use the shared header.js API helper whenever it
     * exists. This keeps authentication, credentials,
     * error handling and API configuration centralized.
     */
    if (
      window.BNB &&
      typeof window.BNB.apiRequest === 'function'
    ) {
      return window.BNB.apiRequest(
        path,
        options || {}
      );
    }

    /*
     * Fallback in case shop.js is loaded without header.js.
     */
    const opts = options || {};

    let response;

    try {
      response = await fetch(
        API_BASE + path,
        {
          ...opts,
          credentials: 'include',
          headers: {
            ...(opts.body
              ? {
                  'Content-Type':
                    'application/json'
                }
              : {}),
            ...(opts.headers || {})
          }
        }
      );
    } catch (error) {
      console.error(
        'BNB API connection error:',
        error
      );

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
        data &&
        data.message
          ? data.message
          : `Request failed with status ${response.status}`;

      const error =
        new Error(message);

      error.status =
        response.status;

      error.data =
        data;

      throw error;
    }

    return data;
  }

  /* =====================================================
     IMAGE URL
     ===================================================== */

  function resolveImageUrl(image) {
  if (!image) {
    return 'assets/images/products/placeholder.png';
  }

  const value = String(image).trim();

  if (!value) {
    return 'assets/images/products/placeholder.png';
  }

  // Cloudinary or any other external image URL
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:') ||
    value.startsWith('blob:')
  ) {
    return value;
  }

  // Protocol-relative external URL
  if (value.startsWith('//')) {
    return window.location.protocol + value;
  }

  // Local frontend image path
  // Example:
  // assets/images/products/luxe-body-wave-wig.jpg
  if (
    value.startsWith('assets/') ||
    value.startsWith('./assets/') ||
    value.startsWith('../assets/') ||
    value.startsWith('/assets/')
  ) {
    return value;
  }

  // Backend upload path, if you ever use one
  if (
    value.startsWith('/uploads/') ||
    value.startsWith('uploads/')
  ) {
    try {
      return new URL(
        value.startsWith('/') ? value : `/${value}`,
        getBackendOrigin()
      ).href;
    } catch (_) {
      return value;
    }
  }

  // If MongoDB ever contains only a filename,
  // fall back to the frontend product images folder.
  return `assets/images/products/${value}`;
}

  /* =====================================================
     ESCAPE HTML
     ===================================================== */

  function escapeHtml(value) {
    return String(
      value == null
        ? ''
        : value
    )
      .replace(
        /&/g,
        '&amp;'
      )
      .replace(
        /</g,
        '&lt;'
      )
      .replace(
        />/g,
        '&gt;'
      )
      .replace(
        /"/g,
        '&quot;'
      )
      .replace(
        /'/g,
        '&#039;'
      );
  }

  /* =====================================================
     PRODUCT ADAPTER
     ===================================================== */

  function adaptProduct(product) {
    const category =
      product &&
      product.category
        ? product.category
        : null;

    let categoryName = '';
    let categorySlug = '';

    if (
      typeof category ===
      'string'
    ) {
      categoryName =
        category;

      categorySlug =
        category;
    } else if (category) {
      categoryName =
        category.name ||
        category.slug ||
        '';

      categorySlug =
        category.slug ||
        category.name ||
        '';
    }

    categoryName =
      String(
        categoryName || ''
      );

    categorySlug =
      String(
        categorySlug || ''
      ).toLowerCase();

    const tagType =
      product &&
      product.tagType
        ? String(
            product.tagType
          )
        : '';

    let badge = '';

    switch (tagType) {
      case 'best-seller':
        badge =
          'bestseller';
        break;

      case 'new':
        badge = 'new';
        break;

      case 'hot':
        badge = 'hot';
        break;

      default:
        badge =
          tagType;
        break;
    }

    return {
      id:
        product &&
        product._id
          ? String(
              product._id
            )
          : '',

      name:
        product &&
        product.name
          ? String(
              product.name
            )
          : '',

      cat:
        categoryName,

      type:
        categorySlug,

      price:
        Number(
          product &&
          product.price != null
            ? product.price
            : 0
        ),

      stock:
        Number(
          product &&
          product.stock != null
            ? product.stock
            : 0
        ),

      status:
        product &&
        product.status
          ? String(
              product.status
            )
          : 'active',

      image:
        resolveImageUrl(
          product &&
          product.image
            ? product.image
            : ''
        ),

      badge,

      tagType,

      tagLabel:
        product &&
        product.tagLabel
          ? String(
              product.tagLabel
            )
          : '',

      createdAt:
        product &&
        product.createdAt
          ? product.createdAt
          : null
    };
  }

  /* =====================================================
     CATEGORY ICONS
     ===================================================== */

  const CATEGORY_ICONS = {
    flower:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2.5C12 2.5 6 6 6 12.5C6 15 7.2 17 9 18.4V22H15V18.4C16.8 17 18 15 18 12.5C18 6 12 2.5 12 2.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',

    prerolls:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 15L15 3L21 9L9 21L3 15Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M13 5L19 11" stroke="currentColor" stroke-width="1.4"/></svg>',

    edibles:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="7" width="17" height="13" rx="2.5" stroke="currentColor" stroke-width="1.5"/><path d="M3.5 11H20.5" stroke="currentColor" stroke-width="1.4"/><path d="M12 7V4.5C12 3.4 12.9 2.5 14 2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',

    concentrates:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3C12 3 6.5 9.5 6.5 14.5C6.5 17.8 8.9 20.5 12 20.5C15.1 20.5 17.5 17.8 17.5 14.5C17.5 9.5 12 3 12 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',

    vapes:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="7" y="3" width="6" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="5.5" y="10" width="9" height="10.5" rx="2.5" stroke="currentColor" stroke-width="1.4"/></svg>',

    accessories:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.4"/></svg>',

    _default:
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 12L12 3H19.5C20.3 3 21 3.7 21 4.5V12L12 21L3 12Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/></svg>'
  };

  /* =====================================================
     RESPONSIVE ITEMS PER PAGE
     ===================================================== */

  function itemsPerPage() {
    const width =
      window.innerWidth;

    if (width > 1080) {
      return 9;
    }

    if (width > 700) {
      return 6;
    }

    return 4;
  }

  /* =====================================================
     URL STATE
     ===================================================== */

  function readUrlState() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const category =
      params.get('cat');

    const search =
      params.get('q');

    const sort =
      params.get('sort');

    const page =
      parseInt(
        params.get('page') ||
          '1',
        10
      );

    state.cats.clear();

    if (category) {
      state.cats.add(
        category
          .trim()
          .toLowerCase()
      );
    }

    state.search =
      search
        ? search
            .trim()
            .toLowerCase()
        : '';

    state.sort =
      sort &&
      SORT_LABELS[sort]
        ? sort
        : 'default';

    state.page =
      Number.isFinite(page) &&
      page > 0
        ? page
        : 1;
  }

  function updateUrl() {
    const url =
      new URL(
        window.location.href
      );

    url.search = '';

    if (
      state.cats.size === 1
    ) {
      const cat =
        Array.from(
          state.cats
        )[0];

      if (cat) {
        url.searchParams.set(
          'cat',
          cat
        );
      }
    }

    if (state.search) {
      url.searchParams.set(
        'q',
        state.search
      );
    }

    if (
      state.sort &&
      state.sort !== 'default'
    ) {
      url.searchParams.set(
        'sort',
        state.sort
      );
    }

    if (
      state.page > 1
    ) {
      url.searchParams.set(
        'page',
        String(
          state.page
        )
      );
    }

    window.history.replaceState(
      {},
      '',
      url.pathname +
        url.search +
        url.hash
    );
  }

  /* =====================================================
     SORT HELPERS
     ===================================================== */

  function backendSortValue(
    value
  ) {
    switch (value) {
      case 'price-asc':
        return 'price-low';

      case 'price-desc':
        return 'price-high';

      case 'newest':
        return 'newest';

      /*
       * Default remains newest because the backend needs
       * a deterministic ordering.
       */
      case 'default':
      default:
        return 'newest';
    }
  }

  function isSpecialSort() {
    return (
      state.sort ===
        'bestsellers' ||
      state.sort === 'hot'
    );
  }

  /* =====================================================
     CATEGORY HELPERS
     ===================================================== */

  function getSelectedCategoryId() {
    if (
      state.cats.size !== 1
    ) {
      return '';
    }

    const slug =
      Array.from(
        state.cats
      )[0];

    if (!slug) {
      return '';
    }

    const category =
      state.categories.find(
        (item) => {
          const itemSlug =
            String(
              item.slug ||
                ''
            )
              .trim()
              .toLowerCase();

          return (
            itemSlug ===
            String(
              slug
            )
              .trim()
              .toLowerCase()
          );
        }
      );

    if (!category) {
      return '';
    }

    return category._id
      ? String(
          category._id
        )
      : '';
  }

  /* =====================================================
     LOAD CATEGORIES
     ===================================================== */

  async function loadCategories() {
    const data =
      await apiRequest(
        '/categories'
      );

    state.categories =
      Array.isArray(
        data &&
          data.categories
      )
        ? data.categories
        : [];

    /*
     * If URL contained a category that no longer exists,
     * don't silently show all products while pretending
     * that category is active.
     */
    if (
      state.cats.size
    ) {
      const valid =
        getSelectedCategoryId();

      if (!valid) {
        state.cats.clear();
        state.page = 1;
        updateUrl();
      }
    }

    buildCategoryList();
  }

  /* =====================================================
     LOAD PRODUCTS
     ===================================================== */

  async function loadProducts() {
    const currentRequest =
      ++state.requestId;

    state.loading = true;

    renderLoading();

    try {
      if (
        isSpecialSort()
      ) {
        await loadSpecialSortProducts(
          currentRequest
        );
      } else {
        await loadNormalProducts(
          currentRequest
        );
      }
    } catch (error) {
      /*
       * Ignore errors from requests that are no longer
       * the latest request.
       */
      if (
        currentRequest !==
        state.requestId
      ) {
        return;
      }

      console.error(
        'Shop product loading failed:',
        error
      );

      renderError(
        error &&
        error.message
          ? error.message
          : 'Unable to load products right now.'
      );
    } finally {
      if (
        currentRequest ===
        state.requestId
      ) {
        state.loading = false;
      }
    }
  }

  /* =====================================================
     BUILD NORMAL PRODUCT QUERY
     ===================================================== */

  function buildProductParams(
    options
  ) {
    const config =
      options || {};

    const params =
      new URLSearchParams();

    if (state.search) {
      params.set(
        'search',
        state.search
      );
    }

    const categoryId =
      getSelectedCategoryId();

    if (categoryId) {
      params.set(
        'category',
        categoryId
      );
    }

    /*
     * Only send price filters when they are actually
     * different from the detected bounds.
     */
    if (
      state.priceMin !== null &&
      priceBoundsLoaded &&
      state.priceMin !==
        priceBounds.min
    ) {
      params.set(
        'minPrice',
        String(
          state.priceMin
        )
      );
    }

    if (
      state.priceMax !== null &&
      priceBoundsLoaded &&
      state.priceMax !==
        priceBounds.max
    ) {
      params.set(
        'maxPrice',
        String(
          state.priceMax
        )
      );
    }

    params.set(
      'status',
      'active'
    );

    params.set(
      'sort',
      config.sort ||
        backendSortValue(
          state.sort
        )
    );

    params.set(
      'page',
      String(
        config.page ||
          state.page
      )
    );

    params.set(
      'limit',
      String(
        config.limit ||
          state.perPage
      )
    );

    return params;
  }

  /* =====================================================
     NORMAL PRODUCTS
     ===================================================== */

  async function loadNormalProducts(
    requestId
  ) {
    const params =
      buildProductParams();

    const data =
      await apiRequest(
        '/products?' +
          params.toString()
      );

    if (
      requestId !==
      state.requestId
    ) {
      return;
    }

    const rawProducts =
      Array.isArray(
        data &&
          data.products
      )
        ? data.products
        : [];

    state.products =
      rawProducts
        .map(
          adaptProduct
        )
        .filter(
          (product) =>
            Boolean(
              product.id
            )
        );

    const pagination =
      data &&
      data.pagination
        ? data.pagination
        : {};

    state.totalProducts =
      Number(
        pagination.totalProducts
      ) || 0;

    state.totalPages =
      Math.max(
        1,
        Number(
          pagination.totalPages
        ) || 1
      );

    /*
     * Backend can tell us the current page if available.
     */
    const backendPage =
      Number(
        pagination.page
      );

    if (
      Number.isFinite(
        backendPage
      ) &&
      backendPage > 0
    ) {
      state.page =
        backendPage;
    }

    /*
     * If the URL requested a page beyond the available
     * range, move to the last real page and request it once.
     */
    if (
      state.page >
      state.totalPages
    ) {
      state.page =
        state.totalPages;

      updateUrl();

      return loadNormalProducts(
        requestId
      );
    }

    state.specialSortProducts =
      null;

    renderCurrentPage();
  }

  /* =====================================================
     SPECIAL SORT PRODUCTS
     
     Current backend Product model exposes tagType but the
     backend does not expose a dedicated best-seller/hot
     sort in the supplied API.

     Therefore:
       bestsellers -> tagType === best-seller
       hot         -> tagType === hot

     This remains limited by the backend's maximum product
     request size.
     ===================================================== */

  async function loadSpecialSortProducts(
    requestId
  ) {
    const params =
      buildProductParams({
        page: 1,
        limit: 100,
        sort: 'newest'
      });

    const data =
      await apiRequest(
        '/products?' +
          params.toString()
      );

    if (
      requestId !==
      state.requestId
    ) {
      return;
    }

    let products =
      Array.isArray(
        data &&
          data.products
      )
        ? data.products
            .map(
              adaptProduct
            )
            .filter(
              (product) =>
                Boolean(
                  product.id
                )
            )
        : [];

    if (
      state.sort ===
      'bestsellers'
    ) {
      products.sort(
        (a, b) => {
          const aBest =
            a.tagType ===
            'best-seller'
              ? 1
              : 0;

          const bBest =
            b.tagType ===
            'best-seller'
              ? 1
              : 0;

          if (
            aBest !==
            bBest
          ) {
            return (
              bBest -
              aBest
            );
          }

          return compareNewest(
            a,
            b
          );
        }
      );
    }

    if (
      state.sort ===
      'hot'
    ) {
      products.sort(
        (a, b) => {
          const aHot =
            a.tagType ===
            'hot'
              ? 1
              : 0;

          const bHot =
            b.tagType ===
            'hot'
              ? 1
              : 0;

          if (
            aHot !==
            bHot
          ) {
            return (
              bHot -
              aHot
            );
          }

          return compareNewest(
            a,
            b
          );
        }
      );
    }

    state.specialSortProducts =
      products;

    state.totalProducts =
      products.length;

    state.totalPages =
      Math.max(
        1,
        Math.ceil(
          products.length /
            state.perPage
        )
      );

    if (
      state.page >
      state.totalPages
    ) {
      state.page =
        state.totalPages;

      updateUrl();
    }

    renderCurrentPage();
  }

  function compareNewest(
    a,
    b
  ) {
    const aTime =
      a.createdAt
        ? new Date(
            a.createdAt
          ).getTime()
        : 0;

    const bTime =
      b.createdAt
        ? new Date(
            b.createdAt
          ).getTime()
        : 0;

    return (
      bTime -
      aTime
    );
  }

  /* =====================================================
     PRICE BOUNDS
     ===================================================== */

  async function loadPriceBounds() {
    try {
      /*
       * Request active products only.
       *
       * The backend currently caps product requests, so
       * this is the best available source until a dedicated
       * /products/price-range endpoint exists.
       */
      const data =
        await apiRequest(
          '/products?status=active&page=1&limit=100'
        );

      const products =
        Array.isArray(
          data &&
            data.products
        )
          ? data.products
          : [];

      const prices =
        products
          .map(
            (product) =>
              Number(
                product.price
              )
          )
          .filter(
            (price) =>
              Number.isFinite(
                price
              )
          );

      if (
        prices.length
      ) {
        priceBounds = {
          min: Math.floor(
            Math.min(
              ...prices
            )
          ),
          max: Math.ceil(
            Math.max(
              ...prices
            )
          )
        };

        if (
          priceBounds.min ===
          priceBounds.max
        ) {
          priceBounds.max =
            priceBounds.min +
            1;
        }

        priceBoundsLoaded =
          true;
      } else {
        /*
         * No products means there is no meaningful range.
         * Keep the controls usable without pretending this
         * is the real catalogue range.
         */
        priceBounds = {
          min: 0,
          max: 100
        };

        priceBoundsLoaded =
          false;
      }
    } catch (error) {
      console.error(
        'Unable to determine price bounds:',
        error
      );

      /*
       * Do not let a failed price-range request prevent
       * the actual shop from loading.
       */
      priceBounds = {
        min: 0,
        max: 100
      };

      priceBoundsLoaded =
        false;
    }

    if (
      state.priceMin === null
    ) {
      state.priceMin =
        priceBounds.min;
    }

    if (
      state.priceMax === null
    ) {
      state.priceMax =
        priceBounds.max;
    }

    configurePriceSlider();
    renderPriceUI();
  }

  function configurePriceSlider() {
    const minInput =
      $('#priceMin');

    const maxInput =
      $('#priceMax');

    if (
      !minInput ||
      !maxInput
    ) {
      return;
    }

    minInput.min =
      String(
        priceBounds.min
      );

    minInput.max =
      String(
        priceBounds.max
      );

    maxInput.min =
      String(
        priceBounds.min
      );

    maxInput.max =
      String(
        priceBounds.max
      );

    minInput.value =
  String(
    state.priceMin
  );

minInput.disabled =
  false;

maxInput.value =
  String(
    state.priceMax
  );
  }

  function renderPriceUI() {
    const minLabel =
      $('#priceMinLabel');

    const maxLabel =
      $('#priceMaxLabel');

    if (minLabel) {
      minLabel.textContent =
        money(
          state.priceMin
        );
    }

    if (maxLabel) {
      maxLabel.textContent =
        money(
          state.priceMax
        );
    }

    const fill =
      $('#priceRangeFill');

    if (!fill) {
      return;
    }

    const range =
      priceBounds.max -
        priceBounds.min ||
      1;

    const left =
      (
        (
          state.priceMin -
          priceBounds.min
        ) /
        range
      ) *
      100;

    const right =
      (
        (
          state.priceMax -
          priceBounds.min
        ) /
        range
      ) *
      100;

    fill.style.left =
      Math.max(
        0,
        Math.min(
          100,
          left
        )
      ) + '%';

    fill.style.right =
      Math.max(
        0,
        Math.min(
          100,
          100 - right
        )
      ) + '%';
  }

  /* =====================================================
     CATEGORY LIST
     ===================================================== */

  function getCategoryCount(
    category
  ) {
    if (!category) {
      return null;
    }

    /*
     * Support common backend naming conventions if your
     * categories controller already returns a count.
     *
     * We NEVER calculate counts from the current page,
     * because that would be incorrect.
     */
    const candidates = [
      category.productCount,
      category.productsCount,
      category.totalProducts,
      category.count
    ];

    for (
      const value of
        candidates
    ) {
      const number =
        Number(value);

      if (
        Number.isFinite(
          number
        ) &&
        number >= 0
      ) {
        return number;
      }
    }

    return null;
  }

  function buildCategoryList() {
    const wrap =
      $('#categoryList');

    if (!wrap) {
      return;
    }

    if (
      !state.categories.length
    ) {
      wrap.innerHTML =
        '<p class="category-row__empty">No categories available.</p>';

      return;
    }

    wrap.innerHTML =
      state.categories
        .map(
          (category) => {
            const slug =
              String(
                category.slug ||
                  category.name ||
                  ''
              )
                .trim()
                .toLowerCase();

            const label =
              category.name ||
              category.slug ||
              '';

            const count =
              getCategoryCount(
                category
              );

            return `
              <button
                type="button"
                class="category-row"
                data-cat="${escapeHtml(
                  slug
                )}"
              >
                <span class="category-row__icon">
                  ${
                    CATEGORY_ICONS[
                      slug
                    ] ||
                    CATEGORY_ICONS._default
                  }
                </span>

                <span class="category-row__name">
                  ${escapeHtml(
                    label
                  )}
                </span>

                ${
                  count !== null
                    ? `
                      <span class="category-row__count">
                        ${count}
                      </span>
                    `
                    : ''
                }
              </button>
            `;
          }
        )
        .join('');

    $$('.category-row', wrap)
      .forEach(
        (button) => {
          button.addEventListener(
            'click',
            () => {
              const cat =
                button.getAttribute(
                  'data-cat'
                );

              if (!cat) {
                return;
              }

              state.cats.clear();
              state.cats.add(
                cat
              );

              state.page =
                1;

              syncCategoryUI();
              updateUrl();
              loadProducts();
            }
          );
        }
      );

    syncCategoryUI();
  }

  function syncCategoryUI() {
    $$('.category-row')
      .forEach(
        (button) => {
          const cat =
            button.getAttribute(
              'data-cat'
            );

          button.classList.toggle(
            'is-active',
            state.cats.has(
              cat
            )
          );
        }
      );
  }

  /* =====================================================
     SIDEBAR SEARCH
     ===================================================== */

  function initSidebarSearch() {
    const form =
      $('#shopSearchForm');

    const input =
      $('#shopSearchInput');

    if (
      !form ||
      !input
    ) {
      return;
    }

    input.value =
      state.search;

    form.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();

        state.search =
          input.value
            .trim()
            .toLowerCase();

        state.page =
          1;

        updateUrl();
        loadProducts();
      }
    );
  }

  /* =====================================================
     SORT
     ===================================================== */

  function setSort(
    value
  ) {
    if (
      !SORT_LABELS[value]
    ) {
      return;
    }

    state.sort =
      value;

    state.page =
      1;

    state.specialSortProducts =
      null;

    syncSortUI();

    updateUrl();
    loadProducts();
  }

  function initSort() {
    const dropdown =
      $('#toolbarSortDropdown');

    const toggle =
      $('#toolbarSortToggle');

    const menu =
      $('#toolbarSortMenu');

    if (
      !dropdown ||
      !toggle ||
      !menu
    ) {
      return;
    }

    function open() {
      dropdown.classList.add(
        'is-open'
      );

      toggle.setAttribute(
        'aria-expanded',
        'true'
      );
    }

    function close() {
      dropdown.classList.remove(
        'is-open'
      );

      toggle.setAttribute(
        'aria-expanded',
        'false'
      );
    }

    toggle.addEventListener(
      'click',
      (event) => {
        event.stopPropagation();

        if (
          dropdown.classList.contains(
            'is-open'
          )
        ) {
          close();
        } else {
          open();
        }
      }
    );

    $$(
      'li',
      menu
    ).forEach(
      (item) => {
        item.addEventListener(
          'click',
          () => {
            setSort(
              item.getAttribute(
                'data-value'
              )
            );

            close();
          }
        );
      }
    );

    document.addEventListener(
      'click',
      (event) => {
        if (
          !dropdown.contains(
            event.target
          )
        ) {
          close();
        }
      }
    );

    document.addEventListener(
      'keydown',
      (event) => {
        if (
          event.key ===
          'Escape'
        ) {
          close();
        }
      }
    );
  }

  function syncSortUI() {
    const label =
      $('#toolbarSortLabel');

    if (label) {
      label.textContent =
        SORT_LABELS[
          state.sort
        ] ||
        SORT_LABELS.default;
    }

    const menu =
      $('#toolbarSortMenu');

    if (!menu) {
      return;
    }

    $$(
      'li',
      menu
    ).forEach(
      (item) => {
        item.classList.toggle(
          'is-selected',
          item.getAttribute(
            'data-value'
          ) ===
            state.sort
        );
      }
    );
  }

  /* =====================================================
     CLEAR FILTERS
     ===================================================== */

  function clearAllFilters() {
    state.search =
      '';

    state.cats.clear();

    state.priceMin =
      priceBounds.min;

    state.priceMax =
      priceBounds.max;

    state.sort =
      'default';

    state.page =
      1;

    state.specialSortProducts =
      null;

    const searchInput =
      $('#shopSearchInput');

    if (searchInput) {
      searchInput.value =
        '';
    }

    const minInput =
      $('#priceMin');

    const maxInput =
      $('#priceMax');

    if (minInput) {
      minInput.value =
        String(
          priceBounds.min
        );
    }

    if (maxInput) {
      maxInput.value =
        String(
          priceBounds.max
        );
    }

    syncCategoryUI();
    renderPriceUI();
    syncSortUI();

    const url =
      new URL(
        window.location.href
      );

    url.search = '';

    window.history.replaceState(
      {},
      '',
      url.pathname +
        url.hash
    );

    loadProducts();
  }

  function initClearAllFilters() {
    const button =
      $('#clearAllFilters');

    if (!button) {
      return;
    }

    button.addEventListener(
      'click',
      clearAllFilters
    );
  }

  /* =====================================================
     PRICE FILTER
     ===================================================== */

  function initPriceSlider() {
    const minInput =
      $('#priceMin');

    const maxInput =
      $('#priceMax');

    const filterButton =
      $('#priceFilterBtn');

    if (
      !minInput ||
      !maxInput
    ) {
      return;
    }

    minInput.addEventListener(
  'input',
  () => {
    let value =
      Number(
        minInput.value
      );

    if (
      !Number.isFinite(
        value
      )
    ) {
      value =
        priceBounds.min;
    }

    value =
      Math.max(
        priceBounds.min,
        Math.min(
          priceBounds.max,
          value
        )
      );

    if (
      value >
      state.priceMax
    ) {
      value =
        state.priceMax;
    }

    minInput.value =
      String(value);

    state.priceMin =
      value;

    renderPriceUI();
    updateFilterCount();
  }
);

    maxInput.addEventListener(
      'input',
      () => {
        let value =
          Number(
            maxInput.value
          );

        if (
          !Number.isFinite(
            value
          )
        ) {
          value =
            priceBounds.max;
        }

        value =
          Math.max(
            priceBounds.min,
            Math.min(
              priceBounds.max,
              value
            )
          );

        maxInput.value =
          String(value);

        state.priceMax =
          value;

        renderPriceUI();
        updateFilterCount();
      }
    );

    if (filterButton) {
      filterButton.addEventListener(
        'click',
        (event) => {
          event.preventDefault();

          state.page =
            1;

          updateUrl();
          loadProducts();
        }
      );
    }
  }

  /* =====================================================
     SEARCH OVERLAY
     
     Search always goes to the backend.
     It no longer searches only the current shop page.
     ===================================================== */

  function initSearchOverlayResults() {
    const input =
      $('#searchInput');

    const results =
      $('#searchResults');

    if (
      !input ||
      !results
    ) {
      return;
    }

    let timer =
      null;

    let searchRequestId =
      0;

    input.addEventListener(
      'input',
      () => {
        clearTimeout(
          timer
        );

        const query =
          input.value
            .trim()
            .toLowerCase();

        if (!query) {
          results.innerHTML =
            '<p class="search-overlay__hint">Try "flower", "gummies", or "vape"</p>';

          return;
        }

        timer =
          setTimeout(
            async () => {
              const currentId =
                ++searchRequestId;

              results.innerHTML =
                '<p class="search-overlay__hint">Searching…</p>';

              try {
                const params =
                  new URLSearchParams();

                params.set(
                  'search',
                  query
                );

                params.set(
                  'status',
                  'active'
                );

                params.set(
                  'page',
                  '1'
                );

                params.set(
                  'limit',
                  '10'
                );

                const data =
                  await apiRequest(
                    '/products?' +
                      params.toString()
                  );

                if (
                  currentId !==
                  searchRequestId
                ) {
                  return;
                }

                const products =
                  Array.isArray(
                    data &&
                      data.products
                  )
                    ? data.products
                        .map(
                          adaptProduct
                        )
                        .filter(
                          (
                            product
                          ) =>
                            Boolean(
                              product.id
                            )
                        )
                    : [];

                if (
                  !products.length
                ) {
                  results.innerHTML =
                    `
                      <p class="search-overlay__hint">
                        No products match "${escapeHtml(
                          input.value
                        )}".
                      </p>
                    `;

                  return;
                }

                renderSearchResults(
                  products
                );
              } catch (error) {
                if (
                  currentId !==
                  searchRequestId
                ) {
                  return;
                }

                console.error(
                  'Search overlay failed:',
                  error
                );

                results.innerHTML =
                  '<p class="search-overlay__hint">Unable to search products right now.</p>';
              }
            },
            300
          );
      }
    );

    results.addEventListener(
      'click',
      (event) => {
        const addButton =
          event.target.closest(
            '[data-add]'
          );

        if (
          !addButton
        ) {
          return;
        }

        event.preventDefault();

        const productId =
          addButton.getAttribute(
            'data-add'
          );

        if (
          !productId
        ) {
          return;
        }

        addToCart(
          productId,
          addButton
        );
      }
    );
  }

  function renderSearchResults(
    products
  ) {
    const results =
      $('#searchResults');

    if (!results) {
      return;
    }

    results.innerHTML =
      products
        .map(
          (product) => `
            <div
              class="search-result"
              data-product-id="${escapeHtml(
                product.id
              )}"
            >
              <a
                href="shop.html?q=${encodeURIComponent(
                  product.name
                )}"
              >
                <span class="search-result__name">
                  ${escapeHtml(
                    product.name
                  )}
                </span>

                <span class="search-result__price">
                  ${money(
                    product.price
                  )}
                </span>
              </a>

              ${
                product.stock > 0 &&
                product.status ===
                  'active'
                  ? `
                    <button
                      type="button"
                      data-add="${escapeHtml(
                        product.id
                      )}"
                      aria-label="Add ${escapeHtml(
                        product.name
                      )} to cart"
                    >
                      +
                    </button>
                  `
                  : ''
              }
            </div>
          `
        )
        .join('');
  }

  /* =====================================================
     ADD TO CART
     ===================================================== */

  async function addToCart(
    productId,
    button
  ) {
    if (
      !productId
    ) {
      return;
    }

    if (
      !window.BNB ||
      typeof window.BNB.addToCart !==
        'function'
    ) {
      console.error(
        'BNB cart API is not available.'
      );

      showToast(
        'Cart is not available right now.'
      );

      return;
    }

    const textEl = button
      ? button.querySelector('.product-card__add-text')
      : null;

    const originalText = button
      ? (textEl ? textEl.textContent : button.textContent)
      : '';

    const setLabel = (value) => {
      if (!button) return;
      if (textEl) {
        textEl.textContent = value;
      } else {
        button.textContent = value;
      }
    };

    if (button) {
      window.BNB.setBusy(button, true);
      button.disabled = true;
    }

    try {
      await window.BNB.addToCart(
        productId,
        1
      );

      if (button) {
        window.BNB.setBusy(button, false);
        setLabel('Added');

        if (textEl) {
          button.classList.add('is-added');
        }

        setTimeout(() => {
          if (document.body.contains(button)) {
            button.disabled = false;

            if (textEl) {
              button.classList.remove('is-added');
              setTimeout(() => {
                setLabel(originalText || 'Add to Cart');
              }, 400);
            } else {
              setLabel(originalText || 'Add to Cart');
            }
          }
        }, 1800);
      }

      if (
        window.BNB &&
        typeof window.BNB.closeSearch ===
          'function'
      ) {
        window.BNB.closeSearch();
      }

    } catch (error) {
      console.error(
        'Add to cart failed:',
        error
      );

      if (button) {
        window.BNB.setBusy(button, false);
        button.disabled = false;
        button.classList.remove('is-added');
        setLabel(originalText || 'Add to Cart');
      }

      showToast(
        error &&
        error.message
          ? error.message
          : 'Unable to add this product to your cart.'
      );
    }
  }

  /* =====================================================
     PRODUCT BADGES
     ===================================================== */

  const BADGE_LABELS = {
    new: 'New',
    bestseller: 'Best Seller',
    hot: 'Hot',
    featured: 'Featured',
    sale: 'Sale',
    limited: 'Limited'
  };

  function badgeMarkup(
    badge,
    tagLabel
  ) {
    if (
      !badge &&
      !tagLabel
    ) {
      return '';
    }

    const label =
      tagLabel ||
      BADGE_LABELS[
        badge
      ] ||
      badge;

    return `
      <span
        class="product-card__badge product-card__badge--${escapeHtml(
          badge || ''
        )}"
      >
        ${escapeHtml(
          label
        )}
      </span>
    `;
  }

  /* =====================================================
     PRODUCT GRID
     ===================================================== */

  function renderGrid(
    pageItems
  ) {
    const grid =
      $('#shopProductGrid');

    const empty =
      $('#shopEmpty');

    if (!grid) {
      return;
    }

    if (
      !pageItems.length
    ) {
      grid.innerHTML =
        '';

      if (empty) {
        empty.hidden =
          false;
      }

      return;
    }

    if (empty) {
      empty.hidden =
        true;
    }

    grid.innerHTML =
      pageItems
        .map(
          (product) => {
            const unavailable =
              product.stock <=
                0 ||
              product.status !==
                'active';

            /*
             * FIX:
             * Available products must say "Add to Cart",
             * not "Added".
             */
            const buttonText =
              unavailable
                ? 'Unavailable'
                : 'Add to Cart';

            return `
              <div
                class="product-card"
                data-id="${escapeHtml(
                  product.id
                )}"
              >
                <div class="product-card__img">

                  ${badgeMarkup(
                    product.badge,
                    product.tagLabel
                  )}

                  <div class="media-frame">
                    ${
                      product.image
                        ? `
                          <img
                            src="${escapeHtml(
                              product.image
                            )}"
                            alt="${escapeHtml(
                              product.name
                            )}"
                            loading="lazy"
                            onerror="this.style.display='none'; this.nextElementSibling.hidden=false;"
                          >

                          <div
                            class="product-card__image-placeholder"
                            hidden
                            aria-label="Product image unavailable"
                          >
                            <span>
                              Image unavailable
                            </span>
                          </div>
                        `
                        : `
                          <div
                            class="product-card__image-placeholder"
                            aria-label="No product image available"
                          >
                            <span>
                              No image
                            </span>
                          </div>
                        `
                    }
                  </div>
                </div>

                <div class="product-card__body">

                  <span class="product-card__cat">
                    ${escapeHtml(
                      product.cat
                    )}
                  </span>

                  <div class="product-card__name">
                    ${escapeHtml(
                      product.name
                    )}
                  </div>

                  <div class="product-card__price-row">

                    <span class="product-card__price">
                      ${money(
                        product.price
                      )}
                    </span>

                    <button
                      type="button"
                      class="product-card__add"
                      data-add="${escapeHtml(
                        product.id
                      )}"
                      aria-label="${
                        unavailable
                          ? 'Product unavailable'
                          : `Add ${escapeHtml(
                              product.name
                            )} to cart`
                      }"
                      ${
                        unavailable
                          ? 'disabled'
                          : ''
                      }
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M3 6H5L6.3 15.6C6.4 16.6 7.3 17.3 8.3 17.3H17.4C18.4 17.3 19.2 16.6 19.4 15.7L20.9 8.6C21.1 7.9 20.5 7.2 19.8 7.2H5.6"
                          stroke="currentColor"
                          stroke-width="1.8"
                          stroke-linejoin="round"
                        />
                      </svg>

                      <span class="product-card__add-text">
                        ${buttonText}
                      </span>
                    </button>

                  </div>
                </div>
              </div>
            `;
          }
        )
        .join('');

    bindGridCartButtons();
  }

  function bindGridCartButtons() {
    $$('#shopProductGrid [data-add]')
      .forEach(
        (button) => {
          button.addEventListener(
            'click',
            (event) => {
              event.preventDefault();
              event.stopPropagation();

              if (
                button.disabled
              ) {
                return;
              }

              addToCart(
                button.getAttribute(
                  'data-add'
                ),
                button
              );
            }
          );
        }
      );
  }

  /* =====================================================
     LOADING / ERROR
     ===================================================== */

  function renderLoading() {
    const grid =
      $('#shopProductGrid');

    const empty =
      $('#shopEmpty');

    if (empty) {
      empty.hidden =
        true;
    }

    if (!grid) {
      return;
    }

    grid.innerHTML = `
      <div
        class="shop-loading"
        style="grid-column: 1 / -1;"
      >
        Loading products…
      </div>
    `;
  }

  function renderError(
    message
  ) {
    const grid =
      $('#shopProductGrid');

    const empty =
      $('#shopEmpty');

    if (empty) {
      empty.hidden =
        true;
    }

    if (!grid) {
      return;
    }

    grid.innerHTML = `
      <div
        class="shop-error"
        style="grid-column: 1 / -1;"
      >
        <p>
          ${escapeHtml(
            message
          )}
        </p>

        <button
          type="button"
          class="btn btn--primary btn--sm"
          id="shopRetryButton"
        >
          Try Again
        </button>
      </div>
    `;

    const retry =
      $('#shopRetryButton');

    if (retry) {
      retry.addEventListener(
        'click',
        loadProducts
      );
    }
  }

  /* =====================================================
     CURRENT PAGE
     ===================================================== */

  function renderCurrentPage() {
    let pageItems = [];

    if (
      isSpecialSort()
    ) {
      const all =
        state.specialSortProducts ||
        [];

      const start =
        (
          state.page -
          1
        ) *
        state.perPage;

      pageItems =
        all.slice(
          start,
          start +
            state.perPage
        );
    } else {
      pageItems =
        state.products;
    }

    renderGrid(
      pageItems
    );

    renderPagination();

    updateResultsCount();

    updateFilterCount();
  }

  /* =====================================================
     PAGINATION
     ===================================================== */

  function pageWindow(
    current,
    total
  ) {
    if (
      total <= 1
    ) {
      return [1];
    }

    const pages = [];

    pages.push(1);

    for (
      let i =
        current - 1;
      i <=
        current + 1;
      i += 1
    ) {
      if (
        i > 1 &&
        i < total
      ) {
        pages.push(i);
      }
    }

    if (
      total > 1
    ) {
      pages.push(total);
    }

    const unique =
      Array.from(
        new Set(pages)
      ).sort(
        (a, b) =>
          a - b
      );

    const output = [];

    let previous =
      null;

    unique.forEach(
      (page) => {
        if (
          previous !== null &&
          page -
            previous >
            1
        ) {
          output.push(
            '…'
          );
        }

        output.push(
          page
        );

        previous =
          page;
      }
    );

    return output;
  }

  function renderPagination() {
    const nav =
      $('#shopPagination');

    if (!nav) {
      return;
    }

    const totalPages =
      Math.max(
        1,
        state.totalPages
      );

    if (
      totalPages <= 1
    ) {
      nav.innerHTML =
        '';

      return;
    }

    const pages =
      pageWindow(
        state.page,
        totalPages
      );

    let html = `
      <button
        type="button"
        class="pagination__nav"
        data-page="${state.page - 1}"
        ${
          state.page === 1
            ? 'disabled'
            : ''
        }
        aria-label="Previous page"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M15 6L9 12L15 18"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    `;

    pages.forEach(
      (page) => {
        if (
          page ===
          '…'
        ) {
          html += `
            <span
              class="pagination__ellipsis"
            >
              …
            </span>
          `;

          return;
        }

        html += `
          <button
            type="button"
            data-page="${page}"
            class="${
              page ===
              state.page
                ? 'is-active'
                : ''
            }"
            aria-current="${
              page ===
              state.page
                ? 'page'
                : 'false'
            }"
          >
            ${page}
          </button>
        `;
      }
    );

    html += `
      <button
        type="button"
        class="pagination__nav"
        data-page="${state.page + 1}"
        ${
          state.page ===
          totalPages
            ? 'disabled'
            : ''
        }
        aria-label="Next page"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M9 6L15 12L9 18"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    `;

    nav.innerHTML =
      html;

    $$(
      'button[data-page]',
      nav
    ).forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const page =
              parseInt(
                button.getAttribute(
                  'data-page'
                ),
                10
              );

            if (
              Number.isNaN(
                page
              ) ||
              page < 1 ||
              page >
                totalPages ||
              page ===
                state.page
            ) {
              return;
            }

            state.page =
              page;

            updateUrl();
            loadProducts();

            const section =
              $('#shop');

            if (section) {
              section.scrollIntoView(
                {
                  behavior:
                    'smooth',
                  block:
                    'start'
                }
              );
            }
          }
        );
      }
    );
  }

  /* =====================================================
     RESULTS COUNT
     ===================================================== */

  function updateResultsCount() {
    const countEl =
      $('#resultsCount');

    if (!countEl) {
      return;
    }

    const total =
      state.totalProducts;

    if (
      total <= 0
    ) {
      countEl.textContent =
        'Showing 0 results';

      return;
    }

    const start =
      (
        state.page -
        1
      ) *
        state.perPage +
      1;

    const end =
      Math.min(
        start +
          state.perPage -
          1,
        total
      );

    countEl.textContent =
      `Showing ${start}–${end} of ${total} results`;
  }

  /* =====================================================
     FILTER COUNT
     ===================================================== */

  function updateFilterCount() {
    const badge =
      $('#filterCount');

    if (!badge) {
      return;
    }

    let count =
      state.cats.size;

    if (
      state.search
    ) {
      count += 1;
    }

    if (
      state.priceMin !==
        priceBounds.min ||
      state.priceMax !==
        priceBounds.max
    ) {
      count += 1;
    }

    badge.hidden =
      count === 0;

    badge.textContent =
      String(count);
  }

  /* =====================================================
     MOBILE FILTER DRAWER
     ===================================================== */

  function initFilterDrawer() {
    const sidebar =
      $('#shopSidebar');

    const toggle =
      $('#filterToggle');

    const closeButton =
      $('#sidebarClose');

    const scrim =
      $('#shopSidebarScrim');

    if (
      !sidebar ||
      !toggle ||
      !scrim
    ) {
      return;
    }

    function open() {
      sidebar.classList.add(
        'is-open'
      );

      scrim.classList.add(
        'is-open'
      );
    }

    function close() {
      sidebar.classList.remove(
        'is-open'
      );

      scrim.classList.remove(
        'is-open'
      );
    }

    toggle.addEventListener(
      'click',
      open
    );

    if (closeButton) {
      closeButton.addEventListener(
        'click',
        close
      );
    }

    scrim.addEventListener(
      'click',
      close
    );

    document.addEventListener(
      'keydown',
      (event) => {
        if (
          event.key ===
          'Escape'
        ) {
          close();
        }
      }
    );
  }

  /* =====================================================
     NAV ACTIVE STATE
     ===================================================== */

  function syncNavActiveState() {
    $$('.main-nav__link, .mobile-menu a')
      .forEach(
        (link) => {
          link.classList.remove(
            'is-active'
          );
        }
      );

    const shopLink =
      $$('.main-nav__dropdown > .main-nav__link')[0];

    if (shopLink) {
      shopLink.classList.add(
        'is-active'
      );
    }

    const mobileShop =
      $$('.mobile-menu a')
        .find(
          (link) =>
            link.textContent.trim() ===
            'Shop'
        );

    if (mobileShop) {
      mobileShop.classList.add(
        'is-active'
      );
    }

    /*
     * Shared header Home link uses #.
     * On shop.html it should return to index.html.
     */
    const homeLinks = [
      ...$$(
        '.main-nav__link'
      ).filter(
        (link) =>
          link.textContent.trim() ===
          'Home'
      ),

      ...$$(
        '.mobile-menu a'
      ).filter(
        (link) =>
          link.textContent.trim() ===
          'Home'
      )
    ];

    homeLinks.forEach(
      (link) => {
        link.setAttribute(
          'href',
          'index.html'
        );
      }
    );
  }

  /* =====================================================
     HEADER / FOOTER CATEGORY LINKS
     ===================================================== */

  function initHeaderFooterCategoryLinks() {
    $$('[data-cat]')
      .forEach(
        (link) => {
          /*
           * Sidebar category buttons already have their
           * own event listeners.
           */
          if (
            link.closest(
              '#shopSidebar'
            )
          ) {
            return;
          }

          /*
           * Prevent duplicate binding if this function
           * somehow gets called again.
           */
          if (
            link.dataset.shopCategoryBound ===
            'true'
          ) {
            return;
          }

          link.dataset.shopCategoryBound =
            'true';

          link.addEventListener(
            'click',
            (event) => {
              const cat =
                link.getAttribute(
                  'data-cat'
                );

              if (!cat) {
                return;
              }

              const href =
                link.getAttribute(
                  'href'
                ) || '';

              const isShopLink =
                href.includes(
                  'shop.html'
                ) ||
                href === '#' ||
                href === '';

              if (!isShopLink) {
                return;
              }

              event.preventDefault();

              state.cats.clear();

              state.cats.add(
                cat
                  .trim()
                  .toLowerCase()
              );

              state.page =
                1;

              syncCategoryUI();
              updateUrl();
              loadProducts();

              if (
                window.BNB &&
                typeof window.BNB.closeCart ===
                  'function'
              ) {
                window.BNB.closeCart();
              }
            }
          );
        }
      );
  }

  /* =====================================================
     RESPONSIVE PAGINATION
     ===================================================== */

  function initResponsivePaging() {
    state.perPage =
      itemsPerPage();

    let previous =
      state.perPage;

    let resizeTimer =
      null;

    window.addEventListener(
      'resize',
      () => {
        clearTimeout(
          resizeTimer
        );

        resizeTimer =
          setTimeout(
            () => {
              const current =
                itemsPerPage();

              if (
                current ===
                previous
              ) {
                return;
              }

              previous =
                current;

              state.perPage =
                current;

              state.page =
                1;

              updateUrl();
              loadProducts();
            },
            150
          );
      }
    );
  }

  /* =====================================================
     TOAST
     ===================================================== */

  function showToast(
    message
  ) {
    let toast =
      $('[data-shop-toast]');

    if (!toast) {
      toast =
        document.createElement(
          'div'
        );

      toast.setAttribute(
        'data-shop-toast',
        'true'
      );

      toast.style.position =
        'fixed';

      toast.style.bottom =
        '24px';

      toast.style.right =
        '24px';

      toast.style.zIndex =
        '99999';

      toast.style.padding =
        '12px 18px';

      toast.style.borderRadius =
        '8px';

      toast.style.background =
        '#111';

      toast.style.color =
        '#fff';

      toast.style.fontSize =
        '14px';

      toast.style.boxShadow =
        '0 6px 24px rgba(0,0,0,.2)';

      toast.style.opacity =
        '0';

      toast.style.transform =
        'translateY(10px)';

      toast.style.transition =
        'opacity .2s ease, transform .2s ease';

      document.body.appendChild(
        toast
      );
    }

    toast.textContent =
      message;

    requestAnimationFrame(
      () => {
        toast.style.opacity =
          '1';

        toast.style.transform =
          'translateY(0)';
      }
    );

    clearTimeout(
      toast._hideTimer
    );

    toast._hideTimer =
      setTimeout(
        () => {
          toast.style.opacity =
            '0';

          toast.style.transform =
            'translateY(10px)';
        },
        2500
      );
  }

  /* =====================================================
     INITIALIZATION
     ===================================================== */

  async function initShop() {
    readUrlState();

    state.perPage =
      itemsPerPage();

    syncSortUI();

    /*
     * Bind all UI first.
     */
    initSidebarSearch();
    initSort();
    initClearAllFilters();
    initPriceSlider();
    initFilterDrawer();
    initResponsivePaging();
    initSearchOverlayResults();

    syncNavActiveState();
    initHeaderFooterCategoryLinks();

    /*
     * Categories need to exist before a ?cat=slug can
     * be translated into a MongoDB ObjectId.
     */
    try {
      await loadCategories();
    } catch (error) {
      console.error(
        'Category loading failed:',
        error
      );

      state.categories =
        [];

      buildCategoryList();
    }

    /*
     * Price bounds are independent from the product page.
     */
    await loadPriceBounds();

    /*
     * Render category UI again in case the category
     * endpoint returned count metadata.
     */
    buildCategoryList();

    /*
     * Finally load the real products.
     */
    await loadProducts();

    syncCategoryUI();
    syncSortUI();
    updateFilterCount();
  }

  /* =====================================================
     PUBLIC SHOP API
     ===================================================== */

  window.BNBShop = {
    reload:
      loadProducts,

    clearFilters:
      clearAllFilters,

    getState:
      function () {
        return {
          search:
            state.search,

          categories:
            Array.from(
              state.cats
            ),

          priceMin:
            state.priceMin,

          priceMax:
            state.priceMax,

          sort:
            state.sort,

          page:
            state.page,

          perPage:
            state.perPage,

          totalProducts:
            state.totalProducts,

          totalPages:
            state.totalPages
        };
      }
  };

  /*
   * IMPORTANT:
   *
   * We intentionally DO NOT overwrite:
   *
   *   window.BNB.getProducts
   *   window.BNB.addProduct
   *   window.BNB.removeProduct
   *
   * header.js owns the shared BNB API.
   *
   * Overwriting those methods from the Shop page can cause
   * other pages/components to receive the wrong product data.
   */

  /* =====================================================
     START
     ===================================================== */

  document.addEventListener(
    'partials:loaded',
    function () {
      initShop().catch(
        (error) => {
          console.error(
            'shop.js initialization failed:',
            error
          );
        }
      );
    },
    {
      once: true
    }
  );

})();