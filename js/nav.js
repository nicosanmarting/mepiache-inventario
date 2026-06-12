/* ===========================
   Mepiache Inventario - Navegación y rol de usuario
   ---------------------------------------------
   Cada página llama a initLayout('archivo.html') al
   cargar. Esto valida la sesión, dibuja el header y
   el menú (filtrado según el rol del usuario) y carga
   el catálogo de productos en caché.

   Roles:
   - "admin": ve Merma/ajuste, Métricas y Configuración
     además de las pantallas operativas.
   - "operativo": ve Inicio, Nuevo conteo, Producción,
     Venta/salida, Stock actual e Historial.

   Para dar permisos de administrador a otro usuario,
   agregar su email (en minúsculas) a ADMIN_EMAILS.
   =========================== */

const ADMIN_EMAILS = [
  'nico.sanmarting19@gmail.com',
  'msanmartinguevara@gmail.com',
];

const NAV_LINKS = [
  { href: 'inicio.html', label: 'Inicio' },
  { href: 'conteo.html', label: 'Nuevo conteo' },
  { href: 'produccion.html', label: 'Producción' },
  { href: 'venta.html', label: 'Venta / salida' },
  { href: 'clientes.html', label: 'Clientes' },
  { href: 'merma.html', label: 'Merma / ajuste', admin: true },
  { href: 'stock.html', label: 'Stock actual' },
  { href: 'metricas.html', label: 'Métricas', admin: true },
  { href: 'historial.html', label: 'Historial' },
  { href: 'configuracion.html', label: 'Configuración', admin: true },
  { href: 'trabajadores.html', label: 'Trabajadores', admin: true },
  { href: 'conservadoras.html', label: 'Conservadoras', admin: true },
  { href: 'documentos.html', label: 'Documentos', admin: true },
];

let _sesionActual = null;

function esAdmin() {
  return !!(_sesionActual && ADMIN_EMAILS.includes((_sesionActual.user.email || '').toLowerCase()));
}

function getSesion() {
  return _sesionActual;
}

// Dibuja header + nav dentro de #app-layout y valida la sesión.
// Devuelve la sesión activa, o null si redirigió a login.
// Si { soloAdmin: true }, redirige a inicio si el usuario no es admin.
async function initLayout(paginaActiva, { soloAdmin = false } = {}) {
  // Ocultar el body de inmediato para evitar el flash de contenido
  // antes de que la validación de sesión/rol termine.
  document.body.style.visibility = 'hidden';

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  _sesionActual = session;

  const admin = esAdmin();

  if (soloAdmin && !admin) {
    window.location.href = 'inicio.html';
    return null;
  }

  const links = NAV_LINKS.filter(l => !l.admin || admin);

  const headerHtml = `
    <header class="app-header">
      <div class="marca">Mepi<span>ache</span> · Inventario</div>
      <div class="usuario-info">
        <span>${session.user.email}</span>
        <button class="secundario" id="btn-logout">Cerrar sesión</button>
      </div>
    </header>
    <nav class="app-nav">
      ${links.map(l => `<a href="${l.href}" class="nav-link${l.href === paginaActiva ? ' activo' : ''}">${l.label}</a>`).join('')}
    </nav>
  `;

  const layout = document.getElementById('app-layout');
  layout.insertAdjacentHTML('afterbegin', headerHtml);

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
  });

  await cargarProductos();
  await cargarEncargados();
  await cargarClientes();

  document.body.style.visibility = 'visible';
  return session;
}

// --------- Helpers de formato compartidos ---------

function formatearFecha(fechaStr) {
  if (!fechaStr) return '';
  const [anio, mes, dia] = fechaStr.slice(0, 10).split('-');
  return `${dia}-${mes}-${anio}`;
}

function formatearFechaHora(fechaIso) {
  if (!fechaIso) return '';
  const d = new Date(fechaIso);
  const fecha = formatearFecha(fechaIso);
  const hora = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  return `${fecha} ${hora}`;
}
