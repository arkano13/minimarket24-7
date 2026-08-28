import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";

const MOVEMENT_TYPES = new Set(["INGRESO", "RETIRO"]);

// Identity comes from the authenticated session, never from client filters.
export async function listMyCashActivity(userId, filters = {}) {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new AppError("Sesión no válida.", 401);
  }
  const fecha = filters.fecha ?? new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const calendarDate = typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ? new Date(`${fecha}T00:00:00Z`) : new Date(NaN);
  if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== fecha) {
    throw new AppError("La fecha no es válida.", 400);
  }
  const tipo = filters.tipo ?? "VENTA";
  if (!["VENTA", "INGRESO", "RETIRO"].includes(tipo)) {
    throw new AppError("Selecciona ventas, ingresos o retiros.", 400);
  }
  const page = Number(filters.page ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) {
    throw new AppError("La página no es válida.", 400);
  }
  const from = new Date(`${fecha}T00:00:00-06:00`);
  const to = new Date(from.getTime() + 86_400_000);
  const query = {
    where: { usuarioId: userId, creadoEn: { gte: from, lt: to } },
    orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
    skip: (page - 1) * 20,
    take: 21,
  };
  let records;
  if (tipo === "VENTA") {
    const sales = await prisma.venta.findMany({
      ...query,
      select: {
        id: true, turnoCajaId: true, creadoEn: true, total: true, estado: true,
        detalles: {
          orderBy: { id: "asc" },
          select: { id: true, productoNombre: true, presentacionNombre: true, cantidad: true, subtotal: true },
        },
        pagos: { select: { metodo: true, monto: true } },
      },
    });
    records = sales.map((sale) => ({
      id: sale.id, tipo, turnoCajaId: sale.turnoCajaId, creadoEn: sale.creadoEn,
      monto: Number(sale.total), estado: sale.estado,
      productos: sale.detalles.map((item) => ({
        id: item.id, nombre: item.productoNombre, presentacion: item.presentacionNombre,
        cantidad: Number(item.cantidad), subtotal: Number(item.subtotal),
      })),
      pagos: sale.pagos.map((payment) => ({ metodo: payment.metodo, monto: Number(payment.monto) })),
    }));
  } else {
    const movements = await prisma.movimientoCaja.findMany({
      ...query,
      where: { ...query.where, tipo },
      select: { id: true, turnoCajaId: true, creadoEn: true, monto: true, motivo: true, tipo: true },
    });
    records = movements.map((movement) => ({ ...movement, monto: Number(movement.monto) }));
  }
  return { registros: records.slice(0, 20), page, hayMas: records.length > 20, fecha, tipo };
}

const SHIFT_INCLUDE = {
  usuarioApertura: {
    select: {
      id: true,
      nombre: true,
    },
  },
  usuarioCierre: {
    select: {
      id: true,
      nombre: true,
    },
  },
  ventas: {
    where: {
      estado: "COMPLETADA",
    },
    select: {
      id: true,
      total: true,
      pagos: {
        select: {
          metodo: true,
          monto: true,
        },
      },
    },
  },
  movimientos: {
    include: {
      usuario: {
        select: {
          id: true,
          nombre: true,
        },
      },
    },
    orderBy: {
      creadoEn: "desc",
    },
  },
};

function decimalValue(value, field, { positive = false } = {}) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0 ||
    (positive && number <= 0)
  ) {
    throw new AppError(
      `${field} debe ser ${
        positive ? "mayor que cero" : "cero o mayor"
      }.`,
      400,
    );
  }

  return new Prisma.Decimal(String(number));
}

function cleanReason(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(
      "Escribe el motivo del movimiento.",
      400,
    );
  }

  const reason = value.trim().replace(/\s+/g, " ");

  if (reason.length > 200) {
    throw new AppError(
      "El motivo no puede superar 200 caracteres.",
      400,
    );
  }

  return reason;
}

function calculateTotals(shift) {
  let cash = new Prisma.Decimal(0);
  let card = new Prisma.Decimal(0);
  let transfer = new Prisma.Decimal(0);
  let salesTotal = new Prisma.Decimal(0);
  let income = new Prisma.Decimal(0);
  let withdrawal = new Prisma.Decimal(0);

  for (const sale of shift.ventas) {
    salesTotal = salesTotal.add(sale.total);

    for (const payment of sale.pagos) {
      if (payment.metodo === "EFECTIVO") {
        cash = cash.add(payment.monto);
      } else if (payment.metodo === "TARJETA") {
        card = card.add(payment.monto);
      } else if (payment.metodo === "TRANSFERENCIA") {
        transfer = transfer.add(payment.monto);
      }
    }
  }

  for (const movement of shift.movimientos) {
    if (movement.tipo === "INGRESO") {
      income = income.add(movement.monto);
    } else {
      withdrawal = withdrawal.add(movement.monto);
    }
  }

  const expectedCash = new Prisma.Decimal(
    shift.fondoInicial,
  )
    .add(cash)
    .add(income)
    .sub(withdrawal)
    .toDecimalPlaces(2);

  return {
    cash,
    card,
    transfer,
    salesTotal,
    income,
    withdrawal,
    expectedCash,
  };
}

