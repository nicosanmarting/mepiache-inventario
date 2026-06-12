/* ===========================
   Mepiache Inventario - Tablas ordenables
   ---------------------------------------------
   initTableSort(theadSelector, columnas, alCambiar) agrega
   click-to-sort a los <th> de un <thead>.

   columnas: array paralelo a los <th> del thead. Cada elemento
   es `null` (columna no ordenable) o un objeto:
     { tipo: 'texto' | 'numero', accesor: (item) => valor }

   alCambiar: función llamada cada vez que el usuario cambia el
   orden (la página debe volver a renderizar usando ordenar()).

   Devuelve { ordenar(datos) } — aplica el orden activo (si hay)
   a una copia del array `datos`.
   =========================== */

function initTableSort(theadSelector, columnas, alCambiar) {
  const thead = document.querySelector(theadSelector);
  if (!thead) return { ordenar: (datos) => datos };

  const ths = Array.from(thead.querySelectorAll('th'));
  const estado = { indice: -1, dir: 1 };

  ths.forEach((th, i) => {
    const col = columnas[i];
    if (!col) return;
    th.classList.add('th-ordenable');
    th.addEventListener('click', () => {
      if (estado.indice === i) {
        estado.dir = -estado.dir;
      } else {
        estado.indice = i;
        estado.dir = 1;
      }
      ths.forEach(other => other.classList.remove('orden-asc', 'orden-desc'));
      th.classList.add(estado.dir === 1 ? 'orden-asc' : 'orden-desc');
      if (alCambiar) alCambiar();
    });
  });

  function ordenar(datos) {
    if (estado.indice < 0) return datos;
    const col = columnas[estado.indice];
    if (!col) return datos;

    return datos.slice().sort((a, b) => {
      let va = col.accesor(a);
      let vb = col.accesor(b);

      if (col.tipo === 'numero') {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
        return (va - vb) * estado.dir;
      }

      va = (va ?? '').toString().toLowerCase();
      vb = (vb ?? '').toString().toLowerCase();
      return va.localeCompare(vb) * estado.dir;
    });
  }

  return { ordenar };
}
