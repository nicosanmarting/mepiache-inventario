/* ===========================
   Mepiache Inventario - Clientes frecuentes
   (visible para todos los usuarios autenticados)
   =========================== */

// --------- Init ---------

document.addEventListener('DOMContentLoaded', async () => {
  const sesion = await initLayout('clientes.html');
  if (!sesion) return;

  bindUI();
  renderTabla();
});

// --------- UI binding ---------

function bindUI() {
  document.getElementById('btn-nuevo-cliente').addEventListener('click', () => abrirFormulario());
  document.getElementById('btn-cancelar-cliente').addEventListener('click', cerrarFormulario);
  document.getElementById('btn-guardar-cliente').addEventListener('click', guardarCliente);
  document.getElementById('filtro-cliente').addEventListener('input', renderTabla);
  document.getElementById('filtro-inactivos').addEventListener('change', renderTabla);
}

// --------- Formulario ---------

function abrirFormulario(c = null) {
  const form = document.getElementById('form-cliente');
  form.style.display = 'block';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.getElementById('form-titulo').textContent = c ? 'Editar cliente' : 'Nuevo cliente';
  document.getElementById('cl-id').value = c ? c.id : '';
  document.getElementById('cl-nombre').value = c ? (c.nombre || '') : '';
  document.getElementById('cl-telefono').value = c ? (c.contacto_telefono || '') : '';
  document.getElementById('cl-email').value = c ? (c.contacto_email || '') : '';
  mostrarMensaje('cl-mensaje', '', '');
}

function cerrarFormulario() {
  document.getElementById('form-cliente').style.display = 'none';
}

// --------- CRUD clientes ---------

async function guardarCliente() {
  const id = document.getElementById('cl-id').value.trim();
  const nombre = document.getElementById('cl-nombre').value.trim();
  const contacto_telefono = document.getElementById('cl-telefono').value.trim();
  const contacto_email = document.getElementById('cl-email').value.trim();

  if (!nombre) {
    mostrarMensaje('cl-mensaje', 'El nombre es obligatorio.', 'error');
    return;
  }

  const btn = document.getElementById('btn-guardar-cliente');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const datos = { nombre, contacto_telefono, contacto_email };

    if (id) {
      await actualizarCliente(id, datos);
    } else {
      await crearCliente(datos);
    }

    mostrarMensaje('cl-mensaje', 'Guardado correctamente.', 'exito');
    renderTabla();
    setTimeout(cerrarFormulario, 900);
  } catch (e) {
    mostrarMensaje('cl-mensaje', 'Error al guardar: ' + (e.message || e), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

async function toggleActivo(id, activo) {
  try {
    await actualizarCliente(id, { activo });
    renderTabla();
  } catch (e) {
    mostrarMensaje('lista-mensaje', 'Error al actualizar estado: ' + (e.message || e), 'error');
  }
}

// --------- Render tabla ---------

function renderTabla() {
  const busqueda = (document.getElementById('filtro-cliente').value || '').toLowerCase();
  const mostrarInactivos = document.getElementById('filtro-inactivos').checked;

  const filtrados = getClientesTodos().filter(c => {
    if (!mostrarInactivos && !c.activo) return false;
    if (busqueda && !(c.nombre || '').toLowerCase().includes(busqueda)) return false;
    return true;
  });

  const tbody = document.getElementById('tabla-clientes-body');

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="estado-vacio">No hay clientes registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map(c => `
    <tr class="${c.activo ? '' : 'fila-inactiva'}">
      <td><strong>${esc(c.nombre)}</strong></td>
      <td class="contacto-cell">${renderCeldaContacto(c)}</td>
      <td><span class="badge ${c.activo ? 'activo' : 'inactivo'}">${c.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        <div class="acciones-tabla">
          <button onclick="abrirFormulario(getClientePorId('${c.id}'))">Editar</button>
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
