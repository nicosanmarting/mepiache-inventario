/* ===========================
   Mepiache Inventario - Autenticación (MOCK)
   ---------------------------------------------
   Esto es un login simulado con usuarios fijos,
   solo para poder navegar el frontend con datos
   de prueba.

   Cuando Supabase esté listo, reemplazar este
   archivo por llamadas a:
     supabase.auth.signInWithPassword({ email, password })
   y guardar la sesión real en vez de localStorage.
   =========================== */

const USUARIOS_MOCK = {
  admin: { clave: 'admin', nombre: 'Nico', rol: 'admin' },
  empleado: { clave: 'empleado', nombre: 'Empleado', rol: 'empleado' },
};

// Si ya hay sesión activa y estamos en el login, ir directo al dashboard
if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
  const sesion = localStorage.getItem('mepiache_sesion');
  if (sesion) {
    window.location.href = 'dashboard.html';
  }
}

const formLogin = document.getElementById('form-login');
if (formLogin) {
  formLogin.addEventListener('submit', (e) => {
    e.preventDefault();

    const usuario = document.getElementById('usuario').value.trim().toLowerCase();
    const clave = document.getElementById('clave').value;
    const errorEl = document.getElementById('login-error');

    const usuarioValido = USUARIOS_MOCK[usuario];

    if (usuarioValido && usuarioValido.clave === clave) {
      localStorage.setItem('mepiache_sesion', JSON.stringify({
        usuario: usuario,
        nombre: usuarioValido.nombre,
        rol: usuarioValido.rol,
      }));
      window.location.href = 'dashboard.html';
    } else {
      errorEl.style.display = 'block';
    }
  });
}
