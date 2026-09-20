const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4321);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

const sessions = new Map();

function now() {
  return new Date().toISOString();
}

function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

function seededUser(username, name, role, password, email = "") {
  const salt = crypto.randomBytes(12).toString("hex");
  return {
    id: crypto.randomUUID(),
    username,
    name,
    email,
    role,
    active: true,
    salt,
    passwordHash: hashPassword(password, salt),
    createdAt: now()
  };
}

function seedDatabase() {
  return {
    business: {
      name: "Pacific Bluffs",
      tagline: "Cocina fresca, pedidos al momento y convenios para negocios de Los Santos.",
      menuImage: "",
      updatedAt: now()
    },
    users: [
      seededUser("jefe", "Direccion Pacific Bluffs", "jefe", "Pacific2026!", "jefe@pacificbluffs.local"),
      seededUser("encargado", "Encargado de turno", "encargado", "Encargado2026!", "encargado@pacificbluffs.local"),
      seededUser("empleado", "Equipo de sala", "empleado", "Empleado2026!", "empleado@pacificbluffs.local")
    ],
    announcements: [
      {
        id: crypto.randomUUID(),
        title: "Apertura de temporada",
        text: "Pacific Bluffs abre con terraza, cocteles sin alcohol y servicio de pedidos para negocios.",
        visible: true,
        createdAt: now()
      },
      {
        id: crypto.randomUUID(),
        title: "Pedidos para empresas",
        text: "Los negocios aliados pueden hacer encargos y revisar el estado desde esta web.",
        visible: true,
        createdAt: now()
      }
    ],
    menuItems: [
      { id: crypto.randomUUID(), name: "Aros de cebolla", category: "Salado", price: 14, description: "Aros de cebolla crujientes y dorados, perfectos para picar.", available: true },
      { id: crypto.randomUUID(), name: "Ensalada caprese", category: "Salado", price: 16, description: "Tomate fresco, mozzarella y albahaca, alinados con aceite de oliva.", available: true },
      { id: crypto.randomUUID(), name: "Ensalada de gambas al coco", category: "Salado", price: 20, description: "Gambas al coco, frescas y sabrosas, con un toque tropical.", available: true },
      { id: crypto.randomUUID(), name: "Focaccia", category: "Salado", price: 15, description: "Pan italiano esponjoso, horneado con aceite de oliva y hierbas aromaticas.", available: true },
      { id: crypto.randomUUID(), name: "Sandwich de jamon queso", category: "Salado", price: 320, description: "Pan tostado con jamon y queso fundido, sencillo y delicioso.", available: true },
      { id: crypto.randomUUID(), name: "Tostada de aguacate", category: "Salado", price: 14, description: "Pan tostado con jamon y queso fundido, sencillo y delicioso.", available: true },
      { id: crypto.randomUUID(), name: "Bunuelos", category: "Dulce", price: 14, description: "Bunuelos caseros, dorados por fuera y tiernos por dentro, con un toque dulce.", available: true },
      { id: crypto.randomUUID(), name: "Helado de frutas", category: "Dulce", price: 13, description: "Helado cremoso de frutas variadas, dulce y refrescante.", available: true },
      { id: crypto.randomUUID(), name: "Macedonia de frutas", category: "Dulce", price: 13, description: "Frutas frescas variadas, jugosas y llenas de sabor.", available: true },
      { id: crypto.randomUUID(), name: "Agua", category: "Bebidas sin alcohol", price: 15, description: "Agua fresca.", available: true },
      { id: crypto.randomUUID(), name: "Blue Balls", category: "Bebidas sin alcohol", price: 17, description: "Bebida refrescante sin alcohol.", available: true },
      { id: crypto.randomUUID(), name: "Cherry Popper", category: "Bebidas sin alcohol", price: 17, description: "Bebida dulce y refrescante sin alcohol.", available: true },
      { id: crypto.randomUUID(), name: "Crotch Rocket", category: "Bebidas sin alcohol", price: 17, description: "Bebida fria sin alcohol.", available: true },
      { id: crypto.randomUUID(), name: "Crush limon/naranja", category: "Bebidas sin alcohol", price: 14, description: "Refresco de limon o naranja.", available: true },
      { id: crypto.randomUUID(), name: "eCola", category: "Bebidas sin alcohol", price: 14, description: "Refresco de cola.", available: true },
      { id: crypto.randomUUID(), name: "Zumo de naranja", category: "Bebidas sin alcohol", price: 16, description: "Zumo de naranja fresco.", available: true },
      { id: crypto.randomUUID(), name: "Gintonic", category: "Cocktails & Alcohol", price: 22, description: "Ginebra y tonica, con un toque citrico y refrescante.", available: true },
      { id: crypto.randomUUID(), name: "Campari", category: "Cocktails & Alcohol", price: 22, description: "Licor italiano de sabor amargo y notas citricas.", available: true },
      { id: crypto.randomUUID(), name: "Cerveza", category: "Cocktails & Alcohol", price: 17, description: "Cerveza refrescante, de sabor suave y ligeramente amargo.", available: true },
      { id: crypto.randomUUID(), name: "Champagne", category: "Cocktails & Alcohol", price: 21, description: "Vino espumoso de burbujas finas, fresco y elegante.", available: true },
      { id: crypto.randomUUID(), name: "Fuego de Jalisco", category: "Cocktails & Alcohol", price: 21, description: "Tequila, citricos y un toque picante.", available: true },
      { id: crypto.randomUUID(), name: "Long Island", category: "Cocktails & Alcohol", price: 24, description: "Coctel intenso con vodka, ron, ginebra, tequila, triple sec, limon y cola.", available: true },
      { id: crypto.randomUUID(), name: "Margarita Azteca", category: "Cocktails & Alcohol", price: 21, description: "Coctel vibrante elaborado con tequila, licor de naranja y zumo de lima.", available: true },
      { id: crypto.randomUUID(), name: "Mimosa", category: "Cocktails & Alcohol", price: 23, description: "Cava y zumo de naranja, fresco y afrutado.", available: true },
      { id: crypto.randomUUID(), name: "Mojito", category: "Cocktails & Alcohol", price: 23, description: "Ron, hierbabuena, lima, azucar y soda, fresco y refrescante.", available: true },
      { id: crypto.randomUUID(), name: "Pina colada", category: "Cocktails & Alcohol", price: 23, description: "Ron, crema de coco y zumo de pina, dulce y tropical.", available: true },
      { id: crypto.randomUUID(), name: "Sex on the beach", category: "Cocktails & Alcohol", price: 23, description: "Vodka, licor de melocoton, zumo de naranja y arandanos, dulce y afrutado.", available: true },
      { id: crypto.randomUUID(), name: "Tequila Sunrise", category: "Cocktails & Alcohol", price: 20, description: "Tequila, zumo de naranja y granadina, dulce, citrico y refrescante.", available: true },
      { id: crypto.randomUUID(), name: "Vodka rosa", category: "Cocktails & Alcohol", price: 22, description: "Vodka, licor de frutos rojos y un toque de lima.", available: true },
      { id: crypto.randomUUID(), name: "Wet pussy shot", category: "Cocktails & Alcohol", price: 19, description: "Vodka, licor de melocoton, arandanos y un toque de lima.", available: true },
      { id: crypto.randomUUID(), name: "Whisky", category: "Cocktails & Alcohol", price: 22, description: "Whisky solo o con hielo.", available: true }
    ],
    orders: [
      {
        id: crypto.randomUUID(),
        code: "PB-1001",
        businessName: "Auto Exotic",
        contact: "555-013",
        details: "20 Sunset Spritz y 10 Bowl Vespucci para reunion.",
        status: "recibido",
        note: "Pendiente de confirmar hora exacta.",
        createdAt: now(),
        updatedAt: now()
      }
    ],
    conventions: [
      {
        id: crypto.randomUUID(),
        name: "Convenio empresas",
        discount: 15,
        active: true,
        notes: "Descuento para pedidos recurrentes de negocios aliados."
      },
      {
        id: crypto.randomUUID(),
        name: "Evento de playa",
        discount: 10,
        active: true,
        notes: "Aplicable a facturas de catering o eventos."
      }
    ],
    invoices: []
  };
}

