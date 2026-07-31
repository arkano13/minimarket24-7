import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";

const MOVEMENT_TYPES = new Set(["INGRESO", "RETIRO"]);

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

function serializeShift(shift) {
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

    movimientos: shift.movimientos.map(
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

export async function getCurrentCashShift() {
  const shift = await findOpenShift();

  return shift
    ? serializeShift(shift)
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

      return serializeShift(shift);
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

      return serializeShift(updatedShift);
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

      return serializeShift(closedShift);
    },
  );
}