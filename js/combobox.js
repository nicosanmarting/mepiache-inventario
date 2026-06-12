/* ===========================
   Mepiache Inventario - Combobox de búsqueda
   ---------------------------------------------
   Convierte un <select> (con o sin <optgroup>) en un campo
   de texto con autocompletado/filtro, manteniendo el <select>
   original sincronizado (oculto) para que el resto del código
   (lectura de .value, listeners de 'change', etc.) siga
   funcionando sin cambios.

   Uso:
     initCombobox('mov-producto', { placeholder: 'Buscar sabor o código...' });

   Si las opciones del <select> se regeneran dinámicamente
   (ej. al cambiar de categoría), llamar después:
     refrescarCombobox('mov-producto');
   =========================== */

const _comboboxes = {};

function _cbEsc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _cbNormalizar(texto) {
  return (texto || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function initCombobox(selectId, opciones = {}) {
  const select = document.getElementById(selectId);
  if (!select || select.dataset.comboboxInit) return;
  select.dataset.comboboxInit = '1';

  const wrapper = document.createElement('div');
  wrapper.className = 'combobox-wrapper';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'combobox-input';
  input.placeholder = opciones.placeholder || 'Buscar...';
  input.autocomplete = 'off';
  if (select.required) input.required = true;

  const lista = document.createElement('div');
  lista.className = 'combobox-lista';
  lista.style.display = 'none';

  select.style.display = 'none';
  select.insertAdjacentElement('afterend', wrapper);
  wrapper.appendChild(input);
  wrapper.appendChild(lista);

  const estado = { select, input, lista, opcionesVisibles: [], activa: -1 };
  _comboboxes[selectId] = estado;

  function obtenerOpciones() {
    const items = [];
    Array.from(select.children).forEach(child => {
      if (child.tagName === 'OPTGROUP') {
        Array.from(child.children).forEach(opt => {
          items.push({ value: opt.value, label: opt.textContent, grupo: child.label });
        });
      } else if (child.tagName === 'OPTION') {
        items.push({ value: child.value, label: child.textContent, grupo: null });
      }
    });
    return items;
  }

  function sincronizarTexto() {
    const seleccionada = select.options[select.selectedIndex];
    input.value = seleccionada ? seleccionada.textContent : '';
  }

  function cerrar() {
    lista.style.display = 'none';
    estado.activa = -1;
  }

  function render(filtro) {
    const norm = _cbNormalizar(filtro);
    const items = obtenerOpciones().filter(it =>
      !norm || _cbNormalizar(it.label).includes(norm) || _cbNormalizar(it.value).includes(norm)
    );

    estado.opcionesVisibles = items;
    estado.activa = -1;

    if (items.length === 0) {
      lista.innerHTML = `<div class="combobox-vacio">Sin resultados.</div>`;
      lista.style.display = 'block';
      return;
    }

    let html = '';
    let grupoActual;
    items.forEach((it, i) => {
      if (it.grupo !== grupoActual) {
        html += `<div class="combobox-grupo">${_cbEsc(it.grupo)}</div>`;
        grupoActual = it.grupo;
      }
      html += `<div class="combobox-opcion" data-index="${i}">${_cbEsc(it.label)}</div>`;
    });
    lista.innerHTML = html;
    lista.style.display = 'block';

    lista.querySelectorAll('.combobox-opcion').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        seleccionar(items[Number(el.dataset.index)]);
      });
    });
  }

  function seleccionar(item) {
    if (!item) return;
    select.value = item.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    input.value = item.label;
    cerrar();
  }

  function resaltar() {
    lista.querySelectorAll('.combobox-opcion').forEach((el, i) => {
      el.classList.toggle('activa', i === estado.activa);
      if (i === estado.activa) el.scrollIntoView({ block: 'nearest' });
    });
  }

  input.addEventListener('focus', () => {
    input.select();
    render('');
  });

  input.addEventListener('input', () => render(input.value));

  input.addEventListener('keydown', (e) => {
    if (lista.style.display === 'none' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      render(input.value);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      estado.activa = Math.min(estado.activa + 1, estado.opcionesVisibles.length - 1);
      resaltar();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      estado.activa = Math.max(estado.activa - 1, 0);
      resaltar();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (estado.activa >= 0) {
        seleccionar(estado.opcionesVisibles[estado.activa]);
      } else if (estado.opcionesVisibles.length === 1) {
        seleccionar(estado.opcionesVisibles[0]);
      }
    } else if (e.key === 'Escape') {
      sincronizarTexto();
      cerrar();
      input.blur();
    }
  });

  input.addEventListener('blur', () => {
    // Pequeño delay para permitir que el mousedown en una opción se procese primero.
    setTimeout(() => {
      sincronizarTexto();
      cerrar();
    }, 120);
  });

  sincronizarTexto();
}

// Llamar después de regenerar las <option> de un <select> con combobox
// (ej. al cambiar de categoría), para que el texto mostrado refleje
// la selección actual.
function refrescarCombobox(selectId) {
  const estado = _comboboxes[selectId];
  if (!estado) return;
  const seleccionada = estado.select.options[estado.select.selectedIndex];
  estado.input.value = seleccionada ? seleccionada.textContent : '';
}
