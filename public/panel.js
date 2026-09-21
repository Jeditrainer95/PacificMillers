// ============================================================
// ESTADO GLOBAL DE LA APLICACIÓN
// ============================================================
// Guarda el token JWT, el usuario logueado y los datos del dashboard.
// El token se persiste en localStorage para mantener la sesión.
const state = {
	token: localStorage.getItem("pb_token") || "",
	user: null,
	dashboard: null,
};

// ============================================================
// HELPERS DE DOM
// ============================================================
// $  -> devuelve el primer elemento que coincide con el selector.
const $ = (selector) => document.querySelector(selector);
// $$ -> devuelve un array con todos los elementos que coinciden.
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

// URL base de la API. En desarrollo (puerto 4321) usa la misma web,
// en producción apunta al backend desplegado en Wasmer.
const API_BASE =
	location.port === "4321" ? "" : "https://pacificmillers.wasmer.app";

// Variables para controlar modales y edición de usuarios.
let pendingOrderDeleteId = null;
let pendingUserDeleteId = null;
let editingUserId = null;

// ============================================================
// FUNCIONES DE FORMATO
// ============================================================

/**
 * Formatea un número como moneda en euros (sin decimales).
 * @param {number|string} value - Valor a formatear.
 * @returns {string} Ej: "$1.250"
 */
function money(value) {
	return `$${Number(value || 0).toLocaleString("es-ES", { maximumFractionDigits: 0 })}`;
}

/**
 * Traduce el estado interno de un pedido a una etiqueta legible.
 * @param {string} status - Estado interno (recibido, preparando, ...).
 * @returns {string} Etiqueta en español.
 */
function statusLabel(status) {
	return (
		{
			recibido: "Recibido",
			preparando: "Preparando",
			listo: "Listo para recoger",
			entregado: "Entregado",
			cancelado: "Cancelado",
		}[status] || status
	);
}

/**
 * Formatea una fecha ISO a formato local español.
 * @param {string} value - Fecha en formato ISO.
 * @returns {string} Fecha legible o "Sin fecha".
 */
