/* ===========================
   Mepiache Inventario - Mantención de equipos (admin)
   ---------------------------------------------
   Vista 1 (lista): catálogo de máquinas/equipos, con
   última y próxima mantención calculadas a partir de
   frecuencia_dias + historial de mantenciones_equipos.

   Vista 2 (detalle): historial de mantenciones de un
   equipo, con formulario para registrar una nueva
   (fecha, descripción, adjunto opcional).
   =========================== */

const BUCKET_EQUIPOS = 'equipos';

const ESTADO_MANTENCION_LABELS = {
  vencido: 'Vencido',
  proximo: 'Próximo',
  ok: 'Al día',
  sin_registro: 'Sin registro',
};

// --------- Estado local ---------

let _equipos = [];
let _equipoActualId = null;
let _historial = [];

// --------- Init ---------

document.addEventListener('DOMContentLoaded', async () => {
  const sesion = await initLayout('equipos.html', { soloAdmin: true });
  if (!sesion) return;

  bindUI();
  await cargarEquipos();
});

// --------- UI binding ---------

function bindUI() {
  document.getElementById('btn-nuevo-equipo').addEventListener('click', () => abrirFormulario());
  document.getElementById('btn-cancelar-equipo').addEventListener('click', cerrarFormulario);
  document.getElementById('btn-guardar-equipo').addEventListener('click', guardarEquipo);
  document.getElementById('filtro-equipo').addEventListener('input', renderTabla);
  document.getElementById('filtro-inactivos').addEventListener('change', renderTabla);

  document.getElementById('btn-volver-lista').addEventListener('click', (ev) => {
    ev.preventDefault();
    volverALista();
  });
  document.getElementById('btn-guardar-mantencion').addEventListener('click', guardarMantencion);
}

// --------- Formulario de equipo ---------

function abrirFormulario(e = null) {
  const form = document.getElementById('form-equipo');
  form.style.display = 'block';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.getElementById('form-titulo').textContent = e ? 'Editar equipo' : 'Nuevo equipo';
  document.getElementById('e-id').value = e ? e.id : '';
  document.getElementById('e-nombre').value = e ? (e.nombre || '') : '';
  document.getElementById('e-descripcion').value = e ? (e.descripcion || '') : '';
  document.getElementById('e-frecuencia').value = e ? (e.frecuencia_dias || '') : '';
  mostrarMensaje('e-mensaje', '', '');
}

function cerrarFormulario() {
  document.getElementById('form-equipo').style.display = 'none';
}

// --------- CRUD equipos ---------

async function cargarEquipos() {
  _equipos = await getEquipos();
  renderTabla();
}

