/* ===========================
   Mepiache Inventario - Autenticación (Supabase)
   ---------------------------------------------
   Usa Supabase Auth (email + contraseña).
   Los usuarios se crean manualmente en
   Authentication > Users del panel de Supabase.
   =========================== */

(async () => {
  // Si ya hay sesión activa, ir directo a Inicio
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    window.location.href = 'inicio.html';
  }
})();

const formLogin = document.getElementById('form-login');
if (formLogin) {
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const clave = document.getElementById('clave').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('btn-login');

    errorEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Ingresando...';

    const { error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: clave,
    });

    if (error) {
      errorEl.textContent = 'Email o contraseña incorrectos.';
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Ingresar';
      return;
    }

    window.location.href = 'inicio.html';
  });
}
