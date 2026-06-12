/* ===========================
   Mepiache Inventario - Materias primas
   - Vista general: visible para todos los usuarios.
   - Campos de proveedor/costo/pedido promedio y alta/edición
     de materias primas: solo admin (cosmético, vía ADMIN_EMAILS).
   =========================== */

let _mpEsAdmin = false;

const _mpSort = initTableSort('#tabla-mp thead', [
  { tipo: 'texto', accesor: mp => mp.categoria },
  { tipo: 'texto', accesor: mp => mp.codigo },
  { tipo: 'texto', accesor: mp => mp.nombre },
  { tipo: 'texto', accesor: mp => mp.unidadMedida },
  { tipo: 'numero', accesor: mp => mp.stock },
  { tipo: 'numero', accesor: mp => mp.stockMinimo },
  { tipo: 'texto', accesor: mp => etiquetaEstadoStock(estadoStockMP(mp)) },
  { tipo: 'texto', accesor: mp => mp.proveedorNombre },
  { tipo: 'texto', accesor: mp => mp.proveedorContacto },
  { tipo: 'numero', accesor: mp => mp.costoUnitario },
  { tipo: 'numero', accesor: mp => mp.pedidoPromedio },
  { tipo: 'texto', accesor: mp => mp.notas },
  null,
], () => renderTabla());

// --------- Init ---------

document.addEventListener('DOMContentLoaded', async () => {
  const sesion = await initLayout('materias-primas.html');
  if (!sesion) return;

  _mpEsAdmin = esAdmin();
  if (_mpEsAdmin) {
    document.body.classList.add('es-admin');
    document.getElementById('btn-nueva-mp').style.display = 'inline-block';
  }

  poblarSelectsEstaticos();
  bindUI();
  aplicarFiltrosDesdeUrl();
  renderResumenCards();
  renderTabla();
  renderMovimientos();
});

function aplicarFiltrosDesdeUrl() {
  const params = new URLSearchParams(window.location.search);

  const busqueda = params.get('busqueda');
  if (busqueda) document.getElementById('filtro-mp').value = busqueda;
}

// --------- UI binding ---------

function bindUI() {
  document.getElementById('btn-nuevo-movimiento').addEventListener('click', () => abrirFormularioMovimiento());
  document.getElementById('btn-cancelar-movimiento').addEventListener('click', cerrarFormularioMovimiento);
  document.getElementById('btn-guardar-movimiento').addEventListener('click', guardarMovimiento);
  document.getElementById('mp-mov-tipo').addEventListener('change', actualizarFormularioMovimiento);

  if (_mpEsAdmin) {
    document.getElementById('btn-nueva-mp').addEventListener('click', () => abrirFormularioMP());
    document.getElementById('btn-cancelar-mp').addEventListener('click', cerrarFormularioMP);
    document.getElementById('btn-guardar-mp').addEventListener('click', guardarMateriaPrima);
  }

  document.getElementById('filtro-categoria-mp').addEventListener('change', renderTabla);
  document.getElementById('filtro-mp').addEventListener('input', renderTabla);
  document.getElementById('filtro-estado-mp').addEventListener('change', renderTabla);
  document.getElementById('filtro-inactivos-mp').addEventListener('change', renderTabla);
}

// --------- Selects estáticos ---------

function poblarSelectsEstaticos() {
  const categorias = getCategoriasMateriaPrima();

  // Filtro de categoría
  document.getElementById('filtro-categoria-mp').insertAdjacentHTML(
    'beforeend',
    categorias.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')
  );

  // Select de categoría en el formulario de materia prima (admin)
  if (_mpEsAdmin) {
    document.getElementById('mp-categoria').innerHTML =
      categorias.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  }

  // Select de materia prima en el formulario de movimiento
  initCombobox('mp-mov-materia', { placeholder: 'Buscar materia prima...' });
  poblarSelectMateriaMovimiento();

  // Fecha por defecto: hoy
  document.getElementById('mp-mov-fecha').value = new Date().toISOString().slice(0, 10);

  // Motivos según tipo de movimiento (inicial)
  actualizarFormularioMovimiento();
}

function poblarSelectMateriaMovimiento() {
  const select = document.getElementById('mp-mov-materia');
  const categorias = getCategoriasMateriaPrima();

  select.innerHTML = categorias.map(cat => {
    const items = getMateriasPrimasPorCategoria(cat);
    if (items.length === 0) return '';
    return `
      <optgroup label="${esc(cat)}">
        ${items.map(mp => `<option value="${mp.id}">${esc(mp.nombre)} (${esc(mp.unidadMedida)})</option>`).join('')}
      </optgroup>
    `;
  }).join('');
  refrescarCombobox('mp-mov-materia');
}

// --------- Formulario: registrar movimiento ---------

function abrirFormularioMovimiento(materiaPrimaId = null) {
  const form = document.getElementById('form-movimiento');
  form.style.display = 'block';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });

  poblarSelectMateriaMovimiento();
  if (materiaPrimaId) {
    document.getElementById('mp-mov-materia').value = materiaPrimaId;
    refrescarCombobox('mp-mov-materia');
  }

  document.getElementById('mp-mov-tipo').value = 'entrada';
  document.getElementById('mp-mov-cantidad').value = '';
  document.getElementById('mp-mov-fecha').value = new Date().toISOString().slice(0, 10);
  document.getElementById('mp-mov-nota').value = '';
  document.getElementById('mp-mov-forzar').checked = false;
  actualizarFormularioMovimiento();
  mostrarMensaje('mp-mov-mensaje', '', '');
}

function cerrarFormularioMovimiento() {
  document.getElementById('form-movimiento').style.display = 'none';
}

function actualizarFormularioMovimiento() {
  const tipo = document.getElementById('mp-mov-tipo').value;
  const motivoSelect = document.getElementById('mp-mov-motivo');
  const forzarRow = document.getElementById('mp-mov-forzar-row');
  const motivoRow = document.getElementById('mp-mov-motivo-row');

  if (tipo === 'entrada') {
    motivoSelect.innerHTML = MOTIVOS_ENTRADA_MP.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
    motivoRow.style.display = '';
    forzarRow.style.display = 'none';
  } else if (tipo === 'salida') {
    motivoSelect.innerHTML = MOTIVOS_SALIDA_MP.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
    motivoRow.style.display = '';
    forzarRow.style.display = '';
  } else {
    // ajuste
    motivoSelect.innerHTML = '<option value="Ajuste de inventario">Ajuste de inventario</option><option value="Conteo físico">Conteo físico</option><option value="Otro">Otro</option>';
    motivoRow.style.display = '';
    forzarRow.style.display = 'none';
  }
}

async function guardarMovimiento() {
  const materiaPrimaId = document.getElementById('mp-mov-materia').value;
  const tipoMovimiento = document.getElementById('mp-mov-tipo').value;
  const cantidadRaw = document.getElementById('mp-mov-cantidad').value;
  const fecha = document.getElementById('mp-mov-fecha').value;
  const motivo = document.getElementById('mp-mov-motivo').value;
  const nota = document.getElementById('mp-mov-nota').value.trim();
  const permitirNegativo = document.getElementById('mp-mov-forzar').checked;

  if (!materiaPrimaId) {
    mostrarMensaje('mp-mov-mensaje', 'Selecciona una materia prima.', 'error');
    return;
  }

  const cantidad = Number(cantidadRaw);
  if (!cantidadRaw || isNaN(cantidad) || cantidad <= 0) {
    mostrarMensaje('mp-mov-mensaje', 'Ingresa una cantidad válida (mayor que 0).', 'error');
    return;
  }

  const btn = document.getElementById('btn-guardar-movimiento');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    await registrarMovimientoMP({
      materiaPrimaId,
      tipoMovimiento,
      cantidad,
      motivo,
      nota,
      fecha,
      permitirNegativo,
    });

    mostrarMensaje('mp-mov-mensaje', 'Movimiento registrado correctamente.', 'exito');
    renderResumenCards();
    renderTabla();
    renderMovimientos();
    setTimeout(cerrarFormularioMovimiento, 900);
  } catch (e) {
    mostrarMensaje('mp-mov-mensaje', 'Error al registrar movimiento: ' + (e.message || e), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar movimiento';
  }
}

// --------- Formulario: nueva / editar materia prima (admin) ---------

function abrirFormularioMP(mp = null) {
  if (!_mpEsAdmin) return;

  const form = document.getElementById('form-mp');
  form.style.display = 'block';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.getElementById('mp-form-titulo').textContent = mp ? 'Editar materia prima' : 'Nueva materia prima';
  document.getElementById('mp-id').value = mp ? mp.id : '';
  document.getElementById('mp-nombre').value = mp ? (mp.nombre || '') : '';
  document.getElementById('mp-codigo').value = mp ? (mp.codigo || '') : '';
  document.getElementById('mp-categoria').value = mp ? mp.categoria : getCategoriasMateriaPrima()[0];
  document.getElementById('mp-unidad').value = mp ? (mp.unidadMedida || 'unidad') : 'unidad';

  const stockInicialInput = document.getElementById('mp-stock-inicial');
  if (mp) {
    stockInicialInput.value = mp.stock;
    stockInicialInput.disabled = true;
    stockInicialInput.title = 'Para ajustar el stock, usa "Registrar movimiento".';
  } else {
    stockInicialInput.value = 0;
    stockInicialInput.disabled = false;
    stockInicialInput.title = '';
  }

  document.getElementById('mp-stock-minimo').value = mp ? mp.stockMinimo : 0;
  document.getElementById('mp-proveedor-nombre').value = mp ? (mp.proveedorNombre || '') : '';
  document.getElementById('mp-proveedor-contacto').value = mp ? (mp.proveedorContacto || '') : '';
  document.getElementById('mp-costo').value = mp && mp.costoUnitario != null ? mp.costoUnitario : '';
  document.getElementById('mp-pedido').value = mp && mp.pedidoPromedio != null ? mp.pedidoPromedio : '';
  document.getElementById('mp-notas').value = mp ? (mp.notas || '') : '';

  mostrarMensaje('mp-mensaje', '', '');
}

function cerrarFormularioMP() {
  document.getElementById('form-mp').style.display = 'none';
}

