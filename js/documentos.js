/* ===========================
   Mepiache Inventario - Documentos de gestión (admin)
   =========================== */

const BUCKET_DOCUMENTOS = 'documentos';
const DIAS_ALERTA_VENCIMIENTO = 30;

let _documentos = [];

// --------- Init ---------

document.addEventListener('DOMContentLoaded', async () => {
  const sesion = await initLayout('documentos.html', { soloAdmin: true });
  if (!sesion) return;

  bindUI();
  await cargarDocumentos();
});

// --------- UI binding ---------

function bindUI() {
  document.getElementById('btn-nuevo-doc').addEventListener('click', () => abrirFormulario());
  document.getElementById('btn-cancelar-doc').addEventListener('click', cerrarFormulario);
  document.getElementById('btn-guardar-doc').addEventListener('click', guardarDocumento);
  document.getElementById('filtro-busqueda').addEventListener('input', renderTabla);
  document.getElementById('filtro-categoria').addEventListener('change', renderTabla);
  document.getElementById('filtro-archivados').addEventListener('change', renderTabla);
}

// --------- Formulario ---------

function abrirFormulario(doc = null) {
  const form = document.getElementById('form-doc');
  form.style.display = 'block';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.getElementById('form-doc-titulo').textContent = doc ? 'Editar documento' : 'Nuevo documento';
  document.getElementById('d-id').value = doc ? doc.id : '';
  document.getElementById('d-titulo').value = doc ? (doc.titulo || '') : '';
  document.getElementById('d-categoria').value = doc ? (doc.categoria || '') : '';
  document.getElementById('d-contraparte').value = doc ? (doc.contraparte || '') : '';
  document.getElementById('d-fecha-doc').value = doc ? (doc.fecha_documento || '') : '';
  document.getElementById('d-fecha-venc').value = doc ? (doc.fecha_vencimiento || '') : '';
  document.getElementById('d-descripcion').value = doc ? (doc.descripcion || '') : '';
  mostrarMensaje('d-mensaje', '', '');
}

function cerrarFormulario() {
  document.getElementById('form-doc').style.display = 'none';
}

// --------- CRUD ---------

async function cargarDocumentos() {
  _documentos = await getDocumentosGestion();
  renderAlertaVencimientos();
  renderTabla();
}

async function guardarDocumento() {
  const id = document.getElementById('d-id').value.trim();
  const titulo = document.getElementById('d-titulo').value.trim();
  const categoria = document.getElementById('d-categoria').value;
  const contraparte = document.getElementById('d-contraparte').value.trim();
  const fechaDoc = document.getElementById('d-fecha-doc').value;
  const fechaVenc = document.getElementById('d-fecha-venc').value;
  const descripcion = document.getElementById('d-descripcion').value.trim();

  if (!titulo) { mostrarMensaje('d-mensaje', 'El título es obligatorio.', 'error'); return; }
  if (!categoria) { mostrarMensaje('d-mensaje', 'Selecciona una categoría.', 'error'); return; }

  const btn = document.getElementById('btn-guardar-doc');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Guardando...';

  try {
    const datos = {
      titulo, categoria, contraparte,
      fecha_documento: fechaDoc || null,
      fecha_vencimiento: fechaVenc || null,
      descripcion,
    };

    if (id) {
      await actualizarDocumentoGestion(id, datos);
      const idx = _documentos.findIndex(d => d.id === id);
      if (idx >= 0) _documentos[idx] = { ..._documentos[idx], ...datos };
    } else {
      const nuevo = await crearDocumentoGestion(datos);
      _documentos.unshift(nuevo);
    }

    mostrarMensaje('d-mensaje', 'Guardado correctamente.', 'exito');
    renderAlertaVencimientos();
    renderTabla();
    setTimeout(cerrarFormulario, 900);
  } catch (e) {
    mostrarMensaje('d-mensaje', 'Error al guardar: ' + (e.message || e), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

async function toggleVigente(id, vigente) {
  try {
    await actualizarDocumentoGestion(id, { vigente });
    const doc = _documentos.find(d => d.id === id);
    if (doc) doc.vigente = vigente;
    renderTabla();
  } catch (e) {
    mostrarMensaje('lista-doc-mensaje', 'Error: ' + (e.message || e), 'error');
  }
}

// --------- Upload / Download ---------

async function subirArchivo(docId, file) {
  const ext = file.name.split('.').pop();
  const path = `${docId}/${Date.now()}.${ext}`;

  const { error } = await supabaseClient.storage
    .from(BUCKET_DOCUMENTOS)
    .upload(path, file, { upsert: true });

  if (error) throw error;

  await actualizarDocumentoGestion(docId, {
    archivo_path: path,
    archivo_nombre: file.name,
  });

  const doc = _documentos.find(d => d.id === docId);
  if (doc) {
    doc.archivo_path = path;
    doc.archivo_nombre = file.name;
  }
}

async function descargarArchivo(path, nombre) {
  const { data, error } = await supabaseClient.storage
    .from(BUCKET_DOCUMENTOS)
    .createSignedUrl(path, 60 * 60);

  if (error) { alert('No se pudo generar enlace: ' + error.message); return; }

  const a = document.createElement('a');
  a.href = data.signedUrl;
  a.download = nombre || 'documento';
  a.target = '_blank';
  a.click();
}

// --------- Alerta de vencimientos ---------

function renderAlertaVencimientos() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + DIAS_ALERTA_VENCIMIENTO);

  const proximos = _documentos.filter(d => {
    if (!d.vigente || !d.fecha_vencimiento) return false;
    const venc = new Date(d.fecha_vencimiento + 'T00:00:00');
    return venc <= limite;
  }).sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));

  const el = document.getElementById('alerta-vencimiento');
  const lista = document.getElementById('alerta-vencimiento-lista');

  if (proximos.length === 0) { el.style.display = 'none'; return; }

  el.style.display = 'block';
  lista.textContent = proximos.map(d => {
    const venc = new Date(d.fecha_vencimiento + 'T00:00:00');
    const diff = Math.round((venc - hoy) / 86400000);
    const texto = diff < 0 ? 'vencido' : diff === 0 ? 'vence hoy' : `vence en ${diff} día${diff > 1 ? 's' : ''}`;
    return `${d.titulo} (${texto})`;
  }).join(' · ');
}

