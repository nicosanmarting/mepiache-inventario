/* ===========================
   Mepiache Inventario - Nuevo conteo
   ---------------------------------------------
   Paso 1: elegir categoría/formato (o continuar un
   borrador existente).
   Paso 2: tabla editable de stock contado vs sistema,
   con guardado de borrador y finalización (RPC).
   =========================== */

let _conteoDetalleActual = [];
let _conteoFinalizado = false;

(async () => {
  const session = await initLayout('conteo.html');
  if (!session) return;

  const filtroPendientes = document.getElementById('filtro-solo-pendientes');
  if (filtroPendientes) filtroPendientes.addEventListener('change', renderTablaConteo);

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

  poblarSelectEncargado();

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

// Llena el selector de encargado con la lista configurable (Configuración > Encargados).
function poblarSelectEncargado() {
  const sel = document.getElementById('select-encargado');
  if (!sel) return;
  const seleccionado = sel.value;
  sel.innerHTML = `<option value="">Sin especificar</option>` +
    getEncargados().map(e => `<option value="${e.nombre}">${e.nombre}</option>`).join('');
  if (seleccionado) sel.value = seleccionado;

  sel.addEventListener('change', actualizarLinkImprimir);
  actualizarLinkImprimir();
}

// Pasa el encargado seleccionado a la planilla imprimible.
function actualizarLinkImprimir() {
  const sel = document.getElementById('select-encargado');
  const link = document.getElementById('link-imprimir-planilla');
  if (!sel || !link) return;
  link.href = sel.value
    ? `imprimir-conteo.html?encargado=${encodeURIComponent(sel.value)}`
    : 'imprimir-conteo.html';
}

async function onSeleccionarCategoria(categoria, borradorExistente) {
  let conteoId;
  const sel = document.getElementById('select-encargado');
  const encargado = sel ? (sel.value || null) : null;

  try {
    if (borradorExistente) {
      const continuar = await confirmarAccion(
        `Ya existe un conteo en borrador para "${categoria}" (creado ${formatearFechaHora(borradorExistente.created_at)}).`,
        {
          titulo: 'Conteo en borrador existente',
          textoConfirmar: 'Continuar borrador',
          textoCancelar: 'Empezar uno nuevo',
        }
      );
      conteoId = continuar ? borradorExistente.id : await crearConteo(categoria, null, encargado);
    } else {
      conteoId = await crearConteo(categoria, null, encargado);
    }
  } catch (err) {
    alert(
      'No se pudo crear el conteo.\n\n' +
      ((err && err.message) ? err.message : 'Error desconocido.') +
      '\n\nSi el error menciona "crear_conteo" o "encargado", probablemente falta ejecutar sql/migration_v4_encargados.sql en Supabase.'
    );
    return;
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
  const metaTexto = finalizado
    ? `Finalizado ${formatearFechaHora(conteo.finalized_at)}`
    : `Borrador iniciado ${formatearFechaHora(conteo.created_at)}`;
  document.getElementById('conteo-meta').textContent = conteo.encargado
    ? `${metaTexto} · Encargado: ${conteo.encargado}`
    : metaTexto;

  const detalle = await getConteoDetalle(conteoId);
  _conteoDetalleActual = detalle;
  _conteoFinalizado = finalizado;

  renderTablaConteo();

  const filtroRow = document.getElementById('filtro-pendientes-row');

  if (!finalizado) {
    document.getElementById('conteo-acciones').style.display = 'flex';
    document.getElementById('conteo-resumen').style.display = 'none';
    if (filtroRow) filtroRow.style.display = '';

    document.getElementById('btn-guardar-borrador').onclick = () => onGuardar(conteoId, false);
    document.getElementById('btn-finalizar').onclick = () => onGuardar(conteoId, true);
  } else {
    document.getElementById('conteo-acciones').style.display = 'none';
    if (filtroRow) filtroRow.style.display = 'none';
    renderResumenFinal(detalle);
  }
}

// --------- Render de la tabla de conteo (respeta filtro "solo pendientes") ---------

function filaEstaContada(d) {
  return d.stock_contado !== null && d.stock_contado !== undefined && d.stock_contado !== '';
}

function renderTablaConteo() {
  const tbody = document.getElementById('tabla-conteo-body');
  const filtroPendientes = document.getElementById('filtro-solo-pendientes');
  const soloPendientes = !_conteoFinalizado && filtroPendientes && filtroPendientes.checked;

  const filas = _conteoDetalleActual.filter(d => !soloPendientes || !filaEstaContada(d));

  if (filas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="estado-vacio">¡Todo contado! 🎉</td></tr>`;
    actualizarProgreso();
    return;
  }

  tbody.innerHTML = filas.map(d => {
    const sistema = Number(d.stock_sistema);
    const contado = filaEstaContada(d) ? d.stock_contado : '';
    let diffTexto = '';
    let diffClase = 'numero';
    if (contado !== '') {
      const diff = Number(contado) - sistema;
      diffTexto = diff > 0 ? `+${diff}` : `${diff}`;
      diffClase = `numero ${diff > 0 ? 'positiva' : diff < 0 ? 'negativa' : ''}`;
    }

    return `
      <tr data-detalle-id="${d.id}" class="${contado !== '' ? 'fila-contada' : ''}">
        <td data-label="Código">${d.producto ? (d.producto.codigo || '') : ''}</td>
        <td data-label="Sabor">${d.producto ? d.producto.nombre : d.producto_id}</td>
        <td class="numero" data-label="Stock sistema">${sistema}</td>
        <td class="numero" data-label="Stock contado">
          <input type="number" class="input-contado" min="0" value="${contado}" ${_conteoFinalizado ? 'disabled' : ''}>
          <span class="autosave-indicator" data-autosave="${d.id}"></span>
        </td>
        <td class="${diffClase} diferencia-cell" data-label="Diferencia">${diffTexto}</td>
        <td data-label="Observación"><input type="text" class="input-observacion" value="${(d.observacion || '').replace(/"/g, '&quot;')}" ${_conteoFinalizado ? 'disabled' : ''}></td>
      </tr>
    `;
  }).join('');

  if (!_conteoFinalizado) {
    bindFilaListeners();
  }

  actualizarProgreso();
}

function bindFilaListeners() {
  const tbody = document.getElementById('tabla-conteo-body');

  tbody.querySelectorAll('.input-contado').forEach(input => {
    input.addEventListener('input', () => {
      const tr = input.closest('tr');
      const item = _conteoDetalleActual.find(d => String(d.id) === String(tr.dataset.detalleId));
      const sistema = Number(tr.children[2].textContent);
      const cell = tr.querySelector('.diferencia-cell');

      const esNegativo = input.value !== '' && Number(input.value) < 0;
      input.classList.toggle('campo-invalido', esNegativo);

      if (input.value === '') {
        cell.textContent = '';
        cell.className = 'numero diferencia-cell';
        tr.classList.remove('fila-contada');
        if (item) item.stock_contado = null;
      } else {
        const diff = Number(input.value) - sistema;
        cell.textContent = diff > 0 ? `+${diff}` : `${diff}`;
        cell.className = `numero diferencia-cell ${diff > 0 ? 'positiva' : diff < 0 ? 'negativa' : ''}`;
        tr.classList.add('fila-contada');
        if (item) item.stock_contado = input.value;
      }
      actualizarProgreso();

      if (item && !esNegativo) programarAutosave(item, tr);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const inputs = Array.from(tbody.querySelectorAll('.input-contado'));
      const idx = inputs.indexOf(input);
      const siguiente = inputs[idx + 1];
      if (siguiente) {
        siguiente.focus();
        siguiente.select();
      } else {
        input.blur();
      }
    });
  });

  tbody.querySelectorAll('.input-observacion').forEach(input => {
    input.addEventListener('input', () => {
      const tr = input.closest('tr');
      const item = _conteoDetalleActual.find(d => String(d.id) === String(tr.dataset.detalleId));
      if (item) item.observacion = input.value;
      if (item) programarAutosave(item, tr);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const inputs = Array.from(tbody.querySelectorAll('.input-contado'));
      const tr = input.closest('tr');
      const filaInputs = Array.from(tbody.querySelectorAll('tr'));
      const idxFila = filaInputs.indexOf(tr);
      const siguiente = inputs[idxFila + 1];
      if (siguiente) {
        siguiente.focus();
        siguiente.select();
      } else {
        input.blur();
      }
    });
  });
}

// --------- Autoguardado por fila (debounced) ---------

const _autosaveTimers = {};

function programarAutosave(item, tr) {
  const indicador = tr.querySelector('.autosave-indicator');

  if (indicador) {
    indicador.textContent = '';
    indicador.className = 'autosave-indicator';
  }

  if (_autosaveTimers[item.id]) clearTimeout(_autosaveTimers[item.id]);

  _autosaveTimers[item.id] = setTimeout(async () => {
    if (indicador) {
      indicador.textContent = 'Guardando...';
      indicador.className = 'autosave-indicator guardando visible';
    }

    try {
      const stockContado = filaEstaContada(item) ? item.stock_contado : '';
      const observacion = (item.observacion || '').trim();
      await guardarConteoDetalle(item.id, { stockContado, observacion });

      if (indicador) {
        indicador.textContent = 'Guardado ✓';
        indicador.className = 'autosave-indicator visible';
        setTimeout(() => indicador.classList.remove('visible'), 1800);
      }
    } catch (err) {
      if (indicador) {
        indicador.textContent = 'Error al guardar';
        indicador.className = 'autosave-indicator error visible';
      }
    }
  }, 1500);
}

function actualizarProgreso() {
  const el = document.getElementById('conteo-progreso');
  if (!el) return;
  const total = _conteoDetalleActual.length;
  const contados = _conteoDetalleActual.filter(filaEstaContada).length;
  el.textContent = total ? `${contados} de ${total} contados` : '';
  el.classList.toggle('completo', total > 0 && contados === total);
}

async function onGuardar(conteoId, finalizar) {
  const mensaje = document.getElementById('conteo-mensaje');
  const btnBorrador = document.getElementById('btn-guardar-borrador');
  const btnFinalizar = document.getElementById('btn-finalizar');
  mensaje.style.display = 'none';
  mensaje.classList.remove('exito', 'error');

  const hayNegativos = _conteoDetalleActual.some(d => filaEstaContada(d) && Number(d.stock_contado) < 0);
  if (hayNegativos) {
    mensaje.textContent = 'Hay cantidades contadas negativas. Corrígelas antes de guardar.';
    mensaje.classList.add('error');
    mensaje.style.display = 'block';
    return;
  }

  const textoBorrador = btnBorrador.textContent;
  const textoFinalizar = btnFinalizar.textContent;
  btnBorrador.disabled = true;
  btnFinalizar.disabled = true;
  btnBorrador.innerHTML = `<span class="spinner"></span> ${textoBorrador}`;
  btnFinalizar.innerHTML = `<span class="spinner"></span> ${textoFinalizar}`;

  try {
    // Se guarda desde _conteoDetalleActual (no desde el DOM) para que las
    // filas ocultas por el filtro "solo pendientes" también se incluyan.
    await Promise.all(_conteoDetalleActual.map(d => {
      const stockContado = filaEstaContada(d) ? d.stock_contado : '';
      const observacion = (d.observacion || '').trim();
      return guardarConteoDetalle(d.id, { stockContado, observacion });
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
      btnBorrador.textContent = textoBorrador;
      btnFinalizar.textContent = textoFinalizar;
    }
  } catch (err) {
    mensaje.textContent = (err && err.message) ? err.message : 'No se pudo guardar el conteo. Intenta de nuevo.';
    mensaje.classList.add('error');
    mensaje.style.display = 'block';
    btnBorrador.disabled = false;
    btnFinalizar.disabled = false;
    btnBorrador.textContent = textoBorrador;
    btnFinalizar.textContent = textoFinalizar;
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
