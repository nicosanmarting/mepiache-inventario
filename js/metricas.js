/* ===========================
   Mepiache Inventario - Métricas y exportación a Excel
   (admin)
   =========================== */

let _chartProdVentas = null;
let _chartStockCategoria = null;
let _chartSalidasCategoria = null;
let _chartMermasMotivo = null;

(async () => {
  const session = await initLayout('metricas.html', { soloAdmin: true });
  if (!session) return;

  await renderTodo();

  document.getElementById('btn-exportar-excel').addEventListener('click', exportarExcel);
})();

async function renderTodo() {
  const m = await getMetricasMensuales(6);
  const resumen = getResumenStock();

  renderCards(m, resumen);
  renderGraficoProdVsVentas(m);
  renderGraficoStockCategoria(resumen);
  renderGraficoSalidasCategoria(m);
  renderGraficoMermasMotivo(m);
  renderRanking(m);
  renderRankingStock();
}

function calcularVariacion(actual, anterior) {
  if (anterior === 0) return actual === 0 ? 0 : 100;
  return ((actual - anterior) / anterior) * 100;
}

// --------- Cards ---------

function renderCards(m, resumen) {
  const varProducido = calcularVariacion(m.producidoMesActual, m.producidoMesAnterior);
  const varVendido = calcularVariacion(m.vendidoMesActual, m.vendidoMesAnterior);

  const cards = [
    { label: 'Stock total', valor: m.stockTotal },
    { label: 'Producido este mes', valor: m.producidoMesActual, variacion: varProducido },
    { label: 'Vendido/salidas este mes', valor: m.vendidoMesActual, variacion: varVendido },
    { label: 'Mermas este mes', valor: m.mermaMesActual },
    { label: 'Productos con stock bajo', valor: resumen.bajoStock, alerta: resumen.bajoStock > 0 },
    { label: 'Productos sin stock', valor: resumen.sinStock, alerta: resumen.sinStock > 0 },
  ];

  document.getElementById('metricas-cards').innerHTML = cards.map(c => {
    let variacionHtml = '';
    if (c.variacion !== undefined) {
      const signo = c.variacion >= 0 ? '+' : '';
      const clase = c.variacion >= 0 ? 'positiva' : 'negativa';
      variacionHtml = `<div class="card-variacion ${clase}">${signo}${c.variacion.toFixed(1)}% vs mes anterior</div>`;
    }
    return `
      <div class="card ${c.alerta ? 'alerta' : ''}">
        <div class="card-label">${c.label}</div>
        <div class="card-valor">${c.valor}</div>
        ${variacionHtml}
      </div>
    `;
  }).join('');
}

// --------- Agregaciones auxiliares ---------

function agregarPorCategoria(movimientos, tipo, mes) {
  const totales = {};
  CATEGORIAS_FORMATO.forEach(c => { totales[c] = 0; });

  movimientos
    .filter(mv => mv.tipo_movimiento === tipo && mv.fecha.slice(0, 7) === mes)
    .forEach(mv => {
      const p = getProductoPorId(mv.producto_id);
      if (p && totales[p.categoriaFormato] !== undefined) {
        totales[p.categoriaFormato] += Number(mv.cantidad);
      }
    });

  return totales;
}

function agregarMermaPorMotivo(movimientos, mes) {
  const totales = {};

  movimientos
    .filter(mv => mv.tipo_movimiento === 'merma' && mv.fecha.slice(0, 7) === mes)
    .forEach(mv => {
      const motivo = mv.motivo || 'Sin motivo';
      totales[motivo] = (totales[motivo] || 0) + Number(mv.cantidad);
    });

  return totales;
}

function rankingVentas(movimientos) {
  const totales = {};

  movimientos
    .filter(mv => mv.tipo_movimiento === 'venta_salida')
    .forEach(mv => {
      totales[mv.producto_id] = (totales[mv.producto_id] || 0) + Number(mv.cantidad);
    });

  return Object.entries(totales)
    .map(([id, cantidad]) => ({ producto: getProductoPorId(id), cantidad }))
    .filter(r => r.producto)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5);
}

