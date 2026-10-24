# Catálogo de joyería (gratis)

- **Frontend:** `index.html` → GitHub Pages
- **Backend:** `Code.gs` → Google Apps Script (Web App), vive dentro del Google Sheet
- **Base de datos:** Google Sheet con dos pestañas: `Productos` y `Pedidos`
- **Fotos:** carpeta `img/` de este repo (fotos de prueba) y/o Google Drive (fotos subidas desde el panel)

## Qué hace

- Catálogo con filtros por categoría y buscador.
- Carrito con varias piezas y cantidades limitadas al stock.
- Al hacer el pedido se registra un **folio** en la pestaña `Pedidos`, con el total calculado por el servidor.
- El cliente ve los datos para transferir y envía el comprobante por WhatsApp con el folio.
- Panel de administración (oculto, se abre con `#admin`):
  - **Pedidos:** marcar pagado (descuenta stock) o cancelar (libera las piezas).
  - **Piezas:** agregar, editar, quitar y subir fotos desde el equipo.

## 1. Configurar datos de pago y WhatsApp

En `index.html`, sección `PAGO Y CONTACTO`:
- `WHATSAPP`: código de país + número, solo dígitos (ej. `5215512345678`).
- `PAGO`: banco, titular y CLABE.

## 2. Hoja de cálculo

1. Pestaña `Productos` con las columnas: `id, nombre, descripcion, precio, stock, imagen, activo, actualizado, categoria`.
2. La pestaña `Pedidos` se crea sola la primera vez.

## 3. Backend (Apps Script)

1. En el Sheet: **Extensiones → Apps Script**. Pega el contenido de `Code.gs`.
2. **Configuración del proyecto → Propiedades de secuencia de comandos → Agregar propiedad**:
   - Nombre: `TOKEN`
   - Valor: una frase larga que solo ustedes conozcan (es la clave del panel).
3. **Implementar → Gestionar implementaciones → editar → Versión nueva → Implementar.** La URL no cambia.
   - La primera vez, o cuando se agregan permisos nuevos (Drive para las fotos), Google pedirá autorizar de nuevo. Si aparece "app no verificada": Configuración avanzada → ir al proyecto.
4. Si cambió la URL, pégala en `API_URL` de `index.html`.

## 4. Publicar en GitHub Pages

1. Repositorio público con `index.html`, `Code.gs`, `img/` y este README.
2. **Settings → Pages → Source:** rama `main`, carpeta `/ (root)`.
3. Catálogo en `https://TU-USUARIO.github.io/NOMBRE-REPO/`.
4. Panel de administración: `https://TU-USUARIO.github.io/NOMBRE-REPO/#admin` (no aparece ningún botón para llegar a él).

## Notas

- **Cambios en `Code.gs`:** hay que publicar una nueva versión, como en el paso 3.
- **Pedidos pendientes reservan piezas:** mientras un pedido esté pendiente, sus piezas no se pueden volver a pedir. Al marcarlo pagado se descuenta el stock; al cancelarlo, se libera.
- **Borrar piezas:** "Quitar" no borra la fila; la marca como inactiva.
- **Clave:** se pide una vez por sesión del navegador y se guarda solo ahí. No está en el HTML.
- **Ocultar no es seguridad:** el panel sale de la página principal, pero quien tenga la dirección `#admin` puede intentar entrar. La protección real es la clave `TOKEN`.
- **Zona horaria** de los folios: `ZONA_HORARIA` en `Code.gs`.
