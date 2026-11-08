// Bloquea la fila del producto hasta que termine la transacción y devuelve
// su existencia y costo actuales. Así un ajuste, una compra o una edición
// calculan sobre el valor real y no pisan ventas hechas mientras tanto.
export async function bloquearProducto(transaction, productoId) {
  const [fila] = await transaction.$queryRaw`
    SELECT stock_actual AS "stockActual", costo_promedio AS "costoPromedio"
    FROM productos WHERE id = ${productoId} FOR UPDATE`;
  return fila ?? null;
}
