/* =====================================================
   BUD N' BUDDER — ADMIN — admin-transactions.js
   ===================================================== */

(function () {
  "use strict";

    const API_BASE_URL = "http://https://budnbudder-backend.onrender.com";

  // ---------------------------------------------------
  // DATA — replace this block with a fetch()/API call.
  // Keep the same shape and the render functions below
  // will work unchanged.
  // ---------------------------------------------------
  const STATUS_LABELS = {
  success: "Completed",
  pending: "Pending",
  failed: "Failed",
  refunded: "Refunded"
};

  let TRANSACTIONS = [];

  // ---------------------------------------------------
// HELPERS
// ---------------------------------------------------

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
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
      data?.error ||
      `Request failed with status ${response.status}`
    );
  }

  return data;
}

  // ---------------------------------------------------
  // HELPERS
  // ---------------------------------------------------
  function fmtMoney(n) { return "$" + Number(n).toFixed(2); }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function normalizeTransaction(t) {
  const order =
    t.order && typeof t.order === "object"
      ? t.order
      : {};

  const user =
    t.user && typeof t.user === "object"
      ? t.user
      : {};

  const orderCustomer =
    order.customer &&
    typeof order.customer === "object"
      ? order.customer
      : {};

  const customerName =
    [
      user.firstName || orderCustomer.firstName,
      user.lastName || orderCustomer.lastName
    ]
      .filter(Boolean)
      .join(" ");

  return {
    id: t.transactionId || t._id || "",
    mongoId: t._id || "",

    title:
      t.title ||
      (order.orderNumber
        ? `Order ${order.orderNumber} payment`
        : "Transaction"),

    description:
      t.description ||
      "",

    orderId:
      order.orderNumber ||
      (typeof t.order === "string" ? t.order : "—"),

    orderBackendId:
      order._id ||
      (typeof t.order === "string" ? t.order : ""),

    date:
      t.createdAt ||
      t.updatedAt ||
      "",

    method:
      t.method ||
      t.provider ||
      "—",

    amount:
      Number(t.amount || 0),

    currency:
      t.currency ||
      "USD",

    type:
      t.type === "debit"
        ? "debit"
        : "credit",

    status:
      t.status ||
      "pending",

    provider:
      t.provider ||
      "",

    providerReference:
      t.providerReference ||
      "",

    customer: {
      name:
        customerName ||
        "Guest",

      email:
        user.email ||
        orderCustomer.email ||
        ""
    },

    order: order
  };
}

  const DAY = 24 * 60 * 60 * 1000;
  function daysAgoFromDate(d) { return (Date.now() - d.getTime()) / DAY; }

  function formatTransactionDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

  // ---------------------------------------------------
  // STATE
  // ---------------------------------------------------
  const state = {
    search: "",
    type: "all",       // all | credit | debit
    status: "all",      // all | success | pending | danger
    provider: "all",
    dateRange: "all",   // all | today | week | month
    amountMin: null,
    amountMax: null,
    page: 1
  };

  function applyUrlFilters() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("provider")) state.provider = params.get("provider").toLowerCase();
    if (params.get("status")) state.status = params.get("status").toLowerCase();
  }

  async function loadTransactions() {
  try {
    const data = await apiRequest(
      "/api/admin/transactions?limit=100&page=1"
    );

    TRANSACTIONS =
      Array.isArray(data.transactions)
        ? data.transactions.map(normalizeTransaction)
        : [];

    state.page = 1;

    renderTypeFilterMenu();
    renderStatusFilterMenu();
    renderDateFilterMenu();
    renderTxnsTable();

  } catch (error) {
    console.error(
      "Failed to load transactions:",
      error
    );

    TRANSACTIONS = [];

    const body =
      document.getElementById("txnsTableBody");

    const noResults =
      document.getElementById("noTxnsState");

    if (body) {
      body.innerHTML = `
        <tr>
          <td
            colspan="5"
            class="dash-empty"
          >
            Unable to load transactions.
            Please refresh the page and try again.
          </td>
        </tr>
      `;
    }

    if (noResults) {
      noResults.hidden = true;
    }

    renderPaginationControls(1, 1);
  }
}

  function isMobileView() { return window.matchMedia("(max-width: 640px)").matches; }
  function getPageSize() { return isMobileView() ? 6 : 8; }

  const TYPE_OPTIONS = [
    { value: "all", label: "All Types" },
    { value: "credit", label: "Credit" },
    { value: "debit", label: "Debit" }
  ];

  const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "success", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" }
];

  const DATE_OPTIONS = [
    { value: "all", label: "All Time" },
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" }
  ];

  // ---------------------------------------------------
  // FILTERING
  // ---------------------------------------------------
  function getFiltered() {
    return TRANSACTIONS.filter(function (t) {
      if (state.provider !== "all" && String(t.provider || "").toLowerCase() !== state.provider) return false;
      if (state.search) {
  const q = state.search.toLowerCase();

  const matchesId =
    String(t.id || "")
      .toLowerCase()
      .includes(q);

  const matchesTitle =
    String(t.title || "")
      .toLowerCase()
      .includes(q);

  const matchesDescription =
    String(t.description || "")
      .toLowerCase()
      .includes(q);

  const matchesOrder =
    String(t.orderId || "")
      .toLowerCase()
      .includes(q);

  const matchesProviderReference =
    String(t.providerReference || "")
      .toLowerCase()
      .includes(q);

  const matchesCustomer =
    String(t.customer?.name || "")
      .toLowerCase()
      .includes(q);

  const matchesEmail =
    String(t.customer?.email || "")
      .toLowerCase()
      .includes(q);

  if (
    !matchesId &&
    !matchesTitle &&
    !matchesDescription &&
    !matchesOrder &&
    !matchesProviderReference &&
    !matchesCustomer &&
    !matchesEmail
  ) {
    return false;
  }
}
      if (state.type !== "all" && t.type !== state.type) return false;
      if (state.status !== "all" && t.status !== state.status) return false;

      if (state.dateRange !== "all") {
  const transactionDate = new Date(t.date);

  if (Number.isNaN(transactionDate.getTime())) {
    return false;
  }

  const now = new Date();

  if (state.dateRange === "today") {
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    if (transactionDate < startOfToday) {
      return false;
    }
  }

  if (state.dateRange === "week") {
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();

    startOfWeek.setDate(
      startOfWeek.getDate() - day
    );

    startOfWeek.setHours(
      0,
      0,
      0,
      0
    );

    if (transactionDate < startOfWeek) {
      return false;
    }
  }

  if (state.dateRange === "month") {
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    if (transactionDate < startOfMonth) {
      return false;
    }
  }
}

      if (state.amountMin != null && t.amount < state.amountMin) return false;
      if (state.amountMax != null && t.amount > state.amountMax) return false;

      return true;
    });
  }

  // ---------------------------------------------------
  // RENDER — filter dropdown menus
  // ---------------------------------------------------
  function renderTypeFilterMenu() {
    const menu = document.getElementById("typeFilterMenu");
    const label = document.getElementById("typeFilterLabel");
    if (!menu) return;
    menu.innerHTML = TYPE_OPTIONS.map(function (opt) {
      return `<button type="button" class="field-dropdown__item${state.type === opt.value ? " is-selected" : ""}" data-value="${opt.value}">${opt.label}</button>`;
    }).join("");
    if (label) {
      const current = TYPE_OPTIONS.find(function (o) { return o.value === state.type; });
      label.textContent = current ? current.label : "All Types";
    }
  }

  function renderStatusFilterMenu() {
    const menu = document.getElementById("statusFilterMenu");
    const label = document.getElementById("statusFilterLabel");
    if (!menu) return;
    menu.innerHTML = STATUS_OPTIONS.map(function (opt) {
      return `<button type="button" class="field-dropdown__item${state.status === opt.value ? " is-selected" : ""}" data-value="${opt.value}">${opt.label}</button>`;
    }).join("");
    if (label) {
      const current = STATUS_OPTIONS.find(function (o) { return o.value === state.status; });
      label.textContent = current ? current.label : "All Statuses";
    }
  }

  function renderDateFilterMenu() {
    const menu = document.getElementById("dateFilterMenu");
    const label = document.getElementById("dateFilterLabel");
    if (!menu) return;
    menu.innerHTML = DATE_OPTIONS.map(function (opt) {
      return `<button type="button" class="field-dropdown__item${state.dateRange === opt.value ? " is-selected" : ""}" data-value="${opt.value}">${opt.label}</button>`;
    }).join("");
    if (label) {
      const current = DATE_OPTIONS.find(function (o) { return o.value === state.dateRange; });
      label.textContent = current ? current.label : "All Time";
    }
  }

  // ---------------------------------------------------
  // PAGINATION
  // ---------------------------------------------------
  function getPage(items) {
    const pageSize = getPageSize();
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    let page = state.page || 1;
    if (page > totalPages) page = totalPages;
    state.page = page;
    const start = (page - 1) * pageSize;
    return { pageItems: items.slice(start, start + pageSize), page, totalPages };
  }

  function renderPaginationControls(page, totalPages) {
    const container = document.getElementById("txnsPagination");
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ""; return; }
    container.innerHTML = `
      <div class="order-pagination">
        <button type="button" class="order-pagination__btn" data-page-action="prev" ${page <= 1 ? "disabled" : ""} aria-label="Previous page">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <span class="order-pagination__info">Page ${page} of ${totalPages}</span>
        <button type="button" class="order-pagination__btn" data-page-action="next" ${page >= totalPages ? "disabled" : ""} aria-label="Next page">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>`;
  }

  // ---------------------------------------------------
  // RENDER — header counts
  // ---------------------------------------------------
  function renderHeaderCounts() {
    const countLabel = document.getElementById("txnCountLabel");
    const netLabel = document.getElementById("txnNetLabel");
    if (countLabel) countLabel.textContent = TRANSACTIONS.length;
    if (netLabel) {
      const net = TRANSACTIONS.reduce(function (sum, t) {
        return sum + (t.type === "credit" ? t.amount : -t.amount);
      }, 0);
      netLabel.textContent = (net < 0 ? "-" : "") + fmtMoney(Math.abs(net));
    }
  }

  // ---------------------------------------------------
  // RENDER — transactions table
  // ---------------------------------------------------
  function renderTxnsTable() {
    const body = document.getElementById("txnsTableBody");
    const noResults = document.getElementById("noTxnsState");
    if (!body) return;

    renderHeaderCounts();

    const filtered = getFiltered();

    if (!filtered.length) {
  body.innerHTML = "";

  if (noResults) {
    noResults.hidden = false;

    noResults.textContent =
      TRANSACTIONS.length
        ? "No transactions match your current filters."
        : "No transactions have been recorded yet.";
  }

  renderPaginationControls(1, 1);
  return;
}
    if (noResults) noResults.hidden = true;

    const { pageItems, page, totalPages } = getPage(filtered);

    body.innerHTML = pageItems.map(function (t) {
      const sign = t.type === "credit" ? "+" : "-";
      return `
        <tr data-txn-id="${t.id}">
          <td data-label="Description" class="txn-description">${escapeHtml(t.title)}</td>
          <td data-label="Date">${formatTransactionDate(t.date)}</td>
          <td data-label="Amount" class="txn-amount is-${t.type}">
  ${sign}${escapeHtml(t.currency)} ${fmtMoney(t.amount)}
</td>
          <td data-label="Status">
            <span class="admin-badge admin-badge--${t.status}">${STATUS_LABELS[t.status] || t.status}</span>
          </td>
          <td data-label="">
            <span class="order-row-actions">
              <button type="button" class="order-row-action" data-view-id="${t.id}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M2 12C2 12 5.5 5.5 12 5.5C18.5 5.5 22 12 22 12C22 12 18.5 18.5 12 18.5C5.5 18.5 2 12 2 12Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/></svg>
                View
              </button>
            </span>
          </td>
        </tr>`;
    }).join("");

    renderPaginationControls(page, totalPages);
  }

  // ---------------------------------------------------
  // TRANSACTION DETAIL MODAL
  // ---------------------------------------------------
  let activeTxnId = null;

  function openTxnModal(t) {
  activeTxnId = t.id;

  const overlay =
    document.getElementById("txnModalOverlay");

  if (!overlay) return;

  const title =
    document.getElementById("txnModalTitle");

  const date =
    document.getElementById("txnModalDate");

  const description =
    document.getElementById("txnModalDescription");

  const method =
    document.getElementById("txnModalMethod");

  const order =
    document.getElementById("txnModalOrder");

  const amountEl =
    document.getElementById("txnModalAmount");

  const statusBadge =
    document.getElementById("txnModalStatusBadge");

  if (title) {
    title.textContent =
      t.id || "Transaction";
  }

  if (date) {
    date.textContent =
      formatTransactionDate(t.date);
  }

  if (description) {
    description.textContent =
      t.description || "—";
  }

  if (method) {
    method.textContent =
      t.method || "—";
  }

  if (order) {
    order.textContent =
      t.orderId || "—";
  }

  if (amountEl) {
    const sign =
      t.type === "credit"
        ? "+"
        : "-";

    amountEl.textContent =
      sign + fmtMoney(t.amount);

    amountEl.className =
      "txn-modal__amount is-" +
      t.type;
  }

  if (statusBadge) {
    statusBadge.textContent =
      STATUS_LABELS[t.status] ||
      t.status ||
      "Pending";

    statusBadge.className =
      "admin-badge admin-badge--" +
      (t.status || "pending");
  }

  /*
   * Optional fields.
   *
   * These only populate if the corresponding
   * elements already exist in your HTML.
   * Therefore they will NOT break the modal
   * if you haven't added them yet.
   */

  const provider =
    document.getElementById("txnModalProvider");

  if (provider) {
    provider.textContent =
      t.provider || "—";
  }

  const providerReference =
    document.getElementById(
      "txnModalProviderReference"
    );

  if (providerReference) {
    providerReference.textContent =
      t.providerReference || "—";
  }

  const currency =
    document.getElementById("txnModalCurrency");

  if (currency) {
    currency.textContent =
      t.currency || "USD";
  }

  const customer =
    document.getElementById("txnModalCustomer");

  if (customer) {
    customer.textContent =
      t.customer?.name || "Guest";
  }

  const customerEmail =
    document.getElementById(
      "txnModalCustomerEmail"
    );

  if (customerEmail) {
    customerEmail.textContent =
      t.customer?.email || "—";
  }

  const zelleVerification = document.getElementById("txnZelleVerification");
  const modalError = document.getElementById("txnModalError");
  if (modalError) { modalError.hidden = true; modalError.textContent = ""; }
  if (zelleVerification) {
    const isPendingZelle = String(t.provider || "").toLowerCase() === "zelle" && String(t.status || "").toLowerCase() === "pending";
    zelleVerification.hidden = !isPendingZelle;
    if (isPendingZelle) {
      zelleVerification.innerHTML = `
        <div class="txn-zelle-verification__title">Zelle payment awaiting verification</div>
        <p>Customer has indicated that the Zelle payment was sent. Verify the actual receipt in the business Zelle account before approving this order.</p>
        <div class="txn-zelle-verification__activity">
          <div><span>Payment record created</span><strong>${escapeHtml(formatTransactionDate(t.date))}</strong></div>
          <div><span>Current state</span><strong>Awaiting admin verification</strong></div>
        </div>
        <button type="button" class="admin-btn admin-btn--dark" id="txnConfirmZelleBtn">Confirm Zelle Payment Received</button>
      `;
      const confirmBtn = document.getElementById("txnConfirmZelleBtn");
      confirmBtn && confirmBtn.addEventListener("click", async function () {
        if (!t.orderBackendId || !t.mongoId) {
          if (modalError) { modalError.hidden = false; modalError.textContent = "This transaction is missing its order reference and cannot be verified from this screen."; }
          return;
        }
        if (!window.confirm("Confirm that this Zelle payment has actually been received? This will mark the order paid and settle it.")) return;
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Confirming…";
        try {
          await apiRequest(`/api/admin/orders/${encodeURIComponent(t.orderBackendId)}/confirm-payment`, {
            method: "POST",
            body: JSON.stringify({ transactionId: t.mongoId })
          });
          await loadTransactions();
          const updated = TRANSACTIONS.find(x => x.mongoId === t.mongoId || x.id === t.id);
          if (updated) { openTxnModal(updated); } else { closeTxnModal(); }
        } catch (error) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = "Confirm Zelle Payment Received";
          if (modalError) { modalError.hidden = false; modalError.textContent = error.message || "Unable to confirm the Zelle payment."; }
        }
      });
    }
  }

  overlay.classList.add("is-open");

  document.body.classList.add(
    "notif-modal-lock"
  );
}

  function closeTxnModal() {
    activeTxnId = null;
    const overlay = document.getElementById("txnModalOverlay");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    document.body.classList.remove("notif-modal-lock");
  }

  function initTxnModal() {
    const overlay = document.getElementById("txnModalOverlay");
    const closeBtn = document.getElementById("txnModalClose");
    const deleteBtn = document.getElementById("txnDeleteBtn");

    closeBtn && closeBtn.addEventListener("click", closeTxnModal);
    overlay && overlay.addEventListener("click", function (e) { if (e.target === overlay) closeTxnModal(); });

    deleteBtn && deleteBtn.addEventListener("click", function () {
      if (!activeTxnId) return;
      openConfirmModal(activeTxnId);
    });
  }

  // ---------------------------------------------------
  // DELETE TRANSACTION CONFIRM MODAL
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

deleteBtn && deleteBtn.addEventListener("click", async function () {
  if (!pendingDeleteId) return;

  const idToDelete = pendingDeleteId;

  deleteBtn.disabled = true;

  try {
    await apiRequest(
      `/api/admin/transactions/${encodeURIComponent(idToDelete)}`,
      {
        method: "DELETE"
      }
    );

    TRANSACTIONS = TRANSACTIONS.filter(function (t) {
      return t.id !== idToDelete;
    });

    closeConfirmModal();
    closeTxnModal();

    renderTxnsTable();

  } catch (error) {
    console.error(
      "Failed to delete transaction:",
      error
    );

    alert(
      error.message ||
      "Unable to delete transaction. Please try again."
    );

  } finally {
    deleteBtn.disabled = false;
  }
});
  }

  // ---------------------------------------------------
  // TABLE ACTIONS (view + pagination)
  // ---------------------------------------------------
  function initTableActions() {
    const body = document.getElementById("txnsTableBody");
    if (!body) return;

    body.addEventListener("click", function (e) {
      const viewBtn = e.target.closest("[data-view-id]");
      if (viewBtn) {
        const t = TRANSACTIONS.find(function (x) { return x.id === viewBtn.dataset.viewId; });
        if (t) openTxnModal(t);
        return;
      }
      const row = e.target.closest("tr[data-txn-id]");
      if (row) {
        const t = TRANSACTIONS.find(function (x) { return x.id === row.dataset.txnId; });
        if (t) openTxnModal(t);
      }
    });

    const pagination = document.getElementById("txnsPagination");
    pagination && pagination.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-page-action]");
      if (!btn || btn.disabled) return;
      state.page = (state.page || 1) + (btn.dataset.pageAction === "next" ? 1 : -1);
      renderTxnsTable();
    });

    let lastIsMobile = isMobileView();
    window.addEventListener("resize", function () {
      const nowMobile = isMobileView();
      if (nowMobile !== lastIsMobile) {
        lastIsMobile = nowMobile;
        state.page = 1;
        renderTxnsTable();
      }
    });
  }

  // ---------------------------------------------------
  // FILTER TOOLBAR
  // ---------------------------------------------------
  function initFilterToolbar() {
    const searchInput = document.getElementById("txnSearchInput");
    const amountMin = document.getElementById("amountMinInput");
    const amountMax = document.getElementById("amountMaxInput");
    const clearBtn = document.getElementById("clearFiltersBtn");

    searchInput && searchInput.addEventListener("input", function () {
      state.search = searchInput.value.trim();
      state.page = 1;
      renderTxnsTable();
    });

    amountMin && amountMin.addEventListener("input", function () {
      state.amountMin = amountMin.value === "" ? null : parseFloat(amountMin.value);
      state.page = 1;
      renderTxnsTable();
    });
    amountMax && amountMax.addEventListener("input", function () {
      state.amountMax = amountMax.value === "" ? null : parseFloat(amountMax.value);
      state.page = 1;
      renderTxnsTable();
    });

    clearBtn && clearBtn.addEventListener("click", function () {
      state.search = "";
      state.type = "all";
      state.status = "all";
      state.dateRange = "all";
      state.amountMin = null;
      state.amountMax = null;
      state.page = 1;
      if (searchInput) searchInput.value = "";
      if (amountMin) amountMin.value = "";
      if (amountMax) amountMax.value = "";
      renderTypeFilterMenu();
      renderStatusFilterMenu();
      renderDateFilterMenu();
      renderTxnsTable();
    });
  }

  function initTypeFilterDropdown() {
    initDropdown("typeFilterDropdown", "typeFilterToggle", "typeFilterMenu", function (value) {
      state.type = value;
      state.page = 1;
      renderTypeFilterMenu();
      renderTxnsTable();
    });
  }

  function initStatusFilterDropdown() {
    initDropdown("statusFilterDropdown", "statusFilterToggle", "statusFilterMenu", function (value) {
      state.status = value;
      state.page = 1;
      renderStatusFilterMenu();
      renderTxnsTable();
    });
  }

  function initDateFilterDropdown() {
    initDropdown("dateFilterDropdown", "dateFilterToggle", "dateFilterMenu", function (value) {
      state.dateRange = value;
      state.page = 1;
      renderDateFilterMenu();
      renderTxnsTable();
    });
  }

  // ---------------------------------------------------
  // GENERIC FIELD DROPDOWN
  // ---------------------------------------------------
  function initDropdown(wrapId, toggleId, menuId, onSelect) {
    const wrap = document.getElementById(wrapId);
    const toggle = document.getElementById(toggleId);
    const menu = document.getElementById(menuId);
    if (!wrap || !toggle || !menu) return;

    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      const opening = !wrap.classList.contains("is-open");
      if (opening) closeAllDropdowns(wrap);
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

  // ---------------------------------------------------
  // INIT
  // ---------------------------------------------------
  async function init() {
  renderTypeFilterMenu();
  renderStatusFilterMenu();
  renderDateFilterMenu();

  initFilterToolbar();
  initTypeFilterDropdown();
  initStatusFilterDropdown();
  initDateFilterDropdown();
  initGlobalDropdownClose();
  initTableActions();
  initTxnModal();
  initConfirmModal();

  await loadNotifications();
  initNotifDropdown();
  initNotifModal();

  applyUrlFilters();
  loadTransactions();
}

  document.addEventListener("DOMContentLoaded", init);
})();