// --------- Render tabla ---------

function renderTabla() {
  const busqueda = (document.getElementById('filtro-busqueda').value || '').toLowerCase();
  const catFiltro = document.getElementById('filtro-categoria').value;
  const mostrarArchivados = document.getElementById('filtro-archivados').checked;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + DIAS_ALERTA_VENCIMIENTO);

  const filtrados = _documentos.filter(d => {
    if (!mostrarArchivados && !d.vigente) return false;
    if (catFiltro && d.categoria !== catFiltro) return false;
    if (busqueda) {
      const match = (d.titulo || '').toLowerCase().includes(busqueda)
        || (d.contraparte || '').toLowerCase().includes(busqueda)
        || (d.descripcion || '').toLowerCase().includes(busqueda);
      if (!match) return false;
    }
    return true;
  });

  const tbody = document.getElementById('tabla-doc-body');

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="estado-vacio">No hay documentos registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map(d => {
    const estadoVenc = calcularEstadoVencimiento(d, hoy, limite);
    return `
      <tr class="${d.vigente ? '' : 'fila-inactiva'}">
        <td><strong>${esc(d.titulo)}</strong></td>
        <td><span class="categoria-pill">${esc(d.categoria)}</span></td>
        <td>${esc(d.contraparte) || '<span style="color:#ccc">—</span>'}</td>
        <td>${d.fecha_documento ? formatearFecha(d.fecha_documento) : '—'}</td>
        <td>${renderCeldaVencimiento(d, estadoVenc)}</td>
        <td class="doc-descripcion">${esc(d.descripcion) || '<span style="color:#ccc">—</span>'}</td>
        <td>${renderCeldaArchivo(d)}</td>
        <td><span class="badge ${badgeEstado(d, estadoVenc)}">${labelEstado(d, estadoVenc)}</span></td>
        <td>
          <div class="acciones-tabla">
            <button onclick="abrirFormulario(getDocPorId('${d.id}'))">Editar</button>
            <button class="secundario" onclick="toggleVigente('${d.id}', ${!d.vigente})">${d.vigente ? 'Archivar' : 'Activar'}</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Adjuntar listeners de upload
  filtrados.forEach(d => {
    const fileInput = document.getElementById(`dfile-${d.id}`);
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const prog = document.getElementById(`dprogress-${d.id}`);
        if (prog) prog.textContent = 'Subiendo...';
        try {
          await subirArchivo(d.id, file);
          renderTabla();
        } catch (err) {
          if (prog) prog.textContent = 'Error';
          alert('Error al subir: ' + (err.message || err));
        }
      });
    }
  });
}

// --------- Helpers de estado ---------

function calcularEstadoVencimiento(d, hoy, limite) {
  if (!d.vigente) return 'archivado';
  if (!d.fecha_vencimiento) return 'vigente';
  const venc = new Date(d.fecha_vencimiento + 'T00:00:00');
  if (venc < hoy) return 'vencido';
  if (venc <= limite) return 'por-vencer';
  return 'vigente';
}

function badgeEstado(d, estado) {
  if (!d.vigente) return 'archivado';
  return estado;
}

function labelEstado(d, estado) {
  if (!d.vigente) return 'Archivado';
  if (estado === 'vencido') return 'Vencido';
  if (estado === 'por-vencer') return 'Por vencer';
  return 'Vigente';
}

function renderCeldaVencimiento(d, estado) {
  if (!d.fecha_vencimiento) return '—';
  const fecha = formatearFecha(d.fecha_vencimiento);
  if (estado === 'vencido') return `<strong style="color:#b3261e">${fecha}</strong>`;
  if (estado === 'por-vencer') return `<strong style="color:#856404">${fecha}</strong>`;
  return fecha;
}

function renderCeldaArchivo(d) {
  const input = `<input type="file" id="dfile-${d.id}" class="file-hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg">`;
  const label = `<label for="dfile-${d.id}" class="upload-label">📎 Subir</label>`;
  const prog = `<span id="dprogress-${d.id}" class="upload-progress"></span>`;

  if (d.archivo_path) {
    return `<div class="contrato-cell">
      <button class="secundario" style="padding:5px 10px;font-size:12px;" onclick="descargarArchivo('${esc(d.archivo_path)}', '${esc(d.archivo_nombre)}')">⬇ Descargar</button>
      <span class="nombre-archivo" title="${esc(d.archivo_nombre)}">${esc(d.archivo_nombre)}</span>
      ${input}${label}${prog}
    </div>`;
  }

  return `<div class="contrato-cell">
    <span style="color:#ccc;font-size:12px;">Sin archivo</span>
    ${input}${label}${prog}
  </div>`;
}

// --------- Misc ---------

function getDocPorId(id) {
  return _documentos.find(d => d.id === id) || null;
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mostrarMensaje(id, texto, tipo) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = texto;
  el.className = 'form-mensaje' + (tipo ? ' ' + tipo : '');
}