function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(seedDatabase(), null, 2), "utf8");
  }
}

function readDb() {
  ensureDatabase();
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  let changed = false;
  db.users = (db.users || []).map(user => {
    const normalized = { ...user };
    if (normalized.email === undefined) {
      normalized.email = "";
      changed = true;
    }
    if (normalized.active === undefined) {
      normalized.active = true;
      changed = true;
    }
    return normalized;
  });
  if (changed) writeDb(db);
  return db;
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml"
  }[ext] || "application/octet-stream";
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 20_000_000) {
        reject(new Error("Payload demasiado grande"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("JSON invalido"));
      }
    });
    req.on("error", reject);
  });
}

function excerpt(text, max = 170) {
  const clean = String(text || "").replace(/[#*_`>\[\]()~-]/g, "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trim()}...` : clean;
}

function normalizeAnnouncement(item = {}) {
  const text = String(item.text || "");
  const content = String(item.content || text || "");
  const images = Array.isArray(item.images) ? item.images.filter(image => image && image.src).slice(0, 8) : [];
  const coverImage = item.coverImage || images.find(image => image.isCover)?.src || "";
  return {
    ...item,
    title: String(item.title || "Anuncio").slice(0, 120),
    summary: String(item.summary || text || excerpt(content)).slice(0, 260),
    text,
    content,
    category: String(item.category || "Comunicado").slice(0, 60),
    author: String(item.author || "Pacific Bluffs").slice(0, 80),
    status: String(item.status || (item.visible === false ? "borrador" : "publicado")).slice(0, 30),
    visible: item.visible !== false && item.status !== "borrador",
    featured: String(item.featured || "").slice(0, 260),
    coverImage,
    images,
    createdAt: item.createdAt || now(),
    updatedAt: item.updatedAt || item.createdAt || now()
  };
}

function validateAnnouncementImages(images) {
  if (!Array.isArray(images)) return [];
  return images.slice(0, 8).map(image => {
    const src = String(image?.src || "");
    if (!src) return null;
    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(src) && !/^https?:\/\//i.test(src) && !src.startsWith("/")) {
      throw new Error("Formato de imagen no valido");
    }
    if (src.length > 1_800_000) throw new Error("Una imagen supera el tamano permitido");
    return {
      id: String(image.id || crypto.randomUUID()),
      name: String(image.name || "Imagen").slice(0, 100),
      src,
      isCover: Boolean(image.isCover)
    };
  }).filter(Boolean);
}

function sanitizePublic(db) {
  return {
    business: db.business,
    announcements: db.announcements.map(normalizeAnnouncement).filter(item => item.visible),
    menuItems: db.menuItems.filter(item => item.available)
  };
}

function withoutSecrets(user) {
  if (!user) return null;
  const { passwordHash, salt, ...safeUser } = user;
  return safeUser;
}

function authUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = sessions.get(token);
  if (!session) return null;
  const db = readDb();
  const user = db.users.find(item => item.id === session.userId);
  return user ? { user, token, db } : null;
}

