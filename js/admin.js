/* ===========================
   Mepiache Inventario - Panel admin
   =========================== */

(async () => {
  const session = await initLayout('admin.html', { soloAdmin: true });
  if (!session) return;

  const { vencidos } = await getResumenMantenciones();
  if (vencidos > 0) {
    const btn = document.getElementById('btn-equipos');
    if (btn) {
      btn.insertAdjacentHTML('beforeend', `<span class="badge bajo" style="margin-top: 6px;">${vencidos} vencida${vencidos === 1 ? '' : 's'}</span>`);
    }
  }
})();
