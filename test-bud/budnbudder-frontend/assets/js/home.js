/* =====================================================
   BUD N' BUDDER — home.js
   Home page only:
   - Backend product data
   - Product rendering
   - Search results
   - Category filtering
   - Add-to-cart
   - Testimonial carousel

   Requires:
   - include.js
   - header.js
   - footer.js
   - main.js

   Backend:
   - /api/products
   - /api/categories
   ===================================================== */

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  const API_BASE =
    window.BNB_API_BASE_URL ||
    window.BNB?.API_BASE ||
    'http://https://budnbudder-backend.onrender.com/api';

  let ALL_PRODUCTS = [];
  let BEST_SELLERS = [];
  let NEW_ARRIVALS = [];
  let CATEGORIES = [];

  /* =====================================================
     HELPERS
     ===================================================== */

  function money(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
      return '$0.00';
    }

    return '$' + amount.toFixed(2);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getBackendOrigin() {
    try {
      return new URL(API_BASE).origin;
    } catch (_) {
      return window.location.origin;
    }
  }

  /* =====================================================
     IMAGE RESOLUTION
     Same backend image handling used by shop.js
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
     CATEGORY HELPERS
     ===================================================== */

  function getCategoryName(category) {
    if (!category) {
      return '';
    }

    if (typeof category === 'string') {
      return category;
    }

    return (
      category.name ||
      category.title ||
      category.label ||
      ''
    );
  }

  function getCategorySlug(category) {
    if (!category) {
      return '';
    }

    if (typeof category === 'string') {
      return category
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-');
    }

    return (
      category.slug ||
      category.name
        ?.toLowerCase()
        .trim()
        .replace(/\s+/g, '-') ||
      ''
    );
  }

  function findCategoryBySlug(slug) {
    if (!slug) {
      return null;
    }

    return CATEGORIES.find((category) => {
      return getCategorySlug(category) === slug;
    }) || null;
  }

  /* =====================================================
     PRODUCT NORMALIZATION
     Converts MongoDB product data into the structure
     this homepage needs.
     ===================================================== */

  function normalizeProduct(product) {
    if (!product) {
      return null;
    }

    const category = product.category;

    const categoryName =
      getCategoryName(category) ||
      product.cat ||
      '';

    const categorySlug =
      getCategorySlug(category) ||
      product.type ||
      '';

    const tagType =
      product.tagType ||
      '';

    const tagLabel =
      product.tagLabel ||
      '';

    let badge = '';

    if (tagType) {
      const normalizedTag = String(tagType)
        .toLowerCase()
        .replace(/[\s_-]+/g, '');

      if (
  normalizedTag === 'bestseller' ||
  normalizedTag === 'best-seller'
) {
  badge = 'bestseller';
} else if (normalizedTag === 'hot') {
  badge = 'hot';
} else if (normalizedTag === 'new') {
  badge = 'new';
} else if (normalizedTag === 'featured') {
  badge = 'featured';
} else if (normalizedTag === 'sale') {
  badge = 'sale';
} else if (normalizedTag === 'limited') {
  badge = 'limited';
}
    }

    return {
      id: product._id || product.id,

      name:
        product.name ||
        'Unnamed Product',

      cat: categoryName,

      type: categorySlug,

      price: Number(product.price) || 0,

      stock:
        product.stock === undefined
          ? null
          : Number(product.stock),

      status:
        product.status ||
        'active',

      image:
        product.image ||
        '',

      tagType,

      tagLabel,

      badge,

      createdAt:
        product.createdAt ||
        null,

      rating:
        Number(product.rating) || 0
    };
  }

  /* =====================================================
     BACKEND PRODUCT LOADING
     ===================================================== */

  async function loadProducts() {
    try {
      /*
        header.js already exposes getProducts().
        Use it when available because it already knows
        how to communicate with the backend.
      */

      if (
        window.BNB &&
        typeof window.BNB.getProducts === 'function'
      ) {
        const result = await window.BNB.getProducts();

        let products = [];

        if (Array.isArray(result)) {
          products = result;
        } else if (Array.isArray(result?.products)) {
          products = result.products;
        } else if (Array.isArray(result?.data)) {
          products = result.data;
        }

        ALL_PRODUCTS = products
          .map(normalizeProduct)
          .filter(Boolean)
          .filter((product) => {
            return product.status === 'active';
          });

        return;
      }

      /*
        Fallback:
        If header.js doesn't expose getProducts(),
        talk directly to the backend.
      */

      const response = await fetch(
        `${API_BASE}/products?status=active&limit=100`,
        {
          credentials: 'include'
        }
      );

      let data = null;

      try {
        data = await response.json();
      } catch (_) {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
          `Failed to load products (${response.status})`
        );
      }

      let products = [];

      if (Array.isArray(data)) {
        products = data;
      } else if (Array.isArray(data?.products)) {
        products = data.products;
      } else if (Array.isArray(data?.data)) {
        products = data.data;
      }

      ALL_PRODUCTS = products
        .map(normalizeProduct)
        .filter(Boolean)
        .filter((product) => {
          return product.status === 'active';
        });

    } catch (error) {
      console.error(
        'Home page product loading error:',
        error
      );

      ALL_PRODUCTS = [];
    }
  }

  /* =====================================================
     CATEGORY LOADING
     ===================================================== */

  async function loadCategories() {
    try {
      if (
        window.BNB &&
        typeof window.BNB.apiRequest === 'function'
      ) {
        const result =
          await window.BNB.apiRequest('/categories');

        if (Array.isArray(result)) {
          CATEGORIES = result;
        } else if (Array.isArray(result?.categories)) {
          CATEGORIES = result.categories;
        } else if (Array.isArray(result?.data)) {
          CATEGORIES = result.data;
        }

        return;
      }

      const response = await fetch(
        `${API_BASE}/categories`,
        {
          credentials: 'include'
        }
      );

      let data = null;

      try {
        data = await response.json();
      } catch (_) {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
          `Failed to load categories (${response.status})`
        );
      }

      if (Array.isArray(data)) {
        CATEGORIES = data;
      } else if (Array.isArray(data?.categories)) {
        CATEGORIES = data.categories;
      } else if (Array.isArray(data?.data)) {
        CATEGORIES = data.data;
      }

    } catch (error) {
      console.error(
        'Home page category loading error:',
        error
      );

      CATEGORIES = [];
    }
  }

  /* =====================================================
     HOMEPAGE PRODUCT GROUPS
     ===================================================== */

  function buildProductSections() {
    /*
      BEST SELLERS

      Products marked by the backend with:
      tagType = "best-seller"
      or
      tagType = "bestseller"
    */

    BEST_SELLERS = ALL_PRODUCTS
      .filter((product) => {
        const tag = String(product.tagType || '')
          .toLowerCase()
          .replace(/[\s_-]+/g, '');

        return tag === 'bestseller';
      })
      .slice(0, 4);

    /*
      If there are not enough products explicitly marked
      as best sellers, use products marked "hot" to fill
      the homepage section.
    */

    if (BEST_SELLERS.length < 4) {
      const existingIds = new Set(
        BEST_SELLERS.map((product) => product.id)
      );

      const hotProducts = ALL_PRODUCTS.filter((product) => {
        const tag = String(product.tagType || '')
          .toLowerCase()
          .replace(/[\s_-]+/g, '');

        return (
          tag === 'hot' &&
          !existingIds.has(product.id)
        );
      });

      BEST_SELLERS = [
        ...BEST_SELLERS,
        ...hotProducts
      ].slice(0, 4);
    }

    /*
      NEW ARRIVALS

      Sort the real backend products by createdAt.
    */

    const bestSellerIds = new Set(
      BEST_SELLERS.map((product) => product.id)
    );

    NEW_ARRIVALS = ALL_PRODUCTS
      .filter((product) => !bestSellerIds.has(product.id))
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();

        return dateB - dateA;
      })
      .slice(0, 4);
  }

  /* =====================================================
     PRODUCT BADGES
     ===================================================== */

  const BADGE_LABELS = {
    new: 'New',
    bestseller: 'Best Seller',
    hot: 'Hot'
  };

  function badgeMarkup(product) {
    if (!product) {
      return '';
    }

    let badge = product.badge;

    /*
      If no badge was explicitly assigned but the backend
      has tagLabel, use that label.
    */

    if (!badge && product.tagLabel) {
      return `
        <span class="product-card__badge">
          ${escapeHtml(product.tagLabel)}
        </span>
      `;
    }

    if (!badge) {
      return '';
    }

    const label =
      BADGE_LABELS[badge] ||
      product.tagLabel ||
      badge;

    return `
      <span class="product-card__badge product-card__badge--${escapeHtml(badge)}">
        ${escapeHtml(label)}
      </span>
    `;
  }

  /* =====================================================
     RATING
     ===================================================== */

  function starRow(rating) {
    const numericRating = Number(rating);

    if (!Number.isFinite(numericRating) || numericRating <= 0) {
      return '☆☆☆☆☆';
    }

    const full = Math.round(
      Math.max(0, Math.min(5, numericRating))
    );

    let stars = '';

    for (let i = 1; i <= 5; i++) {
      stars += i <= full ? '★' : '☆';
    }

    return stars;
  }

  /* =====================================================
     PRODUCT CARD
     ===================================================== */

  function productCardMarkup(product) {
    const productId = escapeHtml(product.id);
    const productName = escapeHtml(product.name);
    const categoryName = escapeHtml(product.cat);
    const categorySlug = escapeHtml(product.type);

    const imageUrl =
      resolveImageUrl(product.image);

    const shopUrl =
      `shop.html?cat=${encodeURIComponent(product.type || '')}` +
      `&q=${encodeURIComponent(product.name || '')}`;

    const hasStock =
      product.stock === null ||
      product.stock === undefined ||
      product.stock > 0;

    return `
      <div
        class="product-card"
        data-id="${productId}"
      >

        <div class="product-card__img">

          ${badgeMarkup(product)}

          <a
            class="product-card__view"
            href="${shopUrl}"
            aria-label="View ${productName} in the shop"
          >
            View

            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M7 17L17 7M17 7H9M17 7V15"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </a>

          <div class="media-frame">

            <img
              src="${escapeHtml(imageUrl)}"
              alt="${productName}"
              loading="lazy"
              onerror="this.src='assets/images/products/placeholder.png'"
            />

          </div>

        </div>

        <div class="product-card__body">

          <span class="product-card__cat">
            ${categoryName}
          </span>

          <div class="product-card__name">
            ${productName}
          </div>

          <div class="product-card__rating">
            ${starRow(product.rating)}

            ${
              product.rating > 0
                ? `<span>${product.rating.toFixed(1)}</span>`
                : ''
            }
          </div>

          <div class="product-card__price-row">

            <span class="product-card__price">
              ${money(product.price)}
            </span>

          </div>

          ${
            !hasStock
              ? `
                <span class="product-card__stock">
                  Out of stock
                </span>
              `
              : ''
          }

        </div>

      </div>
    `;
  }

  /* =====================================================
     PRODUCT GRID
     ===================================================== */

  function renderGrid(targetSelector, products) {
    const grid = $(targetSelector);

    if (!grid) {
      return;
    }

    if (!products.length) {
      grid.innerHTML = `
        <p style="padding:30px;color:#82836f;">
          No products found.
        </p>
      `;

      return;
    }

    grid.innerHTML =
      products
        .map(productCardMarkup)
        .join('');
  }

  function renderProducts(products) {
    if (!products) {
      renderGrid(
        '#bestSellersGrid',
        BEST_SELLERS
      );

      renderGrid(
        '#newArrivalsGrid',
        NEW_ARRIVALS
      );

      return;
    }

    renderGrid(
      '#bestSellersGrid',
      products
    );

    renderGrid(
      '#newArrivalsGrid',
      []
    );
  }

  /* =====================================================
     PRODUCT CARD CLICK / ADD TO CART
     ===================================================== */

  function initProductActions() {
    document.addEventListener('click', async (event) => {

      const card =
        event.target.closest('.product-card');

      if (!card) {
        return;
      }

      /*
        The existing homepage card doesn't currently
        contain an Add to Cart button.

        This handler is intentionally prepared for one
        if you add it later without changing the backend.
      */

      const addButton =
        event.target.closest('[data-add-to-cart]');

      if (!addButton) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const productId =
        addButton.getAttribute('data-add-to-cart');

      if (!productId) {
        return;
      }

      try {

        if (
          !window.BNB ||
          typeof window.BNB.addToCart !== 'function'
        ) {
          throw new Error(
            'Cart system is not available.'
          );
        }

        addButton.disabled = true;

        await window.BNB.addToCart(
          productId,
          1
        );


      } catch (error) {

        console.error(
          'Home page add-to-cart error:',
          error
        );

        alert(
          error.message ||
          'Unable to add this product to your cart.'
        );

      } finally {

        addButton.disabled = false;

      }
    });
  }

  /* =====================================================
     SEARCH RESULTS
     Header search UI is injected by header.html.
     ===================================================== */

  function initSearchResults() {
    const input = $('#searchInput');
    const results = $('#searchResults');

    if (!input || !results) {
      return;
    }

    input.addEventListener('input', () => {

      const q =
        input.value.trim().toLowerCase();

      if (!q) {
        results.innerHTML = `
          <p class="search-overlay__hint">
            Try "flower", "gummies", or "vape"
          </p>
        `;

        return;
      }

      const matches =
        ALL_PRODUCTS.filter((product) => {

          const name =
            String(product.name || '')
              .toLowerCase();

          const category =
            String(product.cat || '')
              .toLowerCase();

          const tag =
            String(product.tagLabel || '')
              .toLowerCase();

          return (
            name.includes(q) ||
            category.includes(q) ||
            tag.includes(q)
          );

        });

      if (!matches.length) {

        results.innerHTML = `
          <p class="search-overlay__hint">
            No products match "${escapeHtml(input.value)}".
          </p>
        `;

        return;
      }

      results.innerHTML =
        matches
          .slice(0, 8)
          .map((product) => {

            const shopUrl =
              `shop.html?cat=${encodeURIComponent(product.type || '')}` +
              `&q=${encodeURIComponent(product.name || '')}`;

            return `
              <a
                class="search-result"
                href="${shopUrl}"
              >

                <span class="search-result__name">
                  ${escapeHtml(product.name)}
                </span>

                <span class="search-result__price">
                  ${money(product.price)}
                </span>

              </a>
            `;

          })
          .join('');
    });
  }

  /* =====================================================
     CATEGORY FILTER
     ===================================================== */

  function initCategoryFilter() {

    document.querySelectorAll('[data-cat]')
      .forEach((link) => {

        /*
          Prevent attaching the same listener twice.
        */

        if (
          link.dataset.homeCategoryBound === 'true'
        ) {
          return;
        }

        link.dataset.homeCategoryBound = 'true';

        link.addEventListener('click', (event) => {

          const cat =
            link.getAttribute('data-cat');

          if (!cat) {
            return;
          }

          event.preventDefault();

          /*
            Match against the real backend category
            slug stored on each normalized product.
          */

          const filteredProducts =
            ALL_PRODUCTS.filter((product) => {
              return product.type === cat;
            });

          /*
            If this is a category with products,
            show those products in the best-sellers
            area temporarily.
          */

          renderProducts(filteredProducts);

          const shopSection =
            document.getElementById('shop');

          if (shopSection) {
            shopSection.scrollIntoView({
              behavior: 'smooth'
            });
          }

        });

      });

  }

  /* =====================================================
     BROWSE PRODUCTS BUTTON
     ===================================================== */

  function initBrowseProductsButton() {

    const button =
      $('#browseProductsBtn');

    if (!button) {
      return;
    }

    button.addEventListener('click', (event) => {

      event.preventDefault();

      window.location.href =
        'shop.html';

    });

  }

  /* =====================================================
     TESTIMONIAL CAROUSEL
     ===================================================== */

  function initTestimonialDots() {

    const dots =
      document.querySelectorAll(
        '#testimonialDots span'
      );

    const cards =
      document.querySelectorAll(
        '.testimonial-card'
      );

    const track =
      $('#testimonialGrid');

    const prevBtn =
      $('#testimonialPrev');

    const nextBtn =
      $('#testimonialNext');

    if (!dots.length || !track) {
      return;
    }

    function setActive(index) {

      dots.forEach((dot) => {
        dot.classList.remove(
          'is-active'
        );
      });

      if (dots[index]) {
        dots[index].classList.add(
          'is-active'
        );
      }

    }

    function goTo(index) {

      if (!cards.length) {
        return;
      }

      const clamped =
        Math.max(
          0,
          Math.min(
            index,
            cards.length - 1
          )
        );

      if (cards[clamped]) {

        cards[clamped].scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'start'
        });

      }

      setActive(clamped);

    }

    dots.forEach((dot, index) => {

      dot.addEventListener(
        'click',
        () => goTo(index)
      );

    });

    if (prevBtn) {

      prevBtn.addEventListener(
        'click',
        () => {

          const active =
            [...dots].findIndex((dot) =>
              dot.classList.contains(
                'is-active'
              )
            );

          goTo(
            (active - 1 + cards.length) %
            cards.length
          );

        }
      );

    }

    if (nextBtn) {

      nextBtn.addEventListener(
        'click',
        () => {

          const active =
            [...dots].findIndex((dot) =>
              dot.classList.contains(
                'is-active'
              )
            );

          goTo(
            (active + 1) %
            cards.length
          );

        }
      );

    }

    if (
      'IntersectionObserver' in window
    ) {

      const observer =
        new IntersectionObserver(
          (entries) => {

            entries.forEach((entry) => {

              if (
                entry.isIntersecting
              ) {

                const index =
                  [...cards].indexOf(
                    entry.target
                  );

                if (index !== -1) {
                  setActive(index);
                }

              }

            });

          },
          {
            root: track,
            threshold: 0.6
          }
        );

      cards.forEach((card) => {
        observer.observe(card);
      });

    }

  }

  /* =====================================================
     INIT
     ===================================================== */

  async function initHome() {

    /*
      Load backend data first.
    */

    await Promise.all([
      loadProducts(),
      loadCategories()
    ]);

    /*
      Build homepage sections from real products.
    */

    buildProductSections();

    /*
      Render the actual MongoDB products.
    */

    renderProducts();

    /*
      Initialize interactions after the DOM and
      header/footer partials are ready.
    */

    initSearchResults();
    initCategoryFilter();
    initProductActions();
    initBrowseProductsButton();
    initTestimonialDots();

  }

  /* =====================================================
     PARTIALS LOADED
     ===================================================== */

  document.addEventListener(
    'partials:loaded',
    () => {

      initHome().catch((error) => {

        console.error(
          'Home page initialization failed:',
          error
        );

      });

    },
    {
      once: true
    }
  );

})();