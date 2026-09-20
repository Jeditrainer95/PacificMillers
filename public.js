const publicState = {
  publicData: null,
  orderItems: {}
};

const $ = selector => document.querySelector(selector);
const API_BASE = location.port === "4321" ? "" : "http://localhost:4321";

function money(value) {
  return `$${Number(value || 0).toLocaleString("es-ES", { maximumFractionDigits: 0 })}`;
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const url = path.startsWith("/api/") ? `${API_BASE}${path}` : path;
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Error de conexion");
  return data;
}

async function loadPublicData() {
  try {
    return await api("/api/public");
  } catch (error) {
    return api("public-data.json");
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function card(title, text, extra = "") {
  return `<article class="card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p>${extra}</article>`;
}

function groupByCategory(items) {
  return items.reduce((groups, item) => {
    const category = item.category || "Carta";
    if (!groups[category]) groups[category] = [];
    groups[category].push(item);
    return groups;
  }, {});
}

function statusLabel(status) {
  return {
    recibido: "Recibido",
    preparando: "Preparando",
    listo: "Listo para recoger",
    entregado: "Entregado",
    cancelado: "Cancelado"
  }[status] || status;
}

function formatDateTime(value) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function extractOrderTotal(details) {
  const match = String(details || "").match(/Total estimado:\s*\$?([\d.,]+)/i);
  return match ? `$${match[1]}` : "No indicado";
}

function parseOrderProducts(details) {
  const productPart = String(details || "").split(". Total estimado:")[0];
  return productPart
    .split(",")
    .map(part => {
      const clean = part.trim();
      const match = clean.match(/^(\d+)x\s+(.+?)(?:\s+\(\$?([\d.,]+)\s+c\/u\))?$/i);
      if (!match) return clean ? { quantity: "", name: clean, unit: "" } : null;
      return { quantity: match[1], name: match[2], unit: match[3] ? `$${match[3]} c/u` : "" };
    })
    .filter(Boolean);
}

function renderStatusProgress(status) {
  const steps = [
    { id: "recibido", label: "Pedido recibido" },
    { id: "preparando", label: "Preparando" },
    { id: "listo", label: "Listo" },
    { id: "entregado", label: "Entregado" }
  ];
  if (status === "cancelado") {
    return `
      <div class="status-progress">
        <div class="status-step current">
          <span>!</span>
          <strong>Pedido cancelado</strong>
        </div>
      </div>
    `;
  }
  const currentIndex = Math.max(0, steps.findIndex(step => step.id === status));
  return `
    <div class="status-progress">
      ${steps.map((step, index) => {
        const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "pending";
        const marker = state === "done" ? "✓" : state === "current" ? "•" : "";
        return `
          <div class="status-step ${state}">
            <span>${marker}</span>
            <strong>${step.label}</strong>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderOrderLookup(order) {
  const products = parseOrderProducts(order.details);
  const total = extractOrderTotal(order.details);
  return `
    <article class="lookup-card">
      <div class="lookup-card-head">
        <div>
          <span class="badge">${statusLabel(order.status)}</span>
          <h3>Pedido #${escapeHtml(order.code)}</h3>
        </div>
        <strong>${escapeHtml(total)}</strong>
      </div>

      <div class="lookup-facts">
        <div><span>Fecha del pedido</span><strong>${formatDateTime(order.createdAt)}</strong></div>
        <div><span>Cliente</span><strong>${escapeHtml(order.businessName || "No indicado")}</strong></div>
        <div><span>Método de pago</span><strong>No indicado</strong></div>
      </div>

      <div class="lookup-products">
        <h4>Productos solicitados</h4>
        ${products.length ? products.map(item => `
          <div class="lookup-product-line">
            <span>${item.quantity ? `${escapeHtml(item.quantity)}x ` : ""}${escapeHtml(item.name)}</span>
            <strong>${escapeHtml(item.unit || "")}</strong>
          </div>
        `).join("") : `<p class="form-note">${escapeHtml(order.details || "Sin detalle de productos.")}</p>`}
      </div>

      <div class="lookup-status">
        <h4>Estado del pedido</h4>
        ${renderStatusProgress(order.status)}
        <p>${escapeHtml(order.note || "Sin notas del equipo.")}</p>
      </div>
    </article>
  `;
}

function renderOrderNotFound() {
  return `
    <article class="lookup-error">
      <h3>Pedido no encontrado</h3>
      <p>No hemos encontrado ningún pedido asociado a este código. Comprueba que el código introducido sea correcto e inténtalo de nuevo.</p>
    </article>
  `;
}

function renderOrderLookupLoading() {
  return `
    <article class="lookup-card lookup-loading" aria-live="polite">
      <div class="lookup-card-head">
        <div>
          <span class="skeleton skeleton-badge"></span>
          <span class="skeleton skeleton-title"></span>
        </div>
        <span class="skeleton skeleton-total"></span>
      </div>
      <div class="lookup-facts">
        <div><span class="skeleton"></span><strong class="skeleton"></strong></div>
        <div><span class="skeleton"></span><strong class="skeleton"></strong></div>
        <div><span class="skeleton"></span><strong class="skeleton"></strong></div>
      </div>
    </article>
  `;
}

function renderCreatedOrder(order) {
  return `
    <div class="order-created-card">
      <h3>¡Pedido realizado correctamente!</h3>
      <p>Tu código de pedido es:</p>
      <strong>${escapeHtml(order.code)}</strong>
      <p>Guarda este código para poder consultar el estado de tu pedido posteriormente.</p>
      <button class="button ghost copyOrderCode" data-code="${escapeHtml(order.code)}" type="button">Copiar código</button>
    </div>
  `;
}

function selectedOrderLines() {
  const items = publicState.publicData?.menuItems || [];
  return Object.entries(publicState.orderItems)
    .map(([id, quantity]) => {
      const item = items.find(menuItem => menuItem.id === id);
      return item && quantity > 0 ? { ...item, quantity } : null;
    })
    .filter(Boolean);
}

function renderOrderSummary() {
  const summary = $("#orderSummary");
  const total = $("#orderTotal");
  const detailsInput = document.querySelector("#orderForm input[name='details']");
  if (!summary || !total || !detailsInput) return;

  const lines = selectedOrderLines();
  const amount = lines.reduce((sum, item) => sum + item.price * item.quantity, 0);
  total.textContent = money(amount);

  if (!lines.length) {
    summary.textContent = "Selecciona productos para preparar el encargo.";
    detailsInput.value = "";
    return;
  }

  const detailText = lines
    .map(item => `${item.quantity}x ${item.name} (${money(item.price)} c/u)`)
    .join(", ");
  summary.innerHTML = lines.map(item => `
    <div class="order-summary-line">
      <span>${item.quantity}x ${escapeHtml(item.name)}</span>
      <strong>${money(item.price * item.quantity)}</strong>
    </div>
  `).join("");
  detailsInput.value = `${detailText}. Total estimado: ${money(amount)}`;
}

function renderOrderMenuPicker() {
  const picker = $("#orderMenuPicker");
  if (!picker) return;
  const groupedMenu = groupByCategory(publicState.publicData?.menuItems || []);
  picker.innerHTML = Object.entries(groupedMenu).map(([category, items]) => `
    <section class="order-picker-category">
      <h4>${escapeHtml(category)}</h4>
      <div class="order-picker-grid">
        ${items.map(item => `
          <article class="order-product">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <span>${money(item.price)}</span>
            </div>
            <div class="quantity-control" data-id="${item.id}">
              <button type="button" data-action="decrease" aria-label="Quitar ${escapeHtml(item.name)}">-</button>
              <output>${publicState.orderItems[item.id] || 0}</output>
              <button type="button" data-action="increase" aria-label="Agregar ${escapeHtml(item.name)}">+</button>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");
  renderOrderSummary();
}

async function loadPublic() {
  publicState.publicData = await loadPublicData();
  const { business, announcements, menuItems } = publicState.publicData;
  const tagline = $("#businessTagline");
  if (tagline) tagline.textContent = business.tagline;

  const announcementsWrap = $("#announcements");
  if (announcementsWrap) {
    announcementsWrap.innerHTML = announcements.length
      ? announcements.map(item => card(item.title, item.text)).join("")
      : card("Sin anuncios", "Todavia no hay comunicados visibles.");
  }

  const menuImage = $("#menuImage");
  const menuImageWrap = $("#menuImageWrap");
  if (menuImage && menuImageWrap) {
    if (business.menuImage) {
      menuImage.src = business.menuImage;
      menuImageWrap.classList.remove("hidden");
    } else {
      menuImageWrap.classList.add("hidden");
    }
  }

  const menuItemsWrap = $("#menuItems");
  if (menuItemsWrap) {
    const groupedMenu = groupByCategory(menuItems);
    menuItemsWrap.innerHTML = Object.entries(groupedMenu).map(([category, items]) => `
      <section class="menu-category">
        <div class="menu-category-heading">
          <h2>${escapeHtml(category)}</h2>
          <span>${items.length} productos</span>
        </div>
        <div class="menu-category-grid">
          ${items.map(item => `
            <article class="menu-item">
              <div>
                <h3>${escapeHtml(item.name)}</h3>
                <p>${escapeHtml(item.description)}</p>
              </div>
              <strong class="price">${money(item.price)}</strong>
            </article>
          `).join("")}
        </div>
      </section>
    `).join("");
  }

  renderOrderMenuPicker();
}

function bindEvents() {
  const orderPicker = $("#orderMenuPicker");
  if (orderPicker) {
    orderPicker.addEventListener("click", event => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const control = button.closest(".quantity-control");
      const id = control.dataset.id;
      const current = publicState.orderItems[id] || 0;
      publicState.orderItems[id] = button.dataset.action === "increase" ? current + 1 : Math.max(0, current - 1);
      if (publicState.orderItems[id] === 0) delete publicState.orderItems[id];
      control.querySelector("output").textContent = publicState.orderItems[id] || 0;
      renderOrderSummary();
    });
  }

  const orderForm = $("#orderForm");
  if (orderForm) {
    orderForm.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const submitButton = form.querySelector("button[type='submit']");
      const data = Object.fromEntries(new FormData(form).entries());
      if (!data.details) {
        $("#orderResult").textContent = "Selecciona al menos un producto de la carta.";
        $("#orderResult").classList.remove("hidden");
        return;
      }
      if (data.notes) data.details = `${data.details}. Notas: ${data.notes}`;
      submitButton.disabled = true;
      submitButton.textContent = "Enviando...";
      const order = await api("/api/orders", { method: "POST", body: JSON.stringify(data) });
      const result = $("#orderResult");
      result.innerHTML = renderCreatedOrder(order);
      result.classList.remove("hidden");
      form.reset();
      publicState.orderItems = {};
      renderOrderMenuPicker();
      submitButton.disabled = false;
      submitButton.textContent = "Enviar encargo";
    });
  }

  const trackForm = $("#trackForm");
  if (trackForm) {
    trackForm.addEventListener("submit", async event => {
      event.preventDefault();
      const submitButton = trackForm.querySelector("button[type='submit']");
      const code = String(new FormData(event.currentTarget).get("code") || "").trim().toUpperCase();
      const result = $("#trackResult");
      result.innerHTML = renderOrderLookupLoading();
      submitButton.disabled = true;
      submitButton.textContent = "Consultando...";
      try {
        const order = await api(`/api/orders/${encodeURIComponent(code)}`);
        result.innerHTML = renderOrderLookup(order);
      } catch (error) {
        result.innerHTML = renderOrderNotFound();
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Consultar pedido";
      }
    });
  }

  document.addEventListener("click", async event => {
    const copyButton = event.target.closest(".copyOrderCode");
    if (!copyButton) return;
    await navigator.clipboard?.writeText(copyButton.dataset.code).catch(() => {});
    copyButton.textContent = "Código copiado";
    setTimeout(() => {
      copyButton.textContent = "Copiar código";
    }, 1800);
  });
}

async function init() {
  bindEvents();
  await loadPublic();
}

init().catch(error => {
  document.body.insertAdjacentHTML("afterbegin", `<div class="notice">${escapeHtml(error.message)}</div>`);
});
