/**
 * Backend del catálogo (Google Apps Script). Vive dentro del Google Sheet:
 * Extensiones → Apps Script.
 *
 * Pestañas que usa: "Productos" y "Pedidos" (se crean solas si no existen).
 * Propiedad necesaria: TOKEN (Configuración del proyecto → Propiedades de secuencia de comandos).
 *
 * Público:
 *   GET  ?action=listar
 *   POST {action:'pedido', items:[{id, cantidad}]}   → crea un pedido pendiente
 * Administración (requiere token):
 *   POST {token, action:'verificar' | 'agregar' | 'actualizar' | 'borrar' | 'subirFoto' |
 *         'listarPedidos' | 'marcarPagado' | 'cancelarPedido'}
 */

const NOMBRE_HOJA = 'Productos';
const NOMBRE_PEDIDOS = 'Pedidos';
const COLUMNAS = ['id', 'nombre', 'descripcion', 'precio', 'stock', 'imagen', 'activo', 'actualizado', 'categoria'];
const COLUMNAS_PEDIDOS = ['folio', 'fecha', 'lineas', 'total', 'estado'];
const CARPETA_FOTOS = 'catalogo-fotos';
const ZONA_HORARIA = 'America/Mexico_City';
const MAX_LINEAS = 20;

function doGet(e) {
  const accion = e.parameter.action || 'listar';
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

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    if (body.action === 'pedido') return responder_({ ok: true, data: crearPedido_(body.items) });

    if (!autorizado_(body.token)) return responder_({ ok: false, error: 'No autorizado' });

    switch (body.action) {
      case 'verificar': return responder_({ ok: true, data: {} });
      case 'agregar': return responder_({ ok: true, data: agregar_(body.producto) });
      case 'actualizar': return responder_({ ok: true, data: actualizar_(body.producto) });
      case 'borrar': return responder_({ ok: true, data: borrar_(body.id) });
      case 'subirFoto': return responder_({ ok: true, data: subirFoto_(body.nombre, body.base64) });
      case 'listarPedidos': return responder_({ ok: true, data: listarPedidos_() });
      case 'marcarPagado': return responder_({ ok: true, data: marcarPagado_(body.folio) });
      case 'cancelarPedido': return responder_({ ok: true, data: cancelarPedido_(body.folio) });
      default: return responder_({ ok: false, error: 'Acción no válida' });
    }
  } catch (err) {
    return responder_({ ok: false, error: err.message });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

// ---------- Productos ----------

function listar_() {
  return leerProductos_()
    .filter(p => p.id !== '' && esActivo_(p))
    .map(p => ({
      id: String(p.id),
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: Number(p.precio),
      stock: Number(p.stock),
      imagen: p.imagen,
      categoria: p.categoria || ''
    }));
}

function agregar_(producto) {
  const d = limpiar_(producto);
  const id = Utilities.getUuid().slice(0, 8);
  hoja_().appendRow([id, d.nombre, d.descripcion, d.precio, d.stock, d.imagen, true, new Date(), d.categoria]);
  return { id };
}

function actualizar_(producto) {
  const p = buscarProducto_(producto.id);
  const d = limpiar_(producto);
  hoja_().getRange(p.fila, 1, 1, COLUMNAS.length)
    .setValues([[String(p.id), d.nombre, d.descripcion, d.precio, d.stock, d.imagen, true, new Date(), d.categoria]]);
  return { id: String(p.id) };
}

// Borrado lógico: la fila queda con activo = FALSE para no perder historial.
function borrar_(id) {
  const p = buscarProducto_(id);
  hoja_().getRange(p.fila, COLUMNAS.indexOf('activo') + 1).setValue(false);
  hoja_().getRange(p.fila, COLUMNAS.indexOf('actualizado') + 1).setValue(new Date());
  return { id: String(p.id) };
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
    imagen,
    categoria: String(p.categoria || '').trim().toLowerCase().slice(0, 30)
  };
}

function buscarProducto_(id) {
  const p = leerProductos_().find(x => String(x.id) === String(id || ''));
  if (!p) throw new Error('Producto no encontrado');
  return p;
}

function leerProductos_() {
  const [, ...filas] = hoja_().getDataRange().getValues();
  return filas.map((f, i) => ({ ...aObjeto_(f, COLUMNAS), fila: i + 2 }));
}

function esActivo_(p) {
  return String(p.activo).toUpperCase() !== 'FALSE';
}

// ---------- Pedidos ----------

