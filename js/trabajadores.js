/* ===========================
   Mepiache Inventario - Trabajadores (admin)
   =========================== */

const BUCKET_CONTRATOS = 'contratos';

// --------- Estado local ---------

let _trabajadores = [];

// --------- Init ---------

document.addEventListener('DOMContentLoaded', async () => {
  const sesion = await initLayout('trabajadores.html', { soloAdmin: true });
  if (!sesion) return;

  bindUI();
  await cargarTrabajadores();
});

// --------- UI binding ---------

function bindUI() {
  document.getElementById('btn-nuevo-trabajador').addEventListener('click', () => abrirFormulario());
  document.getElementById('btn-cancelar-trabajador').addEventListener('click', cerrarFormulario);
  document.getElementById('btn-guardar-trabajador').addEventListener('click', guardarTrabajador);
  document.getElementById('filtro-nombre').addEventListener('input', renderTabla);
  document.getElementById('filtro-inactivos').addEventListener('change', renderTabla);
}

// --------- Formulario ---------

function abrirFormulario(t = null) {
  const form = document.getElementById('form-trabajador');
  form.style.display = 'block';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.getElementById('form-titulo').textContent = t ? 'Editar trabajador' : 'Nuevo trabajador';
  document.getElementById('t-id').value = t ? t.id : '';
  document.getElementById('t-nombre').value = t ? (t.nombre || '') : '';
  document.getElementById('t-rut').value = t ? (t.rut || '') : '';
  document.getElementById('t-cargo').value = t ? (t.cargo || '') : '';
  document.getElementById('t-ingreso').value = t ? (t.fecha_ingreso || '') : '';
  document.getElementById('t-inoperancia').value = t ? (t.inoperancia || '') : '';
  mostrarMensaje('t-mensaje', '', '');
}

function cerrarFormulario() {
  document.getElementById('form-trabajador').style.display = 'none';
}

// --------- CRUD trabajadores ---------

async function cargarTrabajadores() {
  _trabajadores = await getTrabajadores();
  renderTabla();
}

