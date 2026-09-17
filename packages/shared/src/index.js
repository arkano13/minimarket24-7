export const NOMBRE_SISTEMA = "Minimarket 24/7";

export const UNIDADES_VENTA = Object.freeze([
  "UNIDAD",
  "PAQUETE",
  "CAJA",
  "PESO",
  "VOLUMEN",
]);

export const MODOS_PRECIO = Object.freeze(["UNICO", "POR_HORARIO"]);

/**
 * Redondea un monto al lempira entero más cercano.
 * El negocio no maneja monedas, así que los totales cobrados
 * nunca deben tener centavos.
 *
 * Regla: 0.50 redondea hacia arriba (redondeo comercial estándar).
 */
export function redondearAlEntero(monto) {
  return Math.round(Number(monto));
}