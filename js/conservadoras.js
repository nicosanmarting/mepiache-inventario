/* ===========================
   Mepiache Inventario - Conservadoras (admin)
   =========================== */

// --------- Estado local ---------

let _conservadoras = [];

const ESTADO_LABELS = {
  en_uso: 'En uso',
  mantencion: 'En mantención',
  devuelta: 'Devuelta',
};

// --------- Init ---------

document.addEventListener('DOMContentLoaded', async () => {
  const sesion = await initLayout('conservadoras.html', { soloAdmin: true });
  if (!sesion) return;

  bindUI();
  await cargarConservadoras();
});

// --------- UI binding ---------

function bindUI() {
  document.getElementById('btn-nueva-conservadora').addEventListener('click', () => abrirFormulario());
  document.getElementById('btn-cancelar-conservadora').addEventListener('click', cerrarFormulario);
  document.getElementById('btn-guardar-conservadora').addEventListener('click', guardarConservadora);
  document.getElementById('filtro-cliente').addEventListener('input', renderTabla);
  document.getElementById('filtro-estado').addEventListener('change', renderTabla);
  document.getElementById('filtro-inactivos').addEventListener('change', renderTabla);
}

// --------- Formulario ---------

function abrirFormulario(c = null) {
  const form = document.getElementById('form-conservadora');
  form.style.display = 'block';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.getElementById('form-titulo').textContent = c ? 'Editar conservadora' : 'Nueva conservadora';
  document.getElementById('c-id').value = c ? c.id : '';
  document.getElementById('c-codigo').value = c ? (c.codigo || '') : '';
  document.getElementById('c-modelo').value = c ? (c.modelo || '') : '';
  document.getElementById('c-cliente').value = c ? (c.cliente_nombre || '') : '';
  document.getElementById('c-ubicacion').value = c ? (c.ubicacion || '') : '';
  document.getElementById('c-telefono').value = c ? (c.contacto_telefono || '') : '';
  document.getElementById('c-email').value = c ? (c.contacto_email || '') : '';
  document.getElementById('c-fecha-entrega').value = c ? (c.fecha_entrega || '') : '';
  document.getElementById('c-estado').value = c ? (c.estado || 'en_uso') : 'en_uso';
  document.getElementById('c-notas').value = c ? (c.notas || '') : '';
  mostrarMensaje('c-mensaje', '', '');
}

function cerrarFormulario() {
  document.getElementById('form-conservadora').style.display = 'none';
}

// --------- CRUD conservadoras ---------

async function cargarConservadoras() {
  _conservadoras = await getConservadoras();
  renderTabla();
}

async function guardarConservadora() {
  const id = document.getElementById('c-id').value.trim();
  const codigo = document.getElementById('c-codigo').value.trim();
  const modelo = document.getElementById('c-modelo').value.trim();
  const cliente_nombre = document.getElementById('c-cliente').value.trim();
  const ubicacion = document.getElementById('c-ubicacion').value.trim();
  const contacto_telefono = document.getElementById('c-telefono').value.trim();
  const contacto_email = document.getElementById('c-email').value.trim();
  const fecha_entrega = document.getElementById('c-fecha-entrega').value;
  const estado = document.getElementById('c-estado').value;
  const notas = document.getElementById('c-notas').value.trim();

  if (!cliente_nombre) {
    mostrarMensaje('c-mensaje', 'El nombre del cliente es obligatorio.', 'error');
    return;
  }

  const btn = document.getElementById('btn-guardar-conservadora');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const datos = {
      codigo, modelo, cliente_nombre, ubicacion,
      contacto_telefono, contacto_email,
      fecha_entrega: fecha_entrega || null,
      estado, notas,
    };

    if (id) {
      await actualizarConservadora(id, datos);
      const idx = _conservadoras.findIndex(c => c.id === id);
      if (idx >= 0) _conservadoras[idx] = { ..._conservadoras[idx], ...datos };
    } else {
      const nueva = await crearConservadora(datos);
      _conservadoras.unshift(nueva);
    }

    mostrarMensaje('c-mensaje', 'Guardado correctamente.', 'exito');
    renderTabla();
    setTimeout(cerrarFormulario, 900);
  } catch (e) {
    mostrarMensaje('c-mensaje', 'Error al guardar: ' + (e.message || e), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

async function toggleActivo(id, activo) {
  try {
    await actualizarConservadora(id, { activo });
    const c = _conservadoras.find(c => c.id === id);
    if (c) c.activo = activo;
    renderTabla();
  } catch (e) {
    mostrarMensaje('lista-mensaje', 'Error al actualizar estado: ' + (e.message || e), 'error');
  }
}

// --------- Render tabla ---------

function renderTabla() {
  const busqueda = (document.getElementById('filtro-cliente').value || '').toLowerCase();
  const estadoFiltro = document.getElementById('filtro-estado').value;
  const mostrarInactivas = document.getElementById('filtro-inactivos').checked;

  const filtrados = _conservadoras.filter(c => {
    if (!mostrarInactivas && !c.activo) return false;
    if (estadoFiltro && c.estado !== estadoFiltro) return false;
    if (busqueda) {
      const hayMatch = (c.cliente_nombre || '').toLowerCase().includes(busqueda)
        || (c.codigo || '').toLowerCase().includes(busqueda)
        || (c.ubicacion || '').toLowerCase().includes(busqueda);
      if (!hayMatch) return false;
    }
    return true;
  });

  const tbody = document.getElementById('tabla-conservadoras-body');

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="estado-vacio">No hay conservadoras registradas.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map(c => `
    <tr class="${c.activo ? '' : 'fila-inactiva'}">
      <td><strong>${esc(c.codigo) || '—'}</strong></td>
      <td>${esc(c.modelo) || '—'}</td>
      <td>${esc(c.cliente_nombre)}</td>
      <td>${esc(c.ubicacion) || '—'}</td>
      <td class="contacto-cell">${renderCeldaContacto(c)}</td>
      <td>${c.fecha_entrega ? formatearFecha(c.fecha_entrega) : '—'}</td>
      <td><span class="badge ${c.estado}">${ESTADO_LABELS[c.estado] || c.estado}</span></td>
      <td class="notas-cell">${esc(c.notas) || '<span style="color:#ccc">—</span>'}</td>
      <td>
        <div class="acciones-tabla">
          <button onclick="abrirFormulario(getConservadoraPorId('${c.id}'))">Editar</button>
          <button class="secundario" onclick="toggleActivo('${c.id}', ${!c.activo})">${c.activo ? 'Desactivar' : 'Activar'}</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderCeldaContacto(c) {
  if (!c.contacto_telefono && !c.contacto_email) {
    return '<span style="color:#ccc">—</span>';
  }
  return `
    ${c.contacto_telefono ? `<div>${esc(c.contacto_telefono)}</div>` : ''}
    ${c.contacto_email ? `<div>${esc(c.contacto_email)}</div>` : ''}
  `;
}

// --------- Helpers ---------

function getConservadoraPorId(id) {
  return _conservadoras.find(c => c.id === id) || null;
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