function crearPedido_(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_LINEAS) {
    throw new Error('El pedido debe tener entre 1 y ' + MAX_LINEAS + ' piezas');
  }

  // Une líneas repetidas y valida cantidades
  const pedidoPorId = {};
  items.forEach(it => {
    const id = String(it.id || '');
    const cantidad = Math.floor(Number(it.cantidad));
    if (!id || !(cantidad >= 1)) throw new Error('Cantidad no válida');
    pedidoPorId[id] = (pedidoPorId[id] || 0) + cantidad;
  });

  const productos = leerProductos_();
  const reservado = reservadoPorProducto_();

  const lineas = Object.keys(pedidoPorId).map(id => {
    const cantidad = pedidoPorId[id];
    const p = productos.find(x => String(x.id) === id && esActivo_(x));
    if (!p) throw new Error('Una de las piezas ya no está disponible');
    const libres = Number(p.stock) - (reservado[id] || 0);
    if (cantidad > libres) {
      throw new Error('Solo quedan ' + Math.max(0, libres) + ' de "' + p.nombre + '"');
    }
    return { id, nombre: p.nombre, precio: Number(p.precio), cantidad };
  });

  const total = lineas.reduce((suma, l) => suma + l.precio * l.cantidad, 0);
  const folio = 'PED-' + Utilities.formatDate(new Date(), ZONA_HORARIA, 'yyMMdd') + '-' +
    Math.floor(1000 + Math.random() * 9000);

  hojaPedidos_().appendRow([folio, new Date(), JSON.stringify(lineas), total, 'pendiente']);
  return { folio, total, lineas };
}

// Piezas apartadas por pedidos que todavía no están pagados
function reservadoPorProducto_() {
  const reservado = {};
  leerPedidos_().forEach(ped => {
    if (ped.estado !== 'pendiente') return;
    JSON.parse(ped.lineas).forEach(l => {
      reservado[l.id] = (reservado[l.id] || 0) + l.cantidad;
    });
  });
  return reservado;
}

function listarPedidos_() {
  return leerPedidos_()
    .map(p => ({ folio: p.folio, fecha: p.fecha, lineas: JSON.parse(p.lineas), total: p.total, estado: p.estado }))
    .reverse();
}

// Al confirmar el pago se descuenta el stock de cada pieza
function marcarPagado_(folio) {
  const ped = buscarPedido_(folio);
  if (ped.estado !== 'pendiente') throw new Error('El pedido ya no está pendiente');
  JSON.parse(ped.lineas).forEach(l => {
    const p = leerProductos_().find(x => String(x.id) === String(l.id));
    if (p) {
      hoja_().getRange(p.fila, COLUMNAS.indexOf('stock') + 1)
        .setValue(Math.max(0, Number(p.stock) - l.cantidad));
    }
  });
  hojaPedidos_().getRange(ped.fila, COLUMNAS_PEDIDOS.indexOf('estado') + 1).setValue('pagado');
  return { folio: ped.folio };
}

function cancelarPedido_(folio) {
  const ped = buscarPedido_(folio);
  if (ped.estado !== 'pendiente') throw new Error('Solo se pueden cancelar pedidos pendientes');
  hojaPedidos_().getRange(ped.fila, COLUMNAS_PEDIDOS.indexOf('estado') + 1).setValue('cancelado');
  return { folio: ped.folio };
}

function buscarPedido_(folio) {
  const ped = leerPedidos_().find(p => p.folio === String(folio || ''));
  if (!ped) throw new Error('Pedido no encontrado');
  return ped;
}

function leerPedidos_() {
  const [, ...filas] = hojaPedidos_().getDataRange().getValues();
  return filas
    .map((f, i) => ({ ...aObjeto_(f, COLUMNAS_PEDIDOS), fila: i + 2 }))
    .filter(p => p.folio !== '');
}

// ---------- Fotos ----------

// Guarda la foto en Drive con enlace público de lectura y devuelve la URL para la hoja
function subirFoto_(nombre, base64) {
  if (!base64) throw new Error('Falta la imagen');
  const carpetas = DriveApp.getFoldersByName(CARPETA_FOTOS);
  const carpeta = carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder(CARPETA_FOTOS);
  const nombreArchivo = String(nombre || 'foto').replace(/[^\w.-]/g, '_') + '.jpg';
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), 'image/jpeg', nombreArchivo);
  const archivo = carpeta.createFile(blob);
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { url: 'https://lh3.googleusercontent.com/d/' + archivo.getId() };
}

// ---------- Utilidades ----------

function autorizado_(token) {
  const clave = PropertiesService.getScriptProperties().getProperty('TOKEN');
  return !!clave && token === clave;
}

function hoja_() {
  return obtenerHoja_(NOMBRE_HOJA, COLUMNAS);
}

function hojaPedidos_() {
  return obtenerHoja_(NOMBRE_PEDIDOS, COLUMNAS_PEDIDOS);
}

function obtenerHoja_(nombre, columnas) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(nombre);
  if (!hoja) {
    hoja = ss.insertSheet(nombre);
    hoja.appendRow(columnas);
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function aObjeto_(fila, columnas) {
  const o = {};
  columnas.forEach((c, i) => o[c] = fila[i]);
  return o;
}

function responder_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
