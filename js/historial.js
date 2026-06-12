/* ===========================
   Mepiache Inventario - Historial de movimientos
   =========================== */

const HISTORIAL_PAGINA = 50;

let _historialMovimientos = [];
let _historialMostrados = HISTORIAL_PAGINA;

const _historialSort = initTableSort('#tabla-historial thead', [
  { tipo: 'texto', accesor: m => m.created_at },
  { tipo: 'texto', accesor: m => m.producto ? m.producto.nombre : '' },
  { tipo: 'texto', accesor: m => m.producto ? m.producto.categoriaFormato : '' },
  { tipo: 'texto', accesor: m => etiquetaTipoMovimiento(m.tipo_movimiento) },
  { tipo: 'numero', accesor: m => m.cantidad },
  { tipo: 'numero', accesor: m => m.stock_despues },
  { tipo: 'texto', accesor: m => m.motivo },
  { tipo: 'texto', accesor: m => m.nota },
], () => renderFilas());

const FILTROS_HISTORIAL = ['filtro-desde', 'filtro-hasta', 'filtro-categoria', 'filtro-tipo', 'filtro-sabor'];

(async () => {
  const session = await initLayout('historial.html');
  if (!session) return;

  poblarFiltros();
  restaurarFiltrosDesdeStorage('historial', FILTROS_HISTORIAL);
  await renderTabla();
  await poblarCompararConteos();

  document.querySelectorAll('#filtros-historial select, #filtros-historial input').forEach(el => {
    el.addEventListener('change', renderTabla);
  });

  bindGuardarFiltros('historial', FILTROS_HISTORIAL);

  bindFiltrosFechaRapidos('filtros-fecha-rapidos', 'filtro-desde', 'filtro-hasta', () => {
    guardarFiltrosEnStorage('historial', FILTROS_HISTORIAL);
    renderTabla();
  });

  document.getElementById('btn-cargar-mas-historial').addEventListener('click', () => {
    _historialMostrados += HISTORIAL_PAGINA;
    renderFilas();
  });
})();

function limpiarFiltrosHistorial() {
  document.getElementById('filtro-desde').value = '';
  document.getElementById('filtro-hasta').value = '';
  document.getElementById('filtro-categoria').value = '';
  document.getElementById('filtro-tipo').value = '';
  document.getElementById('filtro-sabor').value = '';
  guardarFiltrosEnStorage('historial', FILTROS_HISTORIAL);
  _historialMostrados = HISTORIAL_PAGINA;
  renderTabla();
}

function poblarFiltros() {
  document.getElementById('filtro-categoria').innerHTML += getCategorias()
    .map(c => `<option value="${c}">${c}</option>`).join('');

  document.getElementById('filtro-tipo').innerHTML += Object.entries(TIPOS_MOVIMIENTO_LABEL)
    .map(([valor, etiqueta]) => `<option value="${valor}">${etiqueta}</option>`).join('');
}

async function renderTabla() {
  const tbody = document.getElementById('tabla-historial-body');
  tbody.innerHTML = `<tr><td colspan="8">Cargando...</td></tr>`;

  const desde = document.getElementById('filtro-desde').value || null;
  const hasta = document.getElementById('filtro-hasta').value || null;
  const categoria = document.getElementById('filtro-categoria').value || null;
  const tipo = document.getElementById('filtro-tipo').value || null;
  const busqueda = document.getElementById('filtro-sabor').value.trim().toLowerCase();

  let movimientos = await getMovimientos({
    limite: 300,
    tipoMovimiento: tipo,
    categoriaFormato: categoria,
    desde,
    hasta,
  });

  if (busqueda) {
    movimientos = movimientos.filter(m => m.producto && (
      m.producto.nombre.toLowerCase().includes(busqueda) ||
      (m.producto.codigo || '').toLowerCase().includes(busqueda)
    ));
  }

  _historialMovimientos = movimientos;
  _historialMostrados = HISTORIAL_PAGINA;
  renderFilas();
}

function renderFilas() {
  const tbody = document.getElementById('tabla-historial-body');
  const btnCargarMas = document.getElementById('btn-cargar-mas-historial');

  if (_historialMovimientos.length === 0) {
    tbody.innerHTML = htmlEstadoVacioFiltros(8, 'No hay movimientos con ese filtro.', 'limpiarFiltrosHistorial');
    btnCargarMas.style.display = 'none';
    return;
  }

  const ordenados = _historialSort.ordenar(_historialMovimientos);
  const visibles = ordenados.slice(0, _historialMostrados);

  tbody.innerHTML = visibles.map(m => `
    <tr>
      <td>${formatearFechaHora(m.created_at)}</td>
      <td>${m.producto ? m.producto.nombre : m.producto_id}</td>
      <td>${m.producto ? m.producto.categoriaFormato : ''}</td>
      <td>${etiquetaTipoMovimiento(m.tipo_movimiento)}</td>
      <td class="numero">${m.cantidad}</td>
      <td class="numero">${m.stock_antes} &rarr; ${m.stock_despues}</td>
      <td>${m.motivo || ''}</td>
      <td>${m.nota || ''}</td>
    </tr>
  `).join('');

  btnCargarMas.style.display = ordenados.length > visibles.length ? 'block' : 'none';
}

// --------- Comparar conteos ---------

async function poblarCompararConteos() {
  const conteos = await getConteos({ limite: 100, estado: 'finalizado' });

  const opciones = conteos.map(c => {
    const fecha = formatearFechaHora(c.finalized_at || c.created_at);
    return `<option value="${c.id}">${c.categoria_formato} — ${fecha}</option>`;
  }).join('');

  const selA = document.getElementById('comparar-conteo-a');
  const selB = document.getElementById('comparar-conteo-b');

  selA.innerHTML += opciones;
  selB.innerHTML += opciones;

  [selA, selB].forEach(sel => sel.addEventListener('change', renderComparacionConteos));
}

async function renderComparacionConteos() {
  const tbody = document.getElementById('tabla-comparar-body');
  const selA = document.getElementById('comparar-conteo-a');
  const selB = document.getElementById('comparar-conteo-b');
  const thA = document.getElementById('th-comparar-a');
  const thB = document.getElementById('th-comparar-b');
  const idA = selA.value;
  const idB = selB.value;

  if (!idA || !idB) {
    tbody.innerHTML = `<tr><td colspan="5">Selecciona dos conteos para comparar.</td></tr>`;
    thA.textContent = 'Contado A';
    thB.textContent = 'Contado B';
    return;
  }

  tbody.innerHTML = `<tr><td colspan="5">Cargando...</td></tr>`;
  thA.textContent = `Contado: ${selA.selectedOptions[0].textContent}`;
  thB.textContent = `Contado: ${selB.selectedOptions[0].textContent}`;

  const [detalleA, detalleB] = await Promise.all([
    getConteoDetalle(idA),
    getConteoDetalle(idB),
  ]);

  const mapaA = {};
  detalleA.forEach(d => { mapaA[d.producto_id] = d; });
  const mapaB = {};
  detalleB.forEach(d => { mapaB[d.producto_id] = d; });

  const ids = new Set([...Object.keys(mapaA), ...Object.keys(mapaB)]);

  const filas = Array.from(ids)
    .map(id => {
      const dA = mapaA[id];
      const dB = mapaB[id];
      const producto = (dA && dA.producto) || (dB && dB.producto);
      const contadoA = (dA && dA.stock_contado !== null) ? Number(dA.stock_contado) : null;
      const contadoB = (dB && dB.stock_contado !== null) ? Number(dB.stock_contado) : null;
      const diferencia = (contadoA !== null && contadoB !== null) ? contadoB - contadoA : null;
      return { producto, contadoA, contadoB, diferencia };
    })
    .filter(f => f.producto)
    .sort((a, b) => a.producto.categoriaFormato.localeCompare(b.producto.categoriaFormato) || (a.producto.orden || 0) - (b.producto.orden || 0));

  if (filas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">No hay datos de conteo para comparar.</td></tr>`;
    return;
  }

  tbody.innerHTML = filas.map(f => {
    let clase = '';
    let texto = '—';
    if (f.diferencia !== null) {
      texto = (f.diferencia > 0 ? '+' : '') + f.diferencia;
      clase = f.diferencia > 0 ? 'positiva' : (f.diferencia < 0 ? 'negativa' : '');
    }
    return `
      <tr>
        <td>${f.producto.nombre}</td>
        <td>${f.producto.categoriaFormato}</td>
        <td class="numero">${f.contadoA ?? '—'}</td>
        <td class="numero">${f.contadoB ?? '—'}</td>
        <td class="numero diferencia ${clase}">${texto}</td>
      </tr>
    `;
  }).join('');
}
