# Pacific Bluffs

Web de Pacific Bluffs con anuncios publicos, carta, pedidos, calculadora de convenios y panel interno con usuarios y roles.

## Instalacion recomendada (Node.js)

Este proyecto necesita **Node.js** porque el panel y la base de datos funcionan mediante `server.js`.

```bash
npm start
```

Por defecto escucha en el puerto `4321`. Tambien puedes definir otro puerto:

```bash
PORT=4321 npm start
```

Paginas:

- `/`
- `/anuncios`
- `/carta`
- `/pedidos`
- `/panel`

## Si usas Apache/cPanel

El `.htaccess` incluido envia `/api/*` al proceso Node en `127.0.0.1:4321` y sirve las paginas desde `public/`.

El hosting debe permitir ejecutar Node y tener disponibles `mod_rewrite`, `mod_proxy` y `mod_proxy_http`. Si tu proveedor usa el selector de aplicaciones Node, configura `server.js` como archivo de inicio y usa el puerto que proporcione mediante `PORT`.

## Base de datos

Los datos se guardan en `data/db.json`. Haz copia de seguridad de ese archivo antes de sustituir una instalacion que ya tenga datos reales.

## Usuarios iniciales

- `jefe` / `Pacific2026!`
- `encargado` / `Encargado2026!`
- `empleado` / `Empleado2026!`

El jefe puede gestionar usuarios. Jefe y encargado pueden gestionar el contenido del negocio.
