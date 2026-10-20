// apps/backend/src/modules/informes-periodicos/plantillas.js
//
// HTML de los informes semanal y mensual. Usa los mismos estilos que el
// informe de turno (packages/shared/src/informe-turno.template.js) para
// que los tres se vean iguales en WhatsApp.

import {
  ESTILOS_INFORME, escapeHtml, formatCantidad, formatMoney,
} from "@minisuper/shared/informe-turno-template";

const ZONA = "America/Tegucigalpa";
const VERDE = "#15803D";
const DORADO = "#B45309";
const GRIS = "#94A3B8";
const COLORES_COBRO = { EFECTIVO: "#15803D", TARJETA: "#2563EB", TRANSFERENCIA: "#D97706" };
const NOMBRES_COBRO = { EFECTIVO: "Efectivo", TARJETA: "Tarjeta", TRANSFERENCIA: "Transferencia" };

const ESTILOS_EXTRA = `
  .pie-leg{ display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px dashed var(--border); }
  .pie-leg:last-child{ border-bottom:none; }
  .pie-dot{ width:9px; height:9px; border-radius:3px; flex:0 0 9px; }
  .page-break{ break-before:page; }
  .compra{ background:var(--card); border:1px solid var(--border); border-radius:8px; overflow:hidden; margin-bottom:10px; break-inside:avoid; }
  .compra-head{ display:flex; justify-content:space-between; align-items:center; padding:9px 11px; border-bottom:1px solid var(--border); }
  .compra-num{ font-weight:800; color:var(--primary-dark); font-size:10px; }
  .compra-total{ font-size:12px; font-weight:800; color:var(--primary-dark); font-variant-numeric:tabular-nums; }
  .compra.anulada{ opacity:.75; border-style:dashed; }
  .compra.anulada .compra-total{ text-decoration:line-through; color:var(--muted); }
  .badge-anulada{ display:inline-block; font-size:6.8px; font-weight:700; text-transform:uppercase; color:var(--danger); background:#FDECEC; border:1px solid #F5C2C2; border-radius:4px; padding:1px 6px; margin-left:4px; }
  .anulada-nota{ font-size:7.6px; color:var(--danger); padding:6px 11px; background:#FFF7F7; border-top:1px solid #F5DADA; }
  .tabla-compra th{ font-size:6.8px; padding:6px 7px; }
  .tabla-compra td{ font-size:8.4px; padding:5px 7px; }
  tr.alerta td{ background:#FFF8EE !important; }
  .neg{ color:var(--danger); font-weight:700; }
  .pos{ color:var(--primary-dark); font-weight:700; }
  .section-title{ break-after:avoid; }
  .pay-amount{ white-space:nowrap; }
  .vacio{ font-size:9px; color:var(--muted); padding:10px 12px; background:var(--card); border:1px solid var(--border); border-radius:8px; margin-bottom:16px; }
`;

// ---------- Helpers ----------

