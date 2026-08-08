import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";

// Honduras no tiene horario de verano y siempre está en UTC-6, así que
// esto funciona sin importar la zona horaria del servidor donde corra
// el backend (local, Railway, o donde sea).
const HONDURAS_TIME_ZONE = "America/Tegucigalpa";

const hondurasHourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: HONDURAS_TIME_ZONE,
  hour12: false,
  hour: "2-digit",
});

function hondurasHour(date) {
  const hour = Number(hondurasHourFormatter.format(date));

  // Intl puede devolver "24" en vez de "00" para la medianoche.
  return hour % 24;
}

function localDate(
  value,
  field,
  endOfDay = false,
) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw new AppError(
      `${field} no es válida.`,
      400,
    );
  }

  const time = endOfDay
    ? "23:59:59.999"
    : "00:00:00.000";

  const date = new Date(
    `${value}T${time}`,
  );

  if (Number.isNaN(date.getTime())) {
    throw new AppError(
      `${field} no es válida.`,
      400,
    );
  }

  return date;
}

function todayText() {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(
    now.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    now.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function reportRange(
  fromInput,
  toInput,
) {
  const fromText =
    fromInput || todayText();

  const toText =
    toInput || fromText;

  const from = localDate(
    fromText,
    "La fecha inicial",
  );

  const to = localDate(
    toText,
    "La fecha final",
    true,
  );

  if (from > to) {
    throw new AppError(
      "La fecha inicial no puede ser posterior a la final.",
      400,
    );
  }

  const days =
    (to.getTime() - from.getTime()) /
    86_400_000;

  if (days > 366) {
    throw new AppError(
      "El reporte no puede superar 366 días.",
      400,
    );
  }

  return {
    desde: fromText,
    hasta: toText,
    from,
    to,
  };
}

function roundMoney(value) {
  return (
    Math.round(
      (value + Number.EPSILON) * 100,
    ) / 100
  );
}

export async function getSalesReport(
  fromInput,
  toInput,
) {
  const range = reportRange(
    fromInput,
    toInput,
  );

  const sales = await prisma.venta.findMany({
    where: {
      estado: "COMPLETADA",

      creadoEn: {
        gte: range.from,
        lte: range.to,
      },
    },

    include: {
      usuario: {
        select: {
          id: true,
          nombre: true,
        },
      },

      pagos: {
        orderBy: {
          id: "asc",
        },
      },

      detalles: {
        orderBy: {
          id: "asc",
        },
      },
    },

    orderBy: {
      creadoEn: "desc",
    },
  });

  const payments = new Map([
    [
      "EFECTIVO",
      {
        metodo: "EFECTIVO",
        operaciones: 0,
        total: 0,
      },
    ],

    [
      "TARJETA",
      {
        metodo: "TARJETA",
        operaciones: 0,
        total: 0,
      },
    ],

    [
      "TRANSFERENCIA",
      {
        metodo: "TRANSFERENCIA",
        operaciones: 0,
        total: 0,
      },
    ],
  ]);

  const products = new Map();
  const hours = new Map();

  let total = 0;
  let totalCost = 0;

  for (const sale of sales) {
    total += Number(sale.total);

    const hour = hondurasHour(sale.creadoEn);

    const hourEntry =
      hours.get(hour) ?? {
        hora: hour,
        operaciones: 0,
        total: 0,
      };

    hourEntry.operaciones += 1;
    hourEntry.total += Number(sale.total);

    hours.set(hour, hourEntry);

    for (const payment of sale.pagos) {
      const paymentEntry =
        payments.get(payment.metodo);

      if (paymentEntry) {
        paymentEntry.operaciones += 1;
        paymentEntry.total += Number(
          payment.monto,
        );
      }
    }

    for (const detail of sale.detalles) {
      const detailCost =
        Number(detail.costoUnitario) *
        Number(detail.cantidad);

      const detailSale = Number(
        detail.subtotal,
      );

      totalCost += detailCost;

      const productEntry =
        products.get(detail.productoId) ?? {
          productoId:
            detail.productoId,

          nombre:
            detail.productoNombre,

          cantidad: 0,
          ventas: 0,
          costo: 0,
          ganancia: 0,
        };

      productEntry.cantidad += Number(
        detail.cantidad,
      );

      productEntry.ventas += detailSale;
      productEntry.costo += detailCost;

      productEntry.ganancia +=
        detailSale - detailCost;

      products.set(
        detail.productoId,
        productEntry,
      );
    }
  }

  return {
    periodo: {
      desde: range.desde,
      hasta: range.hasta,
    },

    resumen: {
      operaciones: sales.length,

      total: roundMoney(total),

      costoEstimado:
        roundMoney(totalCost),

      gananciaEstimada:
        roundMoney(
          total - totalCost,
        ),

      promedio:
        sales.length > 0
          ? roundMoney(
              total / sales.length,
            )
          : 0,
    },

    pagos: [...payments.values()].map(
      (payment) => ({
        ...payment,

        total: roundMoney(
          payment.total,
        ),
      }),
    ),

    productos: [...products.values()]
      .map((product) => ({
        ...product,

        cantidad:
          Math.round(
            product.cantidad * 1000,
          ) / 1000,

        ventas: roundMoney(
          product.ventas,
        ),

        costo: roundMoney(
          product.costo,
        ),

        ganancia: roundMoney(
          product.ganancia,
        ),
      }))
      .sort(
        (first, second) =>
          second.ventas - first.ventas,
      ),

    horas: [...hours.values()]
      .map((hour) => ({
        ...hour,

        total: roundMoney(
          hour.total,
        ),
      }))
      .sort(
        (first, second) =>
          first.hora - second.hora,
      ),

    ventas: sales.map((sale) => {
      const payment =
        sale.pagos[0] ?? null;

      return {
        id: sale.id,
        creadoEn: sale.creadoEn,

        cliente:
          sale.clienteNombre ||
          "Venta normal",

        usuario: sale.usuario,
        total: Number(sale.total),

        pago: payment
          ? {
              metodo:
                payment.metodo,

              monto: Number(
                payment.monto,
              ),
            }
          : null,

        productos: sale.detalles.map(
          (detail) => ({
            id: detail.id,

            nombre:
              detail.productoNombre,

            presentacion:
              detail.presentacionNombre,

            cantidad: Number(
              detail.cantidad,
            ),

            precio: Number(
              detail.precioUnitario,
            ),

            subtotal: Number(
              detail.subtotal,
            ),

            origenPrecio:
              detail.precioOrigen,
          }),
        ),
      };
    }),
  };
}