function serializeShift(shift, userId) {
  const totals = calculateTotals(shift);

  return {
    id: shift.id,
    estado: shift.estado,
    fondoInicial: Number(shift.fondoInicial),

    efectivoEsperado: Number(
      shift.efectivoEsperadoCierre ??
        totals.expectedCash,
    ),

    efectivoContado:
      shift.efectivoContado === null
        ? null
        : Number(shift.efectivoContado),

    diferencia:
      shift.diferencia === null
        ? null
        : Number(shift.diferencia),

    abiertoEn: shift.abiertoEn,
    cerradoEn: shift.cerradoEn,

    usuarioApertura: shift.usuarioApertura,
    usuarioCierre: shift.usuarioCierre,

    totales: {
      cantidadVentas: shift.ventas.length,
      ventas: Number(totals.salesTotal),
      efectivo: Number(totals.cash),
      tarjeta: Number(totals.card),
      transferencia: Number(totals.transfer),
      ingresos: Number(totals.income),
      retiros: Number(totals.withdrawal),
    },

    movimientos: shift.movimientos.filter((movement) => movement.usuario.id === userId).map(
      (movement) => ({
        id: movement.id,
        tipo: movement.tipo,
        monto: Number(movement.monto),
        motivo: movement.motivo,
        creadoEn: movement.creadoEn,
        usuario: movement.usuario,
      }),
    ),
  };
}

async function findOpenShift(client = prisma) {
  return client.turnoCaja.findFirst({
    where: {
      estado: "ABIERTO",
    },

    include: SHIFT_INCLUDE,

    orderBy: {
      abiertoEn: "desc",
    },
  });
}

export async function getCurrentCashShift(userId) {
  const shift = await findOpenShift();

  return shift
    ? serializeShift(shift, userId)
    : null;
}

export async function openCashShift(data, userId) {
  const initialFund = decimalValue(
    data.fondoInicial ?? 0,
    "El fondo inicial",
  );

  return prisma.$transaction(
    async (transaction) => {
      const openShift =
        await transaction.turnoCaja.findFirst({
          where: {
            estado: "ABIERTO",
          },
          select: {
            id: true,
          },
        });

      if (openShift) {
        throw new AppError(
          "Ya existe una caja abierta.",
          409,
        );
      }

      const shift =
        await transaction.turnoCaja.create({
          data: {
            usuarioAperturaId: userId,
            fondoInicial: initialFund,
          },
          include: SHIFT_INCLUDE,
        });

      return serializeShift(shift, userId);
    },
  );
}

export async function createCashMovement(
  data,
  userId,
) {
  const type = String(
    data.tipo ?? "",
  ).toUpperCase();

  if (!MOVEMENT_TYPES.has(type)) {
    throw new AppError(
      "Selecciona ingreso o retiro.",
      400,
    );
  }

  const amount = decimalValue(
    data.monto,
    "El monto",
    {
      positive: true,
    },
  );

  const reason = cleanReason(data.motivo);

  return prisma.$transaction(
    async (transaction) => {
      const shift =
        await findOpenShift(transaction);

      if (!shift) {
        throw new AppError(
          "No hay una caja abierta.",
          400,
        );
      }

      if (
        type === "RETIRO" &&
        amount.greaterThan(
          calculateTotals(shift).expectedCash,
        )
      ) {
        throw new AppError(
          "El retiro supera el efectivo esperado en caja.",
          400,
        );
      }

      await transaction.movimientoCaja.create({
        data: {
          turnoCajaId: shift.id,
          usuarioId: userId,
          tipo: type,
          monto: amount,
          motivo: reason,
        },
      });

      const updatedShift =
        await findOpenShift(transaction);

      return serializeShift(updatedShift, userId);
    },
  );
}

export async function closeCashShift(
  data,
  userId,
) {
  const countedCash = decimalValue(
    data.efectivoContado,
    "El efectivo contado",
  );

  return prisma.$transaction(
    async (transaction) => {
      const shift =
        await findOpenShift(transaction);

      if (!shift) {
        throw new AppError(
          "No hay una caja abierta.",
          400,
        );
      }

      const totals = calculateTotals(shift);

      const difference = countedCash
        .sub(totals.expectedCash)
        .toDecimalPlaces(2);

      const closedShift =
        await transaction.turnoCaja.update({
          where: {
            id: shift.id,
          },

          data: {
            usuarioCierreId: userId,
            efectivoEsperadoCierre:
              totals.expectedCash,
            efectivoContado: countedCash,
            diferencia: difference,
            estado: "CERRADO",
            cerradoEn: new Date(),
          },

          include: SHIFT_INCLUDE,
        });

      return serializeShift(closedShift, userId);
    },
  );
}
