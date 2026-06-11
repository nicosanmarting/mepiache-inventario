/* ===========================
   Mepiache Inventario - Historial de movimientos
   =========================== */

(async () => {
  const session = await initLayout('historial.html');
  if (!session) return;

  poblarFiltros();
  await renderTabla();

  document.querySelectorAll('#filtros-historial select, #filtros-historial input').forEach(el => {
    el.addEventListener('change', renderTabla);
  });
})();

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

  if (movimientos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8">No hay movimientos con ese filtro.</td></tr>`;
    return;
  }

  tbody.innerHTML = movimientos.map(m => `
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
}