// --------- Gráficos ---------

const COLOR_DORADO = '#C8941A';
const COLOR_NEGRO = '#0C0C0C';
const PALETA = ['#C8941A', '#0C0C0C', '#E8B84B', '#8a7a5c', '#b3261e', '#2e7d32'];

function renderGraficoProdVsVentas(m) {
  const ctx = document.getElementById('grafico-prod-vs-ventas');
  const labels = m.meses.map(formatearMes);

  if (_chartProdVentas) _chartProdVentas.destroy();

  _chartProdVentas = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Producción',
          data: m.producidoPorMes,
          borderColor: COLOR_DORADO,
          backgroundColor: 'rgba(200, 148, 26, 0.15)',
          tension: 0.25,
          fill: true,
        },
        {
          label: 'Ventas / salidas',
          data: m.vendidoPorMes,
          borderColor: COLOR_NEGRO,
          backgroundColor: 'rgba(12, 12, 12, 0.08)',
          tension: 0.25,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
    },
  });
}

function renderGraficoStockCategoria(resumen) {
  const ctx = document.getElementById('grafico-stock-categoria');

  if (_chartStockCategoria) _chartStockCategoria.destroy();

  _chartStockCategoria = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: CATEGORIAS_FORMATO,
      datasets: [{
        label: 'Stock actual',
        data: CATEGORIAS_FORMATO.map(c => resumen.totalPorCategoria[c] || 0),
        backgroundColor: COLOR_DORADO,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { display: false } },
    },
  });
}

function renderGraficoSalidasCategoria(m) {
  const ctx = document.getElementById('grafico-salidas-categoria');
  const mesActual = m.meses[m.meses.length - 1];
  const totales = agregarPorCategoria(m.movimientos, 'venta_salida', mesActual);

  if (_chartSalidasCategoria) _chartSalidasCategoria.destroy();

  _chartSalidasCategoria = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: CATEGORIAS_FORMATO,
      datasets: [{
        label: 'Salidas del mes',
        data: CATEGORIAS_FORMATO.map(c => totales[c] || 0),
        backgroundColor: COLOR_NEGRO,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { display: false } },
    },
  });
}

function renderGraficoMermasMotivo(m) {
  const ctx = document.getElementById('grafico-mermas-motivo');
  const mesActual = m.meses[m.meses.length - 1];
  const totales = agregarMermaPorMotivo(m.movimientos, mesActual);
  const labels = Object.keys(totales);

  if (_chartMermasMotivo) _chartMermasMotivo.destroy();

  if (labels.length === 0) {
    _chartMermasMotivo = new Chart(ctx, {
      type: 'bar',
      data: { labels: ['Sin mermas este mes'], datasets: [{ data: [0], backgroundColor: COLOR_DORADO }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
    return;
  }

  _chartMermasMotivo = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Mermas del mes',
        data: labels.map(l => totales[l]),
        backgroundColor: labels.map((_, i) => PALETA[i % PALETA.length]),
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: { x: { beginAtZero: true } },
      plugins: { legend: { display: false } },
    },
  });
}

// --------- Ranking ---------

function renderRanking(m) {
  const tbody = document.getElementById('tabla-ranking-body');
  const ranking = rankingVentas(m.movimientos);

  if (ranking.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3">Sin ventas/salidas registradas en el período.</td></tr>`;
    return;
  }

  tbody.innerHTML = ranking.map(r => `
    <tr>
      <td>${r.producto.nombre}</td>
      <td>${r.producto.categoriaFormato}</td>
      <td class="numero">${r.cantidad}</td>
    </tr>
  `).join('');
}

function renderRankingStock() {
  const tbody = document.getElementById('tabla-ranking-stock-body');
  if (!tbody) return;

  const ranking = getProductos()
    .slice()
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 5);

  if (ranking.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3">Sin productos con stock.</td></tr>`;
    return;
  }

  tbody.innerHTML = ranking.map(p => `
    <tr>
      <td>${p.nombre}</td>
      <td>${p.categoriaFormato}</td>
      <td class="numero">${p.stock}</td>
    </tr>
  `).join('');
}

