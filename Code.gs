/**
 * Backend del catálogo (Google Apps Script).
 *
 * Uso: abrir el Google Sheet → Extensiones → Apps Script → pegar este archivo.
 * Propiedad necesaria: TOKEN (Configuración del proyecto → Propiedades de secuencia de comandos).
 *
 * Lectura (pública):  GET  ?action=listar
 * Escritura (token):  POST body JSON { token, action: 'agregar'|'actualizar'|'borrar', ... }
 */

const NOMBRE_HOJA = 'Productos';
const COLUMNAS = ['id', 'nombre', 'descripcion', 'precio', 'stock', 'imagen', 'activo', 'actualizado'];

function doGet(e) {
  const accion = (e.parameter.action || 'listar');
  if (accion === 'listar') return responder_({ ok: true, data: listar_() });
  return responder_({ ok: false, error: 'Acción no válida' });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return responder_({ ok: false, error: 'JSON inválido' });
  }

  const token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!token || body.token !== token) {
    return responder_({ ok: false, error: 'No autorizado' });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    if (body.action === 'agregar') return responder_({ ok: true, data: agregar_(body.producto) });
    if (body.action === 'actualizar') return responder_({ ok: true, data: actualizar_(body.producto) });
    if (body.action === 'borrar') return responder_({ ok: true, data: borrar_(body.id) });
    return responder_({ ok: false, error: 'Acción no válida' });
  } catch (err) {
    return responder_({ ok: false, error: err.message });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function listar_() {
  const [, ...filas] = hoja_().getDataRange().getValues();
  return filas
    .map(aObjeto_)
    .filter(p => p.id !== '' && String(p.activo).toUpperCase() !== 'FALSE')
    .map(p => ({
      id: String(p.id),
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: Number(p.precio),
      stock: Number(p.stock),
      imagen: p.imagen
    }));
}

function agregar_(producto) {
  const d = limpiar_(producto);
  const id = Utilities.getUuid().slice(0, 8);
  hoja_().appendRow([id, d.nombre, d.descripcion, d.precio, d.stock, d.imagen, true, new Date()]);
  return { id };
}

function actualizar_(producto) {
  const id = String(producto.id || '');
  const d = limpiar_(producto);
  const hoja = hoja_();
  const fila = buscarFila_(hoja, id);
  if (!fila) throw new Error('Producto no encontrado');
  hoja.getRange(fila, 1, 1, COLUMNAS.length)
    .setValues([[id, d.nombre, d.descripcion, d.precio, d.stock, d.imagen, true, new Date()]]);
  return { id };
}

// Borrado lógico: el producto queda en la hoja con activo = FALSE, así no se pierde historial.
function borrar_(id) {
  const hoja = hoja_();
  const fila = buscarFila_(hoja, String(id || ''));
  if (!fila) throw new Error('Producto no encontrado');
  hoja.getRange(fila, COLUMNAS.indexOf('activo') + 1).setValue(false);
  hoja.getRange(fila, COLUMNAS.indexOf('actualizado') + 1).setValue(new Date());
  return { id };
}

function limpiar_(p) {
  const nombre = String(p.nombre || '').trim();
  const precio = Number(p.precio);
  const imagen = String(p.imagen || '').trim();
  if (!nombre) throw new Error('El nombre es obligatorio');
  if (!(precio >= 0)) throw new Error('El precio debe ser un número mayor o igual a 0');
  if (imagen && !/^https?:\/\//.test(imagen)) throw new Error('La imagen debe ser una URL http(s)');
  return {
    nombre,
    descripcion: String(p.descripcion || '').trim(),
    precio,
    stock: Math.max(0, Math.floor(Number(p.stock) || 0)),
    imagen
  };
}

// Devuelve el número de fila (base 1) o 0 si no existe. La fila 1 son los encabezados.
function buscarFila_(hoja, id) {
  const ids = hoja.getRange(1, 1, hoja.getLastRow(), 1).getValues();
  for (let i = 1; i < ids.length; i++) {
    if (String(ids[i][0]) === id) return i + 1;
  }
  return 0;
}

function hoja_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(NOMBRE_HOJA);
  if (!hoja) {
    hoja = ss.insertSheet(NOMBRE_HOJA);
    hoja.appendRow(COLUMNAS);
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function aObjeto_(fila) {
  const o = {};
  COLUMNAS.forEach((c, i) => o[c] = fila[i]);
  return o;
}

function responder_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
