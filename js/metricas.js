/* ===========================
   Mepiache Inventario - Métricas y exportación a Excel
   (admin)
   =========================== */

let _chartProdVentas = null;
let _chartStockCategoria = null;
let _chartSalidasCategoria = null;
let _chartMermasMotivo = null;
let _chartIngresos = null;

(async () => {
  const session = await initLayout('metricas.html', { soloAdmin: true });
  if (!session) return;

  await renderTodo();

  document.getElementById('btn-exportar-excel').addEventListener('click', exportarExcel);
  document.getElementById('btn-pdf-mensual').addEventListener('click', generarPDFMensual);
})();

async function renderTodo() {
  const m = await getMetricasMensuales(6);
  const resumen = getResumenStock();

  renderCards(m, resumen);
  renderGraficoProdVsVentas(m);
  renderGraficoStockCategoria(resumen);
  renderGraficoSalidasCategoria(m);
  renderGraficoMermasMotivo(m);
  renderGraficoIngresos(m);
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
  const varIngresos = calcularVariacion(m.ingresosMesActual, m.ingresosMesAnterior);

  const cards = [
    { label: 'Stock total', valor: m.stockTotal },
    { label: 'Producido este mes', valor: m.producidoMesActual, variacion: varProducido },
    { label: 'Vendido/salidas este mes', valor: m.vendidoMesActual, variacion: varVendido },
    { label: 'Ingresos este mes', valor: formatearCLP(m.ingresosMesActual), variacion: varIngresos },
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

function renderGraficoIngresos(m) {
  const ctx = document.getElementById('grafico-ingresos');
  if (!ctx) return;
  const labels = m.meses.map(formatearMes);

  if (_chartIngresos) _chartIngresos.destroy();

  _chartIngresos = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Ingresos por ventas/salidas',
        data: m.ingresosPorMes,
        backgroundColor: COLOR_DORADO,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (value) => formatearCLP(value) },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => formatearCLP(ctx.parsed.y) } },
      },
    },
  });
}

// --------- Ranking ---------

function renderRanking(m) {
  const tbody = document.getElementById('tabla-ranking-body');
  const ranking = rankingVentas(m.movimientos);

  if (ranking.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">Sin ventas/salidas registradas en el período.</td></tr>`;
    return;
  }

  tbody.innerHTML = ranking.map(r => `
    <tr>
      <td>${r.producto.nombre}</td>
      <td>${r.producto.categoriaFormato}</td>
      <td class="numero">${r.cantidad}</td>
      <td class="numero">${formatearCLP(r.cantidad * (r.producto.precioVenta || 0))}</td>
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

// --------- Reporte PDF mensual ---------

async function generarPDFMensual() {
  const btn = document.getElementById('btn-pdf-mensual');
  btn.disabled = true;
  btn.textContent = 'Generando...';

  try {
    const [m, mantenciones] = await Promise.all([
      getMetricasMensuales(6),
      getResumenMantenciones(),
    ]);
    const resumen = getResumenStock();
    const mesActual = m.meses[m.meses.length - 1];

    const doc = new jspdf.jsPDF();

    doc.setFontSize(16);
    doc.text('Mepiache Inventario — Reporte mensual', 14, 18);
    doc.setFontSize(11);
    doc.text(`Período: ${formatearMes(mesActual)}`, 14, 26);
    doc.text(`Generado: ${formatearFechaHora(new Date().toISOString())}`, 14, 32);

    doc.autoTable({
      startY: 40,
      head: [['Indicador', 'Valor']],
      body: [
        ['Stock total', String(m.stockTotal)],
        ['Producido este mes', String(m.producidoMesActual)],
        ['Vendido/salidas este mes', String(m.vendidoMesActual)],
        ['Ingresos este mes', formatearCLP(m.ingresosMesActual)],
        ['Mermas este mes', String(m.mermaMesActual)],
        ['Productos con stock bajo', String(resumen.bajoStock)],
        ['Productos sin stock', String(resumen.sinStock)],
        ['Mantenciones de equipos vencidas', String(mantenciones.vencidos)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [200, 148, 26] },
    });

    const ranking = rankingVentas(m.movimientos);
    let nextY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(13);
    doc.text('Top 5 sabores más vendidos', 14, nextY);
    doc.autoTable({
      startY: nextY + 4,
      head: [['Sabor', 'Categoría/Formato', 'Cantidad vendida', 'Ingresos']],
      body: ranking.length > 0
        ? ranking.map(r => [r.producto.nombre, r.producto.categoriaFormato, String(r.cantidad), formatearCLP(r.cantidad * (r.producto.precioVenta || 0))])
        : [['Sin ventas/salidas registradas en el período.', '', '', '']],
      theme: 'striped',
      headStyles: { fillColor: [200, 148, 26] },
    });

    const orden = { sin_stock: 0, bajo: 1 };
    const alertas = getProductos()
      .filter(p => estadoStock(p) !== 'ok')
      .sort((a, b) => orden[estadoStock(a)] - orden[estadoStock(b)]);

    nextY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(13);
    doc.text('Alertas de stock', 14, nextY);
    doc.autoTable({
      startY: nextY + 4,
      head: [['Producto', 'Categoría/Formato', 'Stock actual', 'Stock mínimo', 'Estado']],
      body: alertas.length > 0
        ? alertas.map(p => [p.nombre, p.categoriaFormato, String(p.stock), String(p.stockMinimo), etiquetaEstadoStock(estadoStock(p))])
        : [['Sin alertas: todo el stock está dentro de lo normal.', '', '', '', '']],
      theme: 'striped',
      headStyles: { fillColor: [200, 148, 26] },
    });

    const fechaArchivo = new Date().toISOString().slice(0, 10);
    doc.save(`mepiache-reporte-mensual-${fechaArchivo}.pdf`);
  } catch (err) {
    console.error('Error generando PDF mensual:', err);
    alert('No se pudo generar el reporte PDF.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generar PDF mensual';
  }
}
