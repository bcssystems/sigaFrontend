let cuentas = [];
let movimientos = [];
let resumenActual = null;

export function init() {
  ['finFiltroCuenta', 'finFiltroTipo', 'finFiltroCategoria', 'finFiltroDesde', 'finFiltroHasta'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', cargar);
  });
  document.getElementById('btnLimpiarFinanzas')?.addEventListener('click', limpiarFiltros);
  document.getElementById('btnVerGraficas')?.addEventListener('click', abrirGraficas);
  document.querySelectorAll('.fin-breakdown-card').forEach(card => {
    card.addEventListener('click', () => mostrarDesglose(card.dataset.breakdown));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mostrarDesglose(card.dataset.breakdown); } });
  });
  const hoy = new Date();
  const fechaHoy = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
  document.getElementById('finFiltroDesde').value = fechaHoy;
  document.getElementById('finFiltroHasta').value = fechaHoy;
  cargar();
}

async function cargar() {
  try {
    const filtros = parametrosFiltros();
    const [resumen, lista] = await Promise.all([API.get('/finanzas/resumen' + (filtros.toString() ? '?' + filtros : '')), API.get('/finanzas/cuentas')]);
    resumenActual = resumen;
    cuentas = lista || resumen.cuentas || [];
    document.getElementById('finTotal').textContent = Utils.formatMonto(resumen.total || 0);
    document.getElementById('finEfectivo').textContent = Utils.formatMonto(resumen.efectivo || 0);
    document.getElementById('finBancos').textContent = Utils.formatMonto(resumen.bancos || 0);
    document.getElementById('finFlujo').textContent = Utils.formatMonto(resumen.creditoPendiente || 0);
    renderCuentaFiltro();
    cargarMovimientos();
  } catch (err) { Utils.showToast(err.message, 'error'); }
}

function renderCuentaFiltro() {
  const filtro = document.getElementById('finFiltroCuenta');
  const seleccionado = filtro?.value || '';
  if (filtro) filtro.innerHTML = '<option value="">Todas</option>' + cuentas.map(c => `<option value="${c.idCuenta}">${Utils.esc(c.nombre)}</option>`).join('');
  if (filtro && cuentas.some(c => String(c.idCuenta) === seleccionado)) filtro.value = seleccionado;
}

async function cargarMovimientos() {
  const q = parametrosFiltros();
  q.set('size', '100');
  try { const page = await API.get('/finanzas/movimientos?' + q); movimientos = page.content || page || []; renderMovimientos(movimientos); } catch (err) { Utils.showToast(err.message, 'error'); }
}

function renderMovimientos(items) {
  const body = document.getElementById('finMovimientosBody'); if (!body) return;
  body.innerHTML = items.length ? items.map(m => `<tr><td>${Utils.formatDateTime(m.fecha)}</td><td>${Utils.esc(m.descripcion)}</td><td>${Utils.esc(m.categoria)}</td><td>${Utils.esc(m.cuenta)}</td><td>${Utils.esc(m.tipoPago || '-')}</td><td><span class="badge-status ${m.tipo === 'INGRESO' ? 'badge-active' : 'badge-inactive'}">${m.tipo}</span></td><td class="text-end fw-semibold ${m.tipo === 'INGRESO' ? 'text-success' : 'text-danger'}">${m.tipo === 'INGRESO' ? '+' : '-'}${Utils.formatMonto(m.monto || 0)}</td></tr>`).join('') : '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-coins"></i><p>No hay movimientos</p></div></td></tr>';
}