// --------- Exportación a Excel ---------

async function exportarExcel() {
  const btn = document.getElementById('btn-exportar-excel');
  btn.disabled = true;
  btn.textContent = 'Generando...';

  try {
    const [movimientos, conteos, conteoDetalle, metricas] = await Promise.all([
      getMovimientos({ limite: 5000 }),
      getConteos({ limite: 500 }),
      getTodoConteoDetalle(),
      getMetricasMensuales(12),
    ]);

    const wb = XLSX.utils.book_new();

    // 1. Stock actual
    const stockRows = getProductos().map(p => ({
      'Código': p.codigo || '',
      Sabor: p.nombre,
      'Categoría/Formato': p.categoriaFormato,
      'Stock actual': p.stock,
      'Stock mínimo': p.stockMinimo,
      Estado: etiquetaEstadoStock(estadoStock(p)),
      'Última actualización': p.actualizado,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockRows), 'Stock actual');

    // 2. Movimientos de inventario
    const movRows = movimientos.map(m => ({
      Fecha: m.fecha,
      Sabor: m.producto ? m.producto.nombre : m.producto_id,
      'Categoría/Formato': m.producto ? m.producto.categoriaFormato : '',
      Tipo: etiquetaTipoMovimiento(m.tipo_movimiento),
      Cantidad: m.cantidad,
      'Stock antes': m.stock_antes,
      'Stock después': m.stock_despues,
      Motivo: m.motivo || '',
      Nota: m.nota || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movRows), 'Movimientos de inventario');

    // 3. Conteos
    const conteoCategoriaPorId = {};
    const conteosRows = conteos.map(c => {
      conteoCategoriaPorId[c.id] = c.categoria_formato;
      return {
        'Categoría/Formato': c.categoria_formato,
        Estado: c.estado === 'finalizado' ? 'Finalizado' : 'Borrador',
        Observación: c.observacion || '',
        Creado: c.created_at,
        Finalizado: c.finalized_at || '',
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(conteosRows), 'Conteos');

    // 4. Detalle de conteos
    const detalleRows = conteoDetalle.map(d => ({
      'Categoría/Formato': conteoCategoriaPorId[d.conteo_id] || '',
      Sabor: d.producto ? d.producto.nombre : d.producto_id,
      'Stock sistema': d.stock_sistema,
      'Stock contado': d.stock_contado,
      Diferencia: d.diferencia,
      Observación: d.observacion || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalleRows), 'Detalle de conteos');

    // 5. Resumen mensual
    const resumenRows = metricas.meses.map((mes, i) => ({
      Mes: formatearMes(mes),
      Producido: metricas.producidoPorMes[i],
      'Vendido/Salidas': metricas.vendidoPorMes[i],
      Mermas: metricas.mermaPorMes[i],
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenRows), 'Resumen mensual');

    // 6. Métricas por categoría/formato (mes actual)
    const mesActual = metricas.meses[metricas.meses.length - 1];
    const resumenStock = getResumenStock();
    const salidasCat = agregarPorCategoria(metricas.movimientos, 'venta_salida', mesActual);
    const produccionCat = agregarPorCategoria(metricas.movimientos, 'produccion', mesActual);
    const mermaCat = agregarPorCategoria(metricas.movimientos, 'merma', mesActual);

    const categoriaRows = CATEGORIAS_FORMATO.map(c => ({
      'Categoría/Formato': c,
      'Stock actual': resumenStock.totalPorCategoria[c] || 0,
      'Producido este mes': produccionCat[c] || 0,
      'Vendido/Salidas este mes': salidasCat[c] || 0,
      'Mermas este mes': mermaCat[c] || 0,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(categoriaRows), 'Métricas por categoría');

    const fechaArchivo = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `mepiache-inventario-${fechaArchivo}.xlsx`);
  } catch (err) {
    console.error('Error exportando a Excel:', err);
    alert('No se pudo generar el archivo Excel.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Exportar a Excel';
  }
}
