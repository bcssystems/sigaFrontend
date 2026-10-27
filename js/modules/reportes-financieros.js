let state = { cuentas: [], movimientos: [], resumen: null };

export function init() {
  const hoy = new Date(); const fecha = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
  document.getElementById('repDesde').value = fecha; document.getElementById('repHasta').value = fecha;
  ['repDesde', 'repHasta', 'repCuenta', 'repTipo', 'repCategoria'].forEach(id => document.getElementById(id)?.addEventListener('change', cargar));
  document.getElementById('btnLimpiarReporte')?.addEventListener('click', () => { ['repDesde', 'repHasta', 'repCuenta', 'repTipo', 'repCategoria'].forEach(id => document.getElementById(id).value = ''); cargar(); });
  document.getElementById('btnPdfReporte')?.addEventListener('click', exportarPdf);
  document.getElementById('btnCsvReporte')?.addEventListener('click', exportarCsv);
  cargar();
}

function params() { const q = new URLSearchParams({ size: '1000' }); const desde = document.getElementById('repDesde').value, hasta = document.getElementById('repHasta').value; const cuenta = document.getElementById('repCuenta').value, tipo = document.getElementById('repTipo').value, cat = document.getElementById('repCategoria').value; if (desde) q.set('inicio', desde + 'T00:00:00'); if (hasta) q.set('fin', hasta + 'T23:59:59'); if (cuenta) q.set('idCuenta', cuenta); if (tipo) q.set('tipo', tipo); if (cat) q.set('categoria', cat); return q; }
async function cargar() { try { const query = params().toString(); const [resumen, cuentas, page] = await Promise.all([API.get('/finanzas/resumen?' + query), API.get('/finanzas/cuentas'), API.get('/finanzas/movimientos?' + query)]); state.resumen = resumen; state.cuentas = cuentas || []; state.movimientos = page.content || page || []; const sel = document.getElementById('repCuenta'), old = sel.value; sel.innerHTML = '<option value="">Todas</option>' + state.cuentas.map(c => `<option value="${c.idCuenta}">${Utils.esc(c.nombre)}</option>`).join(''); sel.value = old; render(); } catch (err) { Utils.showToast(err.message, 'error'); } }
function render() { const r = state.resumen || {}; const totales = document.getElementById('repTotalesBody'); totales.innerHTML = `<tr><th>Saldo total</th><td>${Utils.formatMonto(r.total || 0)}</td><th>Efectivo</th><td>${Utils.formatMonto(r.efectivo || 0)}</td></tr><tr><th>Bancos</th><td>${Utils.formatMonto(r.bancos || 0)}</td><th>Saldo a crédito</th><td>${Utils.formatMonto(r.creditoPendiente || 0)}</td></tr><tr><th>Ingresos</th><td class="text-success">${Utils.formatMonto(r.ingresos || 0)}</td><th>Egresos</th><td class="text-danger">${Utils.formatMonto(r.egresos || 0)}</td></tr><tr><th>Ventas cobradas</th><td>${Utils.formatMonto(r.ventas || 0)}</td><th>Abonos</th><td>${Utils.formatMonto(r.abonos || 0)}</td></tr><tr><th>Compras</th><td>${Utils.formatMonto(r.compras || 0)}</td><th>Gastos</th><td>${Utils.formatMonto(r.gastos || 0)}</td></tr>`; const body = document.getElementById('repMovimientosBody'); body.innerHTML = state.movimientos.length ? state.movimientos.map(m => `<tr><td>${Utils.formatDateTime(m.fecha)}</td><td>${Utils.esc(m.descripcion)}</td><td>${Utils.esc(m.categoria)}</td><td>${Utils.esc(m.cuenta)}</td><td><span class="badge-status ${m.tipo === 'INGRESO' ? 'badge-active' : 'badge-inactive'}">${m.tipo}</span></td><td class="text-end fw-semibold">${m.tipo === 'INGRESO' ? '+' : '-'}${Utils.formatMonto(m.monto || 0)}</td></tr>`).join('') : '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-file-invoice-dollar"></i><p>No hay movimientos</p></div></td></tr>'; }
function exportarCsv() { const rows = [['Fecha', 'Descripción', 'Categoría', 'Cuenta', 'Tipo', 'Monto'], ...state.movimientos.map(m => [m.fecha, m.descripcion, m.categoria, m.cuenta, m.tipo, m.monto])]; const csv = rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n'); const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'reporte-financiero.csv'; a.click(); URL.revokeObjectURL(a.href); }
async function exportarPdf() {
  if (!window.jspdf?.jsPDF) return Utils.showToast('No está disponible la herramienta de PDF', 'error');

  const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
  const margen = 10;
  const ancho = 190;
  const alto = 277;
  const r = state.resumen || {};
  const campo = id => document.getElementById(id);
  const textoFiltro = id => campo(id)?.selectedOptions?.[0]?.textContent?.trim() || 'Todos';
  const desde = campo('repDesde')?.value || 'Todos';
  const hasta = campo('repHasta')?.value || 'Todos';
  const filtros = [
    `Periodo: ${desde} al ${hasta}`,
    `Cuenta: ${textoFiltro('repCuenta')}`,
    `Tipo: ${textoFiltro('repTipo')}`,
    `Categoría: ${textoFiltro('repCategoria')}`
  ];
  const moneda = value => Utils.formatMonto(value || 0);
  let y = margen;

  function encabezado() {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('SIGA - Reporte financiero', margen, y);
    y += 8;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text('Filtros aplicados:', margen, y);
    y += 5;
    filtros.forEach(filtro => { pdf.text(filtro, margen, y); y += 4.5; });
    y += 3;
  }

  function nuevaPagina() {
    pdf.addPage();
    y = margen;
    encabezado();
  }

  function celda(texto, x, anchoCelda, altoCelda, alineacion = 'left') {
    const lineas = pdf.splitTextToSize(String(texto ?? ''), anchoCelda - 3);
    const visibles = lineas.slice(0, Math.max(1, Math.floor((altoCelda - 2) / 4)));
    pdf.text(visibles, alineacion === 'right' ? x + anchoCelda - 2 : x + 2, y + 4, { align: alineacion });
  }

  encabezado();
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Totales del reporte', margen, y);
  y += 4;
  const totalRows = [
    ['Saldo total', moneda(r.total), 'Efectivo', moneda(r.efectivo)],
    ['Bancos', moneda(r.bancos), 'Saldo a crédito', moneda(r.creditoPendiente)],
    ['Ingresos', moneda(r.ingresos), 'Egresos', moneda(r.egresos)],
    ['Ventas cobradas', moneda(r.ventas), 'Abonos', moneda(r.abonos)],
    ['Compras', moneda(r.compras), 'Gastos', moneda(r.gastos)]
  ];
  const totalWidths = [42, 53, 42, 53];
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  totalRows.forEach(row => {
    const altoFila = 6;
    let x = margen;
    row.forEach((valor, i) => {
      pdf.setDrawColor(190);
      pdf.rect(x, y, totalWidths[i], altoFila);
      pdf.setFont('helvetica', i % 2 === 0 ? 'bold' : 'normal');
      pdf.text(valor, x + 2, y + 4);
      x += totalWidths[i];
    });
    y += altoFila;
  });
  y += 7;

  const columnas = [
    { titulo: 'Fecha', ancho: 27 },
    { titulo: 'Descripción', ancho: 55 },
    { titulo: 'Categoría', ancho: 25 },
    { titulo: 'Cuenta', ancho: 35 },
    { titulo: 'Tipo', ancho: 20 },
    { titulo: 'Monto', ancho: 28 }
  ];
  function tablaEncabezado() {
    let x = margen;
    pdf.setFillColor(226, 232, 240);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    columnas.forEach(columna => {
      pdf.rect(x, y, columna.ancho, 8, 'FD');
      pdf.text(columna.titulo, x + 2, y + 5);
      x += columna.ancho;
    });
    y += 8;
    pdf.setFont('helvetica', 'normal');
  }
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Movimientos', margen, y);
  y += 4;
  tablaEncabezado();

  state.movimientos.forEach(movimiento => {
    const descripcion = String(movimiento.descripcion || '');
    const lineasDescripcion = pdf.splitTextToSize(descripcion, columnas[1].ancho - 3);
    const altoFila = Math.max(7, lineasDescripcion.length * 4 + 3);
    if (y + altoFila > alto) {
      nuevaPagina();
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text('Movimientos (continuación)', margen, y);
      y += 4;
      tablaEncabezado();
    }
    let x = margen;
    const valores = [
      Utils.formatDateTime(movimiento.fecha),
      descripcion,
      movimiento.categoria || '',
      movimiento.cuenta || '',
      movimiento.tipo || '',
      `${movimiento.tipo === 'INGRESO' ? '+' : '-'}${moneda(movimiento.monto)}`
    ];
    valores.forEach((valor, i) => {
      pdf.setDrawColor(210);
      pdf.rect(x, y, columnas[i].ancho, altoFila);
      celda(valor, x, columnas[i].ancho, altoFila, i === 5 ? 'right' : 'left');
      x += columnas[i].ancho;
    });
    y += altoFila;
  });

  const paginas = pdf.internal.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    pdf.setPage(pagina);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text(`Página ${pagina} de ${paginas}`, 200, 290, { align: 'right' });
    pdf.setTextColor(0);
  }
  pdf.save('reporte-financiero.pdf');
}
