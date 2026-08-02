import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";

function normalizarTexto(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizarTextoOpcional(
  value,
  maxLength,
  fieldName,
) {
  const text = normalizarTexto(value);

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new AppError(
      `${fieldName} no puede superar los ${maxLength} caracteres.`,
      400,
    );
  }

  return text;
}

function validarNombreNegocio(value) {
  const name = normalizarTexto(value);

  if (!name) {
    throw new AppError(
      "Escribe el nombre del negocio.",
      400,
    );
  }

  if (name.length > 120) {
    throw new AppError(
      "El nombre del negocio no puede superar los 120 caracteres.",
      400,
    );
  }

  return name;
}

function validarSimboloMoneda(value) {
  const symbol = normalizarTexto(value);

  if (!symbol) {
    throw new AppError(
      "Escribe el símbolo de la moneda.",
      400,
    );
  }

  if (symbol.length > 10) {
    throw new AppError(
      "El símbolo de la moneda no puede superar los 10 caracteres.",
      400,
    );
  }

  return symbol;
}

function validarFondoInicial(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError(
      "El fondo inicial debe ser un monto válido.",
      400,
    );
  }

  if (amount > 999999999999) {
    throw new AppError(
      "El fondo inicial es demasiado grande.",
      400,
    );
  }

  return Number(amount.toFixed(2));
}

function horaAMinutos(value) {
  const time = String(value ?? "").trim();

  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new AppError(
      "Uno de los horarios no es válido.",
      400,
    );
  }

  const [hour, minute] = time
    .split(":")
    .map(Number);

  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new AppError(
      "Uno de los horarios no es válido.",
      400,
    );
  }

  return hour * 60 + minute;
}

