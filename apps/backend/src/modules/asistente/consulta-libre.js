// apps/backend/src/modules/asistente/consulta-libre.js
//
// Consulta de solo lectura para el asistente del dueño: puede preguntar
// cualquier cosa de la base (precios, costos, ventas, inventario...) sin que
// haya una herramienta específica para cada pregunta.
//
// Garantías de que NO modifica nada:
//   1. Solo se acepta UNA sentencia SELECT/WITH (sin ";" intermedio).
//   2. Se ejecuta dentro de una transacción READ ONLY: PostgreSQL rechaza
//      cualquier INSERT/UPDATE/DELETE/DDL aunque se colara por el filtro.
//   3. Tiempo máximo y máximo de filas, para no trabar la base.
// Puede leer todas las tablas, incluidas usuarios y sesiones. Solo se
// bloquean funciones que leen archivos del servidor o lo traban.

import { prisma } from "../../lib/prisma.js";

export const MAX_FILAS = 200;
const TIEMPO_MAXIMO = "8s";

const PALABRAS_PROHIBIDAS = /\b(insert|update|delete|merge|upsert|drop|alter|create|truncate|grant|revoke|copy|call|do|vacuum|analyze|reindex|cluster|refresh|lock|listen|notify|set|reset|prepare|execute|deallocate|comment|security|into)\b/i;
const FUNCIONES_PROHIBIDAS = /\b(pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_\w+|dblink\w*|pg_sleep\w*|pg_terminate_backend|pg_cancel_backend|set_config|current_setting|pg_reload_conf|pg_logdir_ls)\b/i;

export function validarConsulta(sqlEntrada) {
  if (typeof sqlEntrada !== "string" || !sqlEntrada.trim()) {
    throw new Error("La consulta está vacía.");
  }

  // Sin comentarios, para que no oculten palabras.
  const sql = sqlEntrada.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").trim().replace(/;+\s*$/, "");

  if (sql.includes(";")) throw new Error("Solo se permite una consulta a la vez.");
  if (!/^(select|with)\b/i.test(sql)) throw new Error("Solo se permiten consultas SELECT.");

  // Las palabras dentro de textos entre comillas ('...') no cuentan.
  const sinTextos = sql.replace(/'(?:[^']|'')*'/g, "''");
  if (PALABRAS_PROHIBIDAS.test(sinTextos)) throw new Error("La consulta solo puede leer datos.");
  if (FUNCIONES_PROHIBIDAS.test(sinTextos)) throw new Error("Esa función no está permitida.");

  return sql;
}

function valorPlano(valor) {
  if (typeof valor === "bigint") return Number(valor);
  if (valor instanceof Date) return valor.toISOString();
  if (valor && typeof valor === "object" && typeof valor.toNumber === "function") return valor.toNumber();
  return valor;
}

export async function consultaLibre(sqlEntrada, { db = prisma } = {}) {
  const sql = validarConsulta(sqlEntrada);

  let filas;
  try {
    filas = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '${TIEMPO_MAXIMO}'`);
      return tx.$queryRawUnsafe(`SELECT * FROM (${sql}) AS consulta LIMIT ${MAX_FILAS + 1}`);
    });
  } catch (err) {
    // Mensaje corto de PostgreSQL para que el modelo corrija la consulta.
    const original = err?.meta?.driverAdapterError?.cause?.originalMessage;
    throw new Error(`La consulta falló: ${original ?? String(err?.message ?? err).split("\n").filter(Boolean).pop()}`);
  }

  const recortado = filas.length > MAX_FILAS;
  return {
    filas: filas.slice(0, MAX_FILAS).map((fila) =>
      Object.fromEntries(Object.entries(fila).map(([clave, valor]) => [clave, valorPlano(valor)])),
    ),
    total: Math.min(filas.length, MAX_FILAS),
    ...(recortado ? { aviso: `Hay más de ${MAX_FILAS} filas; usa filtros, GROUP BY o un LIMIT más chico.` } : {}),
  };
}

// Tablas y columnas reales de la base, para que el modelo arme bien las
// consultas. Se lee una vez y se guarda.
let esquemaCache = null;

export async function esquemaBase({ db = prisma } = {}) {
  if (esquemaCache) return esquemaCache;
  const columnas = await db.$queryRawUnsafe(`
    SELECT table_name AS tabla, column_name AS columna, data_type AS tipo
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name NOT LIKE '\\_prisma%'
    ORDER BY table_name, ordinal_position`);
  const tablas = new Map();
  for (const { tabla, columna, tipo } of columnas) {
    (tablas.get(tabla) ?? tablas.set(tabla, []).get(tabla)).push(`${columna} (${tipo})`);
  }
  esquemaCache = [...tablas].map(([tabla, cols]) => `${tabla}: ${cols.join(", ")}`).join("\n");
  return esquemaCache;
}