async function guardarEquipo() {
  const id = document.getElementById('e-id').value.trim();
  const nombre = document.getElementById('e-nombre').value.trim();
  const descripcion = document.getElementById('e-descripcion').value.trim();
  const frecuenciaStr = document.getElementById('e-frecuencia').value.trim();
  const frecuencia_dias = frecuenciaStr ? parseInt(frecuenciaStr, 10) : null;

  if (!nombre) {
    mostrarMensaje('e-mensaje', 'El nombre del equipo es obligatorio.', 'error');
    return;
  }

  const btn = document.getElementById('btn-guardar-equipo');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Guardando...';

  try {
    const datos = { nombre, descripcion, frecuencia_dias };

    if (id) {
      await actualizarEquipo(id, datos);
      const idx = _equipos.findIndex(e => e.id === id);
      if (idx >= 0) _equipos[idx] = { ..._equipos[idx], ...datos };
    } else {
      const nuevo = await crearEquipo(datos);
      _equipos.unshift(nuevo);
    }

    mostrarMensaje('e-mensaje', 'Guardado correctamente.', 'exito');
    renderTabla();
    setTimeout(cerrarFormulario, 900);
  } catch (err) {
    mostrarMensaje('e-mensaje', 'Error al guardar: ' + (err.message || err), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

async function toggleActivo(id, activo) {
  try {
    await actualizarEquipo(id, { activo });
    const e = _equipos.find(e => e.id === id);
    if (e) e.activo = activo;
    renderTabla();
  } catch (err) {
    mostrarMensaje('lista-mensaje', 'Error al actualizar estado: ' + (err.message || err), 'error');
  }
}

// --------- Render tabla de equipos ---------

function renderTabla() {
  const busqueda = (document.getElementById('filtro-equipo').value || '').toLowerCase();
  const mostrarInactivos = document.getElementById('filtro-inactivos').checked;

  const filtrados = _equipos.filter(e => {
    if (!mostrarInactivos && !e.activo) return false;
    if (busqueda) {
      const hayMatch = (e.nombre || '').toLowerCase().includes(busqueda)
        || (e.descripcion || '').toLowerCase().includes(busqueda);
      if (!hayMatch) return false;
    }
    return true;
  });

  const tbody = document.getElementById('tabla-equipos-body');

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="estado-vacio">No hay equipos registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map(e => {
    const { proxima, estado } = calcularEstadoMantencion(e);
    return `
      <tr class="${e.activo ? '' : 'fila-inactiva'}">
        <td><strong>${esc(e.nombre)}</strong></td>
        <td class="descripcion-cell">${esc(e.descripcion) || '<span style="color:#ccc">—</span>'}</td>
        <td>${e.frecuencia_dias ? `Cada ${e.frecuencia_dias} días` : '<span style="color:#ccc">—</span>'}</td>
        <td>${e.ultima_mantencion ? formatearFecha(e.ultima_mantencion) : '<span style="color:#ccc">—</span>'}</td>
        <td>${proxima ? formatearFecha(proxima) : '<span style="color:#ccc">—</span>'}</td>
        <td><span class="badge ${estado}">${ESTADO_MANTENCION_LABELS[estado] || estado}</span></td>
        <td>
          <div class="acciones-tabla">
            <button onclick="verHistorial('${e.id}')">Historial</button>
            <button onclick="abrirFormulario(getEquipoPorId('${e.id}'))">Editar</button>
            <button class="secundario" onclick="toggleActivo('${e.id}', ${!e.activo})">${e.activo ? 'Desactivar' : 'Activar'}</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// --------- Vista de detalle / historial ---------

async function verHistorial(equipoId) {
  _equipoActualId = equipoId;
  const equipo = getEquipoPorId(equipoId);
  if (!equipo) return;

  document.getElementById('vista-lista').style.display = 'none';
  document.getElementById('vista-detalle').style.display = 'block';

  document.getElementById('detalle-nombre').textContent = equipo.nombre;

  const descEl = document.getElementById('detalle-descripcion');
  if (equipo.descripcion) {
    descEl.textContent = equipo.descripcion;
    descEl.style.display = 'block';
    descEl.className = 'form-mensaje';
  } else {
    descEl.style.display = 'none';
  }

  // Limpiar formulario de mantención
  document.getElementById('m-fecha').value = new Date().toISOString().slice(0, 10);
  document.getElementById('m-descripcion').value = '';
  document.getElementById('m-archivo').value = '';
  mostrarMensaje('m-mensaje', '', '');

  await cargarHistorial(equipoId);
}

function volverALista() {
  document.getElementById('vista-detalle').style.display = 'none';
  document.getElementById('vista-lista').style.display = 'block';
  _equipoActualId = null;
  renderTabla();
}

async function cargarHistorial(equipoId) {
  const tbody = document.getElementById('tabla-historial-body');
  tbody.innerHTML = `<tr><td colspan="4" class="estado-vacio">Cargando...</td></tr>`;
  _historial = await getMantencionesEquipo(equipoId);
  renderHistorial();
}

function renderHistorial() {
  const tbody = document.getElementById('tabla-historial-body');

  if (_historial.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="estado-vacio">Aún no hay mantenciones registradas.</td></tr>`;
    return;
  }

  tbody.innerHTML = _historial.map(m => `
    <tr>
      <td>${formatearFecha(m.fecha)}</td>
      <td class="descripcion-cell">${esc(m.descripcion) || '<span style="color:#ccc">—</span>'}</td>
      <td>${renderCeldaArchivo(m)}</td>
      <td>
        <div class="acciones-tabla">
          <button class="secundario" onclick="eliminarMantencionUI('${m.id}')">Eliminar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderCeldaArchivo(m) {
  if (m.archivo_path) {
    return `
      <div class="archivo-cell">
        <button class="secundario" style="padding:5px 10px;font-size:12px;" onclick="descargarArchivoMantencion('${esc(m.archivo_path)}', '${esc(m.archivo_nombre)}')">⬇ Descargar</button>
        <span title="${esc(m.archivo_nombre)}">${esc(m.archivo_nombre)}</span>
      </div>`;
  }
  return '<span style="color:#ccc">Sin adjunto</span>';
}

// --------- Registrar mantención ---------

async function guardarMantencion() {
  if (!_equipoActualId) return;

  const fecha = document.getElementById('m-fecha').value;
  const descripcion = document.getElementById('m-descripcion').value.trim();
  const fileInput = document.getElementById('m-archivo');
  const file = fileInput.files[0];

  if (!fecha) {
    mostrarMensaje('m-mensaje', 'La fecha es obligatoria.', 'error');
    return;
  }

  const btn = document.getElementById('btn-guardar-mantencion');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Guardando...';

  try {
    let archivo_path = null;
    let archivo_nombre = null;

    if (file) {
      const ext = file.name.split('.').pop();
      archivo_path = `${_equipoActualId}/${Date.now()}.${ext}`;
      archivo_nombre = file.name;

      const { error: errUpload } = await supabaseClient.storage
        .from(BUCKET_EQUIPOS)
        .upload(archivo_path, file, { upsert: true });

      if (errUpload) throw errUpload;
    }

    const nueva = await crearMantencion(_equipoActualId, { fecha, descripcion, archivo_path, archivo_nombre });
    _historial.unshift(nueva);
    _historial.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

    // Actualizar última mantención en la lista local (en memoria)
    const equipo = getEquipoPorId(_equipoActualId);
    if (equipo && (!equipo.ultima_mantencion || fecha > equipo.ultima_mantencion)) {
      equipo.ultima_mantencion = fecha;
    }

    renderHistorial();
    mostrarMensaje('m-mensaje', 'Mantención registrada.', 'exito');

    document.getElementById('m-fecha').value = new Date().toISOString().slice(0, 10);
    document.getElementById('m-descripcion').value = '';
    fileInput.value = '';
  } catch (err) {
    mostrarMensaje('m-mensaje', 'Error al registrar: ' + (err.message || err), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

async function eliminarMantencionUI(id) {
  const ok = await confirmarAccion('¿Eliminar esta mantención del historial?', {
    titulo: 'Eliminar mantención',
    textoConfirmar: 'Eliminar',
    tipo: 'peligro',
  });
  if (!ok) return;

  try {
    await eliminarMantencion(id);
    _historial = _historial.filter(m => m.id !== id);
    renderHistorial();

    // Recalcular última mantención del equipo en memoria
    const equipo = getEquipoPorId(_equipoActualId);
    if (equipo) {
      equipo.ultima_mantencion = _historial.length ? _historial[0].fecha : null;
    }
  } catch (err) {
    mostrarMensaje('m-mensaje', 'Error al eliminar: ' + (err.message || err), 'error');
  }
}

async function descargarArchivoMantencion(path, nombre) {
  const { data, error } = await supabaseClient.storage
    .from(BUCKET_EQUIPOS)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    alert('No se pudo generar el enlace de descarga: ' + error.message);
    return;
  }

  const a = document.createElement('a');
  a.href = data.signedUrl;
  a.download = nombre || 'adjunto';
  a.target = '_blank';
  a.click();
}

// --------- Helpers ---------

function getEquipoPorId(id) {
  return _equipos.find(e => e.id === id) || null;
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mostrarMensaje(id, texto, tipo) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = texto;
  el.className = 'form-mensaje' + (tipo ? ' ' + tipo : '');
}
