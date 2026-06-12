/* ===========================
   Mepiache Inventario - Notificaciones tipo "toast"
   ---------------------------------------------
   mostrarToast(mensaje, tipo, duracion) muestra un
   mensaje flotante en la esquina inferior derecha
   (o ancho completo en mobile). tipo: 'exito' | 'error' | 'info'.
   =========================== */

function mostrarToast(mensaje, tipo = 'exito', duracion = 3000) {
  let cont = document.getElementById('toast-contenedor');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'toast-contenedor';
    document.body.appendChild(cont);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.textContent = mensaje;
  cont.appendChild(toast);

  // Forzar reflow para que la transición de entrada se anime.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('mostrar'));
  });

  setTimeout(() => {
    toast.classList.remove('mostrar');
    setTimeout(() => toast.remove(), 250);
  }, duracion);
}
