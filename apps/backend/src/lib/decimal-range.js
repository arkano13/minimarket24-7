import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError.js";

// PostgreSQL redondea a la escala de la columna antes de comprobar su rango.
export function validateDecimalColumn(value, precision, scale, label) {
  if (value == null) return;
  const decimal = new Prisma.Decimal(value);
  const limit = new Prisma.Decimal(10).pow(precision - scale);
  if (!decimal.isFinite() || decimal.toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP).abs().gte(limit)) {
    throw new AppError(`${label} supera el límite permitido. Revisa el valor ingresado.`, 400);
  }
}

export function validateSaleNumbers({ details, total, grandTotal, received, change }) {
  for (const [value, label] of [[total, "El subtotal"], [grandTotal, "El total"], [received, "El monto recibido"], [change, "El cambio"]]) {
    validateDecimalColumn(value, 14, 2, label);
  }
  for (const detail of details) {
    const product = detail.productoNombre;
    for (const [field, precision, scale, label] of [
      ["cantidad", 16, 3, "La cantidad"],
      ["factorInventario", 14, 3, "El factor de inventario"],
      ["cantidadInventario", 16, 3, "La cantidad de inventario"],
      ["costoUnitario", 14, 4, "El costo unitario"],
      ["precioUnitario", 14, 2, "El precio unitario"],
      ["subtotal", 14, 2, "El subtotal"],
    ]) validateDecimalColumn(detail[field], precision, scale, `${label} de ${product}`);
  }
}
