/* ===========================
   Mepiache Inventario - Lógica del dashboard (Supabase)
   =========================== */

const STOCK_BAJO_UMBRAL = 10; // unidades. Ajustable según criterio del negocio.

// --------- Sesión ---------

document.getElementById('btn-logout').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
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

    if (btn.dataset.tab === 'metricas' && typeof renderMetricas === 'function') {
      renderMetricas();
    }
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

async function renderTablaStock() {
  const tbody = document.getElementById('tabla-stock-body');
  tbody.innerHTML = `<tr><td colspan="6">Cargando...</td></tr>`;

  const stockData = await calcularStock();

  renderResumenCards(stockData);

  const formato = document.getElementById('filtro-formato').value;
  const busqueda = document.getElementById('filtro-sabor').value.trim().toLowerCase();

  const filtrados = stockData
    .filter(p => !formato || p.formato === formato)
    .filter(p => !busqueda || p.nombre.toLowerCase().includes(busqueda))
    .sort((a, b) => a.formato.localeCompare(b.formato) || a.nombre.localeCompare(b.nombre));

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

async function renderTablaProduccion() {
  const tbody = document.getElementById('tabla-produccion-body');
  tbody.innerHTML = `<tr><td colspan="5">Cargando...</td></tr>`;

  const batches = (await getBatches()).slice(0, 15);

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
formProduccion.addEventListener('submit', async (e) => {
  e.preventDefault();

  const btn = formProduccion.querySelector('button[type="submit"]');
  btn.disabled = true;

  const batch = {
    producto_id: document.getElementById('prod-producto').value,
    cantidad: Number(document.getElementById('prod-cantidad').value),
    fecha: document.getElementById('prod-fecha').value,
    notas: document.getElementById('prod-notas').value.trim(),
  };

  try {
    await addBatch(batch);

    const mensaje = document.getElementById('prod-mensaje');
    mensaje.classList.add('exito');
    setTimeout(() => mensaje.classList.remove('exito'), 2500);

    formProduccion.reset();
    document.getElementById('prod-fecha').valueAsDate = new Date();

    await renderTablaProduccion();
    await renderTablaStock();
  } catch (err) {
    alert('No se pudo guardar la producción. Intenta de nuevo.');
  } finally {
    btn.disabled = false;
  }
});

// --------- Ventas ---------

async function renderTablaVentas() {
  const tbody = document.getElementById('tabla-ventas-body');
  tbody.innerHTML = `<tr><td colspan="6">Cargando...</td></tr>`;

  const ventas = (await getVentas()).slice(0, 15);

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
formVentas.addEventListener('submit', async (e) => {
  e.preventDefault();

  const btn = formVentas.querySelector('button[type="submit"]');
  btn.disabled = true;

  const venta = {
    producto_id: document.getElementById('venta-producto').value,
    cantidad: Number(document.getElementById('venta-cantidad').value),
    fecha: document.getElementById('venta-fecha').value,
    canal: document.getElementById('venta-canal').value,
    notas: document.getElementById('venta-notas').value.trim(),
  };

  try {
    await addVenta(venta);

    const mensaje = document.getElementById('venta-mensaje');
    mensaje.classList.add('exito');
    setTimeout(() => mensaje.classList.remove('exito'), 2500);

    formVentas.reset();
    document.getElementById('venta-fecha').valueAsDate = new Date();

    await renderTablaVentas();
    await renderTablaStock();
  } catch (err) {
    alert('No se pudo guardar la venta. Intenta de nuevo.');
  } finally {
    btn.disabled = false;
  }
});

// --------- Inicialización ---------

async function renderTodo() {
  await Promise.all([
    renderTablaStock(),
    renderTablaProduccion(),
    renderTablaVentas(),
  ]);
}

(async () => {
  // Verificar sesión real de Supabase
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('saludo-usuario').textContent = `Hola, ${session.user.email}`;

  await cargarProductos();

  poblarSelectProductos(document.getElementById('prod-producto'));
  poblarSelectProductos(document.getElementById('venta-producto'));
  document.getElementById('prod-fecha').valueAsDate = new Date();
  document.getElementById('venta-fecha').valueAsDate = new Date();

  await renderTodo();
})();
