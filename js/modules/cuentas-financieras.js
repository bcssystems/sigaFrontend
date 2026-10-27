let state = { cuentas: [], metodos: [], editId: null };

export function init() {
  if (!Utils.hasPermiso('CUENTAS_FINANCIERAS_EDITAR')) document.getElementById('btnNuevaCuenta')?.classList.add('d-none');
  document.getElementById('btnNuevaCuenta')?.addEventListener('click', () => abrirCuenta(null));
  document.getElementById('btnGuardarCuenta')?.addEventListener('click', guardarCuenta);
  document.getElementById('btnLimpiarCuentas')?.addEventListener('click', limpiar);
  document.getElementById('buscarCuenta')?.addEventListener('input', render);
  document.getElementById('filtroTipoCuenta')?.addEventListener('change', render);
  document.getElementById('filtroEstadoCuenta')?.addEventListener('change', render);
  document.getElementById('cuentasBody')?.addEventListener('click', manejarCuentas);
  cargar();
}

async function cargar() {
  try {
    [state.cuentas, state.metodos] = await Promise.all([API.get('/finanzas/cuentas'), API.get('/tipos-pago')]);
    render();
  } catch (err) { Utils.showToast(err.message, 'error'); }
}

function cuentasFiltradas() {
  const texto = (document.getElementById('buscarCuenta')?.value || '').toLowerCase();
  const tipo = document.getElementById('filtroTipoCuenta')?.value || '';
  const estado = document.getElementById('filtroEstadoCuenta')?.value || '';
  return state.cuentas.filter(c => (!texto || c.nombre.toLowerCase().includes(texto)) && (!tipo || c.tipo === tipo) && (!estado || String(c.activa) === estado));
}

function render() {
  const cuentas = cuentasFiltradas();
  const body = document.getElementById('cuentasBody');
  body.innerHTML = cuentas.length ? cuentas.map(c => {
    const asignados = state.metodos.filter(t => t.idCuentaFinanciera === c.idCuenta).map(t => Utils.esc(t.nombre)).join(', ') || '<span class="text-muted">Ninguno</span>';
    return `<tr><td><strong>${Utils.esc(c.nombre)}</strong></td><td>${Utils.esc(c.tipo)}</td><td class="text-end fw-semibold">${Utils.formatMonto(c.saldo || 0)}</td><td><span class="badge-status ${c.activa ? 'badge-active' : 'badge-inactive'}">${c.activa ? 'Activa' : 'Inactiva'}</span></td><td class="small">${asignados}</td><td class="acciones-cell"><button type="button" class="btn-kebab-toggle kebab-trigger" data-id="${c.idCuenta}"><i class="fas fa-ellipsis-v"></i></button></td></tr>`;
  }).join('') : '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-landmark"></i><p>Sin resultados</p></div></td></tr>';
}

function manejarCuentas(e) {
  const btn = e.target.closest('.kebab-trigger'); if (!btn) return;
  const id = Number(btn.dataset.id); const c = state.cuentas.find(x => x.idCuenta === id); if (!c) return;
  const items = [];
  if (Utils.hasPermiso('CUENTAS_FINANCIERAS_EDITAR')) items.push({ icon: 'fa-edit', text: 'Editar', onClick: () => abrirCuenta(c) });
  if (Utils.hasPermiso('CUENTAS_FINANCIERAS_EDITAR') && c.activa) items.push({ danger: true, icon: 'fa-ban', text: 'Desactivar', onClick: () => desactivar(c.idCuenta) });
  Utils.abrirMenuKebab(btn, items);
}

function abrirCuenta(cuenta) {
  state.editId = cuenta?.idCuenta || null;
  document.getElementById('tituloCuenta').textContent = state.editId ? 'Editar cuenta' : 'Nueva cuenta';
  document.getElementById('cuentaNombre').value = cuenta?.nombre || '';
  document.getElementById('cuentaTipo').value = cuenta?.tipo || 'BANCO';
  new bootstrap.Modal(document.getElementById('modalCuentaFinanciera')).show();
}

async function guardarCuenta() {
  const nombre = document.getElementById('cuentaNombre').value.trim(); if (!nombre) return Utils.showToast('El nombre es obligatorio', 'warning');
  const data = { nombre, tipo: document.getElementById('cuentaTipo').value };
  try { if (state.editId) await API.put('/finanzas/cuentas/' + state.editId, data); else await API.post('/finanzas/cuentas', data); bootstrap.Modal.getInstance(document.getElementById('modalCuentaFinanciera'))?.hide(); Utils.showToast('Cuenta guardada', 'success'); cargar(); } catch (err) { Utils.showToast(err.message, 'error'); }
}

async function desactivar(id) {
  if (!await Utils.confirmAction('¿Desactivar esta cuenta financiera?', 'Confirmar', 'Desactivar')) return;
  try { await API.del('/finanzas/cuentas/' + id); Utils.showToast('Cuenta desactivada', 'success'); cargar(); } catch (err) { Utils.showToast(err.message, 'error'); }
}

function limpiar() { document.getElementById('buscarCuenta').value = ''; document.getElementById('filtroTipoCuenta').value = ''; document.getElementById('filtroEstadoCuenta').value = ''; render(); }
