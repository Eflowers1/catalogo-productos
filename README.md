# Catálogo de productos (gratis)

- **Frontend:** `index.html` → GitHub Pages
- **Backend:** `Code.gs` → Google Apps Script (Web App)
- **Base de datos:** Google Sheet con una hoja llamada `Productos`

La página es pública para ver el catálogo. Para agregar, editar o quitar productos se pide una clave de administración que solo conocen las 2 personas que editan.

## 1. Crear la hoja

1. Crea un Google Sheet en tu Drive (puedes convertir tu Excel: Archivo → Guardar como → Google Sheets).
2. La hoja se llama `Productos` (si no existe, el script la crea con los encabezados al primer uso).
3. Comparte el Sheet con las 2 personas que editan, como **Editor**.

## 2. Pegar el backend

1. En el Sheet: **Extensiones → Apps Script**.
2. Borra el contenido y pega `Code.gs`. Guarda.
3. **Configuración del proyecto** (engranaje) → **Propiedades de secuencia de comandos** → **Agregar propiedad**:
   - Nombre: `TOKEN`
   - Valor: una clave larga y difícil de adivinar (es la clave de administración).

## 3. Publicar el Web App

1. **Implementar → Nueva implementación → Tipo: Aplicación web**.
2. **Ejecutar como:** Yo.
3. **Quién tiene acceso:** Cualquier usuario.
4. Autoriza los permisos (si aparece "app no verificada": Configuración avanzada → ir al proyecto).
5. Copia la URL que termina en `/exec`.

## 4. Conectar el frontend

1. Abre `index.html` y reemplaza `PEGAR_AQUI_LA_URL_DEL_WEB_APP` por esa URL.
2. Si tu moneda o idioma no es MXN / es-MX, cambia `MONEDA` y `LOCALE` en la misma sección.

## 5. Publicar en GitHub Pages

1. Crea un repositorio **público** en GitHub y sube `index.html` (y `Code.gs` si quieres tenerlo versionado).
2. **Settings → Pages → Source:** rama `main`, carpeta `/ (root)`.
3. Tu catálogo quedará en `https://TU-USUARIO.github.io/NOMBRE-REPO/`.

## Notas

- **Cambios en `Code.gs`:** después de editarlo hay que hacer **Implementar → Administrar implementaciones → Editar → Nueva versión**. Si no, el cambio no se aplica.
- **Borrar:** el botón "Quitar" no elimina la fila; marca `activo = FALSE` y el producto deja de mostrarse.
- **Clave:** se pide una vez por sesión del navegador y se guarda solo ahí. No está en el HTML.
- **Cuotas gratuitas:** de sobra para un catálogo con 2 editores y visitas ocasionales.
