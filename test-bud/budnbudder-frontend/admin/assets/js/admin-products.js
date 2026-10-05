/* =====================================================
   BUD N' BUDDER — ADMIN — admin-products.js
   ===================================================== */

(function () {
  "use strict";

    const API_BASE_URL = "http://https://budnbudder-backend.onrender.com";

  // ---------------------------------------------------
  // DATA
  // ---------------------------------------------------
  let CATEGORIES = [];

  const TAG_OPTIONS = [
  { id: "new", label: "New", color: "#34A561" },
  { id: "sale", label: "Sale", color: "#D8483D" },
  { id: "best-seller", label: "Best Seller", color: "#D8483D" },
  { id: "featured", label: "Featured", color: "#2A2A26" },
  { id: "hot", label: "Hot", color: "#E8730F" },
  { id: "limited", label: "Limited", color: "#2A2A26" }
];
  const CUSTOM_TAG_COLOR = "#2A2A26";

  function tagColor(type) {
    const opt = TAG_OPTIONS.find(function (t) { return t.id === type; });
    return opt ? opt.color : CUSTOM_TAG_COLOR;
  }

  const CATEGORY_ICONS = {
    flower: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.6"/><path d="M12 3C13.5 6 13.5 8 12 8.8C10.5 8 10.5 6 12 3Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 21C13.5 18 13.5 16 12 15.2C10.5 16 10.5 18 12 21Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M3 12C6 10.5 8 10.5 8.8 12C8 13.5 6 13.5 3 12Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M21 12C18 10.5 16 10.5 15.2 12C16 13.5 18 13.5 21 12Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    vape: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="8" rx="1.5" stroke="currentColor" stroke-width="1.6"/><path d="M12 11V21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M8 21H16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    edibles: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 12C4 7.58 7.58 4 12 4C16.42 4 20 7.58 20 12C20 16.42 16.42 20 12 20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4 12C4 16.42 7.58 20 12 20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="1 3.2"/></svg>',
    "pre-roll": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="10.5" width="19" height="4" rx="2" stroke="currentColor" stroke-width="1.5" transform="rotate(-14 12 12)"/></svg>',
    concentrates: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3L18 10C20 12.4 20 16 17.5 18.2C14.9 20.5 9.1 20.5 6.5 18.2C4 16 4 12.4 6 10L12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    accessories: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.4" stroke="currentColor" stroke-width="1.5"/></svg>',
    default: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.6"/></svg>'
  };

let PRODUCTS = [];

  // ---------------------------------------------------
  // STATE
  // ---------------------------------------------------
  const state = {
    search: "",
    selectedCategory: "all", // Changed from 'category'
    priceMin: null,
    priceMax: null,
    pages: {}          // per-category current page (mobile pagination only)
  };

  const MOBILE_PAGE_SIZE = 6;
  const DESKTOP_PAGE_SIZE = 9;
  function isMobileView() {
    return window.matchMedia("(max-width: 640px)").matches;
  }
  function getPageSize() {
    return isMobileView() ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;
  }

  function fmtMoney(n) {
    return "$" + Number(n).toFixed(2);
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

 async function apiRequest(endpoint, options = {}) {
  const isFormData =
    options.body instanceof FormData;

  const headers = {
    ...(options.headers || {})
  };

  // Never manually set Content-Type for FormData.
  // The browser must set multipart/form-data together
  // with the correct boundary.
  if (!isFormData) {
    headers["Content-Type"] =
      "application/json";
  }

  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      credentials: "include",
      ...options,
      headers
    }
  );

  let data = null;

  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      `Request failed with status ${response.status}`
    );
  }

  return data;
}

    function normalizeProduct(product) {
  return {
    id: product._id,

    name: product.name || "",

    category:
      product.category?._id ||
      product.category ||
      "",

    categoryName:
      product.category?.name ||
      "",

    categorySlug:
      product.category?.slug ||
      "",

    status:
      product.status || "active",

    price:
      Number(product.price || 0),

    stock:
      Number(product.stock || 0),

    image:
  resolveProductImage(
    product.image
  ),

    tagType:
      product.tagType || "",

    tagLabel:
      product.tagLabel || ""
  };
}

  

  function getCategoryIcon(iconName) {
    return CATEGORY_ICONS[iconName] || CATEGORY_ICONS.default;
  }

  // ---------------------------------------------------
  // FILTERING
  // ---------------------------------------------------
  function getFiltered() {
    return PRODUCTS.filter(function (p) {
      if (state.search && p.name.toLowerCase().indexOf(state.search.toLowerCase()) === -1) return false;
      if (state.selectedCategory !== "all" && p.category !== state.selectedCategory) return false;
      if (state.priceMin != null && p.price < state.priceMin) return false;
      if (state.priceMax != null && p.price > state.priceMax) return false;
      return true;
    });
  }

  async function loadCategories() {
  try {
    const data = await apiRequest(
      "/api/admin/categories"
    );

    const categories =
      Array.isArray(data.categories)
        ? data.categories
        : [];

    CATEGORIES = categories.map(function (category) {
      const name =
        category.name || "Unnamed Category";

      const slug =
        category.slug ||
        name.toLowerCase();

      const icon =
        CATEGORY_ICONS[slug] ||
        CATEGORY_ICONS[name.toLowerCase()] ||
        "default";

      return {
        id: category._id,
        label: name,
        icon
      };
    });

  } catch (error) {
    console.error(
      "Failed to load categories:",
      error
    );

    CATEGORIES = [];
  }
}

