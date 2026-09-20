const state = {
  token: localStorage.getItem("pb_token") || "",
  user: null,
  dashboard: null
};

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));
const API_BASE = (window.PB_API_BASE || localStorage.getItem("pb_api_base") || "").replace(/\/$/, "");
let pendingOrderDeleteId = null;
let pendingUserDeleteId = null;
let editingUserId = null;
let editingAnnouncementId = null;
let announcementImages = [];

function money(value) {
  return `$${Number(value || 0).toLocaleString("es-ES", { maximumFractionDigits: 0 })}`;
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

function formatDate(value) {
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
  return match ? `$${match[1]}` : "Sin importe";
}

function showOrderDeleteModal(orderId) {
  pendingOrderDeleteId = orderId;
  const modal = $("#orderDeleteModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.querySelector("[data-action='cancel-order-delete']").focus();
}

function hideOrderDeleteModal() {
  pendingOrderDeleteId = null;
  $("#orderDeleteModal")?.classList.add("hidden");
}

function canManageUsers() {
  return state.user?.role === "jefe";
}

function userStatusLabel(user) {
  return user.active === false ? "Inactivo" : "Activo";
}

function showUserMessage(message, type = "ok") {
  const box = $("#userMessage");
  if (!box) return;
  box.textContent = message;
  box.className = `notice user-message ${type === "error" ? "error-text" : ""}`;
  box.classList.remove("hidden");
}

function openUserModal(userId = null) {
  if (!canManageUsers()) return;
  editingUserId = userId;
  const modal = $("#userModal");
  const form = $("#userEditorForm");
  const user = state.dashboard.users.find(item => item.id === userId);
  form.reset();
  form.id.value = user?.id || "";
  form.username.value = user?.username || "";
  form.name.value = user?.name || "";
  form.email.value = user?.email || "";
  form.role.value = user?.role || "empleado";
  form.active.checked = user ? user.active !== false : true;
  form.password.required = !user;
  $("#userModalTitle").textContent = user ? "Editar usuario" : "Crear usuario";
  $("#passwordHelp").textContent = user ? "Dejalo vacio para mantener la contrasena actual." : "Minimo 4 caracteres.";
  modal.classList.remove("hidden");
  form.username.focus();
}

function closeUserModal() {
  editingUserId = null;
  $("#userModal")?.classList.add("hidden");
}

function openUserDeleteModal(userId) {
  if (!canManageUsers()) return;
  pendingUserDeleteId = userId;
  $("#userDeleteModal")?.classList.remove("hidden");
  $("#userDeleteModal")?.querySelector("[data-action='cancel-user-delete']")?.focus();
}

function closeUserDeleteModal() {
  pendingUserDeleteId = null;
  $("#userDeleteModal")?.classList.add("hidden");
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (error) {
    throw new Error(`No se puede conectar con la API en ${API_BASE || "esta web"}. Comprueba que el servidor del host tenga activas las rutas /api.`);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Error de conexion");
  return data;
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

function announcementSummary(item) {
  return item.summary || item.text || String(item.content || "").replace(/[#*_`>\[\]()~-]/g, "").slice(0, 160);
}

function resetAnnouncementEditor() {
  editingAnnouncementId = null;
  announcementImages = [];
  const form = $("#announcementForm");
  if (!form) return;
  form.reset();
  form.id.value = "";
  form.author.value = state.user?.name || "Pacific Bluffs";
  form.status.value = "publicado";
  form.visible.checked = true;
  $("#announcementFormTitle").textContent = "Crear anuncio";
  $("#announcementSubmit").textContent = "Publicar anuncio";
  renderAnnouncementImagePreview();
}

function editAnnouncement(id) {
  if (!canManageAny()) return;
  const item = state.dashboard.announcements.find(announcement => announcement.id === id);
  if (!item) return;
  editingAnnouncementId = id;
  announcementImages = Array.isArray(item.images) ? item.images.map(image => ({ ...image })) : [];
  if (item.coverImage && !announcementImages.some(image => image.src === item.coverImage)) {
    announcementImages.unshift({ id: `cover-${Date.now()}`, name: "Portada", src: item.coverImage, isCover: true });
  }
  announcementImages = announcementImages.map((image, index) => ({ ...image, isCover: image.src === item.coverImage || image.isCover || index === 0 }));
  const form = $("#announcementForm");
  form.id.value = item.id;
  form.title.value = item.title || "";
  form.summary.value = item.summary || item.text || "";
  form.category.value = item.category || "Comunicado";
  form.author.value = item.author || state.user?.name || "Pacific Bluffs";
  form.status.value = item.status || "publicado";
  form.featured.value = item.featured || "";
  form.content.value = item.content || item.text || "";
  form.visible.checked = item.visible !== false;
  $("#announcementFormTitle").textContent = "Editar anuncio";
  $("#announcementSubmit").textContent = "Guardar cambios";
  renderAnnouncementImagePreview();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderAnnouncementImagePreview() {
  const wrap = $("#announcementImagePreview");
  if (!wrap) return;
  wrap.innerHTML = announcementImages.length
    ? announcementImages.map(image => `
      <article class="image-preview-item">
        <img src="${escapeAttr(image.src)}" alt="${escapeAttr(image.name)}">
        <div>
          <strong>${escapeHtml(image.name || "Imagen")}</strong>
          <span>${image.isCover ? "Portada" : "Imagen adicional"}</span>
        </div>
        <button class="button ghost" data-action="set-announcement-cover" data-id="${escapeAttr(image.id)}" type="button">Portada</button>
        <button class="button danger" data-action="remove-announcement-image" data-id="${escapeAttr(image.id)}" type="button">Eliminar</button>
      </article>
    `).join("")
    : `<p class="form-note">Puedes publicar sin imagen o anadir una portada y galeria.</p>`;
}

function resizeImage(file) {
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!validTypes.includes(file.type)) {
    return Promise.reject(new Error("Solo se permiten imagenes JPG, PNG o WebP."));
  }
  if (file.size > 4_000_000) {
    return Promise.reject(new Error("La imagen supera 4 MB."));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("No se pudo procesar la imagen."));
      image.onload = () => {
        const max = 1400;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: file.name,
          src: canvas.toDataURL("image/jpeg", 0.82),
          isCover: announcementImages.length === 0
        });
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function applyEditorFormat(command) {
  const textarea = $("#announcementForm textarea[name='content']");
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || "texto";
  const formats = {
    bold: `**${selected}**`,
    italic: `*${selected}*`,
    h2: `## ${selected}`,
    h3: `### ${selected}`,
    list: `- ${selected}`,
    link: `[${selected}](https://)`,
    divider: `${selected}\n\n---\n`
  };
  const replacement = formats[command] || selected;
  textarea.setRangeText(replacement, start, end, "end");
  textarea.focus();
}

async function refreshDashboard() {
  if (!state.token) return;
  const response = await api("/api/dashboard");
  state.user = response.user;
  state.dashboard = response.data;
  $("#loginPanel").classList.add("hidden");
  $("#dashboard").classList.remove("hidden");
  $("#sessionName").textContent = state.user.name;
  $("#sessionRole").textContent = `Rol: ${state.user.role}`;
  $("#readonlyNotice").classList.toggle("hidden", canManageAny());
  renderDashboard();
}

function canManageAny() {
  return state.user && ["jefe", "encargado"].includes(state.user.role);
}

function canManageConventions() {
  return state.user && ["jefe", "encargado"].includes(state.user.role);
}

function disabledAttr(allowed = canManageAny()) {
  return allowed ? "" : "disabled";
}

function renderDashboard() {
  renderOrdersTab();
  renderContentTab();
  renderConventionsTab();
  renderUsersTab();
}

function renderOrdersTab() {
  const orders = state.dashboard.orders;
  if (!orders.length) {
    $("#tab-orders").innerHTML = `
      <div class="empty-state panel">
        <h3>No hay pedidos disponibles</h3>
        <p>Cuando un negocio envie un encargo, aparecera aqui para revisarlo, actualizarlo o eliminarlo.</p>
      </div>
    `;
    return;
  }

  $("#tab-orders").innerHTML = `
    <div class="orders-admin-list">
      ${orders.map(order => `
        <article class="panel admin-item order-admin-card">
          <div class="order-admin-head">
            <div>
              <span class="badge">${escapeHtml(order.code)} · ${statusLabel(order.status)}</span>
              <h3>Pedido ${escapeHtml(order.code)}</h3>
            </div>
            <strong class="order-amount">${extractOrderTotal(order.details)}</strong>
          </div>

          <div class="order-admin-meta">
            <span><strong>Cliente:</strong> ${escapeHtml(order.businessName)}</span>
            <span><strong>Fecha:</strong> ${formatDate(order.createdAt)}</span>
            <span><strong>Contacto:</strong> ${escapeHtml(order.contact || "Sin contacto")}</span>
          </div>

          <details class="order-details">
            <summary>Ver detalles</summary>
            <p>${escapeHtml(order.details)}</p>
            <p><strong>Nota:</strong> ${escapeHtml(order.note || "Sin nota")}</p>
          </details>

          <form class="orderStatusForm" data-id="${order.id}">
            <label>Estado
              <select name="status" ${disabledAttr()}>
                ${["recibido", "preparando", "listo", "entregado", "cancelado"].map(status => `<option value="${status}" ${order.status === status ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}
              </select>
            </label>
            <label>Nota visible
              <textarea name="note" ${disabledAttr()}>${escapeHtml(order.note || "")}</textarea>
            </label>
            <button class="button secondary" ${disabledAttr()} type="submit">Actualizar</button>
          </form>

          <div class="admin-actions">
            <button class="button danger orderDeleteButton" ${disabledAttr()} data-id="${order.id}" type="button">Eliminar pedido</button>
          </div>
        </article>
      `).join("")}
    </div>
    <div id="orderDeleteModal" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="orderDeleteTitle">
      <div class="modal-panel">
        <h3 id="orderDeleteTitle">Eliminar pedido</h3>
        <p>Estas seguro de que deseas eliminar este pedido?</p>
        <p class="form-note">Esta accion no se puede deshacer.</p>
        <div class="modal-actions">
          <button class="button ghost" data-action="cancel-order-delete" type="button">Cancelar</button>
          <button class="button danger" data-action="confirm-order-delete" type="button">Eliminar pedido</button>
        </div>
      </div>
    </div>
  `;
}

function renderContentTab() {
  const business = state.dashboard.business;
  $("#tab-content").innerHTML = `
    <div class="admin-grid">
      <form id="businessForm" class="panel">
        <h3>Datos principales</h3>
        <label>Texto principal
          <textarea name="tagline" ${disabledAttr()}>${escapeHtml(business.tagline)}</textarea>
        </label>
        <label>Imagen de carta
          <input name="menuImage" ${disabledAttr()} value="${escapeHtml(business.menuImage || "")}" placeholder="/mi-carta.png o URL">
        </label>
        <button class="button primary" ${disabledAttr()} type="submit">Guardar</button>
      </form>

      <form id="announcementForm" class="panel">
        <div class="panel-title">
          <span id="announcementFormTitle">Crear anuncio</span>
          <button class="button ghost" data-action="reset-announcement-editor" type="button">Nuevo</button>
        </div>
        <input name="id" type="hidden">
        <label>Titulo
          <input name="title" ${disabledAttr()} required>
        </label>
        <div class="form-grid">
          <label>Categoria
            <input name="category" ${disabledAttr()} value="Comunicado" required>
          </label>
          <label>Autor
            <input name="author" ${disabledAttr()} value="${escapeAttr(state.user?.name || "Pacific Bluffs")}" required>
          </label>
        </div>
        <label>Descripcion corta
          <textarea name="summary" ${disabledAttr()} maxlength="260" placeholder="Resumen visible en tarjetas y vista previa."></textarea>
        </label>
        <label>Informacion destacada
          <input name="featured" ${disabledAttr()} placeholder="Horario especial, requisito, aviso importante...">
        </label>
        <div class="rich-editor">
          <div class="editor-toolbar" aria-label="Formato del contenido">
            <button class="button ghost" data-format="bold" type="button">B</button>
            <button class="button ghost" data-format="italic" type="button">I</button>
            <button class="button ghost" data-format="h2" type="button">Titulo</button>
            <button class="button ghost" data-format="h3" type="button">Subtitulo</button>
            <button class="button ghost" data-format="list" type="button">Lista</button>
            <button class="button ghost" data-format="link" type="button">Enlace</button>
            <button class="button ghost" data-format="divider" type="button">Separador</button>
          </div>
          <label>Contenido completo
            <textarea name="content" ${disabledAttr()} required placeholder="Escribe el anuncio completo. Puedes usar negrita, titulos, listas, enlaces e imagenes."></textarea>
          </label>
        </div>
        <div class="announcement-uploader">
          <label>Imagenes del anuncio
            <input id="announcementImageInput" ${disabledAttr()} type="file" accept="image/png,image/jpeg,image/webp" multiple>
          </label>
          <p class="form-note">Opcional. Se optimizan antes de guardar. Maximo 8 imagenes, 4 MB por archivo.</p>
          <div id="announcementImagePreview" class="image-preview-list"></div>
        </div>
        <div class="form-grid">
          <label>Estado
            <select name="status" ${disabledAttr()}>
              <option value="publicado">Publicado</option>
              <option value="borrador">Borrador</option>
              <option value="archivado">Archivado</option>
            </select>
          </label>
          <label class="inline-check">
            <input name="visible" type="checkbox" ${disabledAttr()} checked>
            Visible para civiles
          </label>
        </div>
        <button id="announcementSubmit" class="button primary" ${disabledAttr()} type="submit">Publicar anuncio</button>
      </form>

      <form id="menuForm" class="panel">
        <h3>Producto de carta</h3>
        <label>Nombre
          <input name="name" ${disabledAttr()} required>
        </label>
        <label>Categoria
          <input name="category" ${disabledAttr()} value="Comida">
        </label>
        <label>Precio
          <input name="price" ${disabledAttr()} type="number" min="0" step="1" required>
        </label>
        <label>Descripcion
          <textarea name="description" ${disabledAttr()}></textarea>
        </label>
        <label class="inline-check">
          <input name="available" type="checkbox" ${disabledAttr()} checked>
          Disponible
        </label>
        <button class="button primary" ${disabledAttr()} type="submit">Guardar producto</button>
      </form>
    </div>
    <div class="admin-grid">
      <div class="panel">
        <h3>Anuncios actuales</h3>
        <div class="mini-list">${state.dashboard.announcements.map(item => announcementAdminRow(item)).join("")}</div>
      </div>
      <div class="panel">
        <h3>Carta actual</h3>
        <div class="mini-list">${state.dashboard.menuItems.map(item => adminRow(`${item.name} · ${money(item.price)}`, item.description, "menu", item.id)).join("")}</div>
      </div>
    </div>
  `;
  renderAnnouncementImagePreview();
}

function adminRow(title, text, type, id, allowed = canManageAny()) {
  return `
    <article class="card">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
      <div class="admin-actions">
        <button class="button ghost deleteButton" ${disabledAttr(allowed)} data-type="${type}" data-id="${id}" type="button">Eliminar</button>
      </div>
    </article>
  `;
}

function announcementAdminRow(item) {
  return `
    <article class="card announcement-admin-row">
      <span class="badge">${escapeHtml(item.category || "Comunicado")} · ${escapeHtml(item.status || "publicado")}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(announcementSummary(item))}</p>
      <div class="admin-actions">
        <button class="button ghost announcementEditButton" ${disabledAttr()} data-id="${escapeAttr(item.id)}" type="button">Editar</button>
        <button class="button danger deleteButton" ${disabledAttr()} data-type="announcement" data-id="${escapeAttr(item.id)}" type="button">Eliminar</button>
      </div>
    </article>
  `;
}

function renderConventionsTab() {
  const canEdit = canManageConventions();
  $("#tab-conventions").innerHTML = `
    <div class="admin-grid">
      <form id="conventionForm" class="panel">
        <h3>Crear convenio</h3>
        <label>Nombre
          <input name="name" ${disabledAttr(canEdit)} required>
        </label>
        <label>Descuento %
          <input name="discount" ${disabledAttr(canEdit)} type="number" min="0" max="100" step="1" value="0">
        </label>
        <label>Notas
          <textarea name="notes" ${disabledAttr(canEdit)}></textarea>
        </label>
        <label class="inline-check">
          <input name="active" type="checkbox" ${disabledAttr(canEdit)} checked>
          Activo
        </label>
        <button class="button primary" ${disabledAttr(canEdit)} type="submit">Guardar convenio</button>
      </form>

      <form id="invoiceForm" class="panel">
        <h3>Registrar factura</h3>
        <label>Convenio
          <select name="conventionId" ${disabledAttr(canEdit)}>
            ${state.dashboard.conventions.map(item => `<option value="${item.id}">${escapeHtml(item.name)} - ${item.discount}%</option>`).join("")}
          </select>
        </label>
        <label>Negocio
          <input name="businessName" ${disabledAttr(canEdit)} required>
        </label>
        <label>Subtotal
          <input name="subtotal" ${disabledAttr(canEdit)} type="number" min="0" step="1" required>
        </label>
        <label>Detalle
          <textarea name="details" ${disabledAttr(canEdit)}></textarea>
        </label>
        <button class="button primary" ${disabledAttr(canEdit)} type="submit">Guardar factura</button>
      </form>
    </div>
    <div class="admin-grid">
      <div class="panel">
        <h3>Convenios</h3>
        <div class="mini-list">${state.dashboard.conventions.map(item => adminRow(`${item.name} · ${item.discount}%`, item.notes, "conventions", item.id, canEdit)).join("")}</div>
      </div>
      <div class="panel">
        <h3>Facturas recientes</h3>
        <div class="mini-list">${state.dashboard.invoices.map(item => `
          <article class="card">
            <span class="badge">${escapeHtml(item.conventionName)} · ${item.discount}%</span>
            <h3>${escapeHtml(item.businessName)} · ${money(item.total)}</h3>
            <p>Subtotal ${money(item.subtotal)}. Creada por ${escapeHtml(item.createdBy)}.</p>
          </article>
        `).join("") || "<p class='form-note'>Sin facturas registradas.</p>"}</div>
      </div>
    </div>
  `;
}

function renderUsersTab() {
  const users = state.dashboard.users;
  const canEdit = canManageUsers();
  $("#tab-users").innerHTML = `
    <div class="users-header panel">
      <div>
        <h3>Usuarios</h3>
        <p>Gestiona los usuarios y sus permisos.</p>
      </div>
      <button class="button primary" ${canEdit ? "" : "disabled"} data-action="open-user-create" type="button">+ Crear usuario</button>
    </div>
    <div id="userMessage" class="notice user-message hidden"></div>
    <div class="panel users-table-wrap">
      <table class="users-table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td><strong>${escapeHtml(user.username)}</strong></td>
              <td>${escapeHtml(user.name || "-")}</td>
              <td>${escapeHtml(user.email || "-")}</td>
              <td><span class="badge">${escapeHtml(user.role)}</span></td>
              <td>${userStatusLabel(user)}</td>
              <td>
                <div class="table-actions">
                  <button class="button ghost userEditButton" ${canEdit ? "" : "disabled"} data-id="${user.id}" type="button">Editar</button>
                  <button class="button danger userDeleteButton" ${canEdit && user.id !== state.user.id ? "" : "disabled"} data-id="${user.id}" type="button">Eliminar</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <div id="userModal" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="userModalTitle">
      <form id="userEditorForm" class="modal-panel user-editor-form">
        <h3 id="userModalTitle">Crear usuario</h3>
        <input name="id" type="hidden">
        <label>Nombre de usuario
          <input name="username" required>
        </label>
        <label>Nombre completo
          <input name="name" required>
        </label>
        <label>Correo electronico
          <input name="email" type="email" placeholder="usuario@correo.com">
        </label>
        <label>Contrasena
          <input name="password" type="password">
          <span id="passwordHelp" class="form-note">Minimo 4 caracteres.</span>
        </label>
        <label>Rol
          <select name="role" required>
            <option value="jefe">Jefe</option>
            <option value="encargado">Encargado</option>
            <option value="empleado">Empleado</option>
          </select>
        </label>
        <label class="inline-check">
          <input name="active" type="checkbox" checked>
          Cuenta activa
        </label>
        <div class="modal-actions">
          <button class="button ghost" data-action="close-user-modal" type="button">Cancelar</button>
          <button class="button primary" type="submit">Guardar usuario</button>
        </div>
      </form>
    </div>
    <div id="userDeleteModal" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="userDeleteTitle">
      <div class="modal-panel">
        <h3 id="userDeleteTitle">Eliminar usuario</h3>
        <p>Estas seguro de que deseas eliminar este usuario?</p>
        <p class="form-note">Esta accion eliminara el acceso del usuario al sistema y no se podra deshacer.</p>
        <div class="modal-actions">
          <button class="button ghost" data-action="cancel-user-delete" type="button">Cancelar</button>
          <button class="button danger" data-action="confirm-user-delete" type="button">Eliminar usuario</button>
        </div>
      </div>
    </div>
  `;
}

async function handleDashboardSubmit(event) {
  const form = event.target;
  if (!form.matches("form")) return;
  event.preventDefault();

  if (form.id === "userEditorForm") {
    if (!canManageUsers()) return;
    const data = Object.fromEntries(new FormData(form).entries());
    data.active = form.active.checked;
    if (!data.username || !data.name || !data.role) {
      showUserMessage("Rellena usuario, nombre y rol.", "error");
      return;
    }
    if (!editingUserId && !data.password) {
      showUserMessage("La contrasena es obligatoria al crear usuarios.", "error");
      return;
    }
    if (data.password && data.password.length < 4) {
      showUserMessage("La contrasena debe tener al menos 4 caracteres.", "error");
      return;
    }
    const path = editingUserId ? `/api/users/${encodeURIComponent(editingUserId)}` : "/api/users";
    const method = editingUserId ? "PUT" : "POST";
    try {
      const wasEditing = Boolean(editingUserId);
      await api(path, { method, body: JSON.stringify(data) });
      closeUserModal();
      await refreshDashboard();
      showUserMessage(wasEditing ? "Usuario actualizado correctamente." : "Usuario creado correctamente.");
    } catch (error) {
      showUserMessage(error.message, "error");
    }
    return;
  }

  if ((form.id === "conventionForm" || form.id === "invoiceForm") && !canManageConventions()) return;
  if (!["conventionForm", "invoiceForm"].includes(form.id) && !canManageAny()) return;

  const data = Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll("input[type='checkbox']").forEach(input => {
    data[input.name] = input.checked;
  });

  if (form.matches(".orderStatusForm")) {
    await api("/api/order-status", { method: "POST", body: JSON.stringify({ id: form.dataset.id, ...data }) });
  } else if (form.id === "businessForm") {
    await api("/api/business", { method: "PUT", body: JSON.stringify(data) });
  } else if (form.id === "announcementForm") {
    data.id = editingAnnouncementId || data.id || "";
    data.visible = form.visible.checked;
    data.images = announcementImages.map(image => ({ ...image }));
    data.coverImage = announcementImages.find(image => image.isCover)?.src || "";
    data.text = data.summary;
    await api("/api/announcements", { method: "POST", body: JSON.stringify(data) });
    editingAnnouncementId = null;
    announcementImages = [];
  } else if (form.id === "menuForm") {
    await api("/api/menu", { method: "POST", body: JSON.stringify(data) });
  } else if (form.id === "conventionForm") {
    await api("/api/conventions", { method: "POST", body: JSON.stringify(data) });
  } else if (form.id === "invoiceForm") {
    await api("/api/invoices", { method: "POST", body: JSON.stringify(data) });
  }

  await refreshDashboard();
  if (form.id === "announcementForm") resetAnnouncementEditor();
}

async function handleDashboardClick(event) {
  const tab = event.target.closest(".tab");
  if (tab) {
    $$(".tab").forEach(item => item.classList.toggle("active", item === tab));
    $$(".tab-panel").forEach(item => item.classList.toggle("active", item.id === tab.dataset.tab));
    return;
  }

  const orderDeleteButton = event.target.closest(".orderDeleteButton");
  if (orderDeleteButton) {
    if (!canManageAny()) return;
    showOrderDeleteModal(orderDeleteButton.dataset.id);
    return;
  }

  const modalAction = event.target.closest("[data-action]");
  if (modalAction?.dataset.action === "cancel-order-delete") {
    hideOrderDeleteModal();
    return;
  }

  if (modalAction?.dataset.action === "confirm-order-delete") {
    if (!pendingOrderDeleteId) return;
    await api(`/api/orders/${encodeURIComponent(pendingOrderDeleteId)}`, { method: "DELETE" });
    hideOrderDeleteModal();
    await refreshDashboard();
    return;
  }

  if (modalAction?.dataset.action === "open-user-create") {
    openUserModal();
    return;
  }

  if (modalAction?.dataset.action === "reset-announcement-editor") {
    resetAnnouncementEditor();
    return;
  }

  if (modalAction?.dataset.action === "set-announcement-cover") {
    announcementImages = announcementImages.map(image => ({ ...image, isCover: image.id === modalAction.dataset.id }));
    renderAnnouncementImagePreview();
    return;
  }

  if (modalAction?.dataset.action === "remove-announcement-image") {
    const removedCover = announcementImages.find(image => image.id === modalAction.dataset.id)?.isCover;
    announcementImages = announcementImages.filter(image => image.id !== modalAction.dataset.id);
    if (removedCover && announcementImages[0]) announcementImages[0].isCover = true;
    renderAnnouncementImagePreview();
    return;
  }

  const formatButton = event.target.closest("[data-format]");
  if (formatButton) {
    applyEditorFormat(formatButton.dataset.format);
    return;
  }

  if (modalAction?.dataset.action === "close-user-modal") {
    closeUserModal();
    return;
  }

  if (modalAction?.dataset.action === "cancel-user-delete") {
    closeUserDeleteModal();
    return;
  }

  if (modalAction?.dataset.action === "confirm-user-delete") {
    if (!pendingUserDeleteId) return;
    try {
      await api(`/api/users/${encodeURIComponent(pendingUserDeleteId)}`, { method: "DELETE" });
      closeUserDeleteModal();
      await refreshDashboard();
      showUserMessage("Usuario eliminado correctamente.");
    } catch (error) {
      closeUserDeleteModal();
      showUserMessage(error.message, "error");
    }
    return;
  }

  const userEditButton = event.target.closest(".userEditButton");
  if (userEditButton) {
    openUserModal(userEditButton.dataset.id);
    return;
  }

  const userDeleteButton = event.target.closest(".userDeleteButton");
  if (userDeleteButton) {
    openUserDeleteModal(userDeleteButton.dataset.id);
    return;
  }

  const announcementEditButton = event.target.closest(".announcementEditButton");
  if (announcementEditButton) {
    editAnnouncement(announcementEditButton.dataset.id);
    return;
  }

  const deleteButton = event.target.closest(".deleteButton");
  if (!deleteButton) return;
  const type = deleteButton.dataset.type;
  if (type === "conventions" && !canManageConventions()) return;
  if (type !== "conventions" && !canManageAny()) return;
  const id = deleteButton.dataset.id;
  const path = type === "announcement" ? `/api/announcements/${id}` : type === "menu" ? `/api/menu/${id}` : `/api/conventions/${id}`;
  await api(path, { method: "DELETE" });
  await refreshDashboard();
}

function bindEvents() {
  $("#loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    $("#loginError").textContent = "";
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await api("/api/login", { method: "POST", body: JSON.stringify(data) });
      state.token = response.token;
      state.user = response.user;
      localStorage.setItem("pb_token", state.token);
      await refreshDashboard();
    } catch (error) {
      $("#loginError").textContent = error.message;
    }
  });

  $("#logoutButton").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("pb_token");
    state.token = "";
    state.user = null;
    state.dashboard = null;
    $("#dashboard").classList.add("hidden");
    $("#loginPanel").classList.remove("hidden");
  });

  $("#dashboard").addEventListener("submit", handleDashboardSubmit);
  $("#dashboard").addEventListener("click", handleDashboardClick);
  $("#dashboard").addEventListener("change", async event => {
    if (event.target.id !== "announcementImageInput") return;
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    try {
      const remaining = Math.max(0, 8 - announcementImages.length);
      const processed = await Promise.all(files.slice(0, remaining).map(resizeImage));
      announcementImages = [...announcementImages, ...processed];
      if (!announcementImages.some(image => image.isCover) && announcementImages[0]) announcementImages[0].isCover = true;
      renderAnnouncementImagePreview();
      event.target.value = "";
    } catch (error) {
      alert(error.message);
    }
  });
}

async function init() {
  bindEvents();
  if (state.token) {
    refreshDashboard().catch(() => {
      localStorage.removeItem("pb_token");
      state.token = "";
    });
  }
}

init().catch(error => {
  document.body.insertAdjacentHTML("afterbegin", `<div class="notice">${escapeHtml(error.message)}</div>`);
});
