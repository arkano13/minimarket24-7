// apps/backend/src/modules/informes-periodicos/datos-sin-costo.js
//
// Productos activos sin precio de costo, por categoría. Los compuestos se
// excluyen: su costo sale de los productos que los forman. Las categorías
// escritas con distinta mayúscula ("condimentos" / "Condimentos") se juntan.

import { prisma } from "../../lib/prisma.js";

const SIN_CATEGORIA = "Sin categoría";

export async function datosSinCosto({ db = prisma } = {}) {
  const filas = await db.$queryRaw`
    SELECT c.nombre AS categoria, p.nombre AS producto, pp.nombre AS presentacion,
           pp.precio_base AS precio, p.stock_actual / pp.factor_inventario AS existencia
    FROM productos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    JOIN presentaciones_producto pp ON pp.producto_id = p.id AND pp.es_principal AND pp.activo
    WHERE p.activo AND NOT p.es_compuesto AND COALESCE(p.costo_promedio, 0) = 0
    ORDER BY p.nombre`;

  const grupos = new Map();
  for (const fila of filas) {
    const original = fila.categoria?.trim() || SIN_CATEGORIA;
    const clave = original.toLocaleLowerCase("es");
    if (!grupos.has(clave)) {
      const nombre = original === SIN_CATEGORIA
        ? original
        : clave.charAt(0).toLocaleUpperCase("es") + clave.slice(1);
      grupos.set(clave, { nombre, productos: [] });
    }
    grupos.get(clave).productos.push({
      nombre: fila.producto,
      presentacion: fila.presentacion,
      precio: Number(fila.precio),
      existencia: Math.round(Number(fila.existencia) * 100) / 100,
    });
  }

  const categorias = [...grupos.values()].sort((a, b) => {
    if (a.nombre === SIN_CATEGORIA) return 1;
    if (b.nombre === SIN_CATEGORIA) return -1;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  return { categorias, total: filas.length };
}
