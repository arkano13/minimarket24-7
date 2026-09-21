/**
 * Plantilla del "Informe de turno" — Minimarket 24/7 (v2, unificado)
 * -------------------------------------------------------------------
 * Reemplaza los reportes "administrativo" y "ejecutivo" por uno solo.
 * Genera el HTML completo (con CSS embebido) del informe aprobado:
 *   1. KPIs (Total vendido, Cuadre total y Efectivo esperado)
 *   2. Ventas del turno (cobros + total vendido) + Cuadre total (todo el dinero)
 *   3. Cuadre real de caja (faltante/sobrante de los cierres ya hechos)
 *   4. Actividad por hora (barras horizontales) + Destacados
 *   5. Desglose de movimientos: Entradas, Salidas, Compras, Créditos, Inventario
 *   6. Todas las ventas agrupadas por producto
 *   7. Resumen del turno
 *
 * No depende de ningún motor de PDF: solo devuelve un string de HTML.
 *
 * Cómo convertirlo a PDF (elige el que ya tengas disponible):
 *
 *   A) Electron (BrowserWindow oculto, ya que el POS es Electron):
 *        const win = new BrowserWindow({ show: false });
 *        await win.loadURL('data:text/html,' + encodeURIComponent(html));
 *        const pdfBuffer = await win.webContents.printToPDF({
 *          pageSize: 'Letter',
 *          printBackground: true,
 *          margins: { marginType: 'none' } // los márgenes ya están en @page
 *        });
 *        win.close();
 *
 *   B) Puppeteer (si el backend Express genera el PDF en el servidor):
 *        const browser = await puppeteer.launch();
 *        const page = await browser.newPage();
 *        await page.setContent(html, { waitUntil: 'networkidle0' });
 *        const pdfBuffer = await page.pdf({
 *          format: 'Letter',
 *          printBackground: true,
 *          margin: { top: '14mm', right: '13mm', bottom: '16mm', left: '13mm' }
 *        });
 *        await browser.close();
 *
 * IMPORTANTE — fuente Inter vía Google Fonts:
 *   El CSS trae `@import url(fonts.googleapis.com/...)`. Si el equipo
 *   donde corre el POS no tiene internet en el momento de generar el
 *   PDF, la fuente no cargará y caerá al fallback (system-ui). Si
 *   quieres que se vea igual siempre, baja los .woff2 de Inter y
 *   empaquétalos con la app (@font-face local) en vez de depender de
 *   Google Fonts.
 *
 * IMPORTANTE — reglas de negocio:
 *   Cuadre total = Efectivo + Tarjeta + Transferencia + Entradas − Salidas (todo el dinero).
 *   Total vendido = solo ventas. Efectivo esperado (gaveta) = fondo inicial + efectivo por ventas
 *   + entradas en efectivo − salidas (lo calcula el backend).
 *   Regla histórica del Cierre: Efectivo esperado = Efectivo por ventas + Entradas de caja − Salidas de caja.
 *   Las compras a proveedores NO se restan aquí porque normalmente no
 *   salen de la caja del turno. Si alguna vez una compra sí se paga
 *   desde la caja, regístrala como un ítem más dentro de `salidas`,
 *   no en `compras` — así el cálculo del cierre sigue siendo correcto
 *   sin tocar esta plantilla.
 *
 * IMPORTANTE — Cierre (estimado) vs Cuadre real de caja:
 *   El panel "Cierre" es un cálculo teórico a partir de ventas y
 *   movimientos del periodo — no requiere que nadie haya cerrado la
 *   caja. "Cuadre real de caja" es distinto: son los cierres que
 *   efectivamente ocurrieron (con conteo de efectivo del cajero), con
 *   su faltante/sobrante ya calculado por el módulo de caja al
 *   momento del cierre. Si no hubo ningún cierre en el periodo/turno
 *   consultado, esta sección simplemente no se imprime (mismo criterio
 *   que Créditos e Inventario cuando no tienen datos).
 *
 * Uso:
 *   import { generarInformeTurnoHTML } from './informe-turno.template.js';
 *   const html = generarInformeTurnoHTML(datos); // ver forma de "datos" abajo
 */

// ---------- Helpers de formato ----------

