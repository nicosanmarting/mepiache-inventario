/* ===========================
   Mepiache Inventario - Configuración / productos (admin)
   =========================== */

let _configProductos = [];

(async () => {
  const session = await initLayout('configuracion.html');
  if (!session) return;

  if (!esAdmin()) {
    document.querySelector('#app-layout main').innerHTML = `<div class="estado-vacio">Esta pantalla está disponible solo para administradores.</div>`;
    return;
  }

  poblarSelects();
  await cargarYRenderizar();

  document.getElementById('filtro-categoria').addEventListener('change', renderTabla);
  document.getElementById('filtro-sabor').addEventListener('input', renderTabla);
  document.getElementById('filtro-inactivos').addEventListener('change', renderTabla);

  document.getElementById('btn-nuevo-producto').addEventListener('click', () => {
    document.getElementById('form-nuevo-producto').style.display = 'block';
  });
  document.getElementById('btn-cancelar-nuevo').addEventListener('click', () => {
    ocultarFormNuevo();
  });
  document.getElementById('btn-crear-producto').addEventListener('click', onCrearProducto);
})();

function poblarSelects() {
  const opciones = getCategorias().map(c => `<option value="${c}">${c}</option>`).join('');
  document.getElementById('filtro-categoria').innerHTML += opciones;
  document.getElementById('np-categoria').innerHTML = opciones;
}

async function cargarYRenderizar() {
  _configProductos = await getProductosTodos();
  renderTabla();
}

function mostrarMensaje(id, texto, tipo) {
  const el = document.getElementById(id);
  el.textContent = texto;
  el.className = `form-mensaje ${tipo}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function renderTabla() {
  const tbody = document.getElementById('tabla-config-body');

  const categoria = document.getElementById('filtro-categoria').value;
  const busqueda = document.getElementById('filtro-sabor').value.trim().toLowerCase();
  const mostrarInactivos = document.getElementById('filtro-inactivos').checked;

  const productos = _configProductos
    .filter(p => mostrarInactivos || p.activo)
    .filter(p => !categoria || p.categoriaFormato === categoria)
    .filter(p => !busqueda || p.nombre.toLowerCase().includes(busqueda) || (p.codigo || '').toLowerCase().includes(busqueda))
    .sort((a, b) => a.categoriaFormato.localeCompare(b.categoriaFormato) || (a.orden || 0) - (b.orden || 0));

  if (productos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11">No se encontraron productos con ese filtro.</td></tr>`;
    return;
  }

  const opcionesCategoria = getCategorias();

  tbody.innerHTML = productos.map(p => `
    <tr data-id="${p.id}" class="${p.activo ? '' : 'fila-inactiva'}">
      <td><input type="text" class="input-codigo" data-campo="codigo" value="${p.codigo || ''}"></td>
      <td><input type="text" class="input-sabor" data-campo="nombre" value="${p.nombre || ''}"></td>
      <td>
        <select data-campo="categoriaFormato">
          ${opcionesCategoria.map(c => `<option value="${c}" ${c === p.categoriaFormato ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </td>
      <td><input type="text" data-campo="linea" value="${p.linea || ''}"></td>
      <td><input type="text" data-campo="unidadConteo" value="${p.unidadConteo || ''}"></td>
      <td class="numero"><input type="number" step="any" data-campo="contenido" value="${p.contenido ?? ''}"></td>
      <td><input type="text" data-campo="unidadContenido" value="${p.unidadContenido || ''}"></td>
      <td class="numero"><input type="number" step="any" data-campo="stockMinimo" value="${p.stockMinimo ?? 0}"></td>
      <td class="numero"><input type="number" data-campo="orden" value="${p.orden ?? ''}"></td>
      <td><input type="checkbox" data-campo="activo" ${p.activo ? 'checked' : ''}></td>
      <td><div class="acciones-tabla"><button class="btn-guardar-fila">Guardar</button></div></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-guardar-fila').forEach(btn => {
    btn.addEventListener('click', (e) => onGuardarFila(e.target.closest('tr')));
  });
}

async function onGuardarFila(tr) {
  const id = tr.dataset.id;
  const btn = tr.querySelector('.btn-guardar-fila');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const campos = {};
  tr.querySelectorAll('[data-campo]').forEach(el => {
    const campo = el.dataset.campo;
    if (el.type === 'checkbox') {
      campos[campo] = el.checked;
    } else {
      campos[campo] = el.value;
    }
  });

  if (!campos.nombre || !campos.nombre.trim()) {
    mostrarMensaje('config-mensaje', 'El sabor/nombre no puede estar vacío.', 'error');
    btn.disabled = false;
    btn.textContent = original;
    return;
  }

  try {
    await actualizarProducto(id, campos);
    await cargarProductos();
    await cargarYRenderizar();
    mostrarMensaje('config-mensaje', `Producto "${campos.nombre}" actualizado ✔`, 'exito');
  } catch (err) {
    mostrarMensaje('config-mensaje', 'No se pudo guardar el producto. Intenta nuevamente.', 'error');
    btn.disabled = false;
    btn.textContent = original;
  }
}

function ocultarFormNuevo() {
  document.getElementById('form-nuevo-producto').style.display = 'none';
  ['np-codigo', 'np-sabor', 'np-linea', 'np-contenido', 'np-unidad-contenido', 'np-orden'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('np-unidad-conteo').value = 'unidades';
  document.getElementById('np-stock-actual').value = '0';
  document.getElementById('np-stock-minimo').value = '0';
  document.getElementById('np-mensaje').style.display = 'none';
}

async function onCrearProducto() {
  const nombre = document.getElementById('np-sabor').value.trim();
  const categoriaFormato = document.getElementById('np-categoria').value;

  if (!nombre) {
    mostrarMensaje('np-mensaje', 'El sabor/nombre es obligatorio.', 'error');
    return;
  }

  const datos = {
    nombre,
    codigo: document.getElementById('np-codigo').value.trim(),
    categoriaFormato,
    linea: document.getElementById('np-linea').value.trim(),
    unidadConteo: document.getElementById('np-unidad-conteo').value.trim() || 'unidades',
    contenido: document.getElementById('np-contenido').value,
    unidadContenido: document.getElementById('np-unidad-contenido').value.trim(),
    stockActual: document.getElementById('np-stock-actual').value,
    stockMinimo: document.getElementById('np-stock-minimo').value,
    orden: document.getElementById('np-orden').value,
  };

  const btn = document.getElementById('btn-crear-producto');
  btn.disabled = true;
  btn.textContent = 'Creando...';

  try {
    await crearProducto(datos);
    await cargarProductos();
    await cargarYRenderizar();
    ocultarFormNuevo();
    mostrarMensaje('config-mensaje', `Producto "${nombre}" creado ✔`, 'exito');
  } catch (err) {
    mostrarMensaje('np-mensaje', 'No se pudo crear el producto. Intenta nuevamente.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Crear producto';
  }
}