async function guardarMateriaPrima() {
  if (!_mpEsAdmin) return;

  const id = document.getElementById('mp-id').value.trim();
  const nombre = document.getElementById('mp-nombre').value.trim();
  const codigo = document.getElementById('mp-codigo').value.trim();
  const categoria = document.getElementById('mp-categoria').value;
  const unidad_medida = document.getElementById('mp-unidad').value;
  const stock_actual = document.getElementById('mp-stock-inicial').value;
  const stock_minimo = document.getElementById('mp-stock-minimo').value;
  const proveedor_nombre = document.getElementById('mp-proveedor-nombre').value.trim();
  const proveedor_contacto = document.getElementById('mp-proveedor-contacto').value.trim();
  const costo_unitario = document.getElementById('mp-costo').value;
  const pedido_promedio = document.getElementById('mp-pedido').value;
  const notas = document.getElementById('mp-notas').value.trim();

  if (!nombre) {
    mostrarMensaje('mp-mensaje', 'El nombre es obligatorio.', 'error');
    return;
  }

  const btn = document.getElementById('btn-guardar-mp');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const datosComunes = {
      codigo,
      nombre,
      categoria,
      unidad_medida,
      stock_minimo,
      proveedor_nombre,
      proveedor_contacto,
      costo_unitario,
      pedido_promedio,
      notas,
    };

    if (id) {
      await actualizarMateriaPrima(id, datosComunes);
    } else {
      await crearMateriaPrima({ ...datosComunes, stock_actual });
    }

    mostrarMensaje('mp-mensaje', 'Guardado correctamente.', 'exito');
    poblarSelectMateriaMovimiento();
    renderResumenCards();
    renderTabla();
    setTimeout(cerrarFormularioMP, 900);
  } catch (e) {
    mostrarMensaje('mp-mensaje', 'Error al guardar: ' + (e.message || e), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

async function toggleActivoMP(id, activo) {
  if (!_mpEsAdmin) return;
  try {
    await actualizarMateriaPrima(id, { activo });
    poblarSelectMateriaMovimiento();
    renderResumenCards();
    renderTabla();
  } catch (e) {
    mostrarMensaje('lista-mensaje-mp', 'Error al actualizar estado: ' + (e.message || e), 'error');
  }
}

// --------- Resumen ---------

function renderResumenCards() {
  const { bajoStock, sinStock, total } = getResumenStockMateriasPrimas();

  const cards = [
    { label: 'Materias primas activas', valor: total },
    { label: 'Stock bajo', valor: bajoStock, alerta: bajoStock > 0 },
    { label: 'Sin stock', valor: sinStock, alerta: sinStock > 0 },
  ];

  document.getElementById('resumen-cards').innerHTML = cards.map(c => `
    <div class="card ${c.alerta ? 'alerta' : ''}">
      <div class="card-label">${c.label}</div>
      <div class="card-valor">${c.valor}</div>
    </div>
  `).join('');
}

// --------- Tabla principal ---------

function renderTabla() {
  const categoria = document.getElementById('filtro-categoria-mp').value;
  const busqueda = (document.getElementById('filtro-mp').value || '').trim().toLowerCase();
  const estadoFiltro = document.getElementById('filtro-estado-mp').value;
  const mostrarInactivos = document.getElementById('filtro-inactivos-mp').checked;

  const lista = _mpSort.ordenar((mostrarInactivos ? getMateriasPrimasTodas() : getMateriasPrimas())
    .filter(mp => !categoria || mp.categoria === categoria)
    .filter(mp => !busqueda || mp.nombre.toLowerCase().includes(busqueda) || (mp.codigo || '').toLowerCase().includes(busqueda))
    .filter(mp => !estadoFiltro || estadoStockMP(mp) === estadoFiltro)
    .sort((a, b) => a.categoria.localeCompare(b.categoria) || (a.orden || 0) - (b.orden || 0)));

  const tbody = document.getElementById('tabla-mp-body');
  const colspan = _mpEsAdmin ? 13 : 8;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="estado-vacio">No se encontraron materias primas con ese filtro.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(mp => {
    const estado = estadoStockMP(mp);
    const badgeClass = estado === 'sin_stock' ? 'sin' : estado === 'bajo' ? 'bajo' : 'ok';

    const colsAdmin = _mpEsAdmin ? `
      <td class="col-admin">${esc(mp.proveedorNombre || '—')}</td>
      <td class="col-admin">${esc(mp.proveedorContacto || '—')}</td>
      <td class="col-admin numero">${mp.costoUnitario != null ? formatearCLP(mp.costoUnitario) : '—'}</td>
      <td class="col-admin numero">${mp.pedidoPromedio != null ? mp.pedidoPromedio : '—'}</td>
      <td class="col-admin notas-cell">${esc(mp.notas || '')}</td>
    ` : '';

    const acciones = [`<button onclick="abrirFormularioMovimiento('${mp.id}')">Movimiento</button>`];
    if (_mpEsAdmin) {
      acciones.push(`<button class="secundario" onclick="abrirFormularioMP(getMateriaPrimaPorId('${mp.id}'))">Editar</button>`);
      acciones.push(`<button class="secundario" onclick="toggleActivoMP('${mp.id}', ${!mp.activo})">${mp.activo ? 'Desactivar' : 'Activar'}</button>`);
    }

    return `
      <tr class="${mp.activo ? '' : 'fila-inactiva'}">
        <td>${esc(mp.categoria)}</td>
        <td>${esc(mp.codigo || '')}</td>
        <td><strong>${esc(mp.nombre)}</strong></td>
        <td>${esc(mp.unidadMedida)}</td>
        <td class="numero"><strong>${mp.stock}</strong></td>
        <td class="numero">${mp.stockMinimo}</td>
        <td><span class="badge ${badgeClass}">${etiquetaEstadoStock(estado)}</span></td>
        ${colsAdmin}
        <td><div class="acciones-tabla">${acciones.join('')}</div></td>
      </tr>
    `;
  }).join('');
}

// --------- Últimos movimientos ---------

async function renderMovimientos() {
  const tbody = document.getElementById('tabla-mov-mp-body');
  tbody.innerHTML = `<tr><td colspan="5" class="estado-vacio">Cargando...</td></tr>`;

  const movimientos = await getMovimientosMP({ limite: 20 });

  if (movimientos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="estado-vacio">Sin movimientos registrados.</td></tr>`;
    return;
  }

  const etiquetasTipo = { entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste' };

  tbody.innerHTML = movimientos.map(m => `
    <tr>
      <td>${formatearFecha(m.fecha)}</td>
      <td>${esc(m.materiaPrima ? m.materiaPrima.nombre : '—')}</td>
      <td>${etiquetasTipo[m.tipo_movimiento] || m.tipo_movimiento}</td>
      <td class="numero">${m.cantidad}${m.materiaPrima ? ' ' + esc(m.materiaPrima.unidadMedida) : ''}</td>
      <td>${[m.motivo, m.nota].filter(Boolean).map(esc).join(' · ')}</td>
    </tr>
  `).join('');
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

function formatearCLP(valor) {
  return '$' + Number(valor).toLocaleString('es-CL');
}

function mostrarMensaje(id, texto, tipo) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = texto;
  el.className = 'form-mensaje' + (tipo ? ' ' + tipo : '');
}
