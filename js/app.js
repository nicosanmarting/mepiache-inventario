/* ===========================
   Mepiache Inventario - Lógica del dashboard
   =========================== */

const STOCK_BAJO_UMBRAL = 10; // unidades. Ajustable según criterio del negocio.

// --------- Sesión ---------

const sesionRaw = localStorage.getItem('mepiache_sesion');
if (!sesionRaw) {
  window.location.href = 'index.html';
}
const sesion = JSON.parse(sesionRaw || '{}');

document.getElementById('saludo-usuario').textContent =
  `Hola, ${sesion.nombre || 'usuario'} (${sesion.rol || ''})`;

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('mepiache_sesion');
  window.location.href = 'index.html';
});

document.getElementById('btn-reset-demo').addEventListener('click', () => {
  if (confirm('¿Reiniciar los datos de prueba (producción y ventas) a su estado inicial?')) {
    resetDatosDemo();
    renderTodo();
  }
});

// --------- Tabs ---------

const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('activo'));
    tabPanels.forEach(p => p.classList.remove('activo'));

    btn.classList.add('activo');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('activo');
  });
});

// --------- Helpers ---------

function formatearFecha(fechaStr) {
  if (!fechaStr) return '';
  const [anio, mes, dia] = fechaStr.split('-');
  return `${dia}-${mes}-${anio}`;
}

function nombreCanal(canal) {
  const nombres = { presencial: 'Presencial', distribuidor: 'Distribuidor', otro: 'Otro' };
  return nombres[canal] || canal;
}

// --------- Render: Stock ---------

function renderResumenCards(stockData) {
  const total5L = stockData.filter(p => p.formato === '5L').reduce((s, p) => s + p.stock, 0);
  const total10L = stockData.filter(p => p.formato === '10L').reduce((s, p) => s + p.stock, 0);
  const sinStock = stockData.filter(p => p.stock <= 0).length;
  const stockBajo = stockData.filter(p => p.stock > 0 && p.stock < STOCK_BAJO_UMBRAL).length;

  const cards = [
    { label: 'Stock total 5L', valor: total5L, alerta: false },
    { label: 'Stock total 10L', valor: total10L, alerta: false },
    { label: 'Sabores con stock bajo', valor: stockBajo, alerta: stockBajo > 0 },
    { label: 'Sabores sin stock', valor: sinStock, alerta: sinStock > 0 },
  ];

  const cont = document.getElementById('resumen-cards');
  cont.innerHTML = cards.map(c => `
    <div class="card ${c.alerta ? 'alerta' : ''}">
      <div class="card-label">${c.label}</div>
      <div class="card-valor">${c.valor}</div>
    </div>
  `).join('');
}

function renderTablaStock() {
  const stockData = calcularStock();

  renderResumenCards(stockData);

  const formato = document.getElementById('filtro-formato').value;
  const busqueda = document.getElementById('filtro-sabor').value.trim().toLowerCase();

  const filtrados = stockData
    .filter(p => !formato || p.formato === formato)
    .filter(p => !busqueda || p.nombre.toLowerCase().includes(busqueda))
    .sort((a, b) => a.formato.localeCompare(b.formato) || a.nombre.localeCompare(b.nombre));

  const tbody = document.getElementById('tabla-stock-body');

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">No se encontraron sabores con ese filtro.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map(p => {
    const bajo = p.stock < STOCK_BAJO_UMBRAL;
    const badge = p.stock <= 0
      ? `<span class="badge bajo">Sin stock</span>`
      : bajo
        ? `<span class="badge bajo">Stock bajo</span>`
        : `<span class="badge ok">OK</span>`;

    return `
      <tr>
        <td>${p.nombre}</td>
        <td>${p.formato}</td>
        <td class="numero">${p.producido}</td>
        <td class="numero">${p.vendido}</td>
        <td class="numero"><strong>${p.stock}</strong></td>
        <td>${badge}</td>
      </tr>
    `;
  }).join('');
}

document.getElementById('filtro-formato').addEventListener('change', renderTablaStock);
document.getElementById('filtro-sabor').addEventListener('input', renderTablaStock);

// --------- Producción ---------

function poblarSelectProductos(selectEl) {
  const productos = getProductos();
  const grupo5L = productos.filter(p => p.formato === '5L');
  const grupo10L = productos.filter(p => p.formato === '10L');

  selectEl.innerHTML = `
    <optgroup label="5 Litros">
      ${grupo5L.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
    </optgroup>
    <optgroup label="10 Litros">
      ${grupo10L.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
    </optgroup>
  `;
}

function renderTablaProduccion() {
  const batches = getBatches()
    .slice()
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 15);

  const tbody = document.getElementById('tabla-produccion-body');

  if (batches.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">Aún no hay producción registrada.</td></tr>`;
    return;
  }

  tbody.innerHTML = batches.map(b => {
    const producto = getProductoPorId(b.producto_id);
    return `
      <tr>
        <td>${formatearFecha(b.fecha)}</td>
        <td>${producto ? producto.nombre : b.producto_id}</td>
        <td>${producto ? producto.formato : ''}</td>
        <td class="numero">${b.cantidad}</td>
        <td>${b.notas || ''}</td>
      </tr>
    `;
  }).join('');
}

const formProduccion = document.getElementById('form-produccion');
formProduccion.addEventListener('submit', (e) => {
  e.preventDefault();

  const batch = {
    producto_id: document.getElementById('prod-producto').value,
    cantidad: Number(document.getElementById('prod-cantidad').value),
    fecha: document.getElementById('prod-fecha').value,
    notas: document.getElementById('prod-notas').value.trim(),
  };

  addBatch(batch);

  const mensaje = document.getElementById('prod-mensaje');
  mensaje.classList.add('exito');
  setTimeout(() => mensaje.classList.remove('exito'), 2500);

  formProduccion.reset();
  document.getElementById('prod-fecha').valueAsDate = new Date();

  renderTablaProduccion();
  renderTablaStock();
});

// --------- Ventas ---------

function renderTablaVentas() {
  const ventas = getVentas()
    .slice()
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 15);

  const tbody = document.getElementById('tabla-ventas-body');

  if (ventas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">Aún no hay ventas registradas.</td></tr>`;
    return;
  }

  tbody.innerHTML = ventas.map(v => {
    const producto = getProductoPorId(v.producto_id);
    return `
      <tr>
        <td>${formatearFecha(v.fecha)}</td>
        <td>${producto ? producto.nombre : v.producto_id}</td>
        <td>${producto ? producto.formato : ''}</td>
        <td class="numero">${v.cantidad}</td>
        <td>${nombreCanal(v.canal)}</td>
        <td>${v.notas || ''}</td>
      </tr>
    `;
  }).join('');
}

const formVentas = document.getElementById('form-ventas');
formVentas.addEventListener('submit', (e) => {
  e.preventDefault();

  const venta = {
    producto_id: document.getElementById('venta-producto').value,
    cantidad: Number(document.getElementById('venta-cantidad').value),
    fecha: document.getElementById('venta-fecha').value,
    canal: document.getElementById('venta-canal').value,
    notas: document.getElementById('venta-notas').value.trim(),
  };

  addVenta(venta);

  const mensaje = document.getElementById('venta-mensaje');
  mensaje.classList.add('exito');
  setTimeout(() => mensaje.classList.remove('exito'), 2500);

  formVentas.reset();
  document.getElementById('venta-fecha').valueAsDate = new Date();

  renderTablaVentas();
  renderTablaStock();
});

// --------- Inicialización ---------

function renderTodo() {
  renderTablaStock();
  renderTablaProduccion();
  renderTablaVentas();
}

poblarSelectProductos(document.getElementById('prod-producto'));
poblarSelectProductos(document.getElementById('venta-producto'));
document.getElementById('prod-fecha').valueAsDate = new Date();
document.getElementById('venta-fecha').valueAsDate = new Date();

renderTodo();
