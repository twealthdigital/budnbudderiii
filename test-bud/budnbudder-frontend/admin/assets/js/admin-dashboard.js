/* =====================================================
   BUD N' BUDDER — ADMIN — admin-dashboard.js
   ===================================================== */

(function () {
  "use strict";

  const API_BASE_URL = "http://https://budnbudder-backend.onrender.com";

  // ---------------------------------------------------
  // DATA — replace this block with a fetch()/API call.
  // Keep the same shape and the render functions below
  // will work unchanged.
  // ---------------------------------------------------
  
const DASHBOARD_STATE = {
  overview: null,
  analytics: null,
  recentOrders: [],
  transactions: [],
  loading: false
};

const STATUS_LABELS = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  cancelled: "Cancelled",
  success: "Success",
  danger: "Cancelled"
};

async function fetchAdminAPI(endpoint, options = {}) {
  const response = await fetch(
    API_BASE_URL + endpoint,
    {
      method: "GET",
      credentials: "include",
      headers: {
        "Accept": "application/json",
        ...(options.headers || {})
      },
      ...options,
      headers: {
        "Accept": "application/json",
        ...(options.headers || {})
      }
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch (err) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
      "Unable to load dashboard data."
    );
  }

  return data;
}

function resolveProductImage(src) {
  if (!src) return "";

  const value = String(src).trim();

  if (!value) return "";

  // Cloudinary / external URLs
  if (
    value.startsWith("https://") ||
    value.startsWith("http://") ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  ) {
    return value;
  }

  // Already resolved relative path
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

  // Database contains only filename
  if (!value.includes("/")) {
    return `../assets/images/products/${value}`;
  }

  return value;
}



function renderOverview() {
  const grid = document.getElementById("statGrid");

  if (!grid) return;

  const overview = DASHBOARD_STATE.overview;

  if (!overview) {
    grid.innerHTML = `
      <div class="dash-empty">
        Unable to load store overview.
      </div>
    `;
    return;
  }

  const currency = "USD";

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency
    }).format(Number(value || 0));
  }

  const orders = overview.orders || {};

  grid.innerHTML = `
    <article class="stat-card">
      <span class="stat-card__label">Total Revenue</span>
      <strong class="stat-card__value">
        ${formatCurrency(overview.totalRevenue)}
      </strong>
    </article>

    <article class="stat-card">
      <span class="stat-card__label">Total Orders</span>
      <strong class="stat-card__value">
        ${Number(overview.totalOrders || 0).toLocaleString()}
      </strong>
    </article>

    <article class="stat-card">
      <span class="stat-card__label">Total Customers</span>
      <strong class="stat-card__value">
        ${Number(overview.totalCustomers || 0).toLocaleString()}
      </strong>
    </article>

    <article class="stat-card">
      <span class="stat-card__label">Total Products</span>
      <strong class="stat-card__value">
        ${Number(overview.totalProducts || 0).toLocaleString()}
      </strong>
    </article>

    <article class="stat-card">
      <span class="stat-card__label">Pending Orders</span>
      <strong class="stat-card__value">
        ${Number(orders.pending || 0).toLocaleString()}
      </strong>
    </article>

    <article class="stat-card">
      <span class="stat-card__label">Processing Orders</span>
      <strong class="stat-card__value">
        ${Number(orders.processing || 0).toLocaleString()}
      </strong>
    </article>

    <article class="stat-card">
      <span class="stat-card__label">Completed Orders</span>
      <strong class="stat-card__value">
        ${Number(orders.completed || 0).toLocaleString()}
      </strong>
    </article>

    <article class="stat-card">
      <span class="stat-card__label">Cancelled Orders</span>
      <strong class="stat-card__value">
        ${Number(orders.cancelled || 0).toLocaleString()}
      </strong>
    </article>
  `;
}

// function resolveDashboardProductImage(src) {
//   if (!src) return "";

//   // Handle objects just in case the backend
//   // returns a populated image object.
//   if (typeof src === "object") {
//     src =
//       src.url ||
//       src.secure_url ||
//       src.path ||
//       src.image ||
//       "";

//     if (!src) return "";
//   }

//   const value =
//     String(src).trim();

//   if (!value) return "";

//   // Cloudinary / external URL
//   if (
//     value.startsWith("https://") ||
//     value.startsWith("http://")
//   ) {
//     return value;
//   }

//   // Base64 / blob URLs
//   if (
//     value.startsWith("data:") ||
//     value.startsWith("blob:")
//   ) {
//     return value;
//   }