function limpiarFiltros() {
  ['finFiltroCuenta', 'finFiltroTipo', 'finFiltroCategoria', 'finFiltroDesde', 'finFiltroHasta'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  cargar();
}

function parametrosFecha() {
  const q = new URLSearchParams();
  const desde = document.getElementById('finFiltroDesde')?.value;
  const hasta = document.getElementById('finFiltroHasta')?.value;
  if (desde) q.set('inicio', desde + 'T00:00:00');
  if (hasta) q.set('fin', hasta + 'T23:59:59');
  return q.toString();
}

function parametrosFiltros() {
  const q = new URLSearchParams(parametrosFecha());
  const cuenta = document.getElementById('finFiltroCuenta')?.value;
  const tipo = document.getElementById('finFiltroTipo')?.value;
  const categoria = document.getElementById('finFiltroCategoria')?.value;
  if (cuenta) q.set('idCuenta', cuenta);
  if (tipo) q.set('tipo', tipo);
  if (categoria) q.set('categoria', categoria);
  return q;
}

function mostrarDesglose(tipo) {
  if (!resumenActual) return;
  const titulo = document.getElementById('desgloseFinanzasTitulo');
  const subtitulo = document.getElementById('desgloseFinanzasSubtitulo');
  const body = document.getElementById('desgloseFinanzasBody');
  const cuentasFiltradas = tipo === 'efectivo' ? cuentas.filter(c => c.tipo === 'EFECTIVO') : tipo === 'bancos' ? cuentas.filter(c => c.tipo === 'BANCO') : cuentas;
  const fecha = document.getElementById('finFiltroDesde')?.value && document.getElementById('finFiltroHasta')?.value ? `Periodo: ${document.getElementById('finFiltroDesde').value} al ${document.getElementById('finFiltroHasta').value}` : 'Todos los periodos';
  subtitulo.textContent = fecha;
  if (tipo === 'flujo') {
    titulo.textContent = 'Desglose del saldo a crédito';
    body.innerHTML = `<div class="panel-card p-3 mb-3 text-center"><div class="text-muted small">Total pendiente de cobro</div><div class="fs-2 fw-bold" style="color:var(--primary)">${Utils.formatMonto(resumenActual.creditoPendiente || 0)}</div></div><div class="alert alert-info small"><i class="fas fa-info-circle me-1"></i>Este importe corresponde al saldo pendiente de las ventas realizadas a crédito.</div>`;
  } else {
    titulo.textContent = tipo === 'efectivo' ? 'Desglose de efectivo' : tipo === 'bancos' ? 'Desglose de bancos' : 'Desglose del saldo total';
    body.innerHTML = cuentasFiltradas.length ? `<div class="table-responsive"><table class="table table-custom mb-0"><thead><tr><th>Cuenta</th><th>Tipo</th><th>Estado</th><th class="text-end">Saldo</th></tr></thead><tbody>${cuentasFiltradas.map(c => `<tr><td><strong>${Utils.esc(c.nombre)}</strong></td><td>${Utils.esc(c.tipo)}</td><td><span class="badge-status ${c.activa ? 'badge-active' : 'badge-inactive'}">${c.activa ? 'Activa' : 'Inactiva'}</span></td><td class="text-end fw-semibold">${Utils.formatMonto(c.saldo || 0)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><i class="fas fa-wallet"></i><p>No hay cuentas para mostrar</p></div>';
  }
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalDesgloseFinanzas')).show();
}

async function abrirGraficas() {
  const modalEl = document.getElementById('modalGraficasFinanzas');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
  try {
    const q = new URLSearchParams({ size: '1000' });
    const cuenta = document.getElementById('finFiltroCuenta')?.value;
    const tipo = document.getElementById('finFiltroTipo')?.value;
    const categoria = document.getElementById('finFiltroCategoria')?.value;
    if (cuenta) q.set('idCuenta', cuenta); if (tipo) q.set('tipo', tipo); if (categoria) q.set('categoria', categoria);
    const rango = parametrosFecha();
    if (rango) new URLSearchParams(rango).forEach((value, key) => q.set(key, value));
    const page = await API.get('/finanzas/movimientos?' + q);
    movimientos = page.content || page || [];
    dibujarGraficas();
  } catch (err) { Utils.showToast(err.message, 'error'); }
}

function dibujarGraficas() {
  const sinDatos = document.getElementById('graficasSinDatos');
  if (!movimientos.length) { sinDatos.textContent = 'No hay movimientos en el periodo seleccionado.'; }
  else sinDatos.textContent = movimientos.length === 1000 ? 'Se muestran los primeros 1,000 movimientos del periodo.' : '';
  dibujarPie('graficaCuentas', agrupar(movimientos, 'cuenta'), ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']);
  dibujarBarras('graficaCategorias', categorias(movimientos));
  dibujarLinea('graficaEvolucion', evolucion(movimientos));
}

function agrupar(items, campo) { const out = {}; items.forEach(m => { const key = m[campo] || 'Sin asignar'; out[key] = (out[key] || 0) + (m.monto || 0); }); return Object.entries(out).map(([label, value]) => ({ label, value })); }
function categorias(items) { const labels = ['VENTA', 'ABONO', 'COMPRA', 'GASTO', 'CANCELACION']; return labels.map(label => ({ label, ingreso: items.filter(m => m.categoria === label && m.tipo === 'INGRESO').reduce((s, m) => s + (m.monto || 0), 0), egreso: items.filter(m => m.categoria === label && m.tipo === 'EGRESO').reduce((s, m) => s + (m.monto || 0), 0) })); }
function evolucion(items) { const out = {}; items.forEach(m => { const key = (m.fecha || '').slice(0, 10) || 'Sin fecha'; if (!out[key]) out[key] = { label: key, ingreso: 0, egreso: 0 }; out[key][m.tipo === 'INGRESO' ? 'ingreso' : 'egreso'] += m.monto || 0; }); return Object.values(out).sort((a, b) => a.label.localeCompare(b.label)); }

function canvas(id) { const c = document.getElementById(id); if (!c) return null; const dpr = window.devicePixelRatio || 1; const w = c.parentElement.clientWidth || 500; const h = 250; c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px'; const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h); return { ctx, w, h }; }
function dinero(v) { return '$' + Number(v || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 }); }
let pieSegments = [];

function dibujarEjeY(ctx, max, left, top, bottom, h) {
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.strokeStyle = '#e2e8f0';
  for (let i = 0; i <= 4; i++) {
    const value = max * i / 4;
    const y = h - bottom - (h - bottom - top) * i / 4;
    ctx.fillText(dinero(value), left - 7, y + 3);
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(ctx.canvas.width, y); ctx.stroke();
  }
}

function dibujarPie(id, data, colors) {
  const x = canvas(id); if (!x) return;
  const { ctx, w, h } = x;
  const total = data.reduce((s, d) => s + d.value, 0);
  pieSegments = [];
  if (!total) { ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center'; ctx.fillText('Sin datos', w / 2, h / 2); return; }
  let start = -Math.PI / 2; const r = Math.min(82, h / 2 - 12); const cx = w * .28; const cy = h / 2;
  data.forEach((d, i) => {
    const angle = d.value / total * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, start + angle); ctx.closePath();
    ctx.fillStyle = colors[i % colors.length]; ctx.fill();
    pieSegments.push({ start, end: start + angle, data: d, color: colors[i % colors.length], cx, cy, r });
    start += angle;
  });
  ctx.font = '12px Inter, sans-serif';
  data.forEach((d, i) => { const y = 28 + i * 24; ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(w * .55, y - 9, 10, 10); ctx.fillStyle = '#334155'; ctx.textAlign = 'left'; ctx.fillText(d.label + ' ' + dinero(d.value), w * .55 + 16, y); });
  const c = document.getElementById(id);
  c.style.cursor = 'pointer';
  c.onclick = event => {
    const rect = c.getBoundingClientRect(); const px = event.clientX - rect.left; const py = event.clientY - rect.top;
    const distance = Math.hypot(px - cx, py - cy); if (distance > r) return;
    let angle = Math.atan2(py - cy, px - cx); if (angle < -Math.PI / 2) angle += Math.PI * 2;
    const segment = pieSegments.find(s => angle >= s.start && angle <= s.end);
    if (segment) Utils.showToast(segment.data.label + ': ' + dinero(segment.data.value), 'info');
  };
}

function dibujarBarras(id, data) {
  const x = canvas(id); if (!x) return;
  const { ctx, w, h } = x; const left = 70, bottom = 32, top = 12, usable = h - bottom - top;
  const max = Math.max(...data.map(d => Math.max(d.ingreso, d.egreso)), 1); const bw = Math.max(12, (w - left - 12) / data.length / 2.8);
  dibujarEjeY(ctx, max, left, top, bottom, h);
  data.forEach((d, i) => { const center = left + (i + .5) * (w - left - 12) / data.length; [{ v: d.ingreso, color: '#10b981' }, { v: d.egreso, color: '#ef4444' }].forEach((v, j) => { const bh = v.v / max * usable; ctx.fillStyle = v.color; ctx.fillRect(center + (j - .5) * bw, h - bottom - bh, bw - 3, bh); }); ctx.fillStyle = '#64748b'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(d.label).slice(0, 12), center, h - 12); });
  ctx.strokeStyle = '#cbd5e1'; ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, h - bottom); ctx.lineTo(w - 8, h - bottom); ctx.stroke();
}

function dibujarLinea(id, data) {
  const x = canvas(id); if (!x) return;
  const { ctx, w, h } = x; const left = 70, bottom = 32, top = 12, usableW = w - left - 12, usableH = h - bottom - top;
  const max = Math.max(...data.map(d => Math.max(d.ingreso, d.egreso)), 1); dibujarEjeY(ctx, max, left, top, bottom, h);
  [['ingreso', '#10b981'], ['egreso', '#ef4444']].forEach(([key, color]) => { ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2; ctx.beginPath(); data.forEach((d, i) => { const px = left + (data.length === 1 ? usableW / 2 : i * usableW / (data.length - 1)); const py = h - bottom - d[key] / max * usableH; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }); ctx.stroke(); data.forEach((d, i) => { const px = left + (data.length === 1 ? usableW / 2 : i * usableW / (data.length - 1)); const py = h - bottom - d[key] / max * usableH; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); }); });
  ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = '#64748b'; ctx.textAlign = 'center'; data.forEach((d, i) => { if (i % Math.max(1, Math.ceil(data.length / 6)) === 0) ctx.fillText(d.label.slice(5), left + (data.length === 1 ? usableW / 2 : i * usableW / (data.length - 1)), h - 12); });
}
