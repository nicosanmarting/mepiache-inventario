/* ===========================
   Mepiache Inventario - Planillas de conteo imprimibles
   ---------------------------------------------
   Genera planillas en papel lo más parecidas posible a las
   planillas físicas "ARTESANALES MEPIACHE INVENTARIO - STOCK",
   con los productos en el mismo orden que en la app (campo
   `orden`), para que transcribir el conteo después sea simple.
   =========================== */

(async () => {
  const session = await initLayout('conteo.html');
  if (!session) return;

  const params = new URLSearchParams(window.location.search);

  poblarEncargado(params.get('encargado'));

  document.getElementById('imp-dia').value = new Date().toISOString().slice(0, 10);

  renderHoja();

  document.getElementById('btn-imprimir').addEventListener('click', () => window.print());

  ['imp-dia', 'imp-hora', 'imp-encargado'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderHoja);
    document.getElementById(id).addEventListener('change', renderHoja);
  });
})();

function poblarEncargado(seleccionInicial) {
  const sel = document.getElementById('imp-encargado');
  sel.innerHTML += getEncargados().map(e => `<option value="${e.nombre}">${e.nombre}</option>`).join('');
  if (seleccionInicial) sel.value = seleccionInicial;
}

function renderHoja() {
  const dia = document.getElementById('imp-dia').value;
  const hora = document.getElementById('imp-hora').value;
  const encargado = document.getElementById('imp-encargado').value;

  document.getElementById('hoja-impresion').innerHTML = [
    seccionHelados(dia, hora, encargado),
    seccionPaletas(dia, hora, encargado),
    seccionGelato(dia, hora, encargado),
    seccionSustancias(dia, hora, encargado),
  ].join('');
}

// --------- Encabezado común ---------

function encabezado(dia, hora, encargado) {
  return `
    <div class="hoja-encabezado">
      <div class="hoja-titulo">MEPIACHE<br>INVENTARIO - STOCK</div>
      <div class="hoja-datos">
        <div><strong>DIA:</strong> ${dia ? formatearFecha(dia) : '_______________'}</div>
        <div><strong>HORA:</strong> ${hora || '_______________'}</div>
        <div><strong>ENCARGADO:</strong> ${encargado || '_______________'}</div>
      </div>
    </div>
  `;
}

// Empareja productos de dos categorías por nombre de sabor, ordenados
// según el campo `orden` (igual que aparecen en la app).
function emparejarPorSabor(categoriaA, categoriaB) {
  const a = getProductosPorCategoria(categoriaA);
  const b = getProductosPorCategoria(categoriaB);
  const porNombre = new Map();

  a.forEach(p => porNombre.set(p.nombre, { nombre: p.nombre, orden: p.orden || 0, a: p, b: null }));
  b.forEach(p => {
    if (porNombre.has(p.nombre)) {
      porNombre.get(p.nombre).b = p;
    } else {
      porNombre.set(p.nombre, { nombre: p.nombre, orden: p.orden || 0, a: null, b: p });
    }
  });

  return Array.from(porNombre.values()).sort((x, y) => x.orden - y.orden || x.nombre.localeCompare(y.nombre));
}

// --------- HELADOS: Bote 10 L + Bacha 5 L ---------

