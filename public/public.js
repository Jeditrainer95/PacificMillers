const publicState = {
  publicData: null,
  orderItems: {},
  activeAnnouncement: null
};

const $ = selector => document.querySelector(selector);
const API_BASE = (window.PB_API_BASE || localStorage.getItem("pb_api_base") || "").replace(/\/$/, "");

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

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

function card(title, text, extra = "") {
  return `<article class="card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p>${extra}</article>`;
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

function formatDateShort(value) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function announcementUrl(id) {
  return location.protocol === "file:" ? `anuncios.html?id=${encodeURIComponent(id)}` : `/anuncios/${encodeURIComponent(id)}`;
}

function currentAnnouncementId() {
  const directPath = location.pathname.match(/\/anuncios\/([^/]+)/);
  if (directPath) return decodeURIComponent(directPath[1]);
  return new URLSearchParams(location.search).get("id");
}

function announcementSummary(item) {
  return item.summary || item.text || String(item.content || "").replace(/[#*_`>\[\]()~-]/g, "").slice(0, 180);
}

function announcementCover(item, mode = "card") {
  if (item.coverImage) {
    return `<img src="${escapeAttr(item.coverImage)}" alt="${escapeAttr(item.title)}">`;
  }
  return `
    <div class="announcement-cover-empty ${mode === "hero" ? "large" : ""}" aria-hidden="true">
      <span>Pacific Bluffs</span>
      <strong>${escapeHtml((item.category || "Aviso").slice(0, 2).toUpperCase())}</strong>
    </div>
  `;
}

function renderMarkdown(value) {
  const lines = String(value || "").replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let listOpen = false;

  function closeList() {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  }

  function inline(text) {
    return escapeHtml(text)
      .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+|\/[^)\s]+|data:image\/[^)\s]+)\)/g, '<img src="$2" alt="$1">')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      return;
    }
    if (trimmed === "---") {
      closeList();
      html.push("<hr>");
      return;
    }
    if (trimmed.startsWith("### ")) {
      closeList();
      html.push(`<h3>${inline(trimmed.slice(4))}</h3>`);
      return;
    }
    if (trimmed.startsWith("## ")) {
      closeList();
      html.push(`<h2>${inline(trimmed.slice(3))}</h2>`);
      return;
    }
    if (trimmed.startsWith("# ")) {
      closeList();
      html.push(`<h2>${inline(trimmed.slice(2))}</h2>`);
      return;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${inline(trimmed.replace(/^[-*]\s+/, ""))}</li>`);
      return;
    }
    closeList();
    html.push(`<p>${inline(trimmed)}</p>`);
  });

  closeList();
  return html.join("");
}

function renderAnnouncementCard(item) {
  return `
    <article class="announcement-card" data-announcement-id="${escapeAttr(item.id)}">
      <button class="announcement-card-hit" data-action="preview-announcement" data-id="${escapeAttr(item.id)}" type="button" aria-label="Ver anuncio ${escapeAttr(item.title)}"></button>
      <div class="announcement-cover">${announcementCover(item)}</div>
      <div class="announcement-card-body">
        <div class="announcement-meta">
          <span>${escapeHtml(item.category || "Comunicado")}</span>
          <span>${escapeHtml(formatDateShort(item.createdAt))}</span>
        </div>
        <h2>${escapeHtml(item.title)}</h2>
        <p>${escapeHtml(announcementSummary(item))}</p>
        <div class="announcement-foot">
          <span>${escapeHtml(item.author || "Pacific Bluffs")}</span>
          <span class="badge">${escapeHtml(item.status || "publicado")}</span>
        </div>
        <button class="button ghost announcement-preview-button" data-action="preview-announcement" data-id="${escapeAttr(item.id)}" type="button">Ver anuncio</button>
      </div>
    </article>
  `;
}

function renderAnnouncementList(announcements) {
  const wrap = $("#announcements");
  if (!wrap) return;
  wrap.innerHTML = announcements.length
    ? announcements.map(renderAnnouncementCard).join("")
    : `<div class="empty-state panel"><h3>No hay anuncios disponibles</h3><p>Cuando el equipo publique comunicados, apareceran aqui.</p></div>`;
}

function renderAnnouncementModal(item) {
  const firstLines = String(item.content || item.text || "").split("\n").filter(Boolean).slice(0, 3).join("\n");
  return `
    <div id="announcementPreviewModal" class="modal-backdrop announcement-preview-modal" role="dialog" aria-modal="true" aria-labelledby="announcementPreviewTitle">
      <article class="modal-panel announcement-preview-panel">
        <div class="announcement-preview-media">${announcementCover(item, "hero")}</div>
        <div class="announcement-preview-content">
          <div class="announcement-meta">
            <span>${escapeHtml(item.category || "Comunicado")}</span>
            <span>${escapeHtml(formatDateTime(item.createdAt))}</span>
          </div>
          <h2 id="announcementPreviewTitle">${escapeHtml(item.title)}</h2>
          <p>${escapeHtml(announcementSummary(item))}</p>
          <div class="announcement-preview-facts">
            <span><strong>Autor</strong>${escapeHtml(item.author || "Pacific Bluffs")}</span>
            <span><strong>Estado</strong>${escapeHtml(item.status || "publicado")}</span>
          </div>
          ${item.featured ? `<div class="announcement-featured"><strong>Destacado</strong><p>${escapeHtml(item.featured)}</p></div>` : ""}
          <div class="announcement-excerpt">${renderMarkdown(firstLines)}</div>
          <div class="modal-actions">
            <button class="button ghost" data-action="close-announcement-preview" type="button">Cerrar</button>
            <a class="button primary" href="${announcementUrl(item.id)}">Leer anuncio completo</a>
          </div>
        </div>
      </article>
    </div>
  `;
}

function openAnnouncementPreview(id) {
  const item = publicState.publicData?.announcements.find(announcement => announcement.id === id);
  if (!item) return;
  $("#announcementPreviewModal")?.remove();
  document.body.insertAdjacentHTML("beforeend", renderAnnouncementModal(item));
  $("#announcementPreviewModal [data-action='close-announcement-preview']")?.focus();
}

function closeAnnouncementPreview() {
  $("#announcementPreviewModal")?.remove();
}

async function renderAnnouncementDetail(id) {
  const container = $("#announcementDetail");
  if (!container) return;
  container.innerHTML = `
    <article class="announcement-detail-shell">
      <span class="skeleton skeleton-badge"></span>
      <span class="skeleton skeleton-title"></span>
      <span class="skeleton"></span>
    </article>
  `;
  try {
    let item = publicState.publicData?.announcements.find(announcement => announcement.id === id);
    if (!item) item = await api(`/api/announcements/${encodeURIComponent(id)}`);
    document.title = `${item.title} | Pacific Bluffs`;
    container.innerHTML = `
      <article class="announcement-detail-shell">
        <a class="back-link" href="${location.protocol === "file:" ? "anuncios.html" : "/anuncios"}">← Volver a anuncios</a>
        <header class="announcement-detail-header">
          <div>
            <p class="eyebrow">${escapeHtml(item.category || "Comunicado")}</p>
            <h1>${escapeHtml(item.title)}</h1>
          </div>
          <div class="announcement-detail-meta">
            <span><strong>Autor</strong>${escapeHtml(item.author || "Pacific Bluffs")}</span>
            <span><strong>Publicado</strong>${escapeHtml(formatDateTime(item.createdAt))}</span>
            <span><strong>Estado</strong>${escapeHtml(item.status || "publicado")}</span>
          </div>
        </header>
        <div class="announcement-detail-cover">${announcementCover(item, "hero")}</div>
        ${item.featured ? `<aside class="announcement-featured"><strong>Destacado</strong><p>${escapeHtml(item.featured)}</p></aside>` : ""}
        <div class="announcement-content">${renderMarkdown(item.content || item.text || item.summary)}</div>
        ${item.images?.length ? `
          <section class="announcement-gallery" aria-label="Imagenes del anuncio">
            ${item.images.filter(image => image.src !== item.coverImage).map(image => `<img src="${escapeAttr(image.src)}" alt="${escapeAttr(image.name || item.title)}">`).join("")}
          </section>
        ` : ""}
        <a class="button ghost back-button" href="${location.protocol === "file:" ? "anuncios.html" : "/anuncios"}">← Volver a anuncios</a>
      </article>
    `;
  } catch (error) {
    container.innerHTML = `<div class="empty-state panel"><h3>Anuncio no encontrado</h3><p>No hemos encontrado este comunicado o ya no esta publicado.</p><a class="button ghost" href="/anuncios">Volver a anuncios</a></div>`;
  }
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
        <div><span>Metodo de pago</span><strong>No indicado</strong></div>
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
      <p>No hemos encontrado ningun pedido asociado a este codigo. Comprueba que el codigo introducido sea correcto e intentalo de nuevo.</p>
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
      <h3>Pedido realizado correctamente</h3>
      <p>Tu codigo de pedido es:</p>
      <strong>${escapeHtml(order.code)}</strong>
      <p>Guarda este codigo para poder consultar el estado de tu pedido posteriormente.</p>
      <button class="button ghost copyOrderCode" data-code="${escapeHtml(order.code)}" type="button">Copiar codigo</button>
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

  const detailText = lines.map(item => `${item.quantity}x ${item.name} (${money(item.price)} c/u)`).join(", ");
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

  const detailId = currentAnnouncementId();
  if (detailId) {
    $("#announcementListView")?.classList.add("hidden");
    await renderAnnouncementDetail(detailId);
  } else {
    renderAnnouncementList(announcements);
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
  document.addEventListener("click", async event => {
    const previewButton = event.target.closest("[data-action='preview-announcement']");
    if (previewButton) {
      openAnnouncementPreview(previewButton.dataset.id);
      return;
    }

    if (event.target.closest("[data-action='close-announcement-preview']") || event.target.id === "announcementPreviewModal") {
      closeAnnouncementPreview();
      return;
    }

    const copyButton = event.target.closest(".copyOrderCode");
    if (!copyButton) return;
    await navigator.clipboard?.writeText(copyButton.dataset.code).catch(() => {});
    copyButton.textContent = "Codigo copiado";
    setTimeout(() => {
      copyButton.textContent = "Copiar codigo";
    }, 1800);
  });

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
}

async function init() {
  bindEvents();
  await loadPublic();
}

init().catch(error => {
  document.body.insertAdjacentHTML("afterbegin", `<div class="notice">${escapeHtml(error.message)}</div>`);
});
