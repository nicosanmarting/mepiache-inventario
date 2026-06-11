/* ===========================
   Mepiache Inventario - Formularios de movimiento
   ---------------------------------------------
   Lógica compartida por produccion.html, venta.html
   y merma.html. Cada página llama a initMovimientoPage
   con su configuración específica.
   =========================== */

function initMovimientoPage({ paginaActiva, tipoMovimiento, motivos, mensajeExito, soloAdmin, permitirNegativoOpcion }) {
  (async () => {
    const session = await initLayout(paginaActiva);
    if (!session) return;

    if (soloAdmin && !esAdmin()) {
      const main = document.querySelector('#app-layout main');
      main.innerHTML = `<div class="estado-vacio">Esta pantalla está disponible solo para administradores.</div>`;
      return;
    }

    poblarCategorias();
    poblarMotivos();
    document.getElementById('mov-fecha').valueAsDate = new Date();

    document.getElementById('mov-categoria').addEventListener('change', () => {
      poblarProductos();
      actualizarStockActual();
    });
    document.getElementById('mov-producto').addEventListener('change', actualizarStockActual);

    // Si llegamos desde "Stock actual" con ?producto=ID, preseleccionar.
    const params = new URLSearchParams(window.location.search);
    const productoIdInicial = params.get('producto');
    const productoInicial = productoIdInicial ? getProductoPorId(productoIdInicial) : null;

    if (productoInicial) {
      document.getElementById('mov-categoria').value = productoInicial.categoriaFormato;
      poblarProductos();
      document.getElementById('mov-producto').value = productoInicial.id;
    } else {
      poblarProductos();
    }

    actualizarStockActual();
    await renderUltimosMovimientos();

    document.getElementById('form-movimiento').addEventListener('submit', onSubmit);
  })();

  function poblarCategorias() {
    const sel = document.getElementById('mov-categoria');
    sel.innerHTML = getCategorias().map(c => `<option value="${c}">${c}</option>`).join('');
  }

  function poblarProductos() {
    const categoria = document.getElementById('mov-categoria').value;
    const sel = document.getElementById('mov-producto');
    const productos = getProductosPorCategoria(categoria);
    sel.innerHTML = productos.map(p => `<option value="${p.id}">${p.codigo ? p.codigo + ' · ' : ''}${p.nombre}</option>`).join('');
  }

  function poblarMotivos() {
    const row = document.getElementById('mov-motivo-row');
    if (!motivos) {
      if (row) row.style.display = 'none';
      return;
    }
    const sel = document.getElementById('mov-motivo');
    sel.innerHTML = motivos.map(m => `<option value="${m}">${m}</option>`).join('');
  }

  function actualizarStockActual() {
    const id = document.getElementById('mov-producto').value;
    const producto = getProductoPorId(id);
    const cont = document.getElementById('mov-stock-actual');
    if (!producto || !cont) {
      if (cont) cont.innerHTML = '';
      return;
    }
    const estado = estadoStock(producto);
    const badgeClass = estado === 'sin_stock' ? 'sin' : estado === 'bajo' ? 'bajo' : 'ok';
    cont.innerHTML = `
      <div class="card" style="max-width: 280px;">
        <div class="card-label">Stock actual — ${producto.nombre}</div>
        <div class="card-valor">${producto.stock} <span style="font-size: 13px; font-weight: normal;">${producto.unidadConteo || 'unidades'}</span></div>
        <div style="margin-top: 6px;">
          <span class="badge ${badgeClass}">${etiquetaEstadoStock(estado)}</span>
          <span style="font-size: 12px; color: #8a7a5c;"> · mínimo ${producto.stockMinimo}</span>
        </div>
      </div>
    `;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('mov-submit');
    const mensaje = document.getElementById('mov-mensaje');
    mensaje.classList.remove('exito', 'error');
    mensaje.style.display = 'none';
    btn.disabled = true;

    const productoId = document.getElementById('mov-producto').value;
    const cantidad = Number(document.getElementById('mov-cantidad').value);
    const fecha = document.getElementById('mov-fecha').value;
    const nota = document.getElementById('mov-nota').value.trim();
    const motivo = motivos ? document.getElementById('mov-motivo').value : null;
    const forzarEl = document.getElementById('mov-forzar');
    const permitirNegativo = forzarEl ? forzarEl.checked : false;

    try {
      await registrarMovimiento({ productoId, tipoMovimiento, cantidad, motivo, nota, fecha, permitirNegativo });

      mensaje.textContent = mensajeExito;
      mensaje.classList.add('exito');
      mensaje.style.display = 'block';
      setTimeout(() => {
        mensaje.style.display = 'none';
        mensaje.classList.remove('exito');
      }, 2500);

      document.getElementById('mov-cantidad').value = '';
      document.getElementById('mov-nota').value = '';
      if (forzarEl) forzarEl.checked = false;

      actualizarStockActual();
      await renderUltimosMovimientos();
    } catch (err) {
      mensaje.textContent = (err && err.message)
        ? err.message
        : 'No se pudo registrar el movimiento. Intenta de nuevo.';
      mensaje.classList.add('error');
      mensaje.style.display = 'block';
    } finally {
      btn.disabled = false;
    }
  }

  async function renderUltimosMovimientos() {
    const tbody = document.getElementById('mov-tabla-body');
    if (!tbody) return;

    const movimientos = await getMovimientos({ limite: 15, tipoMovimiento });

    if (movimientos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5">Aún no hay registros.</td></tr>`;
      return;
    }

    tbody.innerHTML = movimientos.map(m => `
      <tr>
        <td>${formatearFecha(m.fecha)}</td>
        <td>${m.producto ? m.producto.nombre : m.producto_id}</td>
        <td>${m.producto ? m.producto.categoriaFormato : ''}</td>
        <td class="numero">${m.cantidad}</td>
        <td>${m.motivo || m.nota || ''}</td>
      </tr>
    `).join('');
  }
}
