/* ===========================
   Mepiache Inventario - Métricas y exportación a Excel
   =========================== */

let _chartProdVentas = null;
let _chartStock = null;

const NOMBRES_MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatearMes(mesStr) {
  const [anio, mes] = mesStr.split('-').map(Number);
  return `${NOMBRES_MES[mes - 1]} ${anio}`;
}

function calcularVariacion(actual, anterior) {
  if (anterior === 0) {
    return actual === 0 ? 0 : 100;
  }
  return ((actual - anterior) / anterior) * 100;
}

// --------- Cards ---------

function renderMetricasCards(m) {
  const varProducido = calcularVariacion(m.producidoMesActual, m.producidoMesAnterior);
  const varVendido = calcularVariacion(m.vendidoMesActual, m.vendidoMesAnterior);

  const cards = [
    { label: 'Producido este mes', valor: m.producidoMesActual, variacion: varProducido },
    { label: 'Vendido este mes', valor: m.vendidoMesActual, variacion: varVendido },
    { label: 'Stock total', valor: m.stockTotal, variacion: null },
  ];

  const cont = document.getElementById('metricas-cards');
  cont.innerHTML = cards.map(c => {
    let variacionHtml = '';
    if (c.variacion !== null) {
      const signo = c.variacion >= 0 ? '+' : '';
      const clase = c.variacion >= 0 ? 'positiva' : 'negativa';
      variacionHtml = `<div class="card-variacion ${clase}">${signo}${c.variacion.toFixed(1)}% vs mes anterior</div>`;
    }
    return `
      <div class="card">
        <div class="card-label">${c.label}</div>
        <div class="card-valor">${c.valor}</div>
        ${variacionHtml}
      </div>
    `;
  }).join('');
}

// --------- Gráficos ---------

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
          borderColor: '#C8941A',
          backgroundColor: 'rgba(200, 148, 26, 0.15)',
          tension: 0.25,
          fill: true,
        },
        {
          label: 'Ventas',
          data: m.vendidoPorMes,
          borderColor: '#0C0C0C',
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

function renderGraficoStock(m) {
  const ctx = document.getElementById('grafico-stock');
  const labels = m.meses.map(formatearMes);

  if (_chartStock) _chartStock.destroy();

  _chartStock = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Stock total (fin de mes)',
          data: m.stockAcumuladoPorMes,
          borderColor: '#C8941A',
          backgroundColor: 'rgba(200, 148, 26, 0.15)',
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

async function renderMetricas() {
  const m = await getMetricasMensuales(6);
  renderMetricasCards(m);
  renderGraficoProdVsVentas(m);
  renderGraficoStock(m);
}

// --------- Exportación a Excel ---------

async function exportarExcel() {
  const btn = document.getElementById('btn-exportar-excel');
  btn.disabled = true;
  btn.textContent = 'Generando...';

  try {
    const [batches, ventas, stockData, metricas] = await Promise.all([
      getBatches(),
      getVentas(),
      calcularStock(),
      getMetricasMensuales(12),
    ]);

    const wb = XLSX.utils.book_new();

    // Hoja: Stock actual (resumen)
    const stockRows = stockData.map(p => ({
      Sabor: p.nombre,
      Formato: p.formato,
      Producido: p.producido,
      Vendido: p.vendido,
      Stock: p.stock,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockRows), 'Stock actual');

    // Hoja: Producción (datos crudos)
    const produccionRows = batches.map(b => {
      const producto = getProductoPorId(b.producto_id);
      return {
        Fecha: b.fecha,
        Sabor: producto ? producto.nombre : b.producto_id,
        Formato: producto ? producto.formato : '',
        Cantidad: b.cantidad,
        Notas: b.notas || '',
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(produccionRows), 'Producción');

    // Hoja: Ventas (datos crudos)
    const ventasRows = ventas.map(v => {
      const producto = getProductoPorId(v.producto_id);
      return {
        Fecha: v.fecha,
        Sabor: producto ? producto.nombre : v.producto_id,
        Formato: producto ? producto.formato : '',
        Cantidad: v.cantidad,
        Canal: nombreCanal(v.canal),
        Notas: v.notas || '',
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ventasRows), 'Ventas');

    // Hoja: Resumen mensual (computado)
    const resumenRows = metricas.meses.map((mes, i) => ({
      Mes: formatearMes(mes),
      Producido: metricas.producidoPorMes[i],
      Vendido: metricas.vendidoPorMes[i],
      'Stock fin de mes': metricas.stockAcumuladoPorMes[i],
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenRows), 'Resumen mensual');

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

document.getElementById('btn-exportar-excel').addEventListener('click', exportarExcel);