function seccionHelados(dia, hora, encargado) {
  const filas = emparejarPorSabor('Bote 10 L', 'Bacha 5 L');

  return `
    <section class="hoja-pagina">
      ${encabezado(dia, hora, encargado)}
      <h3 class="hoja-seccion-titulo">HELADOS</h3>
      <table class="tabla-impresion">
        <thead>
          <tr>
            <th>SABOR</th>
            <th>Código</th>
            <th>BOTE x 10 Lts</th>
            <th>Código</th>
            <th>BACHAS x 5 Lts</th>
          </tr>
        </thead>
        <tbody>
          ${filas.map(f => `
            <tr>
              <td>${f.nombre}</td>
              <td>${f.a ? (f.a.codigo || '') : ''}</td>
              <td class="celda-vacia"></td>
              <td>${f.b ? (f.b.codigo || '') : ''}</td>
              <td class="celda-vacia"></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${seccionMateriaPrima()}
    </section>
  `;
}

// --------- PALETAS + MIS PALETAS ---------

function tablaSimple(categoria, titulo) {
  const productos = getProductosPorCategoria(categoria);

  return `
    <div class="hoja-tabla-col">
      <h4 class="hoja-subtitulo">${titulo}</h4>
      <table class="tabla-impresion">
        <thead>
          <tr>
            <th>Código</th>
            <th>SABOR</th>
            <th>CAJAS</th>
            <th>Unids</th>
          </tr>
        </thead>
        <tbody>
          ${productos.map(p => `
            <tr>
              <td>${p.codigo || ''}</td>
              <td>${p.nombre}</td>
              <td class="celda-vacia"></td>
              <td class="celda-vacia"></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function seccionPaletas(dia, hora, encargado) {
  return `
    <section class="hoja-pagina">
      ${encabezado(dia, hora, encargado)}
      <h3 class="hoja-seccion-titulo">PALETAS</h3>
      <div class="hoja-dos-columnas">
        ${tablaSimple('Paletas', 'PALETAS')}
        ${tablaSimple('Mis Paletas', 'MIS PALETAS')}
      </div>
      ${seccionMateriaPrima()}
    </section>
  `;
}

// --------- GELATO PREMIUM: Bachas + Caja 6x750ml ---------

function seccionGelato(dia, hora, encargado) {
  const filas = emparejarPorSabor('Gelato Premium Bachas', 'Gelato Premium Caja 6x750ml');

  return `
    <section class="hoja-pagina">
      ${encabezado(dia, hora, encargado)}
      <h3 class="hoja-seccion-titulo">GELATO PREMIUM</h3>
      <table class="tabla-impresion">
        <thead>
          <tr>
            <th>CODIGO</th>
            <th>SABOR</th>
            <th>BACHAS UNIDADES</th>
            <th>CAJA (6X750ML)</th>
          </tr>
        </thead>
        <tbody>
          ${filas.map(f => {
            const codigo = (f.a && f.a.codigo) || (f.b && f.b.codigo) || '';
            return `
              <tr>
                <td>${codigo}</td>
                <td>${f.nombre}</td>
                <td class="celda-vacia"></td>
                <td class="celda-vacia"></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      ${seccionMateriaPrima()}
    </section>
  `;
}

// --------- SUSTANCIAS ---------

function seccionSustancias(dia, hora, encargado) {
  const productos = getProductosPorCategoria('Sustancias');

  return `
    <section class="hoja-pagina">
      ${encabezado(dia, hora, encargado)}
      <h3 class="hoja-seccion-titulo">SUSTANCIAS</h3>
      <table class="tabla-impresion">
        <thead>
          <tr>
            <th>Código</th>
            <th>PRODUCTO</th>
            <th>FORMATO</th>
            <th>CAJAS</th>
          </tr>
        </thead>
        <tbody>
          ${productos.map(p => `
            <tr>
              <td>${p.codigo || ''}</td>
              <td>${p.nombre}</td>
              <td>${p.contenido} ${p.unidad_contenido || ''}</td>
              <td class="celda-vacia"></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${seccionMateriaPrima()}
    </section>
  `;
}

// --------- MATERIA PRIMA (espacio en blanco para completar a mano) ---------

function seccionMateriaPrima() {
  const filasVacias = Array.from({ length: 8 }).map(() => `
    <tr>
      <td class="celda-vacia"></td>
      <td class="celda-vacia"></td>
      <td class="celda-vacia"></td>
      <td class="celda-vacia"></td>
    </tr>
  `).join('');

  return `
    <h3 class="hoja-seccion-titulo" style="margin-top: 18px;">MATERIA PRIMA</h3>
    <table class="tabla-impresion">
      <thead>
        <tr>
          <th>Cód</th>
          <th>ÍTEM</th>
          <th class="numero">STOCK</th>
          <th class="numero">SOLICITUD</th>
        </tr>
      </thead>
      <tbody>${filasVacias}</tbody>
    </table>
  `;
}