function minutosAHora(value) {
  const totalMinutes = Number(value);
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(
    minute,
  ).padStart(2, "0")}`;
}

function duracionFranja(startMinute, endMinute) {
  return (
    (endMinute - startMinute + 24 * 60) %
    (24 * 60)
  );
}

function validarTurnos(turnos, existingShifts) {
  if (!Array.isArray(turnos) || turnos.length !== 3) {
    throw new AppError(
      "Deben existir exactamente tres turnos.",
      400,
    );
  }

  const existingIds = new Set(
    existingShifts.map((shift) => shift.id),
  );

  const normalizedShifts = turnos.map(
    (shift, index) => {
      const id = Number(shift.id);

      if (
        !Number.isInteger(id) ||
        !existingIds.has(id)
      ) {
        throw new AppError(
          "Uno de los turnos no es válido.",
          400,
        );
      }

      return {
        id,
        orden: index + 1,
        minutoInicio: horaAMinutos(shift.horaInicio),
        minutoFin: horaAMinutos(shift.horaFin),
      };
    },
  );

  const uniqueIds = new Set(
    normalizedShifts.map((shift) => shift.id),
  );

  if (uniqueIds.size !== 3) {
    throw new AppError(
      "No se puede repetir el mismo turno.",
      400,
    );
  }

  for (
    let index = 0;
    index < normalizedShifts.length;
    index += 1
  ) {
    const currentShift = normalizedShifts[index];
    const nextShift =
      normalizedShifts[
        (index + 1) % normalizedShifts.length
      ];

    if (
      currentShift.minutoFin !==
      nextShift.minutoInicio
    ) {
      throw new AppError(
        "Los turnos deben ser continuos, sin espacios ni horarios superpuestos.",
        400,
      );
    }

    if (
      duracionFranja(
        currentShift.minutoInicio,
        currentShift.minutoFin,
      ) === 0
    ) {
      throw new AppError(
        "Un turno no puede iniciar y terminar a la misma hora.",
        400,
      );
    }
  }

  const totalMinutes = normalizedShifts.reduce(
    (total, shift) =>
      total +
      duracionFranja(
        shift.minutoInicio,
        shift.minutoFin,
      ),
    0,
  );

  if (totalMinutes !== 24 * 60) {
    throw new AppError(
      "Los tres turnos deben cubrir las 24 horas del día.",
      400,
    );
  }

  return normalizedShifts;
}

function formatearConfiguracion(
  configuration,
  shifts,
) {
  return {
    id: configuration.id,
    nombreNegocio: configuration.nombreNegocio,
    direccion: configuration.direccion ?? "",
    telefono: configuration.telefono ?? "",
    simboloMoneda: configuration.simboloMoneda,
    fondoInicial: Number(configuration.fondoInicial),
    mensajeReportes:
      configuration.mensajeReportes ?? "",
    actualizadoEn: configuration.actualizadoEn,
    turnos: shifts.map((shift) => ({
      id: shift.id,
      nombre: shift.nombre,
      orden: shift.orden,
      horaInicio: minutosAHora(
        shift.minutoInicio,
      ),
      horaFin: minutosAHora(shift.minutoFin),
    })),
  };
}

async function obtenerOCrearConfiguracion(client) {
  return client.configuracionSistema.upsert({
    where: {
      id: 1,
    },
    update: {},
    create: {
      id: 1,
    },
  });
}

export async function getConfiguration() {
  const configuration =
    await obtenerOCrearConfiguracion(prisma);

  const shifts =
    await prisma.franjaHorariaPrecio.findMany({
      where: {
        activo: true,
      },
      orderBy: [
        {
          orden: "asc",
        },
        {
          id: "asc",
        },
      ],
    });

  if (shifts.length !== 3) {
    throw new AppError(
      "La configuración de turnos está incompleta. Deben existir exactamente tres turnos activos.",
      500,
    );
  }

  return formatearConfiguracion(
    configuration,
    shifts,
  );
}

export async function updateConfiguration(
  payload = {},
) {
  const businessName = validarNombreNegocio(
    payload.nombreNegocio,
  );

  const address = normalizarTextoOpcional(
    payload.direccion,
    250,
    "La dirección",
  );

  const phone = normalizarTextoOpcional(
    payload.telefono,
    30,
    "El teléfono",
  );

  const currencySymbol = validarSimboloMoneda(
    payload.simboloMoneda,
  );

  const openingFund = validarFondoInicial(
    payload.fondoInicial,
  );

  const reportMessage = normalizarTextoOpcional(
    payload.mensajeReportes,
    300,
    "El mensaje para reportes",
  );

  await prisma.$transaction(async (transaction) => {
    const existingShifts =
      await transaction.franjaHorariaPrecio.findMany({
        where: {
          activo: true,
        },
        orderBy: [
          {
            orden: "asc",
          },
          {
            id: "asc",
          },
        ],
      });

    if (existingShifts.length !== 3) {
      throw new AppError(
        "La configuración de turnos está incompleta.",
        500,
      );
    }

    const normalizedShifts = validarTurnos(
      payload.turnos,
      existingShifts,
    );

    await transaction.configuracionSistema.upsert({
      where: {
        id: 1,
      },
      update: {
        nombreNegocio: businessName,
        direccion: address,
        telefono: phone,
        simboloMoneda: currencySymbol,
        fondoInicial: openingFund,
        mensajeReportes: reportMessage,
      },
      create: {
        id: 1,
        nombreNegocio: businessName,
        direccion: address,
        telefono: phone,
        simboloMoneda: currencySymbol,
        fondoInicial: openingFund,
        mensajeReportes: reportMessage,
      },
    });

    /*
     * Se actualizan las mismas franjas existentes.
     * No se borran ni se crean otras, por lo que los
     * precios asignados a cada turno se conservan.
     */
    for (const shift of normalizedShifts) {
      await transaction.franjaHorariaPrecio.update({
        where: {
          id: shift.id,
        },
        data: {
          minutoInicio: shift.minutoInicio,
          minutoFin: shift.minutoFin,
          orden: shift.orden,
        },
      });
    }
  });

  return getConfiguration();
}