function formatDate(value) {
	if (!value) return "Sin fecha";
	return new Date(value).toLocaleString("es-ES", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/**
 * Extrae el total estimado desde el campo "details" de un pedido.
 * Busca el patrón "Total estimado: $123" o similar.
 * @param {string} details - Texto con los detalles del pedido.
 * @returns {string} Importe formateado o "Sin importe".
 */
function extractOrderTotal(details) {
	const match = String(details || "").match(/Total estimado:\s*\$?([\d.,]+)/i);
	return match ? `$${match[1]}` : "Sin importe";
}

// ============================================================
// MODALES DE ELIMINACIÓN DE PEDIDOS
// ============================================================

/**
 * Muestra el modal de confirmación para eliminar un pedido.
 * @param {string} orderId - ID del pedido a eliminar.
 */
function showOrderDeleteModal(orderId) {
	pendingOrderDeleteId = orderId;
	const modal = $("#orderDeleteModal");
	if (!modal) return;
	modal.classList.remove("hidden");
	modal.querySelector("[data-action='cancel-order-delete']").focus();
}

/** Oculta el modal de eliminación de pedidos y resetea el ID pendiente. */
function hideOrderDeleteModal() {
	pendingOrderDeleteId = null;
	$("#orderDeleteModal")?.classList.add("hidden");
}

// ============================================================
// PERMISOS Y ROLES
// ============================================================

/**
 * Indica si el usuario actual puede gestionar usuarios.
 * Solo el rol "jefe" tiene permiso.
 * @returns {boolean}
 */
function canManageUsers() {
	return state.user?.role === "jefe";
}

/**
 * Devuelve la etiqueta de estado de un usuario (Activo/Inactivo).
 * @param {object} user - Objeto usuario.
 * @returns {string}
 */
function userStatusLabel(user) {
	return user.active === false ? "Inactivo" : "Activo";
}

// ============================================================
// MENSAJES DE USUARIO
// ============================================================

/**
 * Muestra un mensaje en el panel de usuarios (debajo de la cabecera).
 * @param {string} message - Texto a mostrar.
 * @param {string} type - "ok" o "error".
 */
function showUserMessage(message, type = "ok") {
	const box = $("#userMessage");
	if (!box) {
		// Si no existe el contenedor (por ejemplo, aún no se renderizó),
		// mostramos un alert como fallback para no perder el feedback.
		alert(message);
		return;
	}
	box.textContent = message;
	box.className = `notice user-message ${type === "error" ? "error-text" : ""}`;
	box.classList.remove("hidden");
}

/**
 * Muestra un mensaje DENTRO del modal de usuario.
 * Sirve para que el usuario vea el error aunque esté dentro del modal.
 * @param {string} message - Texto a mostrar.
 * @param {string} type - "ok" o "error".
 */
function showUserModalMessage(message, type = "ok") {
	const box = $("#userModalMessage");
	if (!box) return;
	box.textContent = message;
	box.className = `notice user-message ${type === "error" ? "error-text" : ""}`;
	box.classList.remove("hidden");
}

/** Limpia el mensaje interno del modal de usuario. */
function clearUserModalMessage() {
	const box = $("#userModalMessage");
	if (!box) return;
	box.textContent = "";
	box.classList.add("hidden");
}

// ============================================================
// CRUD DE USUARIOS - MODAL DE CREAR/EDITAR
// ============================================================

/**
 * Abre el modal de usuario para crear (userId=null) o editar.
 * Rellena el formulario con los datos del usuario si se está editando.
 * @param {string|null} userId - ID del usuario a editar o null para crear.
 */
function openUserModal(userId = null) {
	if (!canManageUsers()) {
		showUserMessage(
			"Solo el rol 'jefe' puede gestionar usuarios.",
			"error",
		);
		return;
	}
	editingUserId = userId;
	const modal = $("#userModal");
	const form = $("#userEditorForm");
	const user = state.dashboard.users.find((item) => item.id === userId);

	form.reset();
	form.id.value = user?.id || "";
	form.username.value = user?.username || "";
	form.name.value = user?.name || "";
	form.email.value = user?.email || "";
	form.role.value = user?.role || "empleado";
	form.active.checked = user ? user.active !== false : true;
	// La contraseña solo es obligatoria al crear.
	form.password.required = !user;

	$("#userModalTitle").textContent = user ? "Editar usuario" : "Crear usuario";
	$("#passwordHelp").textContent = user
		? "Dejalo vacio para mantener la contrasena actual."
		: "Minimo 4 caracteres.";

	clearUserModalMessage();
	modal.classList.remove("hidden");
	form.username.focus();
}

/** Cierra el modal de edición/creación de usuario. */
function closeUserModal() {
	editingUserId = null;
	clearUserModalMessage();
	$("#userModal")?.classList.add("hidden");
}

// ============================================================
// CRUD DE USUARIOS - MODAL DE ELIMINACIÓN
// ============================================================

/**
 * Abre el modal de confirmación para eliminar un usuario.
 * @param {string} userId - ID del usuario a eliminar.
 */
function openUserDeleteModal(userId) {
	if (!canManageUsers()) return;
	pendingUserDeleteId = userId;
	$("#userDeleteModal")?.classList.remove("hidden");
	$("#userDeleteModal")
		?.querySelector("[data-action='cancel-user-delete']")
		?.focus();
}

/** Cierra el modal de eliminación de usuario y resetea el ID pendiente. */
function closeUserDeleteModal() {
	pendingUserDeleteId = null;
	$("#userDeleteModal")?.classList.add("hidden");
}

// ============================================================
// LLAMADAS A LA API
// ============================================================

/**
 * Realiza una petición fetch a la API.
 * Añade automáticamente el token JWT si existe.
 * @param {string} path - Ruta relativa (ej: "/api/users").
 * @param {object} options - Opciones de fetch (method, body, headers...).
 * @returns {Promise<object>} Datos JSON de la respuesta.
 */
async function api(path, options = {}) {
	const headers = {
		"Content-Type": "application/json",
		...(options.headers || {}),
	};
	if (state.token) headers.Authorization = `Bearer ${state.token}`;

	let response;
	try {
		response = await fetch(`${API_BASE}${path}`, { ...options, headers });
	} catch (error) {
		throw new Error(
			`No se puede conectar con la API en ${API_BASE || "esta web"}. Arranca node server.js y recarga.`,
		);
	}

	const data = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`);
	return data;
}

// ============================================================
// SEGURIDAD - ESCAPE DE HTML
// ============================================================

/**
 * Escapa caracteres especiales HTML para prevenir XSS.
 * @param {*} value - Valor a escapar.
 * @returns {string} Valor seguro para insertar en HTML.
 */
function escapeHtml(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

// ============================================================
// REFRESCO DEL DASHBOARD
// ============================================================

/**
 * Carga los datos del dashboard desde la API y actualiza el estado.
 * Si no hay token, no hace nada.
 */
async function refreshDashboard() {
	if (!state.token) return;
	const response = await api("/api/dashboard");
	state.user = response.user;
	state.dashboard = response.data;

	// Muestra el dashboard y oculta el login.
	$("#loginPanel").classList.add("hidden");
	$("#dashboard").classList.remove("hidden");
	$("#sessionName").textContent = state.user.name;
	$("#sessionRole").textContent = `Rol: ${state.user.role}`;
	// Aviso de solo lectura si el usuario no puede gestionar nada.
	$("#readonlyNotice").classList.toggle("hidden", canManageAny());
	renderDashboard();
}

/**
 * Indica si el usuario puede gestionar contenido (jefe o encargado).
 * @returns {boolean}
 */
function canManageAny() {
	return state.user && ["jefe", "encargado"].includes(state.user.role);
}

/**
 * Indica si el usuario puede gestionar convenios (jefe o encargado).
 * @returns {boolean}
 */
function canManageConventions() {
	return state.user && ["jefe", "encargado"].includes(state.user.role);
}

/**
 * Devuelve el atributo "disabled" si el usuario no tiene permiso.
 * @param {boolean} allowed - Si el usuario tiene permiso.
 * @returns {string} "" o "disabled".
 */
function disabledAttr(allowed = canManageAny()) {
	return allowed ? "" : "disabled";
}

// ============================================================
// RENDERIZADO PRINCIPAL
// ============================================================

/** Renderiza todas las pestañas del dashboard. */
function renderDashboard() {
	renderOrdersTab();
	renderContentTab();
	renderConventionsTab();
	renderUsersTab();
}

// ============================================================
// PESTAÑA DE PEDIDOS
// ============================================================

/** Renderiza la lista de pedidos con opciones de actualizar y eliminar. */
function renderOrdersTab() {
	const orders = state.dashboard.orders;

	// Si no hay pedidos, muestra estado vacío.
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
      ${orders
				.map(
					(order) => `
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
                ${["recibido", "preparando", "listo", "entregado", "cancelado"].map((status) => `<option value="${status}" ${order.status === status ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}
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
      `,
				)
				.join("")}
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

// ============================================================
// PESTAÑA DE CONTENIDO (negocio, anuncios, carta)
// ============================================================

/** Renderiza los formularios de negocio, anuncios y carta, más las listas actuales. */
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
        <h3>Nuevo anuncio</h3>
        <label>Titulo
          <input name="title" ${disabledAttr()} required>
        </label>
        <label>Texto
          <textarea name="text" ${disabledAttr()} required></textarea>
        </label>
        <label class="inline-check">
          <input name="visible" type="checkbox" ${disabledAttr()} checked>
          Visible para civiles
        </label>
        <button class="button primary" ${disabledAttr()} type="submit">Publicar</button>
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
        <div class="mini-list">${state.dashboard.announcements.map((item) => adminRow(item.title, item.text, "announcement", item.id)).join("")}</div>
      </div>
      <div class="panel">
        <h3>Carta actual</h3>
        <div class="mini-list">${state.dashboard.menuItems.map((item) => adminRow(`${item.name} · ${money(item.price)}`, item.description, "menu", item.id)).join("")}</div>
      </div>
    </div>
  `;
}

/**
 * Genera una fila (card) con título, texto y botón de eliminar.
 * @param {string} title - Título de la card.
 * @param {string} text - Texto descriptivo.
 * @param {string} type - Tipo de recurso (announcement, menu, conventions).
 * @param {string} id - ID del recurso.
 * @param {boolean} allowed - Si el usuario puede eliminar.
 * @returns {string} HTML de la card.
 */
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

// ============================================================
// PESTAÑA DE CONVENIOS Y FACTURAS
// ============================================================

/** Renderiza los formularios de convenios/facturas y sus listas. */
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
            ${state.dashboard.conventions.map((item) => `<option value="${item.id}">${escapeHtml(item.name)} - ${item.discount}%</option>`).join("")}
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
        <div class="mini-list">${state.dashboard.conventions.map((item) => adminRow(`${item.name} · ${item.discount}%`, item.notes, "conventions", item.id, canEdit)).join("")}</div>
      </div>
      <div class="panel">
        <h3>Facturas recientes</h3>
        <div class="mini-list">${
					state.dashboard.invoices
						.map(
							(item) => `
          <article class="card">
            <span class="badge">${escapeHtml(item.conventionName)} · ${item.discount}%</span>
            <h3>${escapeHtml(item.businessName)} · ${money(item.total)}</h3>
            <p>Subtotal ${money(item.subtotal)}. Creada por ${escapeHtml(item.createdBy)}.</p>
          </article>
        `,
						)
						.join("") || "<p class='form-note'>Sin facturas registradas.</p>"
				}</div>
      </div>
    </div>
  `;
}

// ============================================================
// PESTAÑA DE USUARIOS (CRUD COMPLETO)
// ============================================================

/**
 * Renderiza la tabla de usuarios con acciones de editar/eliminar,
 * y los modales de creación/edición y confirmación de borrado.
 */
function renderUsersTab() {
	const users = state.dashboard.users;
	const canEdit = canManageUsers();

	$("#tab-users").innerHTML = `
    <!-- Cabecera con botón de crear usuario -->
    <div class="users-header panel">
      <div>
        <h3>Usuarios</h3>
        <p>Gestiona los usuarios y sus permisos.</p>
      </div>
      <button class="button primary" ${canEdit ? "" : "disabled"} data-action="open-user-create" type="button">+ Crear usuario</button>
    </div>

    <!-- Contenedor de mensajes (éxito/error) -->
    <div id="userMessage" class="notice user-message hidden"></div>

    <!-- Tabla de usuarios -->
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
          ${users
						.map(
							(user) => `
            <tr>
              <td><strong>${escapeHtml(user.username)}</strong></td>
              <td>${escapeHtml(user.name || "-")}</td>
              <td>${escapeHtml(user.email || "-")}</td>
              <td><span class="badge">${escapeHtml(user.role)}</span></td>
              <td>${userStatusLabel(user)}</td>
              <td>
                <div class="table-actions">
                  <!-- Botón editar: siempre que el usuario pueda gestionar -->
                  <button class="button ghost userEditButton" ${canEdit ? "" : "disabled"} data-id="${user.id}" type="button">Editar</button>
                  <!-- Botón eliminar: no permitido sobre uno mismo -->
                  <button class="button danger userDeleteButton" ${canEdit && user.id !== state.user.id ? "" : "disabled"} data-id="${user.id}" type="button">Eliminar</button>
                </div>
              </td>
            </tr>
          `,
						)
						.join("")}
        </tbody>
      </table>
    </div>

    <!-- Modal de crear/editar usuario -->
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
        <!-- Mensaje interno del modal (para feedback inmediato) -->
        <div id="userModalMessage" class="notice user-message hidden"></div>
        <div class="modal-actions">
          <button class="button ghost" data-action="close-user-modal" type="button">Cancelar</button>
          <button class="button primary" type="submit">Guardar usuario</button>
        </div>
      </form>
    </div>

    <!-- Modal de confirmación de borrado -->
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

// ============================================================
// MANEJO DE ENVÍOS DE FORMULARIOS
// ============================================================

/**
 * Maneja el submit de cualquier formulario dentro del dashboard.
 * Distingue entre formularios de usuario, convenio, factura, etc.
 * @param {Event} event - Evento submit.
 */
async function handleDashboardSubmit(event) {
	const form = event.target;
	if (!form.matches("form")) return;

	// ⚠️ IMPORTANTE: preventDefault SIEMPRE, antes de cualquier return.
	// Así evitamos que el navegador recargue la página si hay un error.
	event.preventDefault();

	// ----- FORMULARIO DE USUARIO (crear/editar) -----
	if (form.id === "userEditorForm") {
		if (!canManageUsers()) {
			showUserModalMessage(
				"Solo el rol 'jefe' puede gestionar usuarios.",
				"error",
			);
			return;
		}

		const data = Object.fromEntries(new FormData(form).entries());
		data.active = form.active.checked;

		// Validaciones básicas
		if (!data.username || !data.name || !data.role) {
			showUserModalMessage("Rellena usuario, nombre y rol.", "error");
			return;
		}
		if (!editingUserId && !data.password) {
			showUserModalMessage(
				"La contrasena es obligatoria al crear usuarios.",
				"error",
			);
			return;
		}
		if (data.password && data.password.length < 4) {
			showUserModalMessage(
				"La contrasena debe tener al menos 4 caracteres.",
				"error",
			);
			return;
		}

		// Si estamos editando -> PUT, si no -> POST
		const path = editingUserId
			? `/api/users/${encodeURIComponent(editingUserId)}`
			: "/api/users";
		const method = editingUserId ? "PUT" : "POST";

		// Feedback visual: deshabilitamos el botón mientras se envía.
		const submitBtn = form.querySelector("button[type='submit']");
		const originalText = submitBtn?.textContent;
		if (submitBtn) {
			submitBtn.disabled = true;
			submitBtn.textContent = "Guardando...";
		}
		clearUserModalMessage();

		try {
			const wasEditing = Boolean(editingUserId);
			console.log(`[user] ${method} ${path}`, data);

			const response = await api(path, {
				method,
				body: JSON.stringify(data),
			});
			console.log("[user] respuesta:", response);

			closeUserModal();
			await refreshDashboard();
			showUserMessage(
				wasEditing
					? "Usuario actualizado correctamente."
					: "Usuario creado correctamente.",
			);
		} catch (error) {
			console.error("[user] error:", error);
			showUserModalMessage(error.message, "error");
		} finally {
			// Restauramos el botón siempre.
			if (submitBtn) {
				submitBtn.disabled = false;
				submitBtn.textContent = originalText || "Guardar usuario";
			}
		}
		return;
	}

	// ----- RESTO DE FORMULARIOS -----
	// Convenios y facturas solo para jefe/encargado.
	if (
		(form.id === "conventionForm" || form.id === "invoiceForm") &&
		!canManageConventions()
	)
		return;
	// El resto de formularios requieren permisos de gestión general.
	if (!["conventionForm", "invoiceForm"].includes(form.id) && !canManageAny())
		return;

	const data = Object.fromEntries(new FormData(form).entries());
	// Convierte checkboxes a booleanos.
	form.querySelectorAll("input[type='checkbox']").forEach((input) => {
		data[input.name] = input.checked;
	});

	try {
		if (form.matches(".orderStatusForm")) {
			await api("/api/order-status", {
				method: "POST",
				body: JSON.stringify({ id: form.dataset.id, ...data }),
			});
		} else if (form.id === "businessForm") {
			await api("/api/business", { method: "PUT", body: JSON.stringify(data) });
		} else if (form.id === "announcementForm") {
			await api("/api/announcements", {
				method: "POST",
				body: JSON.stringify(data),
			});
		} else if (form.id === "menuForm") {
			await api("/api/menu", { method: "POST", body: JSON.stringify(data) });
		} else if (form.id === "conventionForm") {
			await api("/api/conventions", {
				method: "POST",
				body: JSON.stringify(data),
			});
		} else if (form.id === "invoiceForm") {
			await api("/api/invoices", { method: "POST", body: JSON.stringify(data) });
		}

		await refreshDashboard();
	} catch (error) {
		console.error("[form] error:", error);
		alert(error.message);
	}
}

// ============================================================
// MANEJO DE CLICS (tabs, modales, botones CRUD)
// ============================================================

/**
 * Maneja todos los clics dentro del dashboard:
 * - Cambio de pestañas.
 * - Apertura/cierre de modales.
 * - Eliminación de pedidos, usuarios, anuncios, menú, convenios.
 * - Edición de usuarios.
 * @param {Event} event - Evento click.
 */
async function handleDashboardClick(event) {
	// ----- CAMBIO DE PESTAÑA -----
	const tab = event.target.closest(".tab");
	if (tab) {
		$$(".tab").forEach((item) => item.classList.toggle("active", item === tab));
		$$(".tab-panel").forEach((item) =>
			item.classList.toggle("active", item.id === tab.dataset.tab),
		);
		return;
	}

	// ----- ELIMINAR PEDIDO -----
	const orderDeleteButton = event.target.closest(".orderDeleteButton");
	if (orderDeleteButton) {
		if (!canManageAny()) return;
		showOrderDeleteModal(orderDeleteButton.dataset.id);
		return;
	}

	// ----- ACCIONES DE MODALES (data-action) -----
	const modalAction = event.target.closest("[data-action]");

	if (modalAction?.dataset.action === "cancel-order-delete") {
		hideOrderDeleteModal();
		return;
	}

	if (modalAction?.dataset.action === "confirm-order-delete") {
		if (!pendingOrderDeleteId) return;
		await api(`/api/orders/${encodeURIComponent(pendingOrderDeleteId)}`, {
			method: "DELETE",
		});
		hideOrderDeleteModal();
		await refreshDashboard();
		return;
	}

	// ----- CRUD USUARIOS: ABRIR MODAL DE CREAR -----
	if (modalAction?.dataset.action === "open-user-create") {
		openUserModal();
		return;
	}

	// ----- CRUD USUARIOS: CERRAR MODAL DE EDITAR -----
	if (modalAction?.dataset.action === "close-user-modal") {
		closeUserModal();
		return;
	}

	// ----- CRUD USUARIOS: CANCELAR ELIMINACIÓN -----
	if (modalAction?.dataset.action === "cancel-user-delete") {
		closeUserDeleteModal();
		return;
	}

	// ----- CRUD USUARIOS: CONFIRMAR ELIMINACIÓN -----
	if (modalAction?.dataset.action === "confirm-user-delete") {
		if (!pendingUserDeleteId) return;
		try {
			await api(`/api/users/${encodeURIComponent(pendingUserDeleteId)}`, {
				method: "DELETE",
			});
			closeUserDeleteModal();
			await refreshDashboard();
			showUserMessage("Usuario eliminado correctamente.");
		} catch (error) {
			closeUserDeleteModal();
			showUserMessage(error.message, "error");
		}
		return;
	}

	// ----- CRUD USUARIOS: BOTÓN EDITAR -----
	const userEditButton = event.target.closest(".userEditButton");
	if (userEditButton) {
		openUserModal(userEditButton.dataset.id);
		return;
	}

	// ----- CRUD USUARIOS: BOTÓN ELIMINAR -----
	const userDeleteButton = event.target.closest(".userDeleteButton");
	if (userDeleteButton) {
		openUserDeleteModal(userDeleteButton.dataset.id);
		return;
	}

	// ----- ELIMINAR ANUNCIOS / MENÚ / CONVENIOS -----
	const deleteButton = event.target.closest(".deleteButton");
	if (!deleteButton) return;
	const type = deleteButton.dataset.type;
	if (type === "conventions" && !canManageConventions()) return;
	if (type !== "conventions" && !canManageAny()) return;

	const id = deleteButton.dataset.id;
	const path =
		type === "announcement"
			? `/api/announcements/${id}`
			: type === "menu"
				? `/api/menu/${id}`
				: `/api/conventions/${id}`;

	await api(path, { method: "DELETE" });
	await refreshDashboard();
}

// ============================================================
// EVENTOS GLOBALES (login, logout, dashboard)
// ============================================================

/** Vincula los eventos de login, logout y delegación en el dashboard. */
function bindEvents() {
	// ----- LOGIN -----
	$("#loginForm").addEventListener("submit", async (event) => {
		event.preventDefault();
		$("#loginError").textContent = "";
		const data = Object.fromEntries(
			new FormData(event.currentTarget).entries(),
		);
		try {
			const response = await api("/api/login", {
				method: "POST",
				body: JSON.stringify(data),
			});
			state.token = response.token;
			state.user = response.user;
			localStorage.setItem("pb_token", state.token);
			await refreshDashboard();
		} catch (error) {
			$("#loginError").textContent = error.message;
		}
	});

	// ----- LOGOUT -----
	$("#logoutButton").addEventListener("click", async () => {
		await api("/api/logout", { method: "POST" }).catch(() => {});
		localStorage.removeItem("pb_token");
		state.token = "";
		state.user = null;
		state.dashboard = null;
		$("#dashboard").classList.add("hidden");
		$("#loginPanel").classList.remove("hidden");
	});

	// ----- DELEGACIÓN DE EVENTOS EN EL DASHBOARD -----
	// Un solo listener para submit y otro para click.
	$("#dashboard").addEventListener("submit", handleDashboardSubmit);
	$("#dashboard").addEventListener("click", handleDashboardClick);
}

// ============================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ============================================================

/**
 * Punto de entrada:
 * - Vincula los eventos globales.
 * - Si hay token guardado, intenta refrescar el dashboard.
 * - Si el token es inválido, lo elimina y vuelve al login.
 */
async function init() {
	bindEvents();
	if (state.token) {
		refreshDashboard().catch(() => {
			// Token inválido o expirado: limpiamos sesión.
			localStorage.removeItem("pb_token");
			state.token = "";
		});
	}
}

// Ejecuta la inicialización y, si falla, muestra el error en pantalla.
init().catch((error) => {
	document.body.insertAdjacentHTML(
		"afterbegin",
		`<div class="notice">${escapeHtml(error.message)}</div>`,
	);
});
