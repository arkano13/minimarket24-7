import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";

const MOVEMENT_TYPES = new Set(["INGRESO", "RETIRO"]);
const MOVEMENT_METHODS = new Set(["EFECTIVO", "TARJETA", "TRANSFERENCIA"]);

const HONDURAS_TIME_ZONE = "America/Tegucigalpa";

const hondurasDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: HONDURAS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// Fecha (YYYY-MM-DD) y minuto del día (0-1439) de un instante, en hora de
// Honduras. Se usa para clasificar cada venta/movimiento en su turno.
function localDateAndMinute(date) {
  const parts = hondurasDateTimeFormatter.formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value;

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minute: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

function shiftCalendarDate(fecha, days) {
  const value = new Date(`${fecha}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// El "día de negocio" arranca a las 2am (inicio del Turno A), no a
// medianoche. Si todavía no son las 2am, seguimos dentro del día anterior.
function currentBusinessDate() {
  const local = localDateAndMinute(new Date());
  return local.minute < 120 ? shiftCalendarDate(local.date, -1) : local.date;
}

const SHIFT_LABELS = {
  A: "Turno A · 2am–8am",
  B: "Turno B · 8am–6pm",
  C: "Turno C · 6pm–2am",
};
const ALL_SHIFTS = ["A", "B", "C"];

// Clasifica un instante (ya expresado como fecha local + minuto) dentro del
// turno A/B/C del día de negocio "fecha" (que arranca a las 2am de "fecha"
// y termina a las 2am de "fecha" + 1, porque el Turno C cruza la
// medianoche).
function classifyShift(fecha, nextFecha, localDate, minute) {
  if (localDate === fecha && minute >= 120 && minute < 480) return "A";
  if (localDate === fecha && minute >= 480 && minute < 1080) return "B";
  if (
    (localDate === fecha && minute >= 1080) ||
    (localDate === nextFecha && minute < 120)
  ) {
    return "C";
  }
  return null;
}

// Identity comes from the authenticated session, never from client filters.
export async function listMyCashActivity(userId, filters = {}) {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new AppError("Sesión no válida.", 401);
  }

  const fecha = filters.fecha ?? currentBusinessDate();
  const calendarDate = typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ? new Date(`${fecha}T00:00:00Z`) : new Date(NaN);
  if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== fecha) {
    throw new AppError("La fecha no es válida.", 400);
  }

  const tipo = filters.tipo ?? "VENTA";
  if (!["VENTA", "INGRESO", "RETIRO", "TODO"].includes(tipo)) {
    throw new AppError("Selecciona ventas, ingresos, retiros o todo.", 400);
  }
  const page = Number(filters.page ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) {
    throw new AppError("La página no es válida.", 400);
  }

  // Turnos pedidos: por default, los 3 (sin restricción). Se puede elegir
  // uno o varios.
  const requestedShifts = Array.isArray(filters.turnos) && filters.turnos.length > 0
    ? [...new Set(filters.turnos.map((value) => String(value).toUpperCase()))].filter((value) =>
        ALL_SHIFTS.includes(value),
      )
    : ALL_SHIFTS;
  if (requestedShifts.length === 0) {
    throw new AppError("Selecciona al menos un turno.", 400);
  }
  const shiftSet = new Set(requestedShifts);

  const nextFecha = shiftCalendarDate(fecha, 1);

  // El día de negocio va de las 2am de "fecha" a las 2am del día
  // siguiente, para que el Turno C (6pm-2am) quede completo dentro de la
  // misma consulta.
  const from = new Date(`${fecha}T02:00:00-06:00`);
  const to = new Date(`${nextFecha}T02:00:00-06:00`);
  const baseWhere = { usuarioId: userId, creadoEn: { gte: from, lt: to } };

  async function fetchSales() {
    const sales = await prisma.venta.findMany({
      where: baseWhere,
      orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
      select: {
        id: true, turnoCajaId: true, creadoEn: true, total: true, estado: true,
        detalles: {
          orderBy: { id: "asc" },
          select: { id: true, productoNombre: true, presentacionNombre: true, cantidad: true, subtotal: true },
        },
        pagos: { select: { metodo: true, monto: true } },
      },
    });
    return sales.map((sale) => ({
      id: sale.id, tipo: "VENTA", turnoCajaId: sale.turnoCajaId, creadoEn: sale.creadoEn,
      monto: Number(sale.total), estado: sale.estado,
      productos: sale.detalles.map((item) => ({
        id: item.id, nombre: item.productoNombre, presentacion: item.presentacionNombre,
        cantidad: Number(item.cantidad), subtotal: Number(item.subtotal),
      })),
      pagos: sale.pagos.map((payment) => ({ metodo: payment.metodo, monto: Number(payment.monto) })),
    }));
  }

  async function fetchMovements(tipoFiltro) {
    const movements = await prisma.movimientoCaja.findMany({
      where: { ...baseWhere, ...(tipoFiltro ? { tipo: tipoFiltro } : { tipo: { in: ["INGRESO", "RETIRO"] } }) },
      orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
      select: { id: true, turnoCajaId: true, creadoEn: true, monto: true, motivo: true, tipo: true, metodo: true },
    });
    return movements.map((movement) => ({ ...movement, monto: Number(movement.monto) }));
  }

  let records;
  if (tipo === "VENTA") {
    records = await fetchSales();
  } else if (tipo === "TODO") {
    const [sales, movements] = await Promise.all([fetchSales(), fetchMovements()]);
    records = [...sales, ...movements];
  } else {
    records = await fetchMovements(tipo);
  }

  // Filtra por turno (si se pidió un subconjunto) usando la hora local del
  // registro, no la de la consulta.
  records = records.filter((record) => {
    const local = localDateAndMinute(record.creadoEn);
    const shift = classifyShift(fecha, nextFecha, local.date, local.minute);
    return shift !== null && shiftSet.has(shift);
  });

  records.sort(
    (a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime() || b.id - a.id,
  );

  const skip = (page - 1) * 20;
  const paged = records.slice(skip, skip + 21);

  return {
    registros: paged.slice(0, 20),
    page,
    hayMas: paged.length > 20,
    fecha,
    tipo,
    turnos: requestedShifts,
  };
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

// Todos los pagos de venta en EFECTIVO son dinero físico en caja. Los
// ingresos/retiros ahora tienen su propio "metodo" (efectivo, tarjeta o
// transferencia): solo los que son en efectivo mueven el efectivo esperado
// de la gaveta.
function calculateTotals(shift) {
  let cash = new Prisma.Decimal(0);
  let card = new Prisma.Decimal(0);
  let transfer = new Prisma.Decimal(0);
  let salesTotal = new Prisma.Decimal(0);
  let incomeCash = new Prisma.Decimal(0);
  let incomeCard = new Prisma.Decimal(0);
  let incomeTransfer = new Prisma.Decimal(0);
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
      // CREDITO: no mueve efectivo, tarjeta ni transferencia de caja.
    }
  }

  for (const movement of shift.movimientos) {
    if (movement.tipo === "INGRESO") {
      if (movement.metodo === "TARJETA") {
        incomeCard = incomeCard.add(movement.monto);
      } else if (movement.metodo === "TRANSFERENCIA") {
        incomeTransfer = incomeTransfer.add(movement.monto);
      } else {
        incomeCash = incomeCash.add(movement.monto);
      }
    } else {
      // Los retiros siempre son en efectivo.
      withdrawal = withdrawal.add(movement.monto);
    }
  }

  const income = incomeCash.add(incomeCard).add(incomeTransfer);

  const expectedCash = new Prisma.Decimal(
    shift.fondoInicial,
  )
    .add(cash)
    .add(incomeCash)
    .sub(withdrawal)
    .toDecimalPlaces(2);

  return {
    cash,
    card,
    transfer,
    salesTotal,
    income,
    incomeCash,
    incomeCard,
    incomeTransfer,
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
      ingresosEfectivo: Number(totals.incomeCash),
      ingresosTarjeta: Number(totals.incomeCard),
      ingresosTransferencia: Number(totals.incomeTransfer),
      retiros: Number(totals.withdrawal),
    },

    movimientos: shift.movimientos.filter((movement) => movement.usuario.id === userId).map(
      (movement) => ({
        id: movement.id,
        tipo: movement.tipo,
        metodo: movement.metodo,
        monto: Number(movement.monto),
        motivo: movement.motivo,
        creadoEn: movement.creadoEn,
        usuario: movement.usuario,
      }),
    ),
  };
}

// Cada usuario tiene su propia caja: puede haber varias cajas ABIERTAS al
// mismo tiempo (una por PC/cajero), pero nunca dos abiertas para el mismo
// usuario.
async function findOpenShift(userId, client = prisma) {
  return client.turnoCaja.findFirst({
    where: {
      estado: "ABIERTO",
      usuarioAperturaId: userId,
    },

    include: SHIFT_INCLUDE,

    orderBy: {
      abiertoEn: "desc",
    },
  });
}

export async function getCurrentCashShift(userId) {
  const shift = await findOpenShift(userId);

  return shift
    ? serializeShift(shift, userId)
    : null;
}

export async function openCashShift(data, userId) {
  // El fondo inicial arranca en 0 si no se especifica: cada cajero cuenta
  // y declara lo que en realidad tiene en su gaveta al abrir.
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
            usuarioAperturaId: userId,
          },
          select: {
            id: true,
          },
        });

      if (openShift) {
        throw new AppError(
          "Ya tienes una caja abierta.",
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
    // Serializable evita que, si el mismo usuario dispara dos aperturas casi
    // a la vez (doble click, dos pestañas), terminen dos cajas abiertas.
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
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

  // Los retiros son siempre en efectivo (es plata física que sale de la
  // gaveta). Los ingresos sí pueden declararse en efectivo o tarjeta.
  const method =
    type === "RETIRO"
      ? "EFECTIVO"
      : String(data.metodo ?? "EFECTIVO").toUpperCase();

  if (!MOVEMENT_METHODS.has(method)) {
    throw new AppError(
      "Selecciona efectivo o tarjeta.",
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
        await findOpenShift(userId, transaction);

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
          metodo: method,
          monto: amount,
          motivo: reason,
        },
      });

      const updatedShift =
        await findOpenShift(userId, transaction);

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
        await findOpenShift(userId, transaction);

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


// apps/backend/src/modules/caja/caja.service.js
// (agregar al final del archivo, junto a los demás exports)

function serializeShiftCompleto(shift) {
  const totals = calculateTotals(shift);

  return {
    id: shift.id,
    estado: shift.estado,
    fondoInicial: Number(shift.fondoInicial),
    efectivoEsperado: Number(shift.efectivoEsperadoCierre ?? totals.expectedCash),
    efectivoContado: shift.efectivoContado === null ? null : Number(shift.efectivoContado),
    diferencia: shift.diferencia === null ? null : Number(shift.diferencia),
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
      ingresosEfectivo: Number(totals.incomeCash),
      ingresosTarjeta: Number(totals.incomeCard),
      ingresosTransferencia: Number(totals.incomeTransfer),
      retiros: Number(totals.withdrawal),
    },
    movimientos: shift.movimientos.map((m) => ({
      id: m.id, tipo: m.tipo, metodo: m.metodo, monto: Number(m.monto),
      motivo: m.motivo, creadoEn: m.creadoEn, usuario: m.usuario,
    })),
  };
}

// Lista TODAS las cajas (de todos los usuarios) abiertas ese día — para
// reportes/supervisión, no para el flujo de un cajero individual.
export async function listCashShifts(dateInput) {
  const fecha =
    typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
      ? dateInput
      : new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const from = new Date(`${fecha}T00:00:00-06:00`);
  const to = new Date(from.getTime() + 86_400_000);

  const shifts = await prisma.turnoCaja.findMany({
    where: { abiertoEn: { gte: from, lt: to } },
    include: SHIFT_INCLUDE,
    orderBy: { abiertoEn: "desc" },
  });

  return shifts.map(serializeShiftCompleto);
}
