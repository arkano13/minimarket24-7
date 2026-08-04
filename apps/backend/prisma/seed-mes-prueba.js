import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

// =========================================================
// Genera ~30 días de historial ficticio: turnos de caja,
// ventas (con su detalle, pago y movimiento de inventario),
// algunas compras y un par de movimientos de caja.
//
// No usa la API — escribe directo a la base de datos con
// las mismas convenciones que usan seed.js y
// seed-productos-prueba.js, para que quede consistente con
// lo que ya generan las pantallas reales.
// =========================================================

const DIAS = 30;
const VENTAS_MIN_POR_DIA = 45;
const VENTAS_MAX_POR_DIA = 90;
const PROVEEDORES_PRUEBA = [
  { nombre: "Distribuidora El Sol", telefono: "9911-2233" },
  { nombre: "Comercial Las Flores", telefono: "9822-4455" },
  { nombre: "Mayoreo Central", telefono: "9733-5566" },
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals) {
  const value = Math.random() * (max - min) + min;
  return Number(value.toFixed(decimals));
}

function pickRandom(list) {
  return list[randomInt(0, list.length - 1)];
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function randomTimeOnDay(day, startHour, endHour) {
  const start = new Date(day);
  start.setHours(startHour, 0, 0, 0);

  const end = new Date(day);
  end.setHours(endHour, 0, 0, 0);

  const timestamp = randomInt(start.getTime(), end.getTime());
  return new Date(timestamp);
}

function pickCantidad(presentacion) {
  if (presentacion.tipo === "PESO" || presentacion.tipo === "VOLUMEN") {
    return randomFloat(0.25, 2.5, 3);
  }

  return randomInt(1, 3);
}

function pickMetodoPago() {
  const roll = Math.random();

  if (roll < 0.68) {
    return "EFECTIVO";
  }

  if (roll < 0.9) {
    return "TARJETA";
  }

  return "TRANSFERENCIA";
}

async function main() {
  const administrador = await prisma.usuario.findUnique({
    where: { usuario: "admin" },
  });

  if (!administrador) {
    throw new Error("Primero ejecuta: npx prisma db seed");
  }

  const presentaciones = await prisma.presentacionProducto.findMany({
    where: { activo: true, producto: { activo: true } },
    include: { producto: true },
  });

  if (presentaciones.length === 0) {
    throw new Error(
      "No hay productos activos. Primero corre: node prisma/seed-productos-prueba.js",
    );
  }

  // Existencia en memoria por presentación, para no vender de más
  // ni dejar saldos inconsistentes.
  const stockPorProducto = new Map();

  for (const presentacion of presentaciones) {
    stockPorProducto.set(
      presentacion.productoId,
      Number(presentacion.producto.stockActual),
    );
  }

  // --- Proveedores de prueba (para las compras) ---
  const proveedores = [];

  for (const datos of PROVEEDORES_PRUEBA) {
    const existente = await prisma.proveedor.findFirst({
      where: { nombre: datos.nombre },
    });

    const proveedor = existente ?? (await prisma.proveedor.create({ data: datos }));

    proveedores.push(proveedor);
  }

  let ventasCreadas = 0;
  let ventasCanceladas = 0;
  let comprasCreadas = 0;
  let turnosCreados = 0;

  const hoy = startOfDay(new Date());

  for (let offset = DIAS - 1; offset >= 0; offset -= 1) {
    const dia = new Date(hoy);
    dia.setDate(dia.getDate() - offset);

    const aperturaHora = 8;
    const cierreHora = randomInt(21, 22);

    const abiertoEn = randomTimeOnDay(dia, aperturaHora, aperturaHora + 1);
    const fondoInicial = 500;

    const turno = await prisma.turnoCaja.create({
      data: {
        usuarioAperturaId: administrador.id,
        fondoInicial,
        estado: "ABIERTO",
        abiertoEn,
      },
    });

    turnosCreados += 1;

    const numeroVentas = randomInt(VENTAS_MIN_POR_DIA, VENTAS_MAX_POR_DIA);
    let totalEfectivoTurno = 0;

    for (let i = 0; i < numeroVentas; i += 1) {
      const creadoEn = randomTimeOnDay(dia, aperturaHora, cierreHora);
      const cantidadItems = randomInt(1, 6);
      const itemsElegidos = new Set();
      const detalles = [];

      for (let j = 0; j < cantidadItems; j += 1) {
        const presentacion = pickRandom(presentaciones);

        if (itemsElegidos.has(presentacion.id)) {
          continue;
        }

        const stockActual = stockPorProducto.get(presentacion.productoId) ?? 0;
        const factor = Number(presentacion.factorInventario);
        const cantidad = pickCantidad(presentacion);
        const cantidadInventario = round2(cantidad * factor);

        if (cantidadInventario > stockActual) {
          continue;
        }

        itemsElegidos.add(presentacion.id);

        const precioUnitario = Number(presentacion.precioBase);
        const costoUnitario = Number(presentacion.producto.costoPromedio);
        const subtotal = round2(cantidad * precioUnitario);

        detalles.push({
          productoId: presentacion.productoId,
          presentacionId: presentacion.id,
          productoNombre: presentacion.producto.nombre,
          presentacionNombre: presentacion.nombre,
          cantidad,
          factorInventario: factor,
          cantidadInventario,
          costoUnitario,
          precioUnitario,
          subtotal,
          precioOrigen: "NORMAL",
        });

        stockPorProducto.set(
          presentacion.productoId,
          round2(stockActual - cantidadInventario),
        );
      }

      if (detalles.length === 0) {
        continue;
      }

      const total = round2(detalles.reduce((sum, item) => sum + item.subtotal, 0));
      const metodoPago = pickMetodoPago();
      const esCancelada = Math.random() < 0.04;

      let recibido = null;
      let cambio = 0;

      if (metodoPago === "EFECTIVO") {
        const extra = round2(randomFloat(0, 20, 2));
        recibido = round2(total + extra);
        cambio = round2(recibido - total);
      }

      const venta = await prisma.venta.create({
        data: {
          usuarioId: administrador.id,
          turnoCajaId: turno.id,
          subtotal: total,
          total,
          estado: esCancelada ? "CANCELADA" : "COMPLETADA",
          creadoEn,
          canceladoEn: esCancelada
            ? randomTimeOnDay(dia, aperturaHora, cierreHora)
            : null,
          detalles: { create: detalles },
          pagos: {
            create: {
              metodo: metodoPago,
              monto: total,
              recibido,
              cambio,
              creadoEn,
            },
          },
        },
      });

      for (const detalle of detalles) {
        const stockDespuesDeLaVenta = stockPorProducto.get(detalle.productoId);

        await prisma.movimientoInventario.create({
          data: {
            productoId: detalle.productoId,
            usuarioId: administrador.id,
            ventaId: venta.id,
            tipo: "VENTA",
            cantidad: detalle.cantidadInventario,
            saldoPosterior: stockDespuesDeLaVenta,
            costoUnitario: detalle.costoUnitario,
            motivo: `Venta #${venta.id}.`,
            creadoEn,
          },
        });

        if (esCancelada) {
          const stockRestaurado = round2(
            stockDespuesDeLaVenta + detalle.cantidadInventario,
          );

          stockPorProducto.set(detalle.productoId, stockRestaurado);

          await prisma.movimientoInventario.create({
            data: {
              productoId: detalle.productoId,
              usuarioId: administrador.id,
              ventaId: venta.id,
              tipo: "CANCELACION_VENTA",
              cantidad: detalle.cantidadInventario,
              saldoPosterior: stockRestaurado,
              motivo: `Cancelación de venta #${venta.id}.`,
              creadoEn: venta.canceladoEn,
            },
          });
        }
      }

      if (esCancelada) {
        ventasCanceladas += 1;
      } else {
        ventasCreadas += 1;

        if (metodoPago === "EFECTIVO") {
          totalEfectivoTurno += total;
        }
      }
    }

    // Movimientos de caja ocasionales (ingreso o retiro), a veces más de uno
    const numeroMovimientosCaja = Math.random() < 0.6 ? randomInt(1, 3) : 0;

    for (let m = 0; m < numeroMovimientosCaja; m += 1) {
      const esIngreso = Math.random() < 0.5;
      const monto = randomFloat(50, 300, 2);

      await prisma.movimientoCaja.create({
        data: {
          turnoCajaId: turno.id,
          usuarioId: administrador.id,
          tipo: esIngreso ? "INGRESO" : "RETIRO",
          monto,
          motivo: esIngreso ? "Ingreso de prueba" : "Retiro de prueba",
          creadoEn: randomTimeOnDay(dia, aperturaHora, cierreHora),
        },
      });

      totalEfectivoTurno += esIngreso ? monto : -monto;
    }

    const cierreEn = randomTimeOnDay(dia, cierreHora, Math.min(cierreHora + 1, 23));
    const efectivoEsperado = round2(fondoInicial + totalEfectivoTurno);

    await prisma.turnoCaja.update({
      where: { id: turno.id },
      data: {
        estado: "CERRADO",
        usuarioCierreId: administrador.id,
        efectivoEsperadoCierre: efectivoEsperado,
        efectivoContado: efectivoEsperado,
        diferencia: 0,
        cerradoEn: cierreEn,
      },
    });

    // Compra ocasional (cada ~2 días)
    if (offset % 2 === 0) {
      const proveedor = pickRandom(proveedores);
      const cantidadItems = randomInt(4, 10);
      const detallesCompra = [];
      const usados = new Set();

      for (let j = 0; j < cantidadItems; j += 1) {
        const presentacion = pickRandom(presentaciones);

        if (usados.has(presentacion.id)) {
          continue;
        }

        usados.add(presentacion.id);

        const factor = Number(presentacion.factorInventario);
        const cantidad = randomInt(5, 20);
        const cantidadInventario = cantidad * factor;
        const costoPresentacion = round2(
          Number(presentacion.producto.costoPromedio) * factor,
        );
        const subtotal = round2(cantidad * costoPresentacion);

        detallesCompra.push({
          productoId: presentacion.productoId,
          presentacionId: presentacion.id,
          productoNombre: presentacion.producto.nombre,
          presentacionNombre: presentacion.nombre,
          cantidad,
          factorInventario: factor,
          cantidadInventario,
          costoPresentacion,
          costoUnitarioInventario: Number(presentacion.producto.costoPromedio),
          subtotal,
        });

        stockPorProducto.set(
          presentacion.productoId,
          (stockPorProducto.get(presentacion.productoId) ?? 0) + cantidadInventario,
        );
      }

      if (detallesCompra.length > 0) {
        const totalCompra = round2(
          detallesCompra.reduce((sum, item) => sum + item.subtotal, 0),
        );

        const compra = await prisma.compra.create({
          data: {
            proveedorId: proveedor.id,
            usuarioId: administrador.id,
            proveedorNombre: proveedor.nombre,
            numeroDocumento: `TEST-${randomInt(1000, 9999)}`,
            notas: "Compra generada para pruebas.",
            total: totalCompra,
            creadoEn: randomTimeOnDay(dia, 9, 17),
            detalles: { create: detallesCompra },
          },
        });

        for (const detalle of detallesCompra) {
          await prisma.movimientoInventario.create({
            data: {
              productoId: detalle.productoId,
              usuarioId: administrador.id,
              compraId: compra.id,
              tipo: "COMPRA",
              cantidad: detalle.cantidadInventario,
              saldoPosterior: stockPorProducto.get(detalle.productoId),
              costoUnitario: detalle.costoUnitarioInventario,
              motivo: `Compra #${compra.id}.`,
              creadoEn: compra.creadoEn,
            },
          });
        }

        comprasCreadas += 1;
      }
    }
  }

  // Deja el stock final consistente en cada producto.
  for (const [productoId, stock] of stockPorProducto.entries()) {
    await prisma.producto.update({
      where: { id: productoId },
      data: { stockActual: Math.max(0, stock) },
    });
  }

  console.log(`Turnos de caja creados: ${turnosCreados}`);
  console.log(`Ventas completadas: ${ventasCreadas}`);
  console.log(`Ventas canceladas: ${ventasCanceladas}`);
  console.log(`Compras creadas: ${comprasCreadas}`);
  console.log("Listo. Ya tienes ~30 días de historial para probar reportes, caja e inventario.");
}

main()
  .catch((error) => {
    console.error("No se pudo generar el mes de prueba:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });