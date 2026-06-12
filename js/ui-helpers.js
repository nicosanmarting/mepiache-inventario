/* ===========================
   Mepiache Inventario - Helpers de interfaz
   ---------------------------------------------
   conBotonCargando(boton, textoCargando, fn): ejecuta fn()
   mostrando un spinner y deshabilitando el botón mientras
   dura la operación. Devuelve lo que retorne fn().

   confirmarAccion(mensaje, opciones): muestra un modal de
   confirmación (reemplazo de confirm()) y devuelve una
   Promise<boolean>. opciones: { titulo, textoConfirmar,
   textoCancelar, tipo: 'peligro' }.
   =========================== */

async function conBotonCargando(boton, textoCargando, fn) {
  if (!boton) return fn();

  const textoOriginal = boton.innerHTML;
  const anchoOriginal = boton.offsetWidth;

  boton.disabled = true;
  if (anchoOriginal) boton.style.minWidth = anchoOriginal + 'px';
  boton.innerHTML = `<span class="spinner"></span> ${textoCargando || 'Guardando...'}`;

  try {
    return await fn();
  } finally {
    boton.disabled = false;
    boton.innerHTML = textoOriginal;
    boton.style.minWidth = '';
  }
}

// --------- Validación inline de formularios ---------

// Marca un campo como inválido y muestra un mensaje de error debajo.
// Reutiliza (o crea) un <small class="campo-error"> justo después del campo.
function mostrarErrorCampo(idCampo, mensaje) {
  const campo = document.getElementById(idCampo);
  if (!campo) return;

  campo.classList.add('campo-invalido');

  // Si el campo es un <select> convertido a combobox (ver combobox.js),
  // el mensaje y el resaltado visual van en el wrapper/input visible.
  let elementoVisual = campo;
  const siguiente = campo.nextElementSibling;
  if (siguiente && siguiente.classList.contains('combobox-wrapper')) {
    elementoVisual = siguiente;
    const inputVisible = siguiente.querySelector('.combobox-input');
    if (inputVisible) inputVisible.classList.add('campo-invalido');
  }

  let error = document.getElementById(`error-${idCampo}`);
  if (!error) {
    error = document.createElement('small');
    error.id = `error-${idCampo}`;
    error.className = 'campo-error';
    elementoVisual.insertAdjacentElement('afterend', error);
  }
  error.textContent = mensaje;
}

// Quita la marca de error de un campo (si la tiene).
function limpiarErrorCampo(idCampo) {
  const campo = document.getElementById(idCampo);
  if (campo) {
    campo.classList.remove('campo-invalido');
    const siguiente = campo.nextElementSibling;
    if (siguiente && siguiente.classList.contains('combobox-wrapper')) {
      const inputVisible = siguiente.querySelector('.combobox-input');
      if (inputVisible) inputVisible.classList.remove('campo-invalido');
    }
  }

  const error = document.getElementById(`error-${idCampo}`);
  if (error) error.remove();
}

// Quita la marca de error de todos los campos indicados.
function limpiarErroresCampos(ids) {
  ids.forEach(limpiarErrorCampo);
}

// --------- Empty state con botón "Limpiar filtros" ---------

// Devuelve el HTML de una fila de tabla con un mensaje de "sin
// resultados" y un botón que llama a la función global indicada
// (por nombre) para limpiar los filtros activos.
function htmlEstadoVacioFiltros(colspan, mensaje, nombreFuncionLimpiar) {
  return `<tr><td colspan="${colspan}" class="estado-vacio">
    ${mensaje}<br>
    <button type="button" class="secundario" style="margin-top: 10px;" onclick="${nombreFuncionLimpiar}()">Limpiar filtros</button>
  </td></tr>`;
}

// --------- Filtros rápidos de fecha ---------