async function guardarTrabajador() {
  const id = document.getElementById('t-id').value.trim();
  const nombre = document.getElementById('t-nombre').value.trim();
  const rut = document.getElementById('t-rut').value.trim();
  const cargo = document.getElementById('t-cargo').value.trim();
  const fechaIngreso = document.getElementById('t-ingreso').value;
  const inoperancia = document.getElementById('t-inoperancia').value.trim();

  if (!nombre) {
    mostrarMensaje('t-mensaje', 'El nombre es obligatorio.', 'error');
    return;
  }

  const btn = document.getElementById('btn-guardar-trabajador');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Guardando...';

  try {
    const datos = { nombre, rut, cargo, fecha_ingreso: fechaIngreso || null, inoperancia };

    if (id) {
      await actualizarTrabajador(id, datos);
      const idx = _trabajadores.findIndex(t => t.id === id);
      if (idx >= 0) _trabajadores[idx] = { ..._trabajadores[idx], ...datos };
    } else {
      const nuevo = await crearTrabajador(datos);
      _trabajadores.unshift(nuevo);
    }

    mostrarMensaje('t-mensaje', 'Guardado correctamente.', 'exito');
    renderTabla();
    setTimeout(cerrarFormulario, 900);
  } catch (e) {
    mostrarMensaje('t-mensaje', 'Error al guardar: ' + (e.message || e), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

async function toggleActivo(id, activo) {
  try {
    await actualizarTrabajador(id, { activo });
    const t = _trabajadores.find(t => t.id === id);
    if (t) t.activo = activo;
    renderTabla();
  } catch (e) {
    mostrarMensaje('lista-mensaje', 'Error al actualizar estado: ' + (e.message || e), 'error');
  }
}

// --------- Upload / Download de contrato ---------

async function subirContrato(trabajadorId, file) {
  const ext = file.name.split('.').pop();
  const path = `${trabajadorId}/${Date.now()}.${ext}`;

  const { error } = await supabaseClient.storage
    .from(BUCKET_CONTRATOS)
    .upload(path, file, { upsert: true });

  if (error) throw error;

  await actualizarTrabajador(trabajadorId, {
    contrato_path: path,
    contrato_nombre: file.name,
  });

  const t = _trabajadores.find(t => t.id === trabajadorId);
  if (t) {
    t.contrato_path = path;
    t.contrato_nombre = file.name;
  }
}

async function descargarContrato(path, nombre) {
  const { data, error } = await supabaseClient.storage
    .from(BUCKET_CONTRATOS)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    alert('No se pudo generar el enlace de descarga: ' + error.message);
    return;
  }

  const a = document.createElement('a');
  a.href = data.signedUrl;
  a.download = nombre || 'contrato';
  a.target = '_blank';
  a.click();
}

// --------- Render tabla ---------

function renderTabla() {
  const busqueda = (document.getElementById('filtro-nombre').value || '').toLowerCase();
  const mostrarInactivos = document.getElementById('filtro-inactivos').checked;

  const filtrados = _trabajadores.filter(t => {
    if (!mostrarInactivos && !t.activo) return false;
    if (busqueda) {
      const hayMatch = (t.nombre || '').toLowerCase().includes(busqueda)
        || (t.cargo || '').toLowerCase().includes(busqueda)
        || (t.rut || '').toLowerCase().includes(busqueda);
      if (!hayMatch) return false;
    }
    return true;
  });

  const tbody = document.getElementById('tabla-trabajadores-body');

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="estado-vacio">No hay trabajadores registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map(t => `
    <tr class="${t.activo ? '' : 'fila-inactiva'}">
      <td><strong>${esc(t.nombre)}</strong></td>
      <td>${esc(t.rut)}</td>
      <td>${esc(t.cargo)}</td>
      <td>${t.fecha_ingreso ? formatearFecha(t.fecha_ingreso) : '—'}</td>
      <td class="inoperancia-cell">${esc(t.inoperancia) || '<span style="color:#ccc">—</span>'}</td>
      <td>${renderCeldaContrato(t)}</td>
      <td><span class="badge ${t.activo ? 'activo' : 'inactivo'}">${t.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        <div class="acciones-tabla">
          <button onclick="abrirFormulario(getTrabajadorPorId('${t.id}'))">Editar</button>
          <button class="secundario" onclick="toggleActivo('${t.id}', ${!t.activo})">${t.activo ? 'Desactivar' : 'Activar'}</button>
        </div>
      </td>
    </tr>
  `).join('');

  // Adjuntar listeners de upload después de renderizar
  filtrados.forEach(t => {
    const fileInput = document.getElementById(`file-${t.id}`);
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const progressEl = document.getElementById(`progress-${t.id}`);
        if (progressEl) progressEl.textContent = 'Subiendo...';

        try {
          await subirContrato(t.id, file);
          renderTabla();
        } catch (err) {
          if (progressEl) progressEl.textContent = 'Error al subir';
          alert('Error al subir contrato: ' + (err.message || err));
        }
      });
    }
  });
}

function renderCeldaContrato(t) {
  const uploadInput = `<input type="file" id="file-${t.id}" class="file-hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg">`;
  const uploadBtn = `<label for="file-${t.id}" class="upload-label">📎 Subir</label>`;
  const progress = `<span id="progress-${t.id}" class="upload-progress"></span>`;

  if (t.contrato_path) {
    return `
      <div class="contrato-cell">
        <button class="secundario" style="padding:5px 10px;font-size:12px;" onclick="descargarContrato('${esc(t.contrato_path)}', '${esc(t.contrato_nombre)}')">⬇ Descargar</button>
        <span title="${esc(t.contrato_nombre)}">${esc(t.contrato_nombre)}</span>
        ${uploadInput}
        ${uploadBtn}
        ${progress}
      </div>`;
  }

  return `
    <div class="contrato-cell">
      <span style="color:#ccc">Sin contrato</span>
      ${uploadInput}
      ${uploadBtn}
      ${progress}
    </div>`;
}

// --------- Helpers ---------

function getTrabajadorPorId(id) {
  return _trabajadores.find(t => t.id === id) || null;
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