//   // Our current frontend structure:
//   // /admin/admin-dashboard.html
//   // /assets/images/products/...
//   if (
//     value.startsWith("../assets/")
//   ) {
//     return value;
//   }

//   if (
//     value.startsWith("assets/")
//   ) {
//     return "../" + value;
//   }

//   if (
//     value.startsWith("/assets/")
//   ) {
//     return ".." + value;
//   }

//   // If backend only returns filename
//   if (
//     !value.includes("/")
//   ) {
//     return (
//       "../assets/images/products/" +
//       value
//     );
//   }

//   return value;
// }

  // ---------------------------------------------------
  // RENDER — Recent Orders
  // ---------------------------------------------------
  function renderRecentOrders() {
  const body = document.getElementById("recentOrdersBody");

  if (!body) return;

  const orders = DASHBOARD_STATE.recentOrders;

  if (!orders.length) {
    body.innerHTML = `
      <tr>
        <td colspan="6" class="dash-empty">
          No recent orders yet.
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = orders.map(function (order) {
    const firstItem =
      Array.isArray(order.items) && order.items.length
        ? order.items[0]
        : null;

    const productName =
      firstItem?.name ||
      firstItem?.product?.name ||
      "Multiple products";

   const rawProductImage =
  firstItem?.product?.image ||
  firstItem?.image ||
  "";

const productImage =
  resolveProductImage(
    rawProductImage
  );

  console.log(
  "RECENT ORDER IMAGE:",
  {
    raw: rawProductImage,
    resolved: productImage,
    item: firstItem
  }
);

    const customer = order.customer || {};

    const populatedUser = order.user || {};

    const customerName =
      (
        (customer.firstName || populatedUser.firstName || "") +
        " " +
        (customer.lastName || populatedUser.lastName || "")
      ).trim() || "Guest Customer";

    const orderDate =
      order.placedAt || order.createdAt;

    const formattedDate =
      orderDate
        ? new Date(orderDate).toLocaleDateString(
            "en-US",
            {
              month: "short",
              day: "numeric",
              year: "numeric"
            }
          )
        : "—";

    const total =
      Number(order.total || 0);

    const status =
      order.status || "pending";

    return `
      <tr>
        <td data-label="Order ID" class="order-id">
          ${order.orderNumber || "—"}
        </td>

        <td data-label="Product">
          <span class="order-product">
            ${
              productImage
                ? `
                  <img
                    class="order-product__img"
                    src="${productImage}"
                    alt="${productName}"
                  >
                `
                : ""
            }

            <span class="order-product__name">
              ${productName}
            </span>
          </span>
        </td>

        <td data-label="Customer">
          <span class="order-customer">
            ${customerName}
          </span>
        </td>

        <td data-label="Date">
          ${formattedDate}
        </td>

        <td data-label="Total" class="order-total">
          ${fmtMoney(total)}
        </td>

        <td data-label="Status">
          <span class="admin-badge admin-badge--${status}">
            ${STATUS_LABELS[status] || status}
          </span>
        </td>
      </tr>
    `;
  }).join("");
}



  // ---------------------------------------------------
  // RENDER — Transaction History
  // ---------------------------------------------------
  function renderZelleVerificationQueue(transactions) {
  const queue = document.getElementById("zelleVerificationQueue");
  const countEl = document.getElementById("zellePendingCount");
  const textEl = document.getElementById("zelleQueueText");
  if (!queue || !countEl) return;

  const pending = (Array.isArray(transactions) ? transactions : []).filter(function (txn) {
    return String(txn.provider || txn.method || "").toLowerCase() === "zelle" && String(txn.status || "").toLowerCase() === "pending";
  });

  countEl.textContent = String(pending.length);
  queue.hidden = pending.length === 0;
  if (textEl) {
    textEl.textContent = pending.length === 1
      ? "1 customer has reported sending a Zelle payment. Verify the actual receipt before approving the order."
      : `${pending.length} customers have reported sending Zelle payments. Verify the actual receipts before approving any orders.`;
  }
}

function renderTransactions() {
  const list =
    document.getElementById("transactionList");

  if (!list) return;

  const transactions =
    DASHBOARD_STATE.transactions;

  if (!transactions.length) {
    list.innerHTML =
      `<div class="dash-empty">
        No transactions yet.
      </div>`;

    return;
  }

  list.innerHTML = transactions.map(function (txn) {
    const amount =
      Number(txn.amount || 0);

    const formattedAmount =
      (txn.type === "debit" ? "-" : "+") +
      fmtMoney(amount);

    const transactionDate =
      txn.createdAt
        ? new Date(txn.createdAt)
        : null;

    const formattedTime =
      transactionDate
        ? transactionDate.toLocaleString(
            "en-US",
            {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit"
            }
          )
        : "—";

    return `
      <div class="txn-item">
        <div class="txn-item__body">
          <span class="txn-item__title">
            ${txn.title || "Transaction"}
          </span>

          <span class="txn-item__time">
            ${formattedTime}
          </span>
        </div>

        <span class="txn-item__amount is-${txn.type}">
          ${formattedAmount}
        </span>
      </div>
    `;
  }).join("");
}

  // ---------------------------------------------------
  // EARNINGS — computed live from real timestamps, so the
  // 24h/7d/30d windows are always accurate whenever this
  // loads. Replace EARNINGS_SOURCE with your real order/
  // payment records (each needs a real Date + amount) —
  // the math and rendering stay the same.
  // ---------------------------------------------------

  // ---------------------------------------------------
// NOTIFICATIONS — REAL BACKEND
// ---------------------------------------------------
let NOTIFICATIONS = [];

async function loadNotifications() {
  try {
    const data = await fetchAdminAPI(
      "/api/admin/notifications?limit=30"
    );

    const notifications = Array.isArray(data.notifications)
      ? data.notifications
      : [];

    NOTIFICATIONS = notifications.map(function (notification) {
      return {
        id: notification._id,

        type: normalizeNotificationType(
          notification.type
        ),

        title:
          notification.title ||
          "Notification",

        text:
          notification.message ||
          "",

        time:
          formatNotificationTime(
            notification.createdAt
          ),

        unread:
          notification.isRead !== true,

        rawType:
          notification.type,

        order:
          notification.order || null,

        transaction:
          notification.transaction || null,

        product:
          notification.product || null
      };
    });

    renderNotifications();

  } catch (error) {
    console.error(
      "Failed to load notifications:",
      error
    );

    NOTIFICATIONS = [];
    renderNotifications();
  }
}

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
  if (!dateValue) {
    return "—";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const now = new Date();

  const diffMs =
    now.getTime() -
    date.getTime();

  const diffMinutes =
    Math.floor(
      diffMs / 60000
    );

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return (
      diffMinutes +
      (diffMinutes === 1
        ? " minute ago"
        : " minutes ago")
    );
  }

  const diffHours =
    Math.floor(
      diffMinutes / 60
    );

  if (diffHours < 24) {
    return (
      diffHours +
      (diffHours === 1
        ? " hour ago"
        : " hours ago")
    );
  }

  const diffDays =
    Math.floor(
      diffHours / 24
    );

  if (diffDays < 7) {
    return (
      diffDays +
      (diffDays === 1
        ? " day ago"
        : " days ago")
    );
  }

  return date.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  );
}

  const NOTIF_ICONS = {
    order: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 8H20L19 20H5L4 8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 8V6C8 3.79 9.79 2 12 2C14.21 2 16 3.79 16 6V8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    payment: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="5.5" width="18" height="13" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3 9.5H21" stroke="currentColor" stroke-width="1.6"/></svg>',
    stock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 8L12 3L21 8V16L12 21L3 16V8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  };


 function fmtMoney(n) {
  return "$" + Number(n || 0).toFixed(2);
}

  function renderEarningsSkeleton() {
    const grid = document.getElementById("earningsGrid");
    if (!grid) return;
    grid.innerHTML = ["Today", "This Week", "This Month"].map(function (label, i) {
      return `
        <div class="earnings-card${i === 2 ? " earnings-card--highlight" : ""}">
          <span class="earnings-card__label">${label.toUpperCase()}</span>
          <span class="earnings-skeleton"></span>
          <span class="earnings-card__meta">&nbsp;</span>
        </div>`;
    }).join("");
  }


  function renderEarnings() {
  const grid =
    document.getElementById("earningsGrid");

  const updated =
    document.getElementById("earningsUpdated");

  if (!grid) return;

  const analytics =
    DASHBOARD_STATE.analytics;

  if (!analytics || !analytics.earnings) {
    grid.innerHTML =
      `<div class="dash-empty">
        Earnings unavailable.
      </div>`;

    return;
  }

  const earnings =
    analytics.earnings;

  const currency =
    analytics.currency || "USD";

  function formatCurrency(value) {
    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency: currency
      }
    ).format(Number(value || 0));
  }

  grid.innerHTML = `
    <div class="earnings-card">
      <span class="earnings-card__label">
        Today
      </span>

      <span class="earnings-card__value">
        ${formatCurrency(earnings.today)}
      </span>

      <span class="earnings-card__meta">
        Last 24 hours
      </span>
    </div>

    <div class="earnings-card">
      <span class="earnings-card__label">
        This Week
      </span>

      <span class="earnings-card__value">
        ${formatCurrency(earnings.week)}
      </span>

      <span class="earnings-card__meta">
        Last 7 days
      </span>
    </div>

    <div class="earnings-card earnings-card--highlight">
      <span class="earnings-card__label">
        This Month
      </span>

      <span class="earnings-card__value">
        ${formatCurrency(earnings.month)}
      </span>

      <span class="earnings-card__meta">
        Last 30 days
      </span>
    </div>
  `;

  if (updated) {
    const generatedAt =
      analytics.generatedAt
        ? new Date(analytics.generatedAt)
        : new Date();

    updated.textContent =
      "Updated " +
      generatedAt.toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      );
  }
}

 function initEarningsReload() {
  const btn =
    document.getElementById("earningsReloadBtn");

  if (!btn) return;

  btn.addEventListener("click", async function () {
    if (btn.classList.contains("is-loading")) {
      return;
    }

    btn.classList.add("is-loading");
    renderEarningsSkeleton();

    try {
      const data =
        await fetchAdminAPI(
          "/api/admin/dashboard/analytics"
        );

      DASHBOARD_STATE.analytics =
        data;

      renderEarnings();

    } catch (err) {
      console.error(
        "Dashboard analytics reload error:",
        err
      );

      const grid =
        document.getElementById("earningsGrid");

      if (grid) {
        grid.innerHTML =
          `<div class="dash-empty">
            Unable to load earnings.
          </div>`;
      }

    } finally {
      btn.classList.remove("is-loading");
    }
  });
}

function renderNotifications() {
  const list =
    document.getElementById("notifList");

  if (list) {
    if (!NOTIFICATIONS.length) {
      list.innerHTML =
        `<div class="dash-empty">
          No notifications.
        </div>`;
    } else {
      list.innerHTML =
        NOTIFICATIONS.map(function (n) {
          return `
            <div
              class="admin-notif__item${n.unread ? " is-unread" : ""}"
              data-notif-id="${n.id}"
            >
              <span class="admin-notif__icon">
                ${NOTIF_ICONS[n.type] || ""}
              </span>

              <span class="admin-notif__body">
                <span class="admin-notif__title">
                  ${escapeHtml(n.title)}
                </span>

                <span class="admin-notif__text">
                  ${escapeHtml(n.text)}
                </span>

                <span class="admin-notif__time">
                  ${escapeHtml(n.time)}
                </span>
              </span>

              <button
                type="button"
                class="admin-notif__dismiss"
                data-dismiss-id="${n.id}"
                aria-label="Dismiss notification"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M6 6L18 18M18 6L6 18"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>
          `;
        }).join("");
    }
  }

  const unreadCount =
    NOTIFICATIONS.filter(function (n) {
      return n.unread;
    }).length;

  const bellBadge =
    document.getElementById(
      "bellBadge"
    );

  const sidebarBadge =
    document.getElementById(
      "sidebarNotifCount"
    );

  if (bellBadge) {
    bellBadge.textContent =
      unreadCount;

    bellBadge.style.display =
      unreadCount
        ? ""
        : "none";
  }

  if (sidebarBadge) {
    sidebarBadge.textContent =
      unreadCount;

    sidebarBadge.style.display =
      unreadCount
        ? ""
        : "none";
  }
}

async function markNotificationAsRead(id) {
  try {
    await fetchAdminAPI(
      `/api/admin/notifications/${id}/read`,
      {
        method: "PATCH"
      }
    );

  } catch (error) {
    console.error(
      "Failed to mark notification as read:",
      error
    );
  }
}

  function initNotifDropdown() {
    const notif = document.getElementById("adminNotif");
    const toggle = document.getElementById("notifBellBtn");
    const menu = notif ? notif.querySelector(".admin-notif__menu") : null;
    if (!notif || !toggle) return;

    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      const opening = !notif.classList.contains("is-open");
      notif.classList.toggle("is-open");
      if (opening && window.AdminUI) window.AdminUI.positionDropdown(toggle, menu);
    });

    document.addEventListener("click", function (e) {
      if (!notif.contains(e.target)) notif.classList.remove("is-open");
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") notif.classList.remove("is-open");
    });

    window.addEventListener("resize", function () {
      if (notif.classList.contains("is-open") && window.AdminUI) window.AdminUI.positionDropdown(toggle, menu);
    });

    // Clicking an item opens the detail modal; clicking its dismiss
    // (x) button instead removes that notification from the list.
    notif.addEventListener("click", function (e) {
      const dismissBtn = e.target.closest(".admin-notif__dismiss");
      if (dismissBtn) {
        e.stopPropagation();
        dismissNotification(dismissBtn.dataset.dismissId);
        return;
      }
      const item =
  e.target.closest(
    ".admin-notif__item"
  );

if (!item) return;

const n =
  NOTIFICATIONS.find(
    function (x) {
      return (
        x.id ===
        item.dataset.notifId
      );
    }
  );

if (!n) return;

if (n.unread) {
  markNotificationAsRead(n.id);
}

n.unread = false;

renderNotifications();

notif.classList.remove(
  "is-open"
);

openNotifModal(n);
    });
  }

  async function dismissNotification(id) {
  const index =
    NOTIFICATIONS.findIndex(
      function (n) {
        return n.id === id;
      }
    );

  if (index === -1) {
    return;
  }

  try {
    await fetchAdminAPI(
      `/api/admin/notifications/${id}`,
      {
        method: "DELETE"
      }
    );

    NOTIFICATIONS.splice(
      index,
      1
    );

    renderNotifications();

  } catch (error) {
    console.error(
      "Failed to delete notification:",
      error
    );
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
    closeBtn && closeBtn.addEventListener("click", closeNotifModal);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNotifModal();
    });
  }

  async function loadDashboardData() {
  DASHBOARD_STATE.loading = true;

  try {
    const [
      overview,
      analytics,
      recentOrders,
      recentTransactions,
      allTransactions
    ] = await Promise.all([
      fetchAdminAPI(
        "/api/admin/dashboard/overview"
      ),

      fetchAdminAPI(
        "/api/admin/dashboard/analytics"
      ),

      fetchAdminAPI(
        "/api/admin/dashboard/recent-orders?limit=5"
      ),

      fetchAdminAPI(
        "/api/admin/dashboard/recent-transactions?limit=5"
      ),

      fetchAdminAPI(
        "/api/admin/transactions?limit=100&page=1"
      )
    ]);

    DASHBOARD_STATE.overview =
  overview.overview || overview || null;

DASHBOARD_STATE.analytics =
  analytics;

renderOverview();

    DASHBOARD_STATE.recentOrders =
      Array.isArray(recentOrders.orders)
        ? recentOrders.orders
        : [];

    DASHBOARD_STATE.transactions =
      Array.isArray(recentTransactions.transactions)
        ? recentTransactions.transactions
        : [];

    renderRecentOrders();
    renderTransactions();
    renderZelleVerificationQueue(allTransactions.transactions || []);
    renderEarnings();

    return true;

  } catch (err) {
    console.error(
      "Dashboard data loading error:",
      err
    );

    showDashboardError(
      err.message ||
      "Unable to load dashboard data."
    );

    return false;

  } finally {
    DASHBOARD_STATE.loading = false;
  }
}

function showDashboardError(message) {
  console.error("Dashboard:", message);

  const ordersBody =
    document.getElementById("recentOrdersBody");

  if (ordersBody) {
    ordersBody.innerHTML =
      `<tr>
        <td colspan="6" class="dash-empty">
          Unable to load recent orders.
        </td>
      </tr>`;
  }

  const transactionList =
    document.getElementById("transactionList");

  if (transactionList) {
    transactionList.innerHTML =
      `<div class="dash-empty">
        Unable to load transactions.
      </div>`;
  }

  const earningsGrid =
    document.getElementById("earningsGrid");

  if (earningsGrid) {
    earningsGrid.innerHTML =
      `<div class="dash-empty">
        Unable to load earnings.
      </div>`;
  }
}

async function init() {
  initEarningsReload();

  initNotifDropdown();

  initNotifModal();

  renderNotifications();

  await Promise.all([
    loadDashboardData(),
    loadNotifications()
  ]);
}

  document.addEventListener("DOMContentLoaded", init);
})();