/* ===========================
   Mepiache Inventario - Nuevo conteo
   ---------------------------------------------
   Paso 1: elegir categoría/formato (o continuar un
   borrador existente).
   Paso 2: tabla editable de stock contado vs sistema,
   con guardado de borrador y finalización (RPC).
   =========================== */

(async () => {
  const session = await initLayout('conteo.html');
  if (!session) return;

  const params = new URLSearchParams(window.location.search);
  const conteoId = params.get('id');

  if (conteoId) {
    await mostrarConteo(conteoId);
  } else {
    await mostrarPasoCategoria();
  }
})();

// --------- Paso 1: categorías ---------

async function mostrarPasoCategoria() {
  document.getElementById('paso-categoria').style.display = '';
  document.getElementById('paso-detalle').style.display = 'none';

  const cont = document.getElementById('categoria-grid');
  cont.innerHTML = `<div class="estado-vacio">Cargando...</div>`;

  const borradores = await getConteos({ estado: 'borrador', limite: 50 });
  const borradorPorCategoria = {};
  borradores.forEach(b => {
    if (!borradorPorCategoria[b.categoria_formato]) borradorPorCategoria[b.categoria_formato] = b;
  });

  cont.innerHTML = getCategorias().map(c => {
    const productos = getProductosPorCategoria(c);
    const borrador = borradorPorCategoria[c];
    return `
      <button type="button" class="categoria-card" data-categoria="${c}">
        <div class="categoria-nombre">${c}</div>
        <div class="categoria-detalle">${productos.length} sabores</div>
        ${borrador ? `<div style="margin-top: 8px;"><span class="badge bajo">Borrador en curso</span></div>` : ''}
      </button>
    `;
  }).join('');

  cont.querySelectorAll('.categoria-card').forEach(btn => {
    btn.addEventListener('click', () => onSeleccionarCategoria(btn.dataset.categoria, borradorPorCategoria[btn.dataset.categoria]));
  });
}

async function onSeleccionarCategoria(categoria, borradorExistente) {
  let conteoId;

  if (borradorExistente) {
    const continuar = confirm(
      `Ya existe un conteo en borrador para "${categoria}" (creado ${formatearFechaHora(borradorExistente.created_at)}).\n\n` +
      `Aceptar = continuar ese borrador.\nCancelar = empezar un conteo nuevo.`
    );
    conteoId = continuar ? borradorExistente.id : await crearConteo(categoria, null);
  } else {
    conteoId = await crearConteo(categoria, null);
  }

  history.replaceState(null, '', `conteo.html?id=${conteoId}`);
  await mostrarConteo(conteoId);
}

// --------- Paso 2: tabla de conteo ---------

async function mostrarConteo(conteoId) {
  const conteo = await getConteoPorId(conteoId);

  if (!conteo) {
    document.getElementById('paso-categoria').style.display = 'none';
    const detalle = document.getElementById('paso-detalle');
    detalle.style.display = '';
    detalle.innerHTML = `<div class="estado-vacio">No se encontró el conteo solicitado. <a href="conteo.html">Volver</a></div>`;
    return;
  }

  document.getElementById('paso-categoria').style.display = 'none';
  document.getElementById('paso-detalle').style.display = '';

  const finalizado = conteo.estado === 'finalizado';

  document.getElementById('conteo-titulo').textContent = `Conteo: ${conteo.categoria_formato}`;
  document.getElementById('conteo-meta').textContent = finalizado
    ? `Finalizado ${formatearFechaHora(conteo.finalized_at)}`
    : `Borrador iniciado ${formatearFechaHora(conteo.created_at)}`;

  const detalle = await getConteoDetalle(conteoId);

  const tbody = document.getElementById('tabla-conteo-body');
  tbody.innerHTML = detalle.map(d => {
    const sistema = Number(d.stock_sistema);
    const contado = (d.stock_contado === null || d.stock_contado === undefined) ? '' : d.stock_contado;
    let diffTexto = '';
    let diffClase = 'numero';
    if (contado !== '') {
      const diff = Number(contado) - sistema;
      diffTexto = diff > 0 ? `+${diff}` : `${diff}`;
      diffClase = `numero ${diff > 0 ? 'positiva' : diff < 0 ? 'negativa' : ''}`;
    }

    return `
      <tr data-detalle-id="${d.id}">
        <td>${d.producto ? (d.producto.codigo || '') : ''}</td>
        <td>${d.producto ? d.producto.nombre : d.producto_id}</td>
        <td class="numero">${sistema}</td>
        <td class="numero">
          <input type="number" class="input-contado" value="${contado}" ${finalizado ? 'disabled' : ''}>
        </td>
        <td class="${diffClase} diferencia-cell">${diffTexto}</td>
        <td><input type="text" class="input-observacion" value="${(d.observacion || '').replace(/"/g, '&quot;')}" ${finalizado ? 'disabled' : ''}></td>
      </tr>
    `;
  }).join('');

  if (!finalizado) {
    tbody.querySelectorAll('.input-contado').forEach(input => {
      input.addEventListener('input', () => {
        const tr = input.closest('tr');
        const sistema = Number(tr.children[2].textContent);
        const cell = tr.querySelector('.diferencia-cell');
        if (input.value === '') {
          cell.textContent = '';
          cell.className = 'numero diferencia-cell';
          return;
        }
        const diff = Number(input.value) - sistema;
        cell.textContent = diff > 0 ? `+${diff}` : `${diff}`;
        cell.className = `numero diferencia-cell ${diff > 0 ? 'positiva' : diff < 0 ? 'negativa' : ''}`;
      });
    });

    document.getElementById('conteo-acciones').style.display = 'flex';
    document.getElementById('conteo-resumen').style.display = 'none';

    document.getElementById('btn-guardar-borrador').onclick = () => onGuardar(conteoId, false);
    document.getElementById('btn-finalizar').onclick = () => onGuardar(conteoId, true);
  } else {
    document.getElementById('conteo-acciones').style.display = 'none';
    renderResumenFinal(detalle);
  }
}

async function onGuardar(conteoId, finalizar) {
  const mensaje = document.getElementById('conteo-mensaje');
  const btnBorrador = document.getElementById('btn-guardar-borrador');
  const btnFinalizar = document.getElementById('btn-finalizar');
  mensaje.style.display = 'none';
  mensaje.classList.remove('exito', 'error');
  btnBorrador.disabled = true;
  btnFinalizar.disabled = true;

  try {
    const filas = document.querySelectorAll('#tabla-conteo-body tr');
    await Promise.all(Array.from(filas).map(tr => {
      const detalleId = tr.dataset.detalleId;
      const stockContado = tr.querySelector('.input-contado').value;
      const observacion = tr.querySelector('.input-observacion').value.trim();
      return guardarConteoDetalle(detalleId, { stockContado, observacion });
    }));

    if (finalizar) {
      await finalizarConteo(conteoId);
      mensaje.textContent = 'Conteo finalizado. Los ajustes de stock ya fueron aplicados ✔';
      mensaje.classList.add('exito');
      mensaje.style.display = 'block';
      await mostrarConteo(conteoId);
    } else {
      mensaje.textContent = 'Borrador guardado ✔';
      mensaje.classList.add('exito');
      mensaje.style.display = 'block';
      setTimeout(() => {
        mensaje.style.display = 'none';
        mensaje.classList.remove('exito');
      }, 2500);
      btnBorrador.disabled = false;
      btnFinalizar.disabled = false;
    }
  } catch (err) {
    mensaje.textContent = (err && err.message) ? err.message : 'No se pudo guardar el conteo. Intenta de nuevo.';
    mensaje.classList.add('error');
    mensaje.style.display = 'block';
    btnBorrador.disabled = false;
    btnFinalizar.disabled = false;
  }
}

function renderResumenFinal(detalle) {
  const cont = document.getElementById('conteo-resumen');
  const conDiferencia = detalle.filter(d => d.stock_contado !== null && Number(d.stock_contado) !== Number(d.stock_sistema));

  if (conDiferencia.length === 0) {
    cont.innerHTML = `<div class="aviso-mock">Conteo finalizado sin diferencias respecto al sistema.</div>`;
  } else {
    cont.innerHTML = `
      <div class="aviso-mock">
        Conteo finalizado. Se ajustó el stock de ${conDiferencia.length} sabor(es):
        ${conDiferencia.map(d => {
          const diff = Number(d.stock_contado) - Number(d.stock_sistema);
          const signo = diff > 0 ? '+' : '';
          return `<br>· ${d.producto ? d.producto.nombre : d.producto_id}: ${d.stock_sistema} → ${d.stock_contado} (${signo}${diff})`;
        }).join('')}
      </div>
    `;
  }
  cont.style.display = '';
}