async function loadProducts() {
  try {
    const data = await apiRequest(
      "/api/admin/products?limit=100"
    );

    PRODUCTS =
      Array.isArray(data.products)
        ? data.products.map(normalizeProduct)
        : [];

    renderCategorySidebar();
    renderCategoryFilterMenu();
    renderFormCategoryMenu();
    renderProducts();

  } catch (error) {
    console.error(
      "Failed to load products:",
      error
    );

    PRODUCTS = [];

    renderCategorySidebar();
    renderCategoryFilterMenu();
    renderFormCategoryMenu();
    renderProducts();
  }
}

  // ---------------------------------------------------
  // RENDER — category sidebar panels
  // ---------------------------------------------------
  function renderCategorySidebar() {
    const container = document.getElementById("categorySidebarList");
    if (!container) return;

    const counts = {};
    PRODUCTS.forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });

    const allPanel = `
      <button type="button" class="category-panel${state.selectedCategory === "all" ? " is-active" : ""}" data-category="all">
        <span class="category-panel__icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.7"/><rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.7"/><rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.7"/></svg>
        </span>
        <span class="category-panel__info">
          <span class="category-panel__name">All Products</span>
          <span class="category-panel__count">${PRODUCTS.length} items</span>
        </span>
      </button>`;

    const panels = CATEGORIES.map(function (c) {
      const count = counts[c.id] || 0;
      return `
        <div class="category-panel${state.selectedCategory === c.id ? " is-active" : ""}" role="button" tabindex="0" data-category="${c.id}">
          <span class="category-panel__icon">${getCategoryIcon(c.icon)}</span>
          <span class="category-panel__info">
            <span class="category-panel__name">${escapeHtml(c.label)}</span>
            <span class="category-panel__count">${count} item${count !== 1 ? 's' : ''}</span>
          </span>
          <span class="category-panel__actions" data-category-actions="${c.id}">
            <button type="button" class="category-panel__action" data-edit-category="${c.id}" title="Edit ${escapeHtml(c.label)}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M4 20L4.6 16.5L16 5.1C16.6 4.5 17.5 4.5 18.1 5.1L18.9 5.9C19.5 6.5 19.5 7.4 18.9 8L7.5 19.4L4 20Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
            </button>
            <button type="button" class="category-panel__action category-panel__action--danger" data-delete-category="${c.id}" title="Delete ${escapeHtml(c.label)}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 7H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M9 7V4.5H15V7" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 7L7.7 19C7.75 19.6 8.25 20 8.8 20H15.2C15.75 20 16.25 19.6 16.3 19L17 7" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
            </button>
          </span>
        </div>`;
    }).join("");

    container.innerHTML = allPanel + panels;
  }

  // ---------------------------------------------------
  // RENDER — toolbar category filter dropdown
  // ---------------------------------------------------
  function renderCategoryFilterMenu() {
    const menu = document.getElementById("categoryFilterMenu");
    const label = document.getElementById("categoryFilterLabel");
    if (!menu) return;

    const allItem = `<button type="button" class="field-dropdown__item${state.selectedCategory === "all" ? " is-selected" : ""}" data-value="all">All Categories</button>`;
    const items = CATEGORIES.map(function (c) {
      return `<button type="button" class="field-dropdown__item${state.selectedCategory === c.id ? " is-selected" : ""}" data-value="${c.id}">${escapeHtml(c.label)}</button>`;
    }).join("");
    menu.innerHTML = allItem + items;

    if (label) {
      const current = CATEGORIES.find(function (c) { return c.id === state.selectedCategory; });
      label.textContent = state.selectedCategory === "all" ? "All Categories" : (current ? current.label : "All Categories");
    }
  }

  // Single entry point for changing the selected category, used by
  // both the sidebar panels and the toolbar dropdown so they stay
  // in sync with each other.
  function selectCategory(categoryId) {
    state.selectedCategory = categoryId;
    state.pages = {};
    renderCategorySidebar();
    renderCategoryFilterMenu();
    renderProducts();
  }

  function initCategoryFilterDropdown() {
    initDropdown("categoryFilterDropdown", "categoryFilterToggle", "categoryFilterMenu", function (value) {
      selectCategory(value);
    });
  }

  // ---------------------------------------------------
  // RENDER — form category dropdown (add/edit modal)
  // ---------------------------------------------------
  function renderFormTagMenu() {
    const menu = document.getElementById("formTagMenu");
    if (!menu) return;
    const items = TAG_OPTIONS.map(function (t) {
      return `<button type="button" class="field-dropdown__item" data-value="${t.id}">${t.label}</button>`;
    }).join("");
    menu.innerHTML = items + `<button type="button" class="field-dropdown__item" data-value="__custom__">+ Custom Tag</button>`;
  }

  function renderFormCategoryMenu() {
    const menu = document.getElementById("formCategoryMenu");
    if (!menu) return;
    const items = CATEGORIES.map(function (c) {
      return `<button type="button" class="field-dropdown__item" data-value="${c.id}">${escapeHtml(c.label)}</button>`;
    }).join("");
    menu.innerHTML = items + `<button type="button" class="field-dropdown__item" data-value="__create__">+ Create Category</button>`;
  }

  // ---------------------------------------------------
  // PAGINATION — 9 per page on desktop, 6 per page on mobile
  // ---------------------------------------------------
  function getPage(items, pageKey) {
    const pageSize = getPageSize();
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    let page = state.pages[pageKey] || 1;
    if (page > totalPages) page = totalPages;
    state.pages[pageKey] = page;
    const start = (page - 1) * pageSize;
    return { pageItems: items.slice(start, start + pageSize), page, totalPages };
  }

  function renderPaginationControls(pageKey, page, totalPages) {
    if (totalPages <= 1) return "";
    return `
      <div class="product-pagination" data-page-key="${pageKey}">
        <button type="button" class="product-pagination__btn" data-page-action="prev" data-page-key="${pageKey}" ${page <= 1 ? "disabled" : ""} aria-label="Previous page">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <span class="product-pagination__info">Page ${page} of ${totalPages}</span>
        <button type="button" class="product-pagination__btn" data-page-action="next" data-page-key="${pageKey}" ${page >= totalPages ? "disabled" : ""} aria-label="Next page">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>`;
  }

  // ---------------------------------------------------
  // RENDER — product grid
  // ---------------------------------------------------
  function renderProducts() {
    const container = document.getElementById("productCategorySections");
    const noResults = document.getElementById("noResultsState");
    if (!container) return;

    const filtered = getFiltered();

    // Header counts
    const productCountLabel = document.getElementById("productCountLabel");
    const categoryCountLabel = document.getElementById("categoryCountLabel");
    const activeCategories = new Set(PRODUCTS.map(function (p) { return p.category; }));
    if (productCountLabel) productCountLabel.textContent = PRODUCTS.length;
    if (categoryCountLabel) categoryCountLabel.textContent = activeCategories.size;

    if (!filtered.length) {
      container.innerHTML = "";
      if (noResults) noResults.hidden = false;
      return;
    }
    if (noResults) noResults.hidden = true;

    // If a specific category is selected, show only that category's products
    if (state.selectedCategory !== "all") {
      const category = CATEGORIES.find(c => c.id === state.selectedCategory);
      if (category) {
        const items = filtered.filter(p => p.category === state.selectedCategory);
        if (items.length > 0) {
          const { pageItems, page, totalPages } = getPage(items, category.id);
          container.innerHTML = `
            <section class="product-category">
              <div class="product-category__head">
                <span class="product-category__icon">${getCategoryIcon(category.icon)}</span>
                <h3 class="product-category__title">${escapeHtml(category.label)}</h3>
                <span class="product-category__count">${items.length}</span>
              </div>
              <div class="product-grid">
                ${pageItems.map(renderProductCard).join("")}
              </div>
              ${renderPaginationControls(category.id, page, totalPages)}
            </section>`;
        } else {
          container.innerHTML = "";
          if (noResults) noResults.hidden = false;
        }
      }
    } else {
      // "All Products": one flat, paginated grid on every screen size —
      // 9 per page on desktop, 6 per page on mobile.
      const { pageItems, page, totalPages } = getPage(filtered, "all");
      container.innerHTML = `
        <section class="product-category">
          <div class="product-grid">
            ${pageItems.map(renderProductCard).join("")}
          </div>
          ${renderPaginationControls("all", page, totalPages)}
        </section>`;
    }
  }

  function renderProductCard(p) {
    const lowStock = p.stock === 0 ? "Out of stock" : (p.stock <= 8 ? p.stock + " left" : p.stock + " in stock");
    const stockClass = p.stock <= 8 ? " is-low" : "";
    return `
      <article class="product-card" data-id="${p.id}">
        <div class="product-card__img-wrap">
         <img
  class="product-card__img"
  src="${escapeHtml(
    p.image ||
    "../assets/images/products/placeholder.png"
  )}"
  alt="${escapeHtml(p.name)}"
  onerror="this.onerror=null; this.src='../assets/images/products/placeholder.png';"
>
          <span class="admin-badge admin-badge--${p.status === "active" ? "success" : "pending"} product-card__status"> ${p.status === "active" ? "Active" : "Inactive"} </span>
         ${p.tagLabel
  ? `
    <span
      class="product-card__tag"
      style="background:${tagColor(p.tagType)}"
    >
      ${escapeHtml(p.tagLabel)}
    </span>
  `
  : ""
}
        </div>
        <div class="product-card__body">
          <h4 class="product-card__name">${escapeHtml(p.name)}</h4>
          <div class="product-card__meta">
            <span class="product-card__price">${fmtMoney(p.price)}</span>
            <span class="product-card__stock${stockClass}">${lowStock}</span>
          </div>
        </div>
        <div class="product-card__actions">
          <button type="button" class="product-card__action" data-edit-id="${p.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 20L4.6 16.5L16 5.1C16.6 4.5 17.5 4.5 18.1 5.1L18.9 5.9C19.5 6.5 19.5 7.4 18.9 8L7.5 19.4L4 20Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
            Edit
          </button>
          <button type="button" class="product-card__action product-card__action--danger" data-delete-id="${p.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 7H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M9 7V4.5H15V7" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 7L7.7 19C7.75 19.6 8.25 20 8.8 20H15.2C15.75 20 16.25 19.6 16.3 19L17 7" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
            Delete
          </button>
        </div>
      </article>`;
  }

  // ---------------------------------------------------
  // CATEGORY SIDEBAR EVENTS
  // ---------------------------------------------------
  function initCategorySidebar() {
    const container = document.getElementById("categorySidebarList");
    if (!container) return;

    container.addEventListener("click", function (e) {
      // Handle edit/delete buttons first
      const editBtn = e.target.closest("[data-edit-category]");
      if (editBtn) {
        e.stopPropagation();
        const category = CATEGORIES.find(c => c.id === editBtn.dataset.editCategory);
        if (category) openCategoryModal(category);
        return;
      }

      const deleteBtn = e.target.closest("[data-delete-category]");
      if (deleteBtn) {
        e.stopPropagation();
        openDeleteCategoryModal(deleteBtn.dataset.deleteCategory);
        return;
      }

      // Handle category selection
      const panel = e.target.closest("[data-category]");
      if (panel) {
        selectCategory(panel.dataset.category);
      }
    });

    container.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      const panel = e.target.closest("[data-category]");
      if (!panel) return;
      e.preventDefault();
      selectCategory(panel.dataset.category);
    });
  }

  // ---------------------------------------------------
  // CATEGORY MANAGEMENT MODAL
  // ---------------------------------------------------
  function openCategoryModal(category) {
    const overlay = document.getElementById("categoryModalOverlay");
    const title = document.getElementById("categoryModalTitle");
    const error = document.getElementById("categoryFormError");
    if (!overlay) return;

    document.getElementById("categoryIdInput").value = category ? category.id : "";
    document.getElementById("categoryNameInput").value = category ? category.label : "";
    document.getElementById("categoryIconInput").value = category ? category.icon : "default";

    if (error) { error.hidden = true; error.textContent = ""; }
    if (title) title.textContent = category ? "Edit Category" : "Add Category";

    overlay.classList.add("is-open");
    document.body.classList.add("notif-modal-lock");
  }

  let creatingCategoryFromProductForm = false;

  function closeCategoryModal() {
    creatingCategoryFromProductForm = false;
    const overlay = document.getElementById("categoryModalOverlay");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    document.body.classList.remove("notif-modal-lock");
  }

  function initCategoryModal() {
  const overlay =
    document.getElementById(
      "categoryModalOverlay"
    );

  const closeBtn =
    document.getElementById(
      "categoryModalClose"
    );

  const cancelBtn =
    document.getElementById(
      "categoryCancelBtn"
    );

  const addBtn =
    document.getElementById(
      "addCategoryBtn"
    );

  const form =
    document.getElementById(
      "categoryForm"
    );

  addBtn &&
    addBtn.addEventListener(
      "click",
      function () {
        openCategoryModal(null);
      }
    );

  closeBtn &&
    closeBtn.addEventListener(
      "click",
      closeCategoryModal
    );

  cancelBtn &&
    cancelBtn.addEventListener(
      "click",
      closeCategoryModal
    );

  overlay &&
    overlay.addEventListener(
      "click",
      function (e) {
        if (e.target === overlay) {
          closeCategoryModal();
        }
      }
    );

  form &&
    form.addEventListener(
      "submit",
      async function (e) {
        e.preventDefault();

        const formError =
          document.getElementById(
            "categoryFormError"
          );

        const id =
          document.getElementById(
            "categoryIdInput"
          ).value;

        const name =
          document.getElementById(
            "categoryNameInput"
          ).value.trim();

        if (!name) {
          if (formError) {
            formError.textContent =
              "Please enter a category name.";

            formError.hidden = false;
          }

          return;
        }

        const saveBtn =
          e.target.querySelector('button[type="submit"]');

        try {
          const result = await window.AdminUI.withBusy(saveBtn, () =>
            id
              ? apiRequest(`/api/admin/categories/${id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ name })
                })
              : apiRequest("/api/admin/categories", {
                  method: "POST",
                  body: JSON.stringify({ name })
                })
          );

          const savedCategory =
            result?.category || null;

          const wasCreatingFromProduct =
            creatingCategoryFromProductForm &&
            !id;

          closeCategoryModal();

          await loadCategories();

          if (
            wasCreatingFromProduct &&
            savedCategory
          ) {
            const formLabel =
              document.getElementById(
                "formCategoryLabel"
              );

            const formHidden =
              document.getElementById(
                "productCategoryInput"
              );

            if (formLabel) {
              formLabel.textContent =
                savedCategory.name ||
                name;
            }

            if (formHidden) {
              formHidden.value =
                savedCategory._id || "";
            }
          }

          refreshAll();

        } catch (error) {
          console.error(
            "Category save error:",
            error
          );

          if (formError) {
            formError.textContent =
              error.message ||
              "Unable to save category.";

            formError.hidden = false;
          }
        }
      }
    );
}

  // ---------------------------------------------------
  // DELETE CATEGORY MODAL
  // ---------------------------------------------------
  let pendingDeleteCategoryId = null;

  function openDeleteCategoryModal(categoryId) {
    const category = CATEGORIES.find(c => c.id === categoryId);
    if (!category) return;

    pendingDeleteCategoryId = categoryId;
    const overlay = document.getElementById("deleteCategoryModalOverlay");
    const text = document.getElementById("deleteCategoryModalText");
    const deleteBtn = document.getElementById("confirmDeleteCategoryBtn");
    if (!overlay) return;

    const productCount = PRODUCTS.filter(p => p.category === categoryId).length;

    if (text) {
      if (productCount > 0) {
        text.innerHTML = `Category "<strong>${escapeHtml(category.label)}</strong>" has <strong>${productCount} product${productCount !== 1 ? 's' : ''}</strong>. Deleting it will also permanently delete ${productCount !== 1 ? "all of these products" : "this product"}. This action can't be undone.`;
      } else {
        text.innerHTML = `Are you sure you want to delete category "<strong>${escapeHtml(category.label)}</strong>"? This action can't be undone.`;
      }
      if (deleteBtn) deleteBtn.disabled = false;
    }

    overlay.classList.add("is-open");
    document.body.classList.add("notif-modal-lock");
  }

  function closeDeleteCategoryModal() {
    pendingDeleteCategoryId = null;
    const overlay = document.getElementById("deleteCategoryModalOverlay");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    document.body.classList.remove("notif-modal-lock");
  }

  function initDeleteCategoryModal() {
  const overlay =
    document.getElementById(
      "deleteCategoryModalOverlay"
    );

  const cancelBtn =
    document.getElementById(
      "cancelDeleteCategoryBtn"
    );

  const deleteBtn =
    document.getElementById(
      "confirmDeleteCategoryBtn"
    );

  cancelBtn &&
    cancelBtn.addEventListener(
      "click",
      closeDeleteCategoryModal
    );

  overlay &&
    overlay.addEventListener(
      "click",
      function (e) {
        if (e.target === overlay) {
          closeDeleteCategoryModal();
        }
      }
    );

  deleteBtn &&
    deleteBtn.addEventListener(
      "click",
      async function () {
        if (!pendingDeleteCategoryId) {
          return;
        }

        const categoryId =
          pendingDeleteCategoryId;

        try {
          await window.AdminUI.withBusy(
            document.getElementById("confirmDeleteCategoryBtn"),
            () => apiRequest(`/api/admin/categories/${categoryId}`, {
              method: "DELETE"
            })
          );

          if (
            state.selectedCategory ===
            categoryId
          ) {
            state.selectedCategory = "all";
          }

          closeDeleteCategoryModal();

          await loadCategories();
          await loadProducts();

          refreshAll();

        } catch (error) {
          console.error(
            "Category delete error:",
            error
          );

          alert(
            error.message ||
            "Unable to delete category."
          );
        }
      }
    );
}

function resolveProductImage(src) {
  const placeholder =
    "../assets/images/products/placeholder.png";

  if (!src) {
    return placeholder;
  }

  const value = String(src).trim();

  if (!value) {
    return placeholder;
  }

  // Cloudinary and other external URLs
  if (
    value.startsWith("https://") ||
    value.startsWith("http://") ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  ) {
    return value;
  }

  // Protocol-relative external URL
  if (value.startsWith("//")) {
    return window.location.protocol + value;
  }

  // Already relative to the admin page
  if (value.startsWith("../")) {
    return value;
  }

  // Stored as assets/images/...
  if (value.startsWith("assets/")) {
    return `../${value}`;
  }

  // Stored as /assets/images/...
  if (value.startsWith("/assets/")) {
    return `..${value}`;
  }

  // Only a filename was stored
  if (!value.includes("/")) {
    return `../assets/images/products/${value}`;
  }

  return value;
}

  // ---------------------------------------------------
  // ADD / EDIT PRODUCT MODAL
  // ---------------------------------------------------
function updateImagePreview(src) {
  const preview =
    document.getElementById(
      "productImagePreviewImg"
    );

  const placeholder =
    document.getElementById(
      "imageUploadPlaceholder"
    );

  if (!preview || !placeholder) {
    return;
  }

  const imageSrc =
    resolveProductImage(src);

  if (!imageSrc) {
    preview.removeAttribute("src");
    preview.hidden = true;
    placeholder.hidden = false;
    return;
  }

  preview.src = imageSrc;
  preview.hidden = false;
  placeholder.hidden = true;

  preview.onerror = function () {
    console.warn(
      "Product image failed to load:",
      imageSrc
    );

    preview.hidden = true;
    placeholder.hidden = false;
  };
}

  function openProductModal(product) {
  const overlay =
    document.getElementById(
      "productModalOverlay"
    );

  const title =
    document.getElementById(
      "productModalTitle"
    );

  const error =
    document.getElementById(
      "productFormError"
    );

  if (!overlay) return;

  const idInput =
    document.getElementById(
      "productIdInput"
    );

  const nameInput =
    document.getElementById(
      "productNameInput"
    );

  const priceInput =
    document.getElementById(
      "productPriceInput"
    );

  const stockInput =
    document.getElementById(
      "productStockInput"
    );

  const imageInput =
    document.getElementById(
      "productImageInput"
    );

  const categoryLabel =
    document.getElementById(
      "formCategoryLabel"
    );

  const categoryInput =
    document.getElementById(
      "productCategoryInput"
    );

  const statusLabel =
    document.getElementById(
      "formStatusLabel"
    );

  const statusInput =
    document.getElementById(
      "productStatusInput"
    );

  const tagLabel =
    document.getElementById(
      "formTagLabel"
    );

  const tagTypeInput =
    document.getElementById(
      "productTagTypeInput"
    );

  const tagLabelInput =
    document.getElementById(
      "productTagLabelInput"
    );

  const fileInput =
    document.getElementById(
      "productImageFile"
    );

  if (idInput) {
    idInput.value =
      product?.id || "";
  }

  if (nameInput) {
    nameInput.value =
      product?.name || "";
  }

  if (priceInput) {
    priceInput.value =
      product
        ? product.price
        : "";
  }

  if (stockInput) {
    stockInput.value =
      product
        ? product.stock
        : "";
  }

  const imageVal =
    product?.image || "";

  if (imageInput) {
    imageInput.value =
      imageVal;
  }

  updateImagePreview(
    imageVal
  );

  if (fileInput) {
    fileInput.value = "";
  }

  const category =
    product
      ? CATEGORIES.find(
          function (c) {
            return c.id ===
              product.category;
          }
        )
      : null;

  if (categoryLabel) {
    categoryLabel.textContent =
      category
        ? category.label
        : "Select category";
  }

  if (categoryInput) {
    categoryInput.value =
      category
        ? category.id
        : "";
  }

  const status =
    product?.status ||
    "active";

  if (statusLabel) {
    statusLabel.textContent =
      status === "active"
        ? "Active"
        : "Inactive";
  }

  if (statusInput) {
    statusInput.value =
      status;
  }

  const tagType =
    product?.tagType || "";

  const tagText =
    product?.tagLabel || "";

  if (tagLabel) {
    tagLabel.textContent =
      tagText || "No Tag";
  }

  if (tagTypeInput) {
    tagTypeInput.value =
      tagType;
  }

  if (tagLabelInput) {
    tagLabelInput.value =
      tagText;
  }

  if (error) {
    error.hidden = true;
    error.textContent = "";
  }

  if (title) {
    title.textContent =
      product
        ? "Edit Product"
        : "Add Product";
  }

  overlay.classList.add(
    "is-open"
  );

  document.body.classList.add(
    "notif-modal-lock"
  );
}

  function closeProductModal() {
    const overlay = document.getElementById("productModalOverlay");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    document.body.classList.remove("notif-modal-lock");
  }

  async function initProductModal() {
    const overlay = document.getElementById("productModalOverlay");
    const closeBtn = document.getElementById("productModalClose");
    const cancelBtn = document.getElementById("productCancelBtn");
    const addBtn = document.getElementById("addProductBtn");
    const addBtnMobile = document.getElementById("addProductBtnMobile");
    const form = document.getElementById("productForm");

    addBtn && addBtn.addEventListener("click", function () { openProductModal(null); });
    addBtnMobile && addBtnMobile.addEventListener("click", function () { openProductModal(null); });
    closeBtn && closeBtn.addEventListener("click", closeProductModal);
    cancelBtn && cancelBtn.addEventListener("click", closeProductModal);
    overlay && overlay.addEventListener("click", function (e) { if (e.target === overlay) closeProductModal(); });

const uploadBtn =
  document.getElementById("imageUploadBtn");

const fileInput =
  document.getElementById("productImageFile");

const imageInput =
  document.getElementById("productImageInput");

uploadBtn &&
  fileInput &&
  uploadBtn.addEventListener(
    "click",
    function () {
      fileInput.click();
    }
  );

fileInput &&
  fileInput.addEventListener(
    "change",
    async function () {
      const file =
        fileInput.files &&
        fileInput.files[0];

      if (!file) {
        return;
      }

      const formError =
        document.getElementById(
          "productFormError"
        );

      // Reset previous error
      if (formError) {
        formError.hidden = true;
        formError.textContent = "";
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        if (formError) {
          formError.textContent =
            "Please select a valid image file.";

          formError.hidden = false;
        }

        fileInput.value = "";
        return;
      }

      // Match backend's 5 MB limit
      const maxSize =
        5 * 1024 * 1024;

      if (file.size > maxSize) {
        if (formError) {
          formError.textContent =
            "Image must be 5 MB or smaller.";

          formError.hidden = false;
        }

        fileInput.value = "";
        return;
      }

      try {
        if (formError) {
          formError.hidden = false;
          formError.textContent =
            "Uploading image...";
        }

        window.AdminUI.setBusy(uploadBtn, true);
        uploadBtn.disabled = true;

        const formData =
          new FormData();

        formData.append(
          "image",
          file
        );

        const result =
          await apiRequest(
            "/api/admin/products/upload-image",
            {
              method: "POST",
              body: formData
            }
          );

        if (
          !result ||
          !result.image
        ) {
          throw new Error(
            "Image upload did not return an image URL."
          );
        }

        // Store the Cloudinary HTTPS URL
        // in the hidden product image field.
        if (imageInput) {
          imageInput.value =
            result.image;
        }

        // Show the actual Cloudinary image
        // immediately in the preview.
        updateImagePreview(
          result.image
        );

        if (formError) {
          formError.hidden = true;
          formError.textContent = "";
        }

      } catch (error) {
        console.error(
          "Product image upload error:",
          error
        );

        if (formError) {
          formError.textContent =
            error.message ||
            "Unable to upload image.";

          formError.hidden = false;
        }

        if (imageInput) {
          imageInput.value = "";
        }

        updateImagePreview("");

        fileInput.value = "";

      } finally {
        window.AdminUI.setBusy(uploadBtn, false);
        uploadBtn.disabled = false;
      }
    }
  );

    form &&
  form.addEventListener(
    "submit",
    async function (e) {
      e.preventDefault();

      const formError =
        document.getElementById(
          "productFormError"
        );

      if (formError) {
        formError.hidden = true;
        formError.textContent = "";
      }

      const id =
        document.getElementById(
          "productIdInput"
        ).value;

      const name =
        document.getElementById(
          "productNameInput"
        ).value.trim();

      const category =
        document.getElementById(
          "productCategoryInput"
        ).value;

      const status =
        document.getElementById(
          "productStatusInput"
        ).value || "active";

      const price =
        parseFloat(
          document.getElementById(
            "productPriceInput"
          ).value
        );

      const stock =
        parseInt(
          document.getElementById(
            "productStockInput"
          ).value,
          10
        );

      const image =
        document.getElementById(
          "productImageInput"
        ).value.trim();

      const tagType =
        document.getElementById(
          "productTagTypeInput"
        ).value;

      const tagLabel =
        document.getElementById(
          "productTagLabelInput"
        ).value.trim();

      if (
        !name ||
        !category ||
        !Number.isFinite(price) ||
        !Number.isInteger(stock)
      ) {
        if (formError) {
          formError.textContent =
            "Please fill in product name, category, price, and stock.";

          formError.hidden = false;
        }

        return;
      }

      if (!id && !image) {
        if (formError) {
          formError.textContent =
            "Please select a product image.";

          formError.hidden = false;
        }

        return;
      }

      const payload = {
        name,
        category,
        status,
        price,
        stock,
        image,
        tagType,
        tagLabel
      };

      const saveBtn =
        e.target.querySelector('button[type="submit"]');

      try {
        await window.AdminUI.withBusy(saveBtn, () =>
          id
            ? apiRequest(`/api/admin/products/${id}`, {
                method: "PATCH",
                body: JSON.stringify(payload)
              })
            : apiRequest("/api/admin/products", {
                method: "POST",
                body: JSON.stringify(payload)
              })
        );

        closeProductModal();

        await loadProducts();

        refreshAll();

      } catch (error) {
        console.error(
          "Product save error:",
          error
        );

        if (formError) {
          formError.textContent =
            error.message ||
            "Unable to save product.";

          formError.hidden = false;
        }
      }
    }
  );
  }

  // ---------------------------------------------------
  // DELETE PRODUCT MODAL
  // ---------------------------------------------------
  let pendingDeleteId = null;

  function openConfirmModal(id) {
    pendingDeleteId = id;
    const overlay = document.getElementById("confirmModalOverlay");
    if (!overlay) return;
    overlay.classList.add("is-open");
    document.body.classList.add("notif-modal-lock");
  }

  function closeConfirmModal() {
    pendingDeleteId = null;
    const overlay = document.getElementById("confirmModalOverlay");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    document.body.classList.remove("notif-modal-lock");
  }

  function initConfirmModal() {
    const overlay = document.getElementById("confirmModalOverlay");
    const cancelBtn = document.getElementById("confirmCancelBtn");
    const deleteBtn = document.getElementById("confirmDeleteBtn");

    cancelBtn && cancelBtn.addEventListener("click", closeConfirmModal);
    overlay && overlay.addEventListener("click", function (e) { if (e.target === overlay) closeConfirmModal(); });

    deleteBtn && deleteBtn.addEventListener(
  "click",
  async function () {
    if (!pendingDeleteId) return;

    const productId = pendingDeleteId;

    try {
      await window.AdminUI.withBusy(
        document.getElementById("confirmDeleteBtn"),
        () => apiRequest(`/api/admin/products/${productId}`, {
          method: "DELETE"
        })
      );

      closeConfirmModal();

      await loadProducts();

    } catch (error) {
      console.error(
        "Product delete error:",
        error
      );

      alert(
        error.message ||
        "Unable to delete product."
      );
    }
  }
);
  }

  // ---------------------------------------------------
  // GRID ACTIONS
  // ---------------------------------------------------
  function initGridActions() {
    const container = document.getElementById("productCategorySections");
    if (!container) return;

    container.addEventListener("click", function (e) {
      const editBtn = e.target.closest("[data-edit-id]");
      if (editBtn) {
        const product = PRODUCTS.find(function (p) { return p.id === editBtn.dataset.editId; });
        if (product) openProductModal(product);
        return;
      }
      const deleteBtn = e.target.closest("[data-delete-id]");
      if (deleteBtn) {
        openConfirmModal(deleteBtn.dataset.deleteId);
        return;
      }
      const pageBtn = e.target.closest("[data-page-action]");
      if (pageBtn && !pageBtn.disabled) {
        const key = pageBtn.dataset.pageKey;
        const delta = pageBtn.dataset.pageAction === "next" ? 1 : -1;
        state.pages[key] = (state.pages[key] || 1) + delta;
        renderProducts();
      }
    });

    // Re-render if the viewport crosses the mobile breakpoint
    // (e.g. rotating a tablet) so pagination turns on/off cleanly.
    let lastIsMobile = isMobileView();
    window.addEventListener("resize", function () {
      const nowMobile = isMobileView();
      if (nowMobile !== lastIsMobile) {
        lastIsMobile = nowMobile;
        renderProducts();
      }
    });
  }

  // ---------------------------------------------------
  // FILTER TOOLBAR
  // ---------------------------------------------------
  function initFilterToolbar() {
    const searchInput = document.getElementById("productSearchInput");
    const priceMin = document.getElementById("priceMinInput");
    const priceMax = document.getElementById("priceMaxInput");
    const clearBtn = document.getElementById("clearFiltersBtn");

    searchInput && searchInput.addEventListener("input", function () {
      state.search = searchInput.value.trim();
      state.pages = {};
      renderProducts();
    });

    priceMin && priceMin.addEventListener("input", function () {
      state.priceMin = priceMin.value === "" ? null : parseFloat(priceMin.value);
      state.pages = {};
      renderProducts();
    });
    priceMax && priceMax.addEventListener("input", function () {
      state.priceMax = priceMax.value === "" ? null : parseFloat(priceMax.value);
      state.pages = {};
      renderProducts();
    });

    clearBtn && clearBtn.addEventListener("click", function () {
      state.search = "";
      state.selectedCategory = "all";
      state.priceMin = null;
      state.priceMax = null;
      state.pages = {};
      if (searchInput) searchInput.value = "";
      if (priceMin) priceMin.value = "";
      if (priceMax) priceMax.value = "";
      renderCategorySidebar();
      renderCategoryFilterMenu();
      renderProducts();
    });
  }

  // ---------------------------------------------------
  // FORM DROPDOWNS
  // ---------------------------------------------------
  function initDropdown(wrapId, toggleId, menuId, onSelect) {
    const wrap = document.getElementById(wrapId);
    const toggle = document.getElementById(toggleId);
    const menu = document.getElementById(menuId);
    if (!wrap || !toggle || !menu) return;

    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      wrap.classList.toggle("is-open");
    });

    menu.addEventListener("click", function (e) {
      const item = e.target.closest(".field-dropdown__item");
      if (!item) return;
      onSelect(item.dataset.value, item);
      wrap.classList.remove("is-open");
    });
  }

  function closeAllDropdowns(except) {
    document.querySelectorAll(".field-dropdown.is-open").forEach(function (d) {
      if (d !== except) d.classList.remove("is-open");
    });
  }

  function initGlobalDropdownClose() {
    document.addEventListener("click", function () { closeAllDropdowns(null); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAllDropdowns(null);
    });
  }

  function initFormCategoryDropdown() {
    initDropdown("formCategoryDropdown", "formCategoryToggle", "formCategoryMenu", function (value, item) {
      if (value === "__create__") {
        creatingCategoryFromProductForm = true;
        openCategoryModal(null);
        return;
      }
      const label = document.getElementById("formCategoryLabel");
      const hidden = document.getElementById("productCategoryInput");
      const cat = CATEGORIES.find(c => c.id === value);
      if (label && cat) label.textContent = cat.label;
      if (hidden) hidden.value = value;
    });
  }

  function initFormStatusDropdown() {
    initDropdown("formStatusDropdown", "formStatusToggle", "formStatusMenu", function (value, item) {
      const label = document.getElementById("formStatusLabel");
      const hidden = document.getElementById("productStatusInput");
      if (label) label.textContent = item.textContent;
      if (hidden) hidden.value = value;
    });
  }

  function initFormTagDropdown() {
    initDropdown("formTagDropdown", "formTagToggle", "formTagMenu", function (value) {
      if (value === "__custom__") {
        openTagModal();
        return;
      }
      const label = document.getElementById("formTagLabel");
      const typeInput = document.getElementById("productTagTypeInput");
      const labelInput = document.getElementById("productTagLabelInput");
      const opt = TAG_OPTIONS.find(function (t) { return t.id === value; });
      if (label && opt) label.textContent = opt.label;
      if (typeInput) typeInput.value = value;
      if (labelInput && opt) labelInput.value = opt.label;
    });
  }

  // ---------------------------------------------------
  // CUSTOM TAG MODAL
  // ---------------------------------------------------
  function openTagModal() {
    const overlay = document.getElementById("tagModalOverlay");
    if (!overlay) return;
    const input = document.getElementById("tagCustomLabelInput");
    if (input) input.value = "";
    const error = document.getElementById("tagFormError");
    if (error) { error.hidden = true; error.textContent = ""; }
    overlay.classList.add("is-open");
    document.body.classList.add("notif-modal-lock");
  }

  function closeTagModal() {
    const overlay = document.getElementById("tagModalOverlay");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    document.body.classList.remove("notif-modal-lock");
  }

  function initTagModal() {
    const overlay = document.getElementById("tagModalOverlay");
    const closeBtn = document.getElementById("tagModalClose");
    const cancelBtn = document.getElementById("tagCancelBtn");
    const form = document.getElementById("tagForm");

    closeBtn && closeBtn.addEventListener("click", closeTagModal);
    cancelBtn && cancelBtn.addEventListener("click", closeTagModal);
    overlay && overlay.addEventListener("click", function (e) { if (e.target === overlay) closeTagModal(); });

    form && form.addEventListener("submit", function (e) {
      e.preventDefault();
      const error = document.getElementById("tagFormError");
      const text = document.getElementById("tagCustomLabelInput").value.trim();
      if (!text) {
        if (error) { error.textContent = "Please enter a tag name."; error.hidden = false; }
        return;
      }
      const label = document.getElementById("formTagLabel");
      const typeInput = document.getElementById("productTagTypeInput");
      const labelInput = document.getElementById("productTagLabelInput");
      if (label) label.textContent = text;
      if (typeInput) typeInput.value = "";
      if (labelInput) labelInput.value = text;
      closeTagModal();
    });
  }

  // ---------------------------------------------------
  // REFRESH ALL
  // ---------------------------------------------------
  function refreshAll() {
    renderCategorySidebar();
    renderCategoryFilterMenu();
    renderFormCategoryMenu();
    renderFormTagMenu();
    renderProducts();
  }
// ---------------------------------------------------
  // NOTIFICATIONS — REAL BACKEND
  // ---------------------------------------------------
  let NOTIFICATIONS = [];
  let NOTIFICATION_UNREAD_COUNT = 0;

  const NOTIF_ICONS = {
    order: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 8H20L19 20H5L4 8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 8V6C8 3.79 9.79 2 12 2C14.21 2 16 3.79 16 6V8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    payment: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="5.5" width="18" height="13" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3 9.5H21" stroke="currentColor" stroke-width="1.6"/></svg>',
    stock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 8L12 3L21 8V16L12 21L3 16V8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  };

  function normalizeNotificationType(type) {
    switch (type) {
      case "new_order":
      case "order_status":
        return "order";
      case "payment_success":
      case "payment_failed":
      case "refund":
        return "payment";
      case "low_stock":
        return "stock";
      default:
        return "order";
    }
  }

  function formatNotificationTime(dateValue) {
    if (!dateValue) return "—";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "—";

    const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  async function loadNotifications() {
    try {
      const data = await apiRequest("/api/admin/notifications?limit=100");
      const notifications = Array.isArray(data.notifications) ? data.notifications : [];

      NOTIFICATIONS = notifications.map(function (notification) {
        return {
          id: notification._id,
          type: normalizeNotificationType(notification.type),
          title: notification.title || "Notification",
          text: notification.message || "",
          time: formatNotificationTime(notification.createdAt),
          unread: notification.isRead !== true,
          rawType: notification.type,
          order: notification.order || null,
          transaction: notification.transaction || null,
          product: notification.product || null
        };
      });

      NOTIFICATION_UNREAD_COUNT = Number.isFinite(Number(data.unreadCount))
        ? Number(data.unreadCount)
        : NOTIFICATIONS.filter(function (n) { return n.unread; }).length;

      renderNotifications();
    } catch (error) {
      console.error("Failed to load notifications:", error);
      NOTIFICATIONS = [];
      NOTIFICATION_UNREAD_COUNT = 0;
      renderNotifications();
    }
  }

  function renderNotifications() {
    const list = document.getElementById("notifList");
    if (list) {
      list.innerHTML = !NOTIFICATIONS.length
        ? `<div class="dash-empty">No notifications.</div>`
        : NOTIFICATIONS.map(function (n) {
            return `
              <div class="admin-notif__item${n.unread ? " is-unread" : ""}" data-notif-id="${n.id}">
                <span class="admin-notif__icon">${NOTIF_ICONS[n.type] || ""}</span>
                <span class="admin-notif__body">
                  <span class="admin-notif__title">${escapeHtml(n.title)}</span>
                  <span class="admin-notif__text">${escapeHtml(n.text)}</span>
                  <span class="admin-notif__time">${escapeHtml(n.time)}</span>
                </span>
                <button type="button" class="admin-notif__dismiss" data-dismiss-id="${n.id}" aria-label="Dismiss notification">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>
              </div>`;
          }).join("");
    }

    const bellBadge = document.getElementById("bellBadge");
    const sidebarBadge = document.getElementById("sidebarNotifCount");
    const badgeText = String(NOTIFICATION_UNREAD_COUNT);

    if (bellBadge) {
      bellBadge.textContent = badgeText;
      bellBadge.style.display = NOTIFICATION_UNREAD_COUNT ? "" : "none";
    }
    if (sidebarBadge) {
      sidebarBadge.textContent = badgeText;
      sidebarBadge.style.display = NOTIFICATION_UNREAD_COUNT ? "" : "none";
    }
  }

  async function markNotificationAsRead(id) {
    const n = NOTIFICATIONS.find(function (item) { return item.id === id; });
    if (!n || !n.unread) return;

    try {
      await apiRequest(`/api/admin/notifications/${id}/read`, { method: "PATCH" });
      n.unread = false;
      NOTIFICATION_UNREAD_COUNT = Math.max(0, NOTIFICATION_UNREAD_COUNT - 1);
      renderNotifications();
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }

  async function dismissNotification(id) {
    const index = NOTIFICATIONS.findIndex(function (n) { return n.id === id; });
    if (index === -1) return;

    const n = NOTIFICATIONS[index];
    try {
      await apiRequest(`/api/admin/notifications/${id}`, { method: "DELETE" });
      if (n.unread) NOTIFICATION_UNREAD_COUNT = Math.max(0, NOTIFICATION_UNREAD_COUNT - 1);
      NOTIFICATIONS.splice(index, 1);
      renderNotifications();
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  }

  function openNotifModal(n) {
    const overlay = document.getElementById("notifModalOverlay");
    const icon = document.getElementById("notifModalIcon");
    const title = document.getElementById("notifModalTitle");
    const text = document.getElementById("notifModalText");
    const time = document.getElementById("notifModalTime");
    if (!overlay) return;
    if (icon) icon.innerHTML = NOTIF_ICONS[n.type] || "";
    if (title) title.textContent = n.title;
    if (text) text.textContent = n.text;
    if (time) time.textContent = n.time;
    overlay.classList.add("is-open");
    document.body.classList.add("notif-modal-lock");
  }

  function closeNotifModal() {
    const overlay = document.getElementById("notifModalOverlay");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    document.body.classList.remove("notif-modal-lock");
  }

  function initNotifModal() {
    const overlay = document.getElementById("notifModalOverlay");
    const closeBtn = document.getElementById("notifModalClose");
    if (!overlay) return;
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeNotifModal();
    });
    if (closeBtn) closeBtn.addEventListener("click", closeNotifModal);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNotifModal();
    });
  }

  function initNotifDropdown() {
    const notif = document.getElementById("adminNotif");
    const toggle = document.getElementById("notifBellBtn");
    const menu = notif ? notif.querySelector(".admin-notif__menu") : null;
    if (!notif || !toggle) return;

    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      const opening = !notif.classList.contains("is-open");
      if (opening && window.AdminUI && window.AdminUI.closeOtherPanels) window.AdminUI.closeOtherPanels(notif);
      notif.classList.toggle("is-open");
      if (opening && window.AdminUI && window.AdminUI.positionDropdown) window.AdminUI.positionDropdown(toggle, menu);
    });

    document.addEventListener("click", function (e) {
      if (!notif.contains(e.target)) notif.classList.remove("is-open");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") notif.classList.remove("is-open");
    });
    window.addEventListener("resize", function () {
      if (notif.classList.contains("is-open") && window.AdminUI && window.AdminUI.positionDropdown) {
        window.AdminUI.positionDropdown(toggle, menu);
      }
    });

    notif.addEventListener("click", function (e) {
      const dismissBtn = e.target.closest(".admin-notif__dismiss");
      if (dismissBtn) {
        e.stopPropagation();
        dismissNotification(dismissBtn.dataset.dismissId);
        return;
      }

      const item = e.target.closest(".admin-notif__item");
      if (!item) return;
      const n = NOTIFICATIONS.find(function (x) { return x.id === item.dataset.notifId; });
      if (!n) return;

      if (n.unread) markNotificationAsRead(n.id);
      notif.classList.remove("is-open");
      if (typeof openNotifModal === "function") openNotifModal(n);
      else renderNotifications();
    });
  }

  async function init() {
  await loadCategories();

  renderCategorySidebar();
  renderCategoryFilterMenu();
  renderFormCategoryMenu();
  renderFormTagMenu();

  await loadProducts();

  initFilterToolbar();
  initCategoryFilterDropdown();
  initGlobalDropdownClose();
  initFormCategoryDropdown();
  initFormStatusDropdown();
  initFormTagDropdown();
  initTagModal();
  initProductModal();
  initConfirmModal();
  initCategoryModal();
  initDeleteCategoryModal();
  initGridActions();
  initCategorySidebar();

  await loadNotifications();
  initNotifDropdown();
  initNotifModal();
}

  document.addEventListener("DOMContentLoaded", init);
})();