import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

const INVENTORY_LABELS = {
  INVENTARIO_INICIAL: "Inventario inicial",
  COMPRA: "Compra",
  VENTA: "Venta",
  DEVOLUCION_CLIENTE: "Devolución de cliente",
  DEVOLUCION_PROVEEDOR: "Devolución a proveedor",
  AJUSTE_POSITIVO: "Ajuste positivo",
  AJUSTE_NEGATIVO: "Ajuste negativo",
  CANCELACION_VENTA: "Cancelación de venta",
  ANULACION_COMPRA: "Anulación de compra",
};

const CASH_LABELS = {
  INGRESO: "Ingreso de caja",
  RETIRO: "Retiro de caja",
};

export async function registrarBitacora({
  usuarioId = null,
  accion,
  entidad,
  entidadId = null,
  detalle = null,
} = {}) {
  return prisma.bitacora.create({
    data: { usuarioId, accion, entidad, entidadId, detalle },
  });
}

function movimientosCte() {
  return Prisma.sql`
    WITH movimientos AS (
      SELECT
        'bitacora-' || b.id AS id,
        b.creado_en AS fecha,
        b.usuario_id AS usuario_id,
        u1.nombre AS usuario_nombre,
        'USUARIO' AS origen,
        b.accion AS accion,
        b.entidad AS entidad,
        b.entidad_id AS entidad_id,
        b.detalle AS detalle
      FROM bitacora b
      LEFT JOIN usuarios u1 ON u1.id = b.usuario_id

      UNION ALL

      SELECT
        'inventario-' || m.id AS id,
        m.creado_en AS fecha,
        m.usuario_id AS usuario_id,
        u2.nombre AS usuario_nombre,
        'INVENTARIO' AS origen,
        m.tipo::text AS accion,
        'Producto' AS entidad,
        m.producto_id AS entidad_id,
        jsonb_build_object(
          'producto', p.nombre,
          'cantidad', m.cantidad,
          'motivo', m.motivo
        ) AS detalle
      FROM movimientos_inventario m
      LEFT JOIN usuarios u2 ON u2.id = m.usuario_id
      LEFT JOIN productos p ON p.id = m.producto_id

      UNION ALL

      SELECT
        'caja-' || c.id AS id,
        c.creado_en AS fecha,
        c.usuario_id AS usuario_id,
        u3.nombre AS usuario_nombre,
        'CAJA' AS origen,
        c.tipo::text AS accion,
        'Caja' AS entidad,
        c.turno_caja_id AS entidad_id,
        jsonb_build_object(
          'monto', c.monto,
          'motivo', c.motivo
        ) AS detalle
      FROM movimientos_caja c
      LEFT JOIN usuarios u3 ON u3.id = c.usuario_id
    )
  `;
}

export async function listMovimientos({
  desde,
  hasta,
  usuarioId,
  origen,
  page = 1,
  perPage = 50,
} = {}) {
  const desdeFecha = desde
    ? new Date(`${desde}T00:00:00`)
    : new Date("2000-01-01");

  const hastaFecha = hasta
    ? new Date(`${hasta}T23:59:59.999`)
    : new Date("2999-12-31");

  const usuarioFiltro = usuarioId ? Number(usuarioId) : null;
  const origenFiltro = origen || null;
  const offset = (Math.max(1, page) - 1) * perPage;

  const condiciones = Prisma.sql`
    WHERE fecha >= ${desdeFecha}
      AND fecha <= ${hastaFecha}
      AND (${usuarioFiltro}::int IS NULL OR usuario_id = ${usuarioFiltro})
      AND (${origenFiltro}::text IS NULL OR origen = ${origenFiltro})
  `;

  const [filas, totalResult] = await Promise.all([
    prisma.$queryRaw(Prisma.sql`
      ${movimientosCte()}
      SELECT * FROM movimientos
      ${condiciones}
      ORDER BY fecha DESC
      LIMIT ${perPage} OFFSET ${offset}
    `),

    prisma.$queryRaw(Prisma.sql`
      ${movimientosCte()}
      SELECT count(*)::int AS total FROM movimientos
      ${condiciones}
    `),
  ]);

  const registros = filas.map((fila) => ({
    id: fila.id,
    fecha: fila.fecha,
    usuario: fila.usuario_id
      ? { id: fila.usuario_id, nombre: fila.usuario_nombre }
      : null,
    origen: fila.origen,
    accion:
      fila.origen === "INVENTARIO"
        ? INVENTORY_LABELS[fila.accion] ?? fila.accion
        : fila.origen === "CAJA"
        ? CASH_LABELS[fila.accion] ?? fila.accion
        : fila.accion,
    entidad: fila.entidad,
    entidadId: fila.entidad_id,
    detalle: fila.detalle,
  }));

  return {
    total: Number(totalResult[0]?.total ?? 0),
    page: Math.max(1, page),
    perPage,
    registros,
  };
}