function fechaCorta(fecha) {
  const [year, month, day] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function nombreMes(fecha, conAnio = true) {
  const [year, month] = fecha.split("-").map(Number);
  const texto = new Intl.DateTimeFormat("es-HN", { month: "long", timeZone: "UTC", ...(conAnio ? { year: "numeric" } : {}) })
    .format(new Date(Date.UTC(year, month - 1, 1)));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function momento(fecha) {
  const date = new Date(fecha);
  const dia = new Intl.DateTimeFormat("es-HN", { timeZone: ZONA, weekday: "short", day: "numeric", month: "short" }).format(date);
  const hora = new Intl.DateTimeFormat("es-HN", { timeZone: ZONA, hour: "numeric", minute: "2-digit", hour12: true }).format(date);
  return `${dia} · ${hora}`;
}

function generado() {
  const ahora = new Date();
  return `Generado: ${new Intl.DateTimeFormat("es-HN", { timeZone: ZONA, day: "2-digit", month: "short", year: "numeric" }).format(ahora)}, ${new Intl.DateTimeFormat("es-HN", { timeZone: ZONA, hour: "numeric", minute: "2-digit", hour12: true }).format(ahora)}`;
}

function plural(cantidad, singular, varios = `${singular}s`) {
  return `${formatCantidad(cantidad)} ${Number(cantidad) === 1 ? singular : varios}`;
}

function miles(valor) {
  return `L ${(valor / 1000).toLocaleString("es-HN", { maximumFractionDigits: 1 })}k`;
}

// Tope "redondo" del eje: 1, 2, 2.5 o 5 × 10^n.
function topeEje(valor) {
  if (!(valor > 0)) return 1;
  const base = 10 ** Math.floor(Math.log10(valor));
  return [1, 2, 2.5, 5, 10].map((paso) => paso * base).find((tope) => tope >= valor * 1.1) ?? 10 * base;
}

const SIN_DATO = '<span class="pay-meta">sin dato anterior</span>';

function variacion(actual, previo, { puntos = false, hayAnterior = true } = {}) {
  if (!hayAnterior || (!puntos && !(previo > 0))) return SIN_DATO;
  const valor = puntos ? actual - previo : ((actual - previo) / previo) * 100;
  const sube = valor >= 0;
  return `<span style="color:${sube ? "#14532D" : "#B91C1C"}; font-weight:700">${sube ? "▲" : "▼"} ${Math.abs(valor).toFixed(1)}${puntos ? " pts" : "%"}</span>`;
}

function kpi(etiqueta, valor, sub = "", clase = "") {
  return `<div class="kpi-card ${clase}"><div class="kpi-label">${etiqueta}</div><div class="kpi-value">${valor}</div>${sub ? `<div class="pay-meta">${sub}</div>` : ""}</div>`;
}

function destacado(etiqueta, nombre, valor) {
  return `<div class="highlight-card"><div class="highlight-label">${etiqueta}</div><div class="highlight-name">${escapeHtml(nombre)}</div><div class="highlight-value">${valor}</div></div>`;
}

function barra(x, y, ancho, base, color, radio = 4) {
  const r = Math.min(radio, ancho / 2, Math.max(base - y, 0));
  return `<path d="M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + ancho - r} Q${x + ancho},${y} ${x + ancho},${y + r} V${base} Z" fill="${color}"/>`;
}

function documento(titulo, cuerpo) {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8" /><title>${titulo} &middot; Minimarket 24/7</title>
<style>${ESTILOS_INFORME}${ESTILOS_EXTRA}</style></head>
<body><div class="sheet">${cuerpo}</div></body></html>`;
}

function encabezado(subtitulo, titulo, detalle) {
  return `
  <div class="header">
    <div class="header-brand"><div class="header-mark">M</div>
      <div><div class="header-title">Minimarket 24/7</div><div class="header-sub">Sistema de punto de venta &middot; ${subtitulo}</div></div></div>
    <div class="header-right">
      <div class="header-shift">${titulo}</div>
      <div class="header-shift-time">${detalle}</div>
      <div class="header-meta">${generado()}</div>
    </div>
  </div>`;
}

function barrasProveedores(proveedores) {
  const maximo = Math.max(...proveedores.map((proveedor) => proveedor.total), 1);
  return proveedores.map((proveedor, indice) => `
    <div class="hour-row">
      <div class="hour-row-label" style="flex:0 0 128px; color:#14201B; white-space:normal">${escapeHtml(proveedor.nombre)}<span style="color:#64748B; font-weight:500"> · ${proveedor.compras}</span></div>
      <div class="hour-row-track"><div class="hour-row-fill" style="width:${Math.max(2, Math.round((proveedor.total / maximo) * 100))}%;${indice === 0 ? `background:${DORADO}` : ""}"></div></div>
      <div class="hour-row-value" style="flex:0 0 72px">${formatMoney(proveedor.total)}</div>
    </div>`).join("");
}

// ---------- Informe mensual ----------

function graficaTop(productos) {
  if (!productos.length) return '<div class="vacio">No hubo ventas este mes.</div>';
  const W = 330, H = 190, arriba = 22, abajo = 40, hueco = 18;
  const alto = H - arriba - abajo;
  const maximo = Math.max(...productos.map((producto) => producto.cantidad), 1);
  const ancho = (W - hueco * (productos.length + 1)) / productos.length;
  const base = arriba + alto;
  const guias = [0.25, 0.5, 0.75, 1].map((f) => `<line x1="0" x2="${W}" y1="${base - alto * f}" y2="${base - alto * f}" stroke="#EEF1EE"/>`).join("");
  const barras = productos.map((producto, indice) => {
    const altura = (producto.cantidad / maximo) * alto;
    const x = hueco + indice * (ancho + hueco);
    const y = base - altura;
    const palabras = producto.nombre.includes(" · ")
      ? producto.nombre.split(" · ")
      : [producto.nombre.split(" ")[0], producto.nombre.split(" ").slice(1).join(" ")];
    const corto = (texto) => escapeHtml(texto.length > 18 ? `${texto.slice(0, 17)}…` : texto);
    return `${barra(x, y, ancho, base, indice === 0 ? DORADO : VERDE)}
      <text x="${x + ancho / 2}" y="${y - 6}" text-anchor="middle" font-size="9" font-weight="700" fill="#14201B">${formatCantidad(producto.cantidad)}</text>
      <text x="${x + ancho / 2}" y="${base + 13}" text-anchor="middle" font-size="7.6" font-weight="600" fill="#14201B">${corto(palabras[0])}</text>
      ${palabras[1] ? `<text x="${x + ancho / 2}" y="${base + 23}" text-anchor="middle" font-size="7" fill="#64748B">${corto(palabras[1])}</text>` : ""}
      <text x="${x + ancho / 2}" y="${base + (palabras[1] ? 33 : 23)}" text-anchor="middle" font-size="7" fill="#64748B">${miles(producto.ventas)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%">${guias}<line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="#CBD5CF"/>${barras}</svg>`;
}

function dona(cobros) {
  const total = cobros.reduce((suma, cobro) => suma + cobro.total, 0);
  if (!(total > 0)) return '<div class="vacio">No hubo cobros este mes.</div>';
  const radio = 52, circunferencia = 2 * Math.PI * radio;
  let desplazamiento = 0;
  const segmentos = cobros.filter((cobro) => cobro.total > 0).map((cobro) => {
    const largo = (cobro.total / total) * circunferencia;
    const segmento = `<circle r="${radio}" cx="70" cy="70" fill="none" stroke="${COLORES_COBRO[cobro.metodo]}" stroke-width="22" stroke-dasharray="${Math.max(largo - 2, 0.5)} ${circunferencia}" stroke-dashoffset="${-desplazamiento}" transform="rotate(-90 70 70)"/>`;
    desplazamiento += largo;
    return segmento;
  }).join("");
  const leyenda = cobros.map((cobro) => `
    <div class="pie-leg">
      <span class="pie-dot" style="background:${COLORES_COBRO[cobro.metodo]}"></span>
      <div style="flex:1"><div class="pay-name">${NOMBRES_COBRO[cobro.metodo]}</div><div class="pay-meta" style="margin-top:0">${formatCantidad(cobro.operaciones)} operaciones</div></div>
      <div style="text-align:right"><div class="pay-amount">${formatMoney(cobro.total)}</div><div class="pay-meta" style="margin-top:0">${((cobro.total / total) * 100).toFixed(1)}%</div></div>
    </div>`).join("");
  return `<div style="display:flex; align-items:center; gap:14px;">
    <svg viewBox="0 0 140 140" width="132" height="132">${segmentos}
      <text x="70" y="66" text-anchor="middle" font-size="8" fill="#64748B" font-weight="600">COBRADO</text>
      <text x="70" y="80" text-anchor="middle" font-size="10.5" fill="#14532D" font-weight="800">${miles(total)}</text></svg>
    <div style="flex:1">${leyenda}</div></div>`;
}

function graficaSemanas(semanas) {
  const W = 540, H = 160, arriba = 24, abajo = 30, izquierda = 34;
  const alto = H - arriba - abajo;
  const tope = topeEje(Math.max(...semanas.map((semana) => semana.ganancia), 0));
  const paso = (W - izquierda) / semanas.length;
  const ancho = Math.min(70, paso - 30);
  const mejor = semanas.reduce((a, b) => (b.ganancia > a.ganancia ? b : a));
  const peor = semanas.reduce((a, b) => (b.ganancia < a.ganancia ? b : a));
  const promedio = semanas.reduce((suma, semana) => suma + semana.ganancia, 0) / semanas.length;
  const yDe = (valor) => arriba + alto - (Math.max(valor, 0) / tope) * alto;
  const base = arriba + alto;
  const guias = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const valor = tope * f;
    return `<line x1="${izquierda}" x2="${W}" y1="${yDe(valor)}" y2="${yDe(valor)}" stroke="${f ? "#EEF1EE" : "#CBD5CF"}"/><text x="${izquierda - 5}" y="${yDe(valor) + 3}" text-anchor="end" font-size="7" fill="#64748B">${f ? `${(valor / 1000).toLocaleString("es-HN", { maximumFractionDigits: 1 })}k` : "0"}</text>`;
  }).join("");
  const barras = semanas.map((semana, indice) => {
    const x = izquierda + indice * paso + (paso - ancho) / 2;
    const y = yDe(semana.ganancia);
    const color = semana === mejor ? DORADO : semana === peor && mejor !== peor ? GRIS : VERDE;
    return `${barra(x, y, ancho, base, color)}
      <text x="${x + ancho / 2}" y="${Math.min(y, yDe(promedio)) - 5}" text-anchor="middle" font-size="7.5" font-weight="700" fill="#14201B">${miles(semana.ganancia)}</text>
      <text x="${x + ancho / 2}" y="${base + 12}" text-anchor="middle" font-size="7" fill="#64748B">${Number(semana.desde.slice(8))}–${Number(semana.hasta.slice(8))} ${fechaCorta(semana.hasta).split(" ").slice(1).join(" ")}</text>`;
  }).join("");
  const linea = `<line x1="${izquierda}" x2="${W}" y1="${yDe(promedio)}" y2="${yDe(promedio)}" stroke="#14532D" stroke-dasharray="3 3"/>`;
  return { svg: `<svg viewBox="0 0 ${W} ${H}" width="100%">${guias}${barras}${linea}</svg>`, mejor, peor, promedio };
}

function rangoDias(semana) {
  return `${Number(semana.desde.slice(8))} al ${Number(semana.hasta.slice(8))} de ${nombreMes(semana.desde, false).toLowerCase()}`;
}

export function generarInformeMensualHTML(datos) {
  const { actual, previo, rango, anterior } = datos;
  const mes = nombreMes(rango.desde);
  const mesAnterior = nombreMes(anterior.desde);
  const mesCorto = nombreMes(rango.desde, false).toLowerCase();
  const semanas = graficaSemanas(datos.semanas);
  const totalComprado = datos.proveedores.reduce((suma, proveedor) => suma + proveedor.total, 0);
  const numeroCompras = datos.proveedores.reduce((suma, proveedor) => suma + proveedor.compras, 0);
  const principal = datos.proveedores[0];
  const masCompras = [...datos.proveedores].sort((a, b) => b.compras - a.compras)[0];
  const cobrado = datos.cobros.reduce((suma, cobro) => suma + cobro.total, 0);
  const cobroPrincipal = [...datos.cobros].sort((a, b) => b.total - a.total)[0];
  const textoTurno = (turno) => (turno ? `Turno ${turno.turno} · ${formatMoney(turno.ganancia)}` : "—");
  const textoProducto = (producto) => (producto ? `${escapeHtml(producto.nombre)} · ${formatCantidad(producto.cantidad)} u.` : "—");
  const turnoEtiquetas = { A: "Turno A &middot; 2 a. m. – 8 a. m.", B: "Turno B &middot; 8 a. m. – 6 p. m.", C: "Turno C &middot; 6 p. m. – 2 a. m." };

  const cuerpo = `
  ${encabezado("Informe mensual", mes, `1 &ndash; ${Number(rango.hasta.slice(8))} ${mesCorto} &middot; comparado con ${mesAnterior.toLowerCase()}`)}

  <div class="section-title">Resumen del mes</div>
  <div class="kpi-grid">
    ${kpi("Total vendido", formatMoney(actual.total), `${variacion(actual.total, previo.total)} vs ${mesAnterior.toLowerCase()}`, "is-money")}
    ${kpi("Ganancia estimada", formatMoney(actual.ganancia), `${variacion(actual.ganancia, previo.ganancia)} vs ${mesAnterior.toLowerCase()}`, "is-money")}
    ${kpi("Margen estimado", `${actual.margen.toFixed(2)}%`, `${variacion(actual.margen, previo.margen, { puntos: true, hayAnterior: previo.operaciones > 0 })} vs ${mesAnterior.toLowerCase()}`, "is-margin")}
    ${kpi("Comprado a proveedores", formatMoney(actual.gastadoEnCompras), plural(actual.pedidos, "compra"))}
    ${kpi("Ventas realizadas", formatCantidad(actual.operaciones), `${variacion(actual.operaciones, previo.operaciones)} vs ${mesAnterior.toLowerCase()}`)}
  </div>

  <div class="row-2col">
    <div class="panel" style="flex:1.1">
      <div class="section-title" style="margin-bottom:2px;">Top 5 productos más vendidos</div>
      <div class="panel-subtitle">Unidades vendidas en el mes &middot; debajo, lo que se vendió en lempiras</div>
      ${graficaTop(datos.top)}
    </div>
    <div class="panel" style="flex:0.9">
      <div class="section-title" style="margin-bottom:2px;">Cobros por método</div>
      <div class="panel-subtitle">Cuánto se cobró en efectivo, tarjeta y transferencia</div>
      ${dona(datos.cobros)}
      ${datos.credito > 0 ? `<div class="footnote" style="margin-top:8px;">Las ventas a crédito (${formatMoney(datos.credito)}) no aparecen en el gráfico porque todavía no se cobraron.</div>` : ""}
    </div>
  </div>

  <div class="panel" style="margin-bottom:16px;">
    <div class="section-title" style="margin-bottom:2px;">Rentabilidad por semana</div>
    <div class="panel-subtitle">Ganancia estimada de cada semana &middot; <span style="color:${DORADO}; font-weight:700">■</span> mejor semana &nbsp; <span style="color:${GRIS}; font-weight:700">■</span> semana más baja &nbsp; <span style="color:#14532D; font-weight:700">- - -</span> promedio</div>
    ${semanas.svg}
    <div style="display:flex; gap:8px; margin-top:8px;">
      <div style="flex:1">${destacado("Mejor semana", rangoDias(semanas.mejor), `${formatMoney(semanas.mejor.ganancia)} de ganancia`)}</div>
      <div style="flex:1">${destacado("Semana más baja", rangoDias(semanas.peor), `${formatMoney(semanas.peor.ganancia)} de ganancia`)}</div>
      <div style="flex:1">${destacado("Promedio semanal", formatMoney(semanas.promedio), "de ganancia por semana")}</div>
    </div>
  </div>

  <div class="row-2col page-break">
    <div class="panel" style="flex:1.25">
      <div class="section-title" style="margin-bottom:2px;">Compras a proveedores</div>
      <div class="panel-subtitle">Total invertido por proveedor &middot; el número es la cantidad de compras</div>
      ${datos.proveedores.length ? `<div class="hour-list">${barrasProveedores(datos.proveedores)}</div>` : '<div class="vacio">No se registraron compras este mes.</div>'}
      <div class="cierre-total" style="margin-top:12px;"><span class="cierre-total-label">Total comprado &middot; ${plural(numeroCompras, "compra")}</span><span class="cierre-total-value">${formatMoney(totalComprado)}</span></div>
    </div>
    <div class="highlight-grid" style="flex:0.75; margin-bottom:0;">
      ${principal ? destacado("Proveedor con más inversión", principal.nombre, `${formatMoney(principal.total)} &middot; ${Math.round((principal.total / totalComprado) * 100)}% de lo comprado`) : ""}
      ${masCompras ? destacado("Proveedor con más compras", masCompras.nombre, `${plural(masCompras.compras, "compra")} en el mes`) : ""}
      ${numeroCompras ? destacado("Compra promedio", formatMoney(totalComprado / numeroCompras), "por cada compra") : ""}
    </div>
  </div>

  <div class="section-title">Comparación con el mes anterior</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Indicador</th><th class="num">${mesAnterior}</th><th class="num">${mes}</th><th class="num">Variación</th></tr></thead>
      <tbody>
        <tr><td class="product-name">Total vendido</td><td class="num">${formatMoney(previo.total)}</td><td class="num">${formatMoney(actual.total)}</td><td class="num">${variacion(actual.total, previo.total)}</td></tr>
        <tr><td class="product-name">Ganancia estimada</td><td class="num">${formatMoney(previo.ganancia)}</td><td class="num">${formatMoney(actual.ganancia)}</td><td class="num">${variacion(actual.ganancia, previo.ganancia)}</td></tr>
        <tr><td class="product-name">Margen estimado</td><td class="num">${previo.margen.toFixed(2)}%</td><td class="num">${actual.margen.toFixed(2)}%</td><td class="num">${variacion(actual.margen, previo.margen, { puntos: true, hayAnterior: previo.operaciones > 0 })}</td></tr>
        <tr><td class="product-name">Ventas realizadas</td><td class="num">${formatCantidad(previo.operaciones)}</td><td class="num">${formatCantidad(actual.operaciones)}</td><td class="num">${variacion(actual.operaciones, previo.operaciones)}</td></tr>
        <tr><td class="product-name">Producto más vendido</td><td class="num">${textoProducto(previo.masVendido)}</td><td class="num">${textoProducto(actual.masVendido)}</td><td class="num">${!previo.masVendido || !actual.masVendido ? SIN_DATO : actual.masVendido.nombre === previo.masVendido.nombre ? variacion(actual.masVendido.cantidad, previo.masVendido.cantidad) : '<span class="pay-meta">cambió</span>'}</td></tr>
        <tr><td class="product-name">Turno más rentable</td><td class="num">${textoTurno(previo.turno)}</td><td class="num">${textoTurno(actual.turno)}</td><td class="num">${!previo.turno || !actual.turno ? SIN_DATO : actual.turno.turno === previo.turno.turno ? variacion(actual.turno.ganancia, previo.turno.ganancia) : '<span class="pay-meta">cambió</span>'}</td></tr>
        <tr><td class="product-name">Pedidos a proveedores</td><td class="num">${plural(previo.pedidos, "pedido")}</td><td class="num">${plural(actual.pedidos, "pedido")}</td><td class="num">${variacion(actual.pedidos, previo.pedidos)}</td></tr>
        <tr><td class="product-name">Gastado en compras</td><td class="num">${formatMoney(previo.gastadoEnCompras)}</td><td class="num">${formatMoney(actual.gastadoEnCompras)}</td><td class="num">${variacion(actual.gastadoEnCompras, previo.gastadoEnCompras)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section-title">Ganancia por turno</div>
  <div class="kpi-grid">
    ${["A", "B", "C"].map((turno) => {
      const esMejor = actual.turno?.turno === turno;
      return `<div class="kpi-card"${esMejor ? ' style="background:var(--accent-soft); border-color:#F0DDB8"' : ""}><div class="kpi-label">${turnoEtiquetas[turno]}${esMejor ? " &middot; el más rentable" : ""}</div><div class="kpi-value"${esMejor ? ' style="color:var(--primary-dark)"' : ""}>${formatMoney(datos.turnos[turno])}</div><div class="pay-meta">${variacion(datos.turnos[turno], datos.turnosAnteriores[turno])} vs ${mesAnterior.toLowerCase()}</div></div>`;
    }).join("")}
  </div>

  <div class="summary">
    <div class="summary-title">Resumen del mes</div>
    <p>En ${mesCorto} se vendieron ${formatMoney(actual.total)} en ${plural(actual.operaciones, "venta")}${previo.total > 0 ? `, ${variacion(actual.total, previo.total)} respecto a ${mesAnterior.toLowerCase()}` : ""}, con una ganancia estimada de ${formatMoney(actual.ganancia)}.
    ${actual.masVendido ? `El producto más vendido fue ${escapeHtml(actual.masVendido.nombre)} (${formatCantidad(actual.masVendido.cantidad)} unidades)` : "No hubo ventas"}${actual.turno ? ` y el turno más rentable fue el ${actual.turno.turno}` : ""}.
    ${cobrado > 0 ? `El cobro principal fue en ${NOMBRES_COBRO[cobroPrincipal.metodo].toLowerCase()} (${Math.round((cobroPrincipal.total / cobrado) * 100)}%).` : ""}
    Se hicieron ${plural(actual.pedidos, "pedido")} a proveedores por ${formatMoney(actual.gastadoEnCompras)}${principal ? `; la mayor inversión fue con ${escapeHtml(principal.nombre)}` : ""}.</p>
  </div>
  <div class="footnote">La ganancia es una estimación basada en los costos registrados. Las cervezas se cuentan en unidades (las cajas se suman como unidades). Los turnos se cuentan por la hora de cada venta.</div>`;

  return documento("Informe mensual", cuerpo);
}

// ---------- Informe semanal ----------

const ETIQUETA_MOVIMIENTO = {
  AJUSTE_POSITIVO: ["Entrada (ajuste)", "type-ingreso", "+"],
  COMPRA: ["Entrada manual", "type-ingreso", "+"],
  DEVOLUCION_CLIENTE: ["Devolución de cliente", "type-ingreso", "+"],
  DEVOLUCION_PROVEEDOR: ["Devolución a proveedor", "type-retiro", "−"],
};

function loteHtml(linea) {
  if (!linea.lote) return '<span class="pay-meta">Primera compra</span>';
  const cambio = linea.lote.costoUnidad > 0 ? ((linea.costoUnidad - linea.lote.costoUnidad) / linea.lote.costoUnidad) * 100 : 0;
  const igual = Math.abs(cambio) < 0.05;
  const texto = igual
    ? "= igual"
    : `<span class="${cambio > 0 ? "neg" : "pos"}">${cambio > 0 ? "▲" : "▼"} ${Math.abs(cambio).toFixed(1)}%</span>`;
  return `${formatMoney(linea.lote.costoUnidad)}<div class="pay-meta" style="margin-top:0">${momento(linea.lote.fecha).split(" · ")[0]} · ${texto}</div>`;
}

function subioDeCosto(linea) {
  return linea.lote && linea.costoUnidad > linea.lote.costoUnidad * 1.0005;
}

function compraHtml(compra) {
  const filas = compra.lineas.map((linea) => `<tr${!compra.anulada && subioDeCosto(linea) ? ' class="alerta"' : ""}>
    <td class="product-name">${escapeHtml(linea.producto)}<div class="pay-meta" style="margin-top:0">Entraron ${formatCantidad(linea.unidades)} ${escapeHtml(linea.unidad)}</div></td>
    <td class="num"><b>${formatMoney(linea.costoUnidad)}</b></td>
    <td class="num">${loteHtml(linea)}</td>
    <td class="num">${linea.precioVenta === null ? "—" : formatMoney(linea.precioVenta)}</td>
    <td class="num">${linea.utilidadUnidad === null ? "—" : `<span class="${linea.utilidadUnidad < 0 ? "neg" : ""}">${formatMoney(linea.utilidadUnidad)}</span><div class="pay-meta" style="margin-top:0">${linea.margen.toFixed(1)}%</div>`}</td>
    <td class="num ${linea.utilidad < 0 ? "neg" : "pos"}">${linea.utilidad === null ? "—" : formatMoney(linea.utilidad)}</td>
    <td class="num">${formatMoney(linea.subtotal)}</td></tr>`).join("");
  const utilidad = compra.lineas.reduce((suma, linea) => suma + (linea.utilidad ?? 0), 0);
  return `<div class="compra ${compra.anulada ? "anulada" : ""}">
    <div class="compra-head">
      <div><span class="compra-num">Compra #${compra.id}</span> &middot; <span class="product-name">${escapeHtml(compra.proveedor)}</span>${compra.anulada ? ' <span class="badge-anulada">Anulada</span>' : ""}
        <div class="pay-meta">${momento(compra.creadoEn)} &middot; Factura: ${escapeHtml(compra.documento ?? "sin número")} &middot; Registró: ${escapeHtml(compra.usuario)}</div></div>
      <div style="text-align:right"><div class="compra-total">${formatMoney(compra.total)}</div>${compra.anulada ? "" : `<div class="pay-meta" style="margin-top:0">Utilidad bruta proyectada: <b class="pos">${formatMoney(utilidad)}</b></div>`}</div>
    </div>
    <table class="tabla-compra"><thead><tr><th>Producto</th><th class="num">Costo unidad</th><th class="num">Último lote</th><th class="num">Precio venta</th><th class="num">Utilidad por unidad</th><th class="num">Utilidad proyectada</th><th class="num">Subtotal</th></tr></thead>
    <tbody>${filas}</tbody></table>
    ${compra.anulada ? `<div class="anulada-nota">Compra anulada${compra.anuladaEn ? ` el ${momento(compra.anuladaEn)}` : ""}. No suma al total ni al inventario.</div>` : ""}
  </div>`;
}

export function generarInformeSemanalHTML(datos) {
  const { rango } = datos;
  const validas = datos.compras.filter((compra) => !compra.anulada);
  const anuladas = datos.compras.length - validas.length;
  const totalComprado = validas.reduce((suma, compra) => suma + compra.total, 0);
  const unidades = validas.flatMap((compra) => compra.lineas).reduce((suma, linea) => suma + linea.unidades, 0);
  const totalBajas = datos.bajas.reduce((suma, baja) => suma + baja.perdida, 0);
  const unidadesBajas = datos.bajas.reduce((suma, baja) => suma + baja.cantidad, 0);
  const entradasAjuste = datos.otrosMovimientos.filter((movimiento) => ETIQUETA_MOVIMIENTO[movimiento.tipo]?.[2] === "+");

  const proveedores = [...validas.reduce((mapa, compra) => {
    const entrada = mapa.get(compra.proveedor) ?? { nombre: compra.proveedor, compras: 0, total: 0 };
    entrada.compras += 1;
    entrada.total += compra.total;
    return mapa.set(compra.proveedor, entrada);
  }, new Map()).values()].sort((a, b) => b.total - a.total);
  const mayorCompra = [...validas].sort((a, b) => b.total - a.total)[0];
  const perdidas = [...datos.bajas.reduce((mapa, baja) => {
    const entrada = mapa.get(baja.producto) ?? { nombre: baja.producto, perdida: 0, cantidad: 0 };
    entrada.perdida += baja.perdida;
    entrada.cantidad += baja.cantidad;
    return mapa.set(baja.producto, entrada);
  }, new Map()).values()].sort((a, b) => b.perdida - a.perdida);
  const subieron = [...new Set(validas.flatMap((compra) => compra.lineas).filter(subioDeCosto).map((linea) => linea.producto))];

  const cuerpo = `
  ${encabezado("Informe semanal", `Semana ${fechaCorta(rango.desde)} &ndash; ${fechaCorta(rango.hasta)}`, "Lunes a domingo &middot; compras e inventario")}

  <div class="section-title">Resumen de la semana</div>
  <div class="kpi-grid">
    ${kpi("Total comprado", formatMoney(totalComprado), `${plural(validas.length, "compra")}${anuladas ? ` &middot; ${anuladas} anulada${anuladas === 1 ? "" : "s"}` : ""}`, "is-money")}
    ${kpi("Unidades que entraron", formatCantidad(Math.round(unidades * 1000) / 1000), "por compras")}
    ${kpi("Bajas de inventario", formatMoney(totalBajas), `${plural(datos.bajas.length, "registro")} &middot; ${plural(unidadesBajas, "unidad", "unidades")}`, "is-margin")}
    ${kpi("Devuelto a proveedores", formatMoney(datos.devueltoProveedores.total), `${datos.devueltoProveedores.cantidad} devoluci${datos.devueltoProveedores.cantidad === 1 ? "ón" : "ones"}`)}
    ${kpi("Entradas manuales", formatCantidad(entradasAjuste.length), "ajustes y devoluciones de clientes")}
  </div>

  ${proveedores.length ? `
  <div class="row-2col">
    <div class="panel" style="flex:1.2">
      <div class="section-title" style="margin-bottom:2px;">Compras por proveedor</div>
      <div class="panel-subtitle">Total invertido &middot; el número es la cantidad de compras</div>
      <div class="hour-list">${barrasProveedores(proveedores)}</div>
      <div class="cierre-total" style="margin-top:12px;"><span class="cierre-total-label">Total comprado</span><span class="cierre-total-value">${formatMoney(totalComprado)}</span></div>
    </div>
    <div class="highlight-grid" style="flex:0.8; margin-bottom:0;">
      ${destacado("Mayor inversión", proveedores[0].nombre, formatMoney(proveedores[0].total))}
      ${destacado("Compra más grande", `Compra #${mayorCompra.id}`, `${formatMoney(mayorCompra.total)} &middot; ${escapeHtml(mayorCompra.proveedor)}`)}
      ${perdidas[0] ? destacado("Producto con más pérdida por bajas", perdidas[0].nombre, `${formatMoney(perdidas[0].perdida)} &middot; ${formatCantidad(perdidas[0].cantidad)} unidades`) : ""}
    </div>
  </div>` : ""}

  <div class="section-title">Compras detalladas</div>
  ${datos.compras.length ? `<div class="footnote" style="margin:-4px 0 8px">Costos y precios por unidad. Último lote = costo por unidad de la compra anterior del mismo producto (<span class="neg">▲</span> subió, <span class="pos">▼</span> bajó; las filas en naranja subieron de costo). Utilidad proyectada = (precio de venta − costo) × unidades compradas.</div>
  ${datos.compras.map(compraHtml).join("")}` : '<div class="vacio">No se registraron compras esta semana.</div>'}

  <div class="section-title" style="margin-top:6px">Bajas de inventario (salidas manuales)</div>
  ${datos.bajas.length ? `<div class="table-wrap"><table>
    <thead><tr><th>Fecha</th><th>Producto</th><th class="num">Cant.</th><th class="num">Costo unit.</th><th class="num">Pérdida</th><th>Motivo</th><th>Registró</th></tr></thead>
    <tbody>${datos.bajas.map((baja) => `<tr><td>${momento(baja.creadoEn)}</td><td class="product-name">${escapeHtml(baja.producto)}</td><td class="num neg">&minus; ${formatCantidad(baja.cantidad)}</td><td class="num">${formatMoney(baja.costoUnidad)}</td><td class="num neg">${formatMoney(baja.perdida)}</td><td>${escapeHtml(baja.motivo)}</td><td>${escapeHtml(baja.usuario)}</td></tr>`).join("")}
      <tr class="total-row"><td colspan="4">Total perdido por bajas</td><td class="num">${formatMoney(totalBajas)}</td><td colspan="2"></td></tr></tbody>
  </table></div>` : '<div class="vacio">No hubo bajas de inventario esta semana.</div>'}

  ${datos.otrosMovimientos.length ? `
  <div class="section-title">Entradas manuales y devoluciones</div>
  <div class="table-wrap"><table>
    <thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th class="num">Cant.</th><th>Motivo</th><th>Registró</th></tr></thead>
    <tbody>${datos.otrosMovimientos.map((movimiento) => {
      const [etiqueta, clase, signo] = ETIQUETA_MOVIMIENTO[movimiento.tipo] ?? [movimiento.tipo, "", ""];
      return `<tr><td>${momento(movimiento.creadoEn)}</td><td class="${clase}">${etiqueta}</td><td class="product-name">${escapeHtml(movimiento.producto)}</td><td class="num ${signo === "+" ? "pos" : "neg"}">${signo} ${formatCantidad(movimiento.cantidad)}</td><td>${escapeHtml(movimiento.motivo)}</td><td>${escapeHtml(movimiento.usuario)}</td></tr>`;
    }).join("")}</tbody>
  </table></div>` : ""}

  <div class="section-title">Entradas y salidas de inventario por producto</div>
  ${datos.inventario.length ? `<div class="table-wrap"><table>
    <thead><tr><th>Producto</th><th class="num">Al iniciar</th><th class="num">+ Compras</th><th class="num">+ Ajustes</th><th class="num">&minus; Ventas</th><th class="num">&minus; Bajas y dev.</th><th class="num">Al cerrar</th></tr></thead>
    <tbody>${datos.inventario.map((fila) => `<tr><td class="product-name">${escapeHtml(fila.producto)}</td><td class="num">${formatCantidad(fila.inicial)}</td><td class="num pos">${fila.compras ? `+ ${formatCantidad(fila.compras)}` : "—"}</td><td class="num pos">${fila.ajustes ? `+ ${formatCantidad(fila.ajustes)}` : "—"}</td><td class="num">${fila.ventas ? `&minus; ${formatCantidad(fila.ventas)}` : "—"}</td><td class="num ${fila.bajas ? "neg" : ""}">${fila.bajas ? `&minus; ${formatCantidad(fila.bajas)}` : "—"}</td><td class="num" style="font-weight:700">${formatCantidad(fila.final)}</td></tr>`).join("")}</tbody>
  </table></div>
  <div class="footnote" style="margin-top:-10px; margin-bottom:14px;">Solo aparecen los productos que tuvieron compras, ajustes o bajas en la semana. Cantidades en unidades (las cajas, paquetes y cartones se convierten a unidades).</div>` : '<div class="vacio">No hubo compras, ajustes ni bajas esta semana.</div>'}

  <div class="summary">
    <div class="summary-title">Resumen de la semana</div>
    <p>Se registraron ${plural(validas.length, "compra")} por ${formatMoney(totalComprado)}${anuladas ? ` (${anuladas} anulada${anuladas === 1 ? "" : "s"})` : ""}${proveedores[0] ? `; la mayor inversión fue con ${escapeHtml(proveedores[0].nombre)}` : ""}.
    ${datos.bajas.length ? `Se dieron de baja ${plural(unidadesBajas, "unidad", "unidades")} por ${formatMoney(totalBajas)}${perdidas[0] ? `; la pérdida más alta fue de ${escapeHtml(perdidas[0].nombre)}` : ""}.` : "No hubo bajas de inventario."}
    ${subieron.length ? `Subieron de costo respecto a su último lote: ${subieron.map(escapeHtml).join(", ")}.` : ""}</p>
  </div>
  <div class="footnote">La pérdida por bajas y la utilidad proyectada se calculan con los costos registrados y el precio de venta actual por unidad.</div>`;

  return documento("Informe semanal", cuerpo);
}
