# Pacific Bluffs — versión HTML + PHP

Esta versión funciona sin Node.js. El frontend es HTML/CSS/JavaScript y la API es PHP.

## Requisitos del hosting
- PHP 7.4+ (recomendado PHP 8.1+)
- Apache con `mod_rewrite` y `.htaccess` habilitado
- Permisos de escritura para `data/` (PHP necesita modificar `db.json` y crear `sessions.json`)

## Instalación
1. Sube todo el contenido de esta carpeta al directorio público del dominio.
2. Comprueba que `data/` tenga permisos de escritura para PHP.
3. Abre `/` y después `/panel`.
4. No hace falta ejecutar `npm`, `node` ni configurar un proceso Node.

## API
Las peticiones `/api/...` son reescritas a `api.php` mediante `.htaccess`.

## Usuario inicial
- Usuario: `jefe`
- Contraseña: `Pacific2026!`

Cambia la contraseña desde el panel después de entrar.