function canManage(user) {
  return user && (user.role === "jefe" || user.role === "encargado");
}

function canManageUsers(user) {
  return user && user.role === "jefe";
}

function isValidRole(role) {
  return ["jefe", "encargado", "empleado"].includes(role);
}

function cleanUserPayload(body) {
  return {
    username: String(body.username || "").trim().slice(0, 50),
    name: String(body.name || "").trim().slice(0, 80),
    email: String(body.email || "").trim().slice(0, 120),
    role: String(body.role || "").trim(),
    active: body.active === true || body.active === "true" || body.active === "on"
  };
}

function nextOrderCode(db) {
  const max = db.orders.reduce((highest, order) => {
    const match = String(order.code || "").match(/PB-(\d+)/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 1000);
  return `PB-${max + 1}`;
}

function upsertById(collection, item) {
  if (!item.id) item.id = crypto.randomUUID();
  const index = collection.findIndex(existing => existing.id === item.id);
  if (index >= 0) {
    collection[index] = { ...collection[index], ...item };
    return collection[index];
  }
  collection.push(item);
  return item;
}

async function handleApi(req, res, url) {
  const db = readDb();

  if (req.method === "GET" && url.pathname === "/api/public") {
    return sendJson(res, 200, sanitizePublic(db));
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/announcements/")) {
    const id = decodeURIComponent(url.pathname.split("/").pop());
    const announcement = db.announcements.map(normalizeAnnouncement).find(item => item.id === id && item.visible);
    if (!announcement) return sendJson(res, 404, { error: "Anuncio no encontrado" });
    return sendJson(res, 200, announcement);
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, service: "Pacific Bluffs API" });
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await readBody(req);
    const user = db.users.find(item => item.username === body.username);
    if (!user || user.passwordHash !== hashPassword(String(body.password || ""), user.salt)) {
      return sendJson(res, 401, { error: "Usuario o contrasena incorrectos" });
    }
    if (user.active === false) {
      return sendJson(res, 403, { error: "Esta cuenta esta inactiva" });
    }
    const token = crypto.randomBytes(30).toString("hex");
    sessions.set(token, { userId: user.id, createdAt: Date.now() });
    return sendJson(res, 200, { token, user: withoutSecrets(user) });
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    const auth = authUser(req);
    if (auth) sessions.delete(auth.token);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/orders") {
    const body = await readBody(req);
    if (!body.businessName || !body.details) {
      return sendJson(res, 400, { error: "Faltan el negocio y el detalle del encargo" });
    }
    const freshDb = readDb();
    const order = {
      id: crypto.randomUUID(),
      code: nextOrderCode(freshDb),
      businessName: String(body.businessName).slice(0, 80),
      contact: String(body.contact || "").slice(0, 80),
      details: String(body.details).slice(0, 1200),
      status: "recibido",
      note: "Encargo recibido. El equipo lo revisara pronto.",
      createdAt: now(),
      updatedAt: now()
    };
    freshDb.orders.unshift(order);
    writeDb(freshDb);
    return sendJson(res, 201, order);
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/orders/")) {
    const code = decodeURIComponent(url.pathname.split("/").pop()).toUpperCase();
    const order = db.orders.find(item => String(item.code).toUpperCase() === code);
    if (!order) return sendJson(res, 404, { error: "No encontramos ese encargo" });
    return sendJson(res, 200, order);
  }

  const auth = authUser(req);
  if (!auth) return sendJson(res, 401, { error: "Sesion requerida" });

  if (req.method === "GET" && url.pathname === "/api/dashboard") {
    return sendJson(res, 200, {
      user: withoutSecrets(auth.user),
      data: {
        ...auth.db,
        users: auth.db.users.map(withoutSecrets)
      }
    });
  }

  if (!canManage(auth.user)) {
    return sendJson(res, 403, { error: "Tu rol solo permite ver el contenido" });
  }

  const managedDb = auth.db;
  const body = req.method === "GET" ? {} : await readBody(req);

  if (req.method === "PUT" && url.pathname === "/api/business") {
    managedDb.business = { ...managedDb.business, ...body, updatedAt: now() };
    writeDb(managedDb);
    return sendJson(res, 200, managedDb.business);
  }

  if (req.method === "POST" && url.pathname === "/api/announcements") {
    const images = validateAnnouncementImages(body.images);
    if (!String(body.title || "").trim() || !String(body.content || body.text || "").trim()) {
      return sendJson(res, 400, { error: "Faltan titulo y contenido del anuncio" });
    }
    const coverCandidate = String(body.coverImage || "");
    const coverImage = coverCandidate || images.find(image => image.isCover)?.src || "";
    const item = upsertById(managedDb.announcements, {
      id: body.id,
      title: String(body.title || "").slice(0, 120),
      summary: String(body.summary || "").slice(0, 260),
      text: String(body.summary || body.text || "").slice(0, 1000),
      content: String(body.content || body.text || "").slice(0, 12000),
      category: String(body.category || "Comunicado").slice(0, 60),
      author: String(body.author || auth.user.name || "Pacific Bluffs").slice(0, 80),
      status: String(body.status || "publicado").slice(0, 30),
      visible: Boolean(body.visible) && String(body.status || "publicado") !== "borrador",
      featured: String(body.featured || "").slice(0, 260),
      coverImage,
      images,
      createdAt: body.createdAt || now(),
      updatedAt: now()
    });
    writeDb(managedDb);
    return sendJson(res, 200, item);
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/announcements/")) {
    const id = url.pathname.split("/").pop();
    managedDb.announcements = managedDb.announcements.filter(item => item.id !== id);
    writeDb(managedDb);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/menu") {
    const item = upsertById(managedDb.menuItems, {
      id: body.id,
      name: String(body.name || "").slice(0, 100),
      category: String(body.category || "Carta").slice(0, 60),
      price: Number(body.price || 0),
      description: String(body.description || "").slice(0, 600),
      available: Boolean(body.available)
    });
    writeDb(managedDb);
    return sendJson(res, 200, item);
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/menu/")) {
    const id = url.pathname.split("/").pop();
    managedDb.menuItems = managedDb.menuItems.filter(item => item.id !== id);
    writeDb(managedDb);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/order-status") {
    const order = managedDb.orders.find(item => item.id === body.id);
    if (!order) return sendJson(res, 404, { error: "Encargo no encontrado" });
    order.status = String(body.status || order.status);
    order.note = String(body.note || "").slice(0, 600);
    order.updatedAt = now();
    writeDb(managedDb);
    return sendJson(res, 200, order);
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/orders/")) {
    const id = decodeURIComponent(url.pathname.split("/").pop());
    const orderExists = managedDb.orders.some(item => item.id === id);
    if (!orderExists) return sendJson(res, 404, { error: "Encargo no encontrado" });
    managedDb.orders = managedDb.orders.filter(item => item.id !== id);
    writeDb(managedDb);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/conventions") {
    const item = upsertById(managedDb.conventions, {
      id: body.id,
      name: String(body.name || "").slice(0, 100),
      discount: Math.max(0, Math.min(100, Number(body.discount || 0))),
      active: Boolean(body.active),
      notes: String(body.notes || "").slice(0, 600)
    });
    writeDb(managedDb);
    return sendJson(res, 200, item);
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/conventions/")) {
    const id = url.pathname.split("/").pop();
    managedDb.conventions = managedDb.conventions.filter(item => item.id !== id);
    writeDb(managedDb);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/invoices") {
    const convention = managedDb.conventions.find(item => item.id === body.conventionId);
    const subtotal = Number(body.subtotal || 0);
    const discount = convention ? Number(convention.discount || 0) : Number(body.discount || 0);
    const total = Math.max(0, subtotal - (subtotal * discount / 100));
    const invoice = {
      id: crypto.randomUUID(),
      businessName: String(body.businessName || "Sin negocio").slice(0, 100),
      conventionName: convention ? convention.name : "Sin convenio",
      subtotal,
      discount,
      total,
      details: String(body.details || "").slice(0, 1000),
      createdBy: auth.user.name,
      createdAt: now()
    };
    managedDb.invoices.unshift(invoice);
    writeDb(managedDb);
    return sendJson(res, 201, invoice);
  }

  if (req.method === "POST" && url.pathname === "/api/users") {
    if (!canManageUsers(auth.user)) {
      return sendJson(res, 403, { error: "Solo el jefe puede crear usuarios" });
    }
    const cleaned = cleanUserPayload(body);
    if (!cleaned.username || !cleaned.name || !body.password || !cleaned.role) {
      return sendJson(res, 400, { error: "Faltan datos del usuario" });
    }
    if (!isValidRole(cleaned.role)) {
      return sendJson(res, 400, { error: "Rol no valido" });
    }
    if (cleaned.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned.email)) {
      return sendJson(res, 400, { error: "Correo electronico no valido" });
    }
    if (String(body.password).length < 4) {
      return sendJson(res, 400, { error: "La contrasena debe tener al menos 4 caracteres" });
    }
    if (managedDb.users.some(user => user.username.toLowerCase() === cleaned.username.toLowerCase())) {
      return sendJson(res, 409, { error: "Ese usuario ya existe" });
    }
    const user = seededUser(cleaned.username, cleaned.name, cleaned.role, String(body.password), cleaned.email);
    user.active = cleaned.active;
    managedDb.users.push(user);
    writeDb(managedDb);
    return sendJson(res, 201, withoutSecrets(user));
  }

  if (req.method === "PUT" && url.pathname.startsWith("/api/users/")) {
    if (!canManageUsers(auth.user)) {
      return sendJson(res, 403, { error: "Solo el jefe puede modificar usuarios" });
    }
    const id = decodeURIComponent(url.pathname.split("/").pop());
    const user = managedDb.users.find(item => item.id === id);
    if (!user) return sendJson(res, 404, { error: "Usuario no encontrado" });

    const cleaned = cleanUserPayload(body);
    if (!cleaned.username || !cleaned.name || !cleaned.role) {
      return sendJson(res, 400, { error: "Faltan datos del usuario" });
    }
    if (!isValidRole(cleaned.role)) {
      return sendJson(res, 400, { error: "Rol no valido" });
    }
    if (cleaned.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned.email)) {
      return sendJson(res, 400, { error: "Correo electronico no valido" });
    }
    if (managedDb.users.some(item => item.id !== id && item.username.toLowerCase() === cleaned.username.toLowerCase())) {
      return sendJson(res, 409, { error: "Ese usuario ya existe" });
    }
    if (id === auth.user.id && (cleaned.role !== "jefe" || !cleaned.active)) {
      return sendJson(res, 400, { error: "No puedes quitarte permisos de jefe ni desactivar tu propia cuenta" });
    }

    user.username = cleaned.username;
    user.name = cleaned.name;
    user.email = cleaned.email;
    user.role = cleaned.role;
    user.active = cleaned.active;
    if (body.password) {
      if (String(body.password).length < 4) {
        return sendJson(res, 400, { error: "La nueva contrasena debe tener al menos 4 caracteres" });
      }
      user.salt = crypto.randomBytes(12).toString("hex");
      user.passwordHash = hashPassword(String(body.password), user.salt);
    }
    user.updatedAt = now();
    writeDb(managedDb);
    return sendJson(res, 200, withoutSecrets(user));
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/users/")) {
    if (!canManageUsers(auth.user)) {
      return sendJson(res, 403, { error: "Solo el jefe puede eliminar usuarios" });
    }
    const id = decodeURIComponent(url.pathname.split("/").pop());
    if (id === auth.user.id) {
      return sendJson(res, 400, { error: "No puedes eliminar tu propia cuenta de jefe" });
    }
    const user = managedDb.users.find(item => item.id === id);
    if (!user) return sendJson(res, 404, { error: "Usuario no encontrado" });
    const activeChiefs = managedDb.users.filter(item => item.role === "jefe" && item.active !== false && item.id !== id);
    if (user.role === "jefe" && activeChiefs.length === 0) {
      return sendJson(res, 400, { error: "Debe quedar al menos un jefe activo" });
    }
    managedDb.users = managedDb.users.filter(item => item.id !== id);
    sessions.forEach((session, token) => {
      if (session.userId === id) sessions.delete(token);
    });
    writeDb(managedDb);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: "Ruta API no encontrada" });
}

function serveStatic(req, res, url) {
  const pageRoutes = {
    "/": "/index.html",
    "/anuncios": "/anuncios.html",
    "/anuncios/": "/anuncios.html",
    "/carta": "/carta.html",
    "/carta/": "/carta.html",
    "/pedidos": "/pedidos.html",
    "/pedidos/": "/pedidos.html",
    "/panel": "/panel.html",
    "/panel/": "/panel.html"
  };
  const requested = pageRoutes[url.pathname] || (url.pathname.startsWith("/anuncios/") ? "/anuncios.html" : decodeURIComponent(url.pathname));
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) return sendText(res, 403, "Acceso denegado");
  fs.readFile(filePath, (error, data) => {
    if (error) return sendText(res, 404, "No encontrado");
    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      });
      res.end();
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Error interno" });
  }
});

ensureDatabase();
server.listen(PORT, () => {
  console.log(`Pacific Bluffs listo en http://localhost:${PORT}`);
});
