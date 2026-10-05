/* =====================================================
   BUD N' BUDDER — ADMIN — admin-orders.js
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
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  cancelled: "Cancelled"
};
 

let ORDERS = [];

  // ---------------------------------------------------
  // HELPERS
  // ---------------------------------------------------
  function fmtMoney(n) { return "$" + Number(n).toFixed(2); }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

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
      `Request failed with status ${response.status}`
    );
  }

  return data;
}

function resolveProductImage(src) {
  if (!src) return "";

  if (typeof src === "object") {
    src =
      src.secure_url ||
      src.url ||
      src.path ||
      src.image ||
      "";

    if (!src) return "";
  }

  const value = String(src).trim();

  if (!value) return "";

  if (
    value.startsWith("https://") ||
    value.startsWith("http://") ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  ) {
    return value;
  }

  if (value.startsWith("../")) {
    return value;
  }

  if (value.startsWith("assets/")) {
    return "../" + value;
  }

  if (value.startsWith("/assets/")) {
    return ".." + value;
  }

  if (!value.includes("/")) {
    return "../assets/images/products/" + value;
  }

  return value;
}

function normalizeOrder(order) {
  const customer =
  order.customer ||
  order.user ||
  {};
  const shipping = order.shippingAddress || {};

  return {
    id:
      order.orderNumber ||
      order._id ||
      "",

    backendId:
      order._id ||
      "",

    date:
      order.placedAt ||
      order.createdAt ||
      "",

    status:
      order.status ||
      "pending",

    customer: {
      name:
        `${customer.firstName || ""} ${customer.lastName || ""}`.trim() ||
        "Guest Customer",

      email:
        customer.email || "",

      phone:
        customer.phone || ""
    },

    address:
      [
        shipping.address1,
        shipping.address2,
        shipping.city,
        shipping.state,
        shipping.zip,
        shipping.country
      ]
        .filter(Boolean)
        .join(", "),

    items:
      Array.isArray(order.items)
        ? order.items.map(function (item) {
            return {
              name:
                item.product?.name ||
                item.name ||
                "Product",

              image:
                resolveProductImage(
                  item.product?.image ||
                  item.image ||
                  ""
                ),

              qty:
                Number(
                  item.quantity || 1
                ),

              price:
                Number(
                  item.price ||
                  item.product?.price ||
                  0
                )
            };
          })
        : [],

    shipping:
      Number(order.shipping || 0),

    tax:
      Number(order.tax || 0),

    subtotal:
      Number(order.subtotal || 0),

    total:
      Number(order.total || 0),

    paymentStatus:
      order.paymentStatus || "pending",

    paymentMethod:
      order.paymentMethod || "",

    notes:
      order.notes || ""
  };
}

async function loadOrders() {

  try {

    const data = await apiRequest(
      "/api/admin/orders"
    );

    ORDERS =
      Array.isArray(data.orders)
        ? data.orders.map(normalizeOrder)
        : [];

    state.page = 1;

    renderStatusFilterMenu();
    renderDateFilterMenu();
    renderOrdersTable();

  } catch (error) {

    console.error(
      "Failed to load orders:",
      error
    );

    ORDERS = [];

    const body =
      document.getElementById(
        "ordersTableBody"
      );

    const noResults =
      document.getElementById(
        "noOrdersState"
      );

    if (body) {

      body.innerHTML = `
        <tr>
          <td
            colspan="7"
            class="dash-empty"
          >
            Unable to load orders.
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

function formatOrderDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }
  );
}

  function itemsSubtotal(order) {
    return order.items.reduce(function (sum, it) { return sum + it.price * it.qty; }, 0);
  }

  function orderTotal(order) {
  if (
    Number.isFinite(Number(order.total)) &&
    Number(order.total) > 0
  ) {
    return Number(order.total);
  }

  return (
    itemsSubtotal(order) +
    (order.shipping || 0) +
    (order.tax || 0)
  );
}

  function itemsCount(order) {
    return order.items.reduce(function (sum, it) { return sum + it.qty; }, 0);
  }

  const DAY = 24 * 60 * 60 * 1000;
  function daysAgoFromDate(d) { return (Date.now() - d.getTime()) / DAY; }

  // ---------------------------------------------------
  // STATE
  // ---------------------------------------------------
  const state = {
    search: "",
    status: "all",
    dateRange: "all",   // all | today | week | month
    amountMin: null,
    amountMax: null,
    page: 1
  };

  function isMobileView() { return window.matchMedia("(max-width: 640px)").matches; }
  function getPageSize() { return isMobileView() ? 6 : 8; }

  const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" }
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
  return ORDERS.filter(function (o) {

    // SEARCH
    if (state.search) {
      const q =
        String(state.search || "")
          .trim()
          .toLowerCase();

      const matchesOrderId =
        String(o.id || "")
          .toLowerCase()
          .includes(q);

      const matchesOrderNumber =
        String(o.orderNumber || "")
          .toLowerCase()
          .includes(q);

      const matchesCustomerName =
        String(o.customer?.name || "")
          .toLowerCase()
          .includes(q);

      const matchesCustomerEmail =
        String(o.customer?.email || "")
          .toLowerCase()
          .includes(q);

      const matchesCustomerPhone =
        String(o.customer?.phone || "")
          .toLowerCase()
          .includes(q);

      if (
        !matchesOrderId &&
        !matchesOrderNumber &&
        !matchesCustomerName &&
        !matchesCustomerEmail &&
        !matchesCustomerPhone
      ) {
        return false;
      }
    }

    // STATUS FILTER
    if (
      state.status !== "all" &&
      o.status !== state.status
    ) {
      return false;
    }

    // DATE FILTER
    if (state.dateRange !== "all") {
      const orderDate =
        new Date(o.date);

      if (
        Number.isNaN(
          orderDate.getTime()
        )
      ) {
        return false;
      }

      const now = new Date();

      // TODAY
      if (
        state.dateRange === "today"
      ) {
        const startOfToday =
          new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );

        if (
          orderDate < startOfToday
        ) {
          return false;
        }
      }

      // THIS WEEK
      if (
        state.dateRange === "week"
      ) {
        const startOfWeek =
          new Date(now);

        const day =
          startOfWeek.getDay();

        startOfWeek.setDate(
          startOfWeek.getDate() - day
        );

        startOfWeek.setHours(
          0,
          0,
          0,
          0
        );

        if (
          orderDate < startOfWeek
        ) {
          return false;
        }
      }

      // THIS MONTH
      if (
        state.dateRange === "month"
      ) {
        const startOfMonth =
          new Date(
            now.getFullYear(),
            now.getMonth(),
            1
          );

        if (
          orderDate < startOfMonth
        ) {
          return false;
        }
      }
    }

    // AMOUNT FILTER
    const total =
      Number(orderTotal(o)) || 0;

    if (
      state.amountMin !== null &&
      total < state.amountMin
    ) {
      return false;
    }

    if (
      state.amountMax !== null &&
      total > state.amountMax
    ) {
      return false;
    }

    return true;
  });
}

  // ---------------------------------------------------
  // RENDER — filter dropdown menus
  // ---------------------------------------------------
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
    const container = document.getElementById("ordersPagination");
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
    const countLabel = document.getElementById("orderCountLabel");
    const revenueLabel = document.getElementById("orderRevenueLabel");
    if (countLabel) countLabel.textContent = ORDERS.length;
    if (revenueLabel) {
      const revenue = ORDERS
  .filter(function (o) {
    return o.status !== "cancelled";
  })
        .reduce(function (sum, o) { return sum + orderTotal(o); }, 0);
      revenueLabel.textContent = fmtMoney(revenue);
    }
  }

  // ---------------------------------------------------
  // RENDER — orders table
  // ---------------------------------------------------
  function renderOrdersTable() {
    const body = document.getElementById("ordersTableBody");
    const noResults = document.getElementById("noOrdersState");
    if (!body) return;

    renderHeaderCounts();

    const filtered = getFiltered();

    if (!filtered.length) {
  body.innerHTML = "";

  if (noResults) {
    noResults.hidden = false;

    noResults.textContent =
      ORDERS.length
        ? "No orders match your current filters."
        : "No orders have been created yet.";
  }

  renderPaginationControls(1, 1);

  return;
}
    if (noResults) noResults.hidden = true;

    const { pageItems, page, totalPages } = getPage(filtered);

    body.innerHTML = pageItems.map(function (order) {
      const total = orderTotal(order);
      const count = itemsCount(order);
      return `
        <tr data-order-id="${order.id}">
          <td data-label="Order ID" class="order-id">${order.id}</td>
          <td data-label="Customer">
            <span class="order-customer">
              <span class="order-customer__info">
                <span class="order-customer__name">${escapeHtml(order.customer.name)}</span>
                <span class="order-customer__email">${escapeHtml(order.customer.email)}</span>
              </span>
            </span>
          </td>
          <td data-label="Items" class="order-items-count">${count} item${count !== 1 ? "s" : ""}</td>
          <td data-label="Date">
  ${formatOrderDate(order.date)}
</td>
          <td data-label="Total" class="order-total">${fmtMoney(total)}</td>
          <td data-label="Status">
            <span class="admin-badge admin-badge--${order.status}">${STATUS_LABELS[order.status] || order.status}</span>
          </td>
          <td data-label="">
            <span class="order-row-actions">
              <button type="button" class="order-row-action" data-view-id="${order.id}">
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
  // ORDER DETAIL MODAL
  // ---------------------------------------------------
  let activeOrderId = null;
  let activeOrderBackendId = null;

  async function openOrderModal(order) {
    activeOrderId = order.id;
    activeOrderBackendId = order.backendId;

    const backendId =
  order.backendId;

  let transactions = [];

if (!backendId) {
  alert(
    "Unable to identify this order."
  );
  return;
}

try {
  const data = await apiRequest(
  `/api/admin/orders/${backendId}`
);

if (!data?.order) {
  throw new Error(
    "Order details were not returned by the server."
  );
}

order = normalizeOrder(data.order);

transactions =
  Array.isArray(data.transactions)
    ? data.transactions
    : [];

} catch (error) {
  console.error(
    "Failed to load order details:",
    error
  );

  alert(
    error.message ||
    "Unable to load order details."
  );

  return;
}
    const overlay = document.getElementById("orderModalOverlay");
    if (!overlay) return;

    document.getElementById("orderModalTitle").textContent = "Order " + order.id;
    document.getElementById(
  "orderModalDate"
).textContent =
  formatOrderDate(order.date);
    document.getElementById("orderModalAddress").textContent = order.address;

    document.getElementById("orderModalCustomer").innerHTML = `
      <div class="order-modal__customer-avatar order-modal__customer-avatar--fallback">
  ${escapeHtml(
    order.customer.name
      .split(" ")
      .map(function (part) {
        return part.charAt(0);
      })
      .join("")
      .slice(0, 2)
      .toUpperCase()
  )}
</div>
      <span class="order-modal__customer-info">
        <span class="order-modal__customer-name">${escapeHtml(order.customer.name)}</span>
        <span class="order-modal__customer-meta">${escapeHtml(order.customer.email)}</span>
      </span>`;

    document.getElementById("orderModalItems").innerHTML = order.items.map(function (it) {
      return `
        <div class="order-modal__item">
          <img class="order-modal__item-img" src="${it.image}" alt="${escapeHtml(it.name)}" onerror="this.style.opacity='0'">
          <span class="order-modal__item-body">
            <span class="order-modal__item-name">${escapeHtml(it.name)}</span>
            <span class="order-modal__item-qty">Qty ${it.qty} × ${fmtMoney(it.price)}</span>
          </span>
          <span class="order-modal__item-price">${fmtMoney(it.price * it.qty)}</span>
        </div>`;
    }).join("");

    const subtotal = itemsSubtotal(order);
    const paymentStatus =
  order.paymentStatus || "pending";

const paymentMethod =
  order.paymentMethod || "Not specified";

const paymentLabel =
  paymentStatus
    .replace(/_/g, " ")
    .replace(/\b\w/g, function (c) {
      return c.toUpperCase();
    });


const orderStatusLabel =
  String(order.status || "pending")
    .replace(/_/g, " ")
    .replace(/\b\w/g, function (c) { return c.toUpperCase(); });

const orderStatusClass = String(order.status || "pending").toLowerCase();
const paymentStatusClass = String(paymentStatus || "pending").toLowerCase();

const statusSummary = document.getElementById("orderModalStatusSummary");
if (statusSummary) {
  statusSummary.innerHTML = `
    <div class="order-status-card">
      <div class="order-status-card__header">
        <div>
          <span class="order-modal__label">Order Status</span>
          <span class="admin-badge admin-badge--${escapeHtml(orderStatusClass)}">${escapeHtml(orderStatusLabel)}</span>
        </div>
        <div>
          <span class="order-modal__label">Payment Status</span>
          <span class="admin-badge admin-badge--${escapeHtml(paymentStatusClass)}">${escapeHtml(paymentLabel)}</span>
        </div>
      </div>
      <div class="order-status-card__body">
        <div>
          <strong>Update order status</strong>
          <p id="orderStatusHelp" class="order-status-card__help">
            ${order.status === "processing"
              ? "Payment is confirmed. Mark Completed only after the store has fulfilled the order."
              : order.status === "completed"
                ? "This order has been marked completed."
                : order.status === "pending"
                  ? "This order is still pending. Confirm payment before moving it to Processing."
                  : "Update the order status when its fulfillment state changes."}
          </p>
        </div>
        <div class="order-status-card__controls">
          <select id="orderStatusSelect" class="admin-field-select" aria-label="Order status">
            ${["pending","processing","completed","cancelled"].map(function (value) {
              const label = value.charAt(0).toUpperCase() + value.slice(1);
              return `<option value="${value}" ${order.status === value ? "selected" : ""}>${label}</option>`;
            }).join("")}
          </select>
          <button type="button" class="admin-btn admin-btn--dark" id="orderStatusUpdateBtn">
            Update Status
          </button>
        </div>
      </div>
    </div>
  `;
}

document.getElementById("orderModalTotals").innerHTML = `
  <span class="order-modal__totals-row">
    <span>Subtotal</span>
    <span>${fmtMoney(subtotal)}</span>
  </span>

  <span class="order-modal__totals-row">
    <span>Shipping</span>
    <span>${fmtMoney(order.shipping || 0)}</span>
  </span>

  <span class="order-modal__totals-row">
    <span>Tax</span>
    <span>${fmtMoney(order.tax || 0)}</span>
  </span>

  <span class="order-modal__totals-row">
    <span>Payment</span>
    <span>
      ${escapeHtml(paymentMethod)}
    </span>
  </span>

  <span class="order-modal__totals-row">
    <span>Payment Status</span>
    <span>
      ${escapeHtml(paymentLabel)}
    </span>
  </span>

  <span class="order-modal__totals-row is-grand">
    <span>Total</span>
    <span>${fmtMoney(orderTotal(order))}</span>
  </span>
`;

const transactionContainer =
  document.getElementById(
    "orderModalTransactions"
  );

if (transactionContainer) {
  transactionContainer.innerHTML =
    transactions.length
      ? transactions.map(function (tx) {
          const transactionDate =
            tx.createdAt
              ? formatOrderDate(
                  tx.createdAt
                )
              : "—";

          const transactionStatus =
            tx.status || "Unknown";

          const transactionMethod =
            tx.method ||
            tx.provider ||
            "—";

          const transactionReference =
            tx.transactionId ||
            tx.providerReference ||
            tx._id ||
            "—";

          return `
            <div class="order-modal__transaction">
              <div>
  <strong>
    Transaction
  </strong>

  <div>
    ${escapeHtml(
      transactionReference
    )}
  </div>

  ${
    tx.providerReference
      ? `
        <div>
          Provider Reference:
          ${escapeHtml(
            tx.providerReference
          )}
        </div>
      `
      : ""
  }
</div>

              <div>
                <strong>
                  Amount
                </strong>

                <div>
                  ${fmtMoney(
                    Number(
                      tx.amount || 0
                    )
                  )}
                </div>
              </div>

              <div>
                <strong>
                  Method
                </strong>

                <div>
                  ${escapeHtml(
                    transactionMethod
                  )}
                </div>
              </div>

              <div>
                <strong>
                  Status
                </strong>

                <div>
                  ${escapeHtml(
                    transactionStatus
                  )}
                </div>
              </div>

              ${tx.provider === 'zelle' && tx.status === 'pending' ? `
                <div>
                  <button type="button" class="admin-btn admin-btn--dark" data-confirm-transaction="${escapeHtml(tx._id)}">Confirm Zelle Payment</button>
                </div>
              ` : ''}

              <div>
                <strong>
                  Date
                </strong>

                <div>
                  ${escapeHtml(
                    transactionDate
                  )}
                </div>
              </div>
            </div>
          `;
        }).join("")
      : `
          <div class="dash-empty">
            No transaction records found.
          </div>
        `;
}
    overlay.classList.add("is-open");
    document.body.classList.add("notif-modal-lock");
  }

  function closeOrderModal() {
    activeOrderId = null;
    activeOrderBackendId = null;
    const overlay = document.getElementById("orderModalOverlay");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    document.body.classList.remove("notif-modal-lock");
  }

  function initOrderModal() {
    const overlay = document.getElementById("orderModalOverlay");
    const closeBtn = document.getElementById("orderModalClose");
    const cancelOrderBtn = document.getElementById("orderCancelOrderBtn");

    const transactionsEl = document.getElementById("orderModalTransactions");
    transactionsEl && transactionsEl.addEventListener("click", async function (event) {
      const button = event.target.closest("[data-confirm-transaction]");
      if (!button || !activeOrderId) return;
      if (!confirm("Confirm that this Zelle payment has been received?")) return;
      button.disabled = true;
      try {
        await apiRequest(`/api/admin/orders/${activeOrderBackendId}/confirm-payment`, {
          method: "POST",
          body: JSON.stringify({ transactionId: button.dataset.confirmTransaction })
        });
        await loadOrders();
        const updated = ORDERS.find(o => o.backendId === activeOrderBackendId || o.id === activeOrderId);
        if (updated) await openOrderModal(updated);
      } catch (error) {
        button.disabled = false;
        alert(error.message || "Unable to confirm payment.");
      }
    });


    const statusSummaryEl = document.getElementById("orderModalStatusSummary");
    statusSummaryEl && statusSummaryEl.addEventListener("click", async function (event) {
      const button = event.target.closest("#orderStatusUpdateBtn");
      if (!button || !activeOrderBackendId) return;

      const select = document.getElementById("orderStatusSelect");
      if (!select) return;

      const nextStatus = select.value;
      const currentOrder = ORDERS.find(function (o) {
        return o.backendId === activeOrderBackendId || o.id === activeOrderId;
      });

      if (!currentOrder) return;

      if (nextStatus === currentOrder.status) {
        alert("The order is already " + nextStatus + ".");
        return;
      }

      if (nextStatus === "completed" && String(currentOrder.paymentStatus || "").toLowerCase() !== "paid") {
        alert("This order cannot be marked Completed until its payment status is Paid.");
        select.value = currentOrder.status;
        return;
      }

      const label = nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1);
      if (!confirm("Change this order from " +
        String(currentOrder.status).charAt(0).toUpperCase() + String(currentOrder.status).slice(1) +
        " to " + label + "?")) {
        select.value = currentOrder.status;
        return;
      }

      button.disabled = true;
      button.textContent = "Updating...";

      try {
        await apiRequest(`/api/admin/orders/${activeOrderBackendId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus })
        });

        await loadOrders();

        const updated = ORDERS.find(function (o) {
          return o.backendId === activeOrderBackendId || o.id === activeOrderId;
        });

        if (updated) {
          await openOrderModal(updated);
        } else {
          closeOrderModal();
        }
      } catch (error) {
        console.error("Order status update error:", error);
        button.disabled = false;
        button.textContent = "Update Status";
        alert(error.message || "Unable to update order status.");
      }
    });

    closeBtn && closeBtn.addEventListener("click", closeOrderModal);
    overlay && overlay.addEventListener("click", function (e) { if (e.target === overlay) closeOrderModal(); });

    cancelOrderBtn && cancelOrderBtn.addEventListener("click", function () {
      if (!activeOrderId) return;
      openConfirmModal(activeOrderId);
    });
  }


  // ---------------------------------------------------
  // CANCEL ORDER CONFIRM MODAL
  // ---------------------------------------------------
  let pendingCancelId = null;

  function openConfirmModal(id) {
    pendingCancelId = id;
    const overlay = document.getElementById("confirmModalOverlay");
    if (!overlay) return;
    overlay.classList.add("is-open");
    document.body.classList.add("notif-modal-lock");
  }

  function closeConfirmModal() {
    pendingCancelId = null;
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
    if (!pendingCancelId) return;

    const order = ORDERS.find(
      function (o) {
        return o.id === pendingCancelId;
      }
    );

    if (!order || !order.backendId) {
      alert(
        "Unable to identify this order."
      );
      return;
    }

    try {
      await apiRequest(
        `/api/admin/orders/${order.backendId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "cancelled"
          })
        }
      );

      closeConfirmModal();
      closeOrderModal();

      await loadOrders();

    } catch (error) {
      console.error(
        "Order cancellation error:",
        error
      );

      alert(
        error.message ||
        "Unable to cancel order."
      );
    }
  }
);
  }

  // ---------------------------------------------------
  // TABLE ACTIONS (view + pagination)
  // ---------------------------------------------------
  function initTableActions() {
    const body = document.getElementById("ordersTableBody");
    if (!body) return;

    body.addEventListener("click", function (e) {
      const viewBtn = e.target.closest("[data-view-id]");
      if (viewBtn) {
        const order = ORDERS.find(function (o) { return o.id === viewBtn.dataset.viewId; });
        if (order) openOrderModal(order);
        return;
      }
      const row = e.target.closest("tr[data-order-id]");
      if (row) {
        const order = ORDERS.find(function (o) { return o.id === row.dataset.orderId; });
        if (order) openOrderModal(order);
      }
    });

    const pagination =
  document.getElementById(
    "ordersPagination"
  );

pagination &&
  pagination.addEventListener(
    "click",
    function (e) {
      const btn =
        e.target.closest(
          "[data-page-action]"
        );

      if (!btn || btn.disabled) {
        return;
      }

      const action =
        btn.dataset.pageAction;

      if (action === "next") {
        state.page =
          (state.page || 1) + 1;
      }

      if (action === "prev") {
        state.page =
          Math.max(
            1,
            (state.page || 1) - 1
          );
      }

      renderOrdersTable();
    }
  );

    let lastIsMobile = isMobileView();
    window.addEventListener("resize", function () {
      const nowMobile = isMobileView();
      if (nowMobile !== lastIsMobile) {
        lastIsMobile = nowMobile;
        state.page = 1;
        renderOrdersTable();
      }
    });
  }

  // ---------------------------------------------------
  // FILTER TOOLBAR
  // ---------------------------------------------------
  function initFilterToolbar() {
    const searchInput = document.getElementById("orderSearchInput");
    const amountMin = document.getElementById("amountMinInput");
    const amountMax = document.getElementById("amountMaxInput");
    const clearBtn = document.getElementById("clearFiltersBtn");

    searchInput && searchInput.addEventListener("input", function () {
      state.search = searchInput.value.trim();
      state.page = 1;
      renderOrdersTable();
    });

    amountMin &&
  amountMin.addEventListener(
    "input",
    function () {
      const value =
        parseFloat(
          amountMin.value
        );

      state.amountMin =
        Number.isFinite(value)
          ? value
          : null;

      state.page = 1;
      renderOrdersTable();
    }
  );

amountMax &&
  amountMax.addEventListener(
    "input",
    function () {
      const value =
        parseFloat(
          amountMax.value
        );

      state.amountMax =
        Number.isFinite(value)
          ? value
          : null;

      state.page = 1;
      renderOrdersTable();
    }
  );

    clearBtn && clearBtn.addEventListener("click", function () {
      state.search = "";
      state.status = "all";
      state.dateRange = "all";
      state.amountMin = null;
      state.amountMax = null;
      state.page = 1;
      if (searchInput) searchInput.value = "";
      if (amountMin) amountMin.value = "";
      if (amountMax) amountMax.value = "";
      renderStatusFilterMenu();
      renderDateFilterMenu();
      renderOrdersTable();
    });
  }

  function initStatusFilterDropdown() {
    initDropdown("statusFilterDropdown", "statusFilterToggle", "statusFilterMenu", function (value) {
      state.status = value;
      state.page = 1;
      renderStatusFilterMenu();
      renderOrdersTable();
    });
  }

  function initDateFilterDropdown() {
    initDropdown("dateFilterDropdown", "dateFilterToggle", "dateFilterMenu", function (value) {
      state.dateRange = value;
      state.page = 1;
      renderDateFilterMenu();
      renderOrdersTable();
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

 async function init() {
  renderStatusFilterMenu();
  renderDateFilterMenu();

  initFilterToolbar();
  initStatusFilterDropdown();
  initDateFilterDropdown();
  initGlobalDropdownClose();
  initTableActions();
  initOrderModal();
  initConfirmModal();

  initNotifDropdown();
  initNotifModal();

  await loadOrders();
  await loadNotifications();
}

  document.addEventListener("DOMContentLoaded", init);
})();