// Devuelve la fecha en formato YYYY-MM-DD (hora local), apto para
// <input type="date">.
function _fechaISO(date) {
  const año = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

// Conecta un grupo de botones data-rango="hoy|semana|mes|limpiar" a
// dos <input type="date"> (desde/hasta), llamando a alCambiar() después
// de actualizar los valores.
function bindFiltrosFechaRapidos(contenedorId, idDesde, idHasta, alCambiar) {
  const contenedor = document.getElementById(contenedorId);
  const desde = document.getElementById(idDesde);
  const hasta = document.getElementById(idHasta);
  if (!contenedor || !desde || !hasta) return;

  contenedor.querySelectorAll('button[data-rango]').forEach(btn => {
    btn.addEventListener('click', () => {
      const hoy = new Date();
      const rango = btn.dataset.rango;

      if (rango === 'hoy') {
        desde.value = _fechaISO(hoy);
        hasta.value = _fechaISO(hoy);
      } else if (rango === 'semana') {
        const diaSemana = (hoy.getDay() + 6) % 7; // lunes = 0
        const lunes = new Date(hoy);
        lunes.setDate(hoy.getDate() - diaSemana);
        desde.value = _fechaISO(lunes);
        hasta.value = _fechaISO(hoy);
      } else if (rango === 'mes') {
        const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        desde.value = _fechaISO(primero);
        hasta.value = _fechaISO(hoy);
      } else if (rango === 'limpiar') {
        desde.value = '';
        hasta.value = '';
      }

      if (typeof alCambiar === 'function') alCambiar();
    });
  });
}

// --------- Persistencia de filtros en localStorage ---------
//
// restaurarFiltrosDesdeStorage debe llamarse ANTES de aplicar los
// filtros que vengan en la URL, así la URL siempre tiene prioridad
// sobre lo guardado en una visita anterior.

function _claveFiltros(clave) {
  return `mepiache-filtros-${clave}`;
}

function restaurarFiltrosDesdeStorage(clave, ids) {
  let valores;
  try {
    valores = JSON.parse(localStorage.getItem(_claveFiltros(clave)) || '{}');
  } catch (e) {
    valores = {};
  }

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el || !(id in valores)) return;
    if (el.type === 'checkbox') el.checked = !!valores[id];
    else el.value = valores[id];
  });
}

function guardarFiltrosEnStorage(clave, ids) {
  const valores = {};
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    valores[id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  try {
    localStorage.setItem(_claveFiltros(clave), JSON.stringify(valores));
  } catch (e) {
    // localStorage no disponible (modo privado, etc.) - se ignora.
  }
}

function bindGuardarFiltros(clave, ids) {
  const guardar = () => guardarFiltrosEnStorage(clave, ids);
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', guardar);
    el.addEventListener('input', guardar);
  });
}

function confirmarAccion(mensaje, opciones = {}) {
  const {
    titulo = 'Confirmar acción',
    textoConfirmar = 'Confirmar',
    textoCancelar = 'Cancelar',
    tipo = 'normal',
  } = opciones;

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const dialogo = document.createElement('div');
    dialogo.className = 'modal-dialogo';
    dialogo.setAttribute('role', 'alertdialog');
    dialogo.setAttribute('aria-modal', 'true');

    const h3 = document.createElement('h3');
    h3.textContent = titulo;

    const p = document.createElement('p');
    p.textContent = mensaje;

    const acciones = document.createElement('div');
    acciones.className = 'modal-acciones';

    const btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.className = 'secundario';
    btnCancelar.textContent = textoCancelar;

    const btnConfirmar = document.createElement('button');
    btnConfirmar.type = 'button';
    btnConfirmar.className = tipo === 'peligro' ? 'peligro' : '';
    btnConfirmar.textContent = textoConfirmar;

    acciones.appendChild(btnCancelar);
    acciones.appendChild(btnConfirmar);
    dialogo.appendChild(h3);
    dialogo.appendChild(p);
    dialogo.appendChild(acciones);
    overlay.appendChild(dialogo);
    document.body.appendChild(overlay);

    const cerrar = (valor) => {
      overlay.classList.remove('mostrar');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => overlay.remove(), 180);
      resolve(valor);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') cerrar(false);
      if (e.key === 'Enter') cerrar(true);
    };

    btnCancelar.addEventListener('click', () => cerrar(false));
    btnConfirmar.addEventListener('click', () => cerrar(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cerrar(false);
    });
    document.addEventListener('keydown', onKey);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.add('mostrar');
        btnConfirmar.focus();
      });
    });
  });
}