function formatMoney(valor) {
  const n = Number(valor) || 0;
  const signo = n < 0 ? '\u2212 ' : '';
  const abs = Math.abs(n).toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${signo}L ${abs}`;
}

function formatCantidad(valor) {
  const n = Number(valor) || 0;
  return Number.isInteger(n)
    ? n.toLocaleString('es-HN')
    : n.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function sum(items, campo) {
  return (items || []).reduce((acc, it) => acc + (Number(it[campo]) || 0), 0);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------- Bloques reutilizables ----------

function renderKpiCard(kpi) {
  const claseExtra = kpi.tipo === 'dinero' ? 'is-money' : kpi.tipo === 'margen' ? 'is-margin' : '';
  const valor = kpi.tipo === 'dinero' ? formatMoney(kpi.valor)
    : kpi.tipo === 'margen' ? `${Number(kpi.valor).toFixed(2)}%`
    : formatCantidad(kpi.valor);
  return `
    <div class="kpi-card ${claseExtra}">
      <div class="kpi-label">${escapeHtml(kpi.etiqueta)}</div>
      <div class="kpi-value">${valor}</div>
    </div>`;
}

function renderHighlightCard(h) {
  return `
    <div class="highlight-card">
      <div class="highlight-label">${escapeHtml(h.etiqueta)}</div>
      <div class="highlight-name">${escapeHtml(h.nombre)}</div>
      <div class="highlight-value">${escapeHtml(h.valor)}</div>
    </div>`;
}

function renderCobroRow(c) {
  const claseBarra = c.dorado ? 'pay-bar-fill gold' : 'pay-bar-fill';
  const opsTexto = c.operaciones === 1 ? 'operaci\u00f3n' : 'operaciones';
  return `
    <div class="pay-row">
      <div class="pay-top"><span class="pay-name">${escapeHtml(c.nombre)}</span><span class="pay-amount">${formatMoney(c.monto)}</span></div>
      <div class="pay-bar-track"><div class="${claseBarra}" style="width:${c.porcentaje}%;"></div></div>
      <div class="pay-meta">${c.porcentaje}% del total &middot; ${c.operaciones} ${opsTexto}</div>
    </div>`;
}

/**
 * Cierre = Efectivo por ventas + Entradas de caja − Salidas de caja.
 * Las compras NO entran aquí (ver nota de negocio arriba).
 */
function renderCierre(cierre) {
  const efectivoVentas = Number(cierre.efectivoVentas) || 0;
  const totalEntradas = Number(cierre.totalEntradas) || 0;
  const totalSalidas = Number(cierre.totalSalidas) || 0;
  const efectivoEsperado = efectivoVentas + totalEntradas - totalSalidas;

  return `
    <div class="panel">
      <div class="section-title" style="margin-bottom:2px;">Cierre</div>
      <div class="cierre-row">
        <span class="cierre-label">Efectivo por ventas</span>
        <span class="cierre-value">${formatMoney(efectivoVentas)}</span>
      </div>
      <div class="cierre-divider"></div>
      <div class="cierre-row">
        <span class="cierre-label">+ Entradas de caja</span>
        <span class="cierre-value">${formatMoney(totalEntradas)}</span>
      </div>
      <div class="cierre-row">
        <span class="cierre-label">&minus; Salidas de caja</span>
        <span class="cierre-value neg">&minus; ${formatMoney(totalSalidas)}</span>
      </div>
      <div class="cierre-total">
        <span class="cierre-total-label">Efectivo esperado</span>
        <span class="cierre-total-value">${formatMoney(efectivoEsperado)}</span>
      </div>
      <div class="footnote" style="margin-top:8px;">Estimación a partir de ventas y movimientos — no incluye fondo inicial ni requiere que se haya cerrado la caja.</div>
    </div>`;
}

/**
 * Ventas del turno: distribución de cobros + Total vendido.
 * El total vendido cuenta SOLO ventas (no entradas ni salidas de caja).
 */
function renderVentasPanel(cobros, resumen) {
  return `
    <div class="panel">
      <div class="section-title" style="margin-bottom:10px;">Ventas del turno</div>
      ${cobros.map(renderCobroRow).join('')}
      <div class="cierre-total" style="margin-top:12px;">
        <span class="cierre-total-label">Total vendido &middot; ${formatCantidad(resumen.operaciones)} ${Number(resumen.operaciones) === 1 ? 'venta' : 'ventas'}</span>
        <span class="cierre-total-value">${formatMoney(resumen.totalVendido)}</span>
      </div>
      <div class="footnote" style="margin-top:8px;">Solo cuenta ventas. No incluye entradas ni salidas de caja.</div>
    </div>`;
}

/**
 * Cuadre total = todo el dinero del turno:
 *   Efectivo + Tarjeta + Transferencia + Entradas de caja − Salidas de caja.
 * Es el total que se compara con el libro de la caja. No incluye el fondo
 * inicial (no es dinero vendido) ni las ventas a crédito (no se cobraron).
 * Debajo se muestra el efectivo esperado en gaveta (mismo cálculo del cierre).
 */
function renderCuadreTotal(ct) {
  const efectivo = Number(ct.efectivoVentas) || 0;
  const tarjeta = Number(ct.tarjeta) || 0;
  const transferencia = Number(ct.transferencia) || 0;
  const entradas = Number(ct.totalEntradas) || 0;
  const salidas = Number(ct.totalSalidas) || 0;
  const fondo = Number(ct.fondoInicial) || 0;
  const total = efectivo + tarjeta + transferencia + entradas - salidas;
  const efectivoEsperado = ct.efectivoEsperado === undefined || ct.efectivoEsperado === null
    ? fondo + efectivo + entradas - salidas
    : Number(ct.efectivoEsperado) || 0;

  const filaFondo = fondo > 0
    ? `<div class="cierre-row"><span class="cierre-label">Fondo inicial (incluido en la gaveta)</span><span class="cierre-value">${formatMoney(fondo)}</span></div>`
    : '';

  return `
    <div class="panel">
      <div class="section-title" style="margin-bottom:2px;">Cuadre total</div>
      <div class="cierre-row"><span class="cierre-label">Efectivo por ventas</span><span class="cierre-value">${formatMoney(efectivo)}</span></div>
      <div class="cierre-row"><span class="cierre-label">+ Tarjeta</span><span class="cierre-value">${formatMoney(tarjeta)}</span></div>
      <div class="cierre-row"><span class="cierre-label">+ Transferencia</span><span class="cierre-value">${formatMoney(transferencia)}</span></div>
      <div class="cierre-divider"></div>
      <div class="cierre-row"><span class="cierre-label">+ Entradas de caja</span><span class="cierre-value">${formatMoney(entradas)}</span></div>
      <div class="cierre-row"><span class="cierre-label">&minus; Salidas de caja</span><span class="cierre-value neg">&minus; ${formatMoney(salidas)}</span></div>
      <div class="cierre-total">
        <span class="cierre-total-label">Cuadre total</span>
        <span class="cierre-total-value">${formatMoney(total)}</span>
      </div>
      <div class="cierre-divider" style="margin-top:8px;"></div>
      ${filaFondo}
      <div class="cierre-row"><span class="cierre-label">Efectivo esperado en gaveta</span><span class="cierre-value">${formatMoney(efectivoEsperado)}</span></div>
      <div class="cierre-row"><span class="cierre-label">Tarjeta + transferencia</span><span class="cierre-value">${formatMoney(tarjeta + transferencia)}</span></div>
      <div class="footnote" style="margin-top:6px;">Cuadre total = efectivo + tarjeta + transferencia + entradas &minus; salidas. No incluye el fondo inicial ni las ventas a cr&eacute;dito.</div>
    </div>`;
}

/** Devuelve también el efectivo esperado ya calculado, por si el caller lo
 * quiere reusar como KPI sin tener que reescribir la fórmula aparte. */
function calcularEfectivoEsperado(cierre) {
  return (Number(cierre.efectivoVentas) || 0)
    + (Number(cierre.totalEntradas) || 0)
    - (Number(cierre.totalSalidas) || 0);
}

/**
 * Cuadre REAL de caja: a diferencia de "Cierre" (estimado), esto son
 * cierres que efectivamente ocurrieron, con el conteo de efectivo del
 * cajero y la diferencia (faltante/sobrante) ya calculada por el
 * módulo de caja. Si no hay cierres en el periodo, no se imprime nada
 * — mismo criterio que Créditos e Inventario.
 */
function renderCuadreCaja(cuadreCaja) {
  if (!cuadreCaja || !cuadreCaja.items || cuadreCaja.items.length === 0) return '';

  const totalDiferencia = sum(cuadreCaja.items, 'diferencia');
  const colorTotal = totalDiferencia < 0 ? 'var(--danger)' : totalDiferencia > 0 ? 'var(--primary-dark)' : 'var(--muted)';

  const filasHtml = cuadreCaja.items.map(it => {
    const diferencia = Number(it.diferencia) || 0;
    const esFaltante = diferencia < 0;
    const esSobrante = diferencia > 0;
    const clase = esFaltante ? 'type-retiro' : esSobrante ? 'type-ingreso' : '';
    const etiqueta = esFaltante ? 'Faltante' : esSobrante ? 'Sobrante' : 'Exacto';

    return `
        <tr>
          <td>${escapeHtml(it.hora)}</td>
          <td class="product-name">${escapeHtml(it.cajero)}</td>
          <td class="num">${formatMoney(it.fondoInicial)}</td>
          <td class="num">${formatMoney(it.esperado)}</td>
          <td class="num">${formatMoney(it.contado)}</td>
          <td class="num ${clase}">${etiqueta} &middot; ${formatMoney(diferencia)}</td>
        </tr>`;
  }).join('');

  return `
  <div class="panel-title-row">
    <div class="section-title" style="border:none; padding:0; margin-bottom:8px;">Cuadre real de caja</div>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Cierre</th>
          <th>Cajero</th>
          <th class="num">Fondo inicial</th>
          <th class="num">Esperado</th>
          <th class="num">Contado</th>
          <th class="num">Diferencia</th>
        </tr>
      </thead>
      <tbody>${filasHtml}</tbody>
    </table>
  </div>
  <div class="footnote" style="margin:-10px 0 16px 0;">
    ${cuadreCaja.items.length} ${cuadreCaja.items.length === 1 ? 'cierre' : 'cierres'} en este periodo &middot;
    diferencia total: <strong style="color:${colorTotal};">${formatMoney(totalDiferencia)}</strong>
  </div>`;
}

function renderHourList(horas, notaHoras) {
  if (!horas || horas.length === 0) return '';
  const max = Math.max(...horas.map(h => Number(h.valor) || 0), 1);
  const filas = horas.map(h => {
    const valor = Number(h.valor) || 0;
    const pct = Math.max(Math.round((valor / max) * 100), 2);
    return `
        <div class="hour-row">
          <div class="hour-row-label">${escapeHtml(h.etiqueta)}</div>
          <div class="hour-row-track"><div class="hour-row-fill" style="width:${pct}%;"></div></div>
          <div class="hour-row-value">${formatMoney(valor)}</div>
        </div>`;
  }).join('');

  return `
    <div class="panel">
      <div class="section-title" style="margin-bottom:2px;">Actividad por hora</div>
      <div class="panel-subtitle">Horas con mayor movimiento</div>
      <div class="hour-list">${filas}
      </div>
      ${notaHoras ? `<div class="footnote" style="margin-top:10px;">${escapeHtml(notaHoras)}</div>` : ''}
    </div>`;
}

function renderDesgloseTable({ titulo, esEjemplo, etiquetaEjemplo, columnas, filas, totalLabel, totalValor }) {
  const thead = columnas.map(c => `<th${c.num ? ' class="num"' : ''}>${escapeHtml(c.header)}</th>`).join('');
  const filasHtml = filas.map(fila => `
        <tr>${columnas.map(c => `<td${c.num ? ` class="num${c.claseExtra ? ' ' + c.claseExtra(fila) : ''}"` : (c.claseExtra ? ` class="${c.claseExtra(fila)}"` : '')}>${c.render(fila)}</td>`).join('')}</tr>`).join('');

  const totalRow = (totalLabel && totalValor !== undefined) ? `
        <tr class="total-row">
          <td colspan="${columnas.length - 1}">${escapeHtml(totalLabel)}</td>
          <td class="num">${totalValor}</td>
        </tr>` : '';

  return `
  <div class="panel-title-row">
    <div class="section-title" style="border:none; padding:0; margin-bottom:8px;">
      ${escapeHtml(titulo)} ${esEjemplo ? `<span class="badge-example">${escapeHtml(etiquetaEjemplo || 'Ejemplo')}</span>` : ''}
    </div>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr>${thead}</tr></thead>
      <tbody>${filasHtml}${totalRow}</tbody>
    </table>
  </div>`;
}

function renderEntradas(entradas) {
  if (!entradas || !entradas.items || entradas.items.length === 0) return '';
  const total = sum(entradas.items, 'monto');
  return renderDesgloseTable({
    titulo: 'Entradas de caja',
    esEjemplo: entradas.esEjemplo,
    columnas: [
      { header: 'Hora', render: r => escapeHtml(r.hora) },
      { header: 'Motivo', render: r => escapeHtml(r.motivo) },
      { header: 'Monto', num: true, claseExtra: () => 'amount-in', render: r => `+ ${formatMoney(r.monto)}` },
    ],
    filas: entradas.items,
    totalLabel: 'Total entradas',
    totalValor: formatMoney(total),
  });
}

function renderSalidas(salidas) {
  if (!salidas || !salidas.items || salidas.items.length === 0) return '';
  const total = sum(salidas.items, 'monto');
  return renderDesgloseTable({
    titulo: 'Salidas de caja',
    esEjemplo: salidas.esEjemplo,
    columnas: [
      { header: 'Hora', render: r => escapeHtml(r.hora) },
      { header: 'Motivo', render: r => escapeHtml(r.motivo) },
      { header: 'Monto', num: true, claseExtra: () => 'amount-out', render: r => `&minus; ${formatMoney(Math.abs(r.monto))}` },
    ],
    filas: salidas.items,
    totalLabel: 'Total salidas',
    totalValor: `<span style="color:var(--danger);">&minus; ${formatMoney(total)}</span>`,
  });
}

function renderCompras(compras) {
  if (!compras || !compras.items || compras.items.length === 0) return '';
  const total = sum(compras.items, 'total');
  return renderDesgloseTable({
    titulo: 'Compras a proveedores',
    esEjemplo: compras.esEjemplo,
    columnas: [
      { header: 'Proveedor', render: r => `<span class="product-name">${escapeHtml(r.proveedor)}</span>` },
      { header: 'Hora', render: r => escapeHtml(r.hora) },
      { header: 'Total', num: true, render: r => formatMoney(r.total) },
    ],
    filas: compras.items,
    totalLabel: 'Total comprado',
    totalValor: formatMoney(total),
  });
}

function renderCreditos(creditos) {
  if (!creditos || !creditos.items || creditos.items.length === 0) return '';
  const total = sum(creditos.items, 'monto');
  return renderDesgloseTable({
    titulo: 'Cr\u00e9ditos (fiar)',
    esEjemplo: creditos.esEjemplo,
    etiquetaEjemplo: creditos.etiquetaEjemplo,
    columnas: [
      { header: 'Cliente', render: r => `<span class="product-name">${escapeHtml(r.cliente)}</span>` },
      { header: 'Hora', render: r => escapeHtml(r.hora) },
      { header: 'Monto', num: true, render: r => formatMoney(r.monto) },
    ],
    filas: creditos.items,
    totalLabel: 'Total en cr\u00e9ditos',
    totalValor: formatMoney(total),
  });
}

function renderInventario(inventario) {
  if (!inventario || !inventario.items || inventario.items.length === 0) return '';
  const filasHtml = inventario.items.map(it => {
    const esSalida = String(it.movimiento).toLowerCase() === 'salida';
    const claseTipo = esSalida ? 'type-retiro' : 'type-ingreso';
    const color = esSalida ? 'var(--danger)' : 'var(--primary-dark)';
    const signo = esSalida ? '\u2212' : '+';
    return `
        <tr>
          <td class="product-name">${escapeHtml(it.producto)}</td>
          <td class="${claseTipo}">${escapeHtml(it.movimiento)}</td>
          <td class="num" style="color:${color};">${signo} ${formatCantidad(Math.abs(it.cantidad))}</td>
          <td>${escapeHtml(it.motivo)}</td>
        </tr>`;
  }).join('');

  return `
  <div class="panel-title-row">
    <div class="section-title" style="border:none; padding:0; margin-bottom:8px;">
      Movimientos de inventario ${inventario.esEjemplo ? `<span class="badge-example">${escapeHtml(inventario.etiquetaEjemplo || 'Ejemplo')}</span>` : ''}
    </div>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Producto</th><th>Movimiento</th><th class="num">Cantidad</th><th>Motivo</th></tr></thead>
      <tbody>${filasHtml}</tbody>
    </table>
  </div>`;
}

function renderProductsTable(productos) {
  const filas = productos.map((p, i) => {
    const gananciaNeg = Number(p.ganancia) < 0;
    return `
        <tr${i === 0 ? ' class="rank-1"' : ''}>
          <td class="col-idx">${i + 1}</td>
          <td class="product-name">${escapeHtml(p.nombre)}</td>
          <td class="num">${formatCantidad(p.cantidad)}</td>
          <td class="num">${formatMoney(p.ventas)}</td>
          <td class="num">${formatMoney(p.costo)}</td>
          <td class="num"${gananciaNeg ? ' style="color:var(--danger);"' : ''}>${formatMoney(p.ganancia)}</td>
        </tr>`;
  }).join('');

  return `
  <div class="section-title">Todas las ventas &middot; agrupadas por producto</div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th class="col-idx">#</th>
          <th>Producto</th>
          <th class="num">Cant.</th>
          <th class="num">Ventas</th>
          <th class="num">Costo</th>
          <th class="num">Ganancia</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
  </div>`;
}

// ---------- CSS (idéntico al diseño aprobado) ----------

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  :root{
    --primary:#15803D;
    --primary-dark:#14532D;
    --primary-soft:#EAF5EC;
    --accent:#B45309;
    --accent-soft:#FDF3E4;
    --ink:#14201B;
    --muted:#64748B;
    --border:#E4E9E4;
    --bg:#FAFAF8;
    --card:#FFFFFF;
    --danger:#B91C1C;
  }

  *{ box-sizing:border-box; }

  @page{ size: Letter; margin: 14mm 13mm 16mm 13mm; }

  body{
    font-family:'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif;
    color:var(--ink); background:var(--bg); font-size:10.5px; line-height:1.45;
    -webkit-font-smoothing:antialiased;
  }

  .header{
    display:flex; align-items:center; justify-content:space-between;
    background:linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
    color:#fff; border-radius:10px; padding:16px 20px; margin-bottom:14px;
  }
  .header-brand{ display:flex; align-items:center; gap:12px; }
  .header-mark{
    width:38px; height:38px; border-radius:9px; background:rgba(255,255,255,0.16);
    display:flex; align-items:center; justify-content:center;
    font-weight:800; font-size:16px; letter-spacing:-0.5px;
    border:1px solid rgba(255,255,255,0.25);
  }
  .header-title{ font-size:15px; font-weight:700; letter-spacing:0.2px; }
  .header-sub{ font-size:8.5px; color:rgba(255,255,255,0.75); text-transform:uppercase; letter-spacing:1px; margin-top:1px; }
  .header-right{ text-align:right; }
  .header-shift{ font-size:12.5px; font-weight:700; }
  .header-shift-time{ font-size:8.5px; color:rgba(255,255,255,0.8); margin-top:1px; }
  .header-meta{ font-size:7.6px; color:rgba(255,255,255,0.65); margin-top:6px; }

  .section-title{
    font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px;
    color:var(--primary-dark); margin:0 0 8px 0; padding-bottom:5px;
    border-bottom:1.5px solid var(--border);
  }

  .kpi-grid{ display:grid; grid-template-columns:repeat(6, 1fr); gap:8px; margin-bottom:14px; }
  .kpi-card{ background:var(--card); border:1px solid var(--border); border-radius:8px; padding:9px 10px; break-inside:avoid; }
  .kpi-card .kpi-label{ font-size:7.3px; text-transform:uppercase; letter-spacing:0.5px; color:var(--muted); font-weight:600; margin-bottom:4px; }
  .kpi-card .kpi-value{ font-size:13px; font-weight:800; color:var(--ink); font-variant-numeric:tabular-nums; letter-spacing:-0.3px; white-space:nowrap; }
  .kpi-card.is-money .kpi-value{ color:var(--primary-dark); }
  .kpi-card.is-margin .kpi-value{ color:var(--accent); }

  .highlight-grid{ display:grid; gap:8px; margin-bottom:16px; }
  .highlight-card{ background:var(--accent-soft); border:1px solid #F0DDB8; border-radius:8px; padding:9px 10px; break-inside:avoid; }
  .highlight-label{ font-size:7.2px; text-transform:uppercase; letter-spacing:0.5px; color:#9A5B0C; font-weight:700; margin-bottom:4px; }
  .highlight-name{ font-size:11px; font-weight:700; color:var(--ink); }
  .highlight-value{ font-size:9.5px; font-weight:600; color:var(--accent); margin-top:1px; }

  .row-2col{ display:grid; grid-template-columns: 1.05fr 0.95fr; gap:14px; margin-bottom:16px; }
  .panel{ background:var(--card); border:1px solid var(--border); border-radius:8px; padding:12px 14px; }

  .pay-row{ margin-bottom:10px; }
  .pay-row:last-child{ margin-bottom:0; }
  .pay-top{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px; }
  .pay-name{ font-size:9.5px; font-weight:700; }
  .pay-amount{ font-size:9.5px; font-weight:700; font-variant-numeric:tabular-nums; }
  .pay-bar-track{ height:6px; background:#EEF1EE; border-radius:4px; overflow:hidden; }
  .pay-bar-fill{ height:100%; background:var(--primary); border-radius:4px; }
  .pay-bar-fill.gold{ background:var(--accent); }
  .pay-meta{ font-size:7.6px; color:var(--muted); margin-top:3px; }

  /* Cierre */
  .cierre-row{ display:flex; justify-content:space-between; align-items:baseline; padding:6px 0; font-size:9.5px; }
  .cierre-row .cierre-value{ font-variant-numeric:tabular-nums; font-weight:600; }
  .cierre-row .cierre-value.neg{ color:var(--danger); }
  .cierre-divider{ border-top:1px dashed var(--border); margin:2px 0; }
  .cierre-total{
    display:flex; justify-content:space-between; align-items:baseline;
    margin-top:8px; padding:10px 10px; border-radius:6px;
    background:var(--primary-soft); border:1px solid #CFE8D5;
  }
  .cierre-total .cierre-total-label{ font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; color:var(--primary-dark); }
  .cierre-total .cierre-total-value{ font-size:14px; font-weight:800; color:var(--primary-dark); font-variant-numeric:tabular-nums; }

  /* Actividad por hora — barras horizontales */
  .panel-subtitle{ font-size:8px; color:var(--muted); margin:-6px 0 10px 0; }
  .hour-list{ display:flex; flex-direction:column; gap:7px; }
  .hour-row{ display:grid; grid-template-columns: 42px 1fr 60px; align-items:center; column-gap:8px; }
  .hour-row-label{ font-size:8.3px; color:var(--muted); font-weight:600; white-space:nowrap; }
  .hour-row-track{ height:8px; background:var(--accent-soft); border-radius:5px; overflow:hidden; }
  .hour-row-fill{ height:100%; background:var(--primary); border-radius:5px; }
  .hour-row-value{ font-size:8.3px; font-weight:700; text-align:right; font-variant-numeric:tabular-nums; color:var(--ink); white-space:nowrap; }

  table{ width:100%; border-collapse:collapse; }
  .table-wrap{ background:var(--card); border:1px solid var(--border); border-radius:8px; overflow:hidden; margin-bottom:16px; }
  thead{ display:table-header-group; }
  tr{ break-inside:avoid; }
  th{
    background:var(--primary-soft); color:var(--primary-dark); font-size:7.5px; text-transform:uppercase;
    letter-spacing:0.4px; font-weight:700; text-align:left; padding:7px 9px; border-bottom:1.5px solid #CFE8D5;
  }
  td{ padding:6px 9px; font-size:9px; border-bottom:1px solid #F0F1EF; vertical-align:middle; }
  tbody tr:last-child td{ border-bottom:none; }
  tbody tr:nth-child(even){ background:#FBFCFA; }
  .num{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .col-idx{ color:var(--muted); width:22px; }
  .badge-example{
    display:inline-block; font-size:6.8px; font-weight:700; text-transform:uppercase; letter-spacing:0.4px;
    color:var(--accent); background:var(--accent-soft); border:1px solid #F0DDB8; border-radius:4px; padding:2px 6px; margin-left:6px;
  }
  .type-ingreso{ color:var(--primary-dark); font-weight:600; }
  .type-retiro{ color:var(--danger); font-weight:600; }
  .amount-in{ color:var(--primary-dark); font-weight:700; }
  .amount-out{ color:var(--danger); font-weight:700; }
  .total-row td{ background:var(--primary-soft) !important; border-top:1.5px solid #CFE8D5; font-weight:700; color:var(--primary-dark); }
  .rank-1 td{ background:var(--accent-soft) !important; }
  .rank-1 .num, .rank-1 td:first-child{ font-weight:700; }
  .product-name{ font-weight:600; }

  .panel-title-row{ display:flex; align-items:center; justify-content:space-between; margin-bottom:2px; }

  .summary{ background:var(--primary-soft); border-left:4px solid var(--primary); border-radius:6px; padding:12px 14px; margin-bottom:10px; }
  .summary-title{ font-size:9.5px; font-weight:700; color:var(--primary-dark); margin-bottom:5px; text-transform:uppercase; letter-spacing:0.5px; }
  .summary p{ margin:0; font-size:9.5px; color:#1F2A22; }

  .footnote{ font-size:7.4px; color:var(--muted); line-height:1.5; }
  .footnote strong{ color:#8A5A12; }
`;

// ---------- Función principal ----------

/**
 * @param {Object} datos
 * @param {Object} datos.turno              { numero, horaInicio, horaFin }
 * @param {Object} datos.periodo            { texto }
 * @param {string} datos.generadoTexto
 * @param {Array}  datos.kpis               [{ etiqueta, valor, tipo:'dinero'|'margen'|'numero' }, ...]
 *   Sugerido: Total vendido, Efectivo esperado, Ventas realizadas, Costo estimado, Ganancia estimada, Margen estimado.
 *   Tip: para "Efectivo esperado" usa calcularEfectivoEsperado(datos.cierre) al armar este array,
 *   así nunca se desincroniza del panel de Cierre.
 * @param {Object} datos.cierre             { efectivoVentas, totalEntradas, totalSalidas }
 *   El efectivo esperado se calcula solo: efectivoVentas + totalEntradas − totalSalidas.
 *   Las compras NO van aquí (ver nota de negocio arriba del archivo).
 * @param {Object} [datos.cuadreCaja]       { items: [{ hora, cajero, fondoInicial, esperado, contado, diferencia }] }
 *   Cuadre REAL de caja (distinto del "Cierre" estimado): los cierres
 *   que efectivamente ocurrieron, con su faltante/sobrante ya
 *   calculado. Si items está vacío o no se pasa, la sección no se
 *   imprime.
 * @param {Array}  datos.destacados         [{ etiqueta, nombre, valor }, ...] (4 sugeridos, se muestran apilados)
 * @param {Array}  datos.cobros             [{ nombre, monto, porcentaje, operaciones, dorado? }, ...]
 * @param {Array}  datos.horas              [{ etiqueta, valor }, ...] — se dibuja como barras horizontales
 * @param {string} [datos.notaHoras]
 * @param {Object} [datos.entradas]         { esEjemplo, items:[{hora, motivo, monto}] } — total se calcula solo
 * @param {Object} [datos.salidas]          { esEjemplo, items:[{hora, motivo, monto}] } — total se calcula solo
 * @param {Object} [datos.compras]          { esEjemplo, items:[{proveedor, hora, total}] } — total se calcula solo
 * @param {Object} [datos.creditos]         { esEjemplo, etiquetaEjemplo, items:[{cliente, hora, monto}] }
 * @param {Object} [datos.inventario]       { esEjemplo, etiquetaEjemplo, items:[{producto, movimiento:'Entrada'|'Salida', cantidad, motivo}] }
 * @param {Array}  datos.productos          [{ nombre, cantidad, ventas, costo, ganancia }, ...] — ya ordenados desc.
 * @param {string} datos.resumenHtml
 * @param {string} datos.notaPie
 * @returns {string} HTML completo listo para convertir a PDF
 */
export function generarInformeTurnoHTML(datos) {
  const {
    turno, periodo, generadoTexto, kpis = [], cierre, cuadreCaja, destacados = [], cobros = [],
    horas = [], notaHoras, entradas, salidas, compras, creditos, inventario,
    productos = [], resumenHtml, notaPie,
  } = datos;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Informe de turno &middot; Minimarket 24/7</title>
<style>${CSS}</style>
</head>
<body>
<div class="sheet">

  <div class="header">
    <div class="header-brand">
      <div class="header-mark">M</div>
      <div>
        <div class="header-title">Minimarket 24/7</div>
        <div class="header-sub">Sistema de punto de venta &middot; Informe de turno</div>
      </div>
    </div>
    <div class="header-right">
      <div class="header-shift">Turno ${escapeHtml(turno.numero)}</div>
      <div class="header-shift-time">${escapeHtml(turno.horaInicio)}${turno.horaFin ? ` &ndash; ${escapeHtml(turno.horaFin)}` : ''}</div>
      <div class="header-meta">${escapeHtml(periodo.texto)} &nbsp;&middot;&nbsp; ${escapeHtml(generadoTexto)}</div>
    </div>
  </div>

  <div class="section-title">Resumen financiero</div>
  <div class="kpi-grid" style="grid-template-columns:repeat(${kpis.length || 6}, 1fr);">
    ${kpis.map(renderKpiCard).join('')}
  </div>

  <div class="row-2col">
    ${datos.cuadreTotal && datos.resumenVentas
      ? renderVentasPanel(cobros, datos.resumenVentas) + renderCuadreTotal(datos.cuadreTotal)
      : `<div class="panel">
      <div class="section-title" style="margin-bottom:10px;">Distribuci&oacute;n de cobros</div>
      ${cobros.map(renderCobroRow).join('')}
    </div>
    ${renderCierre(cierre)}`}
  </div>

  ${renderCuadreCaja(cuadreCaja)}

  <div class="row-2col" style="grid-template-columns: 1.35fr 0.65fr;">
    ${renderHourList(horas, notaHoras)}
    <div class="highlight-grid" style="grid-template-columns:1fr; margin-bottom:0;">
      ${destacados.map(renderHighlightCard).join('')}
    </div>
  </div>

  <div class="section-title">Desglose de movimientos</div>
  ${renderEntradas(entradas)}
  ${renderSalidas(salidas)}
  ${renderCompras(compras)}
  ${renderCreditos(creditos)}
  ${renderInventario(inventario)}

  ${renderProductsTable(productos)}

  <div class="summary">
    <div class="summary-title">Resumen del turno</div>
    <p>${resumenHtml}</p>
  </div>

  <div class="footnote">${notaPie}</div>

</div>
</body>
</html>`;
}

export {
  calcularEfectivoEsperado,
  formatMoney,
  formatCantidad,
};