// Convierte productos compuestos de un solo componente (six-pack, cajetilla,
// "tomar aquí", etc.) en PRESENTACIONES del producto original, y desactiva
// los compuestos "+ envase" que ya cubre el botón Envase de Ventas.
//
// Uso (desde apps/backend):
//   node scripts/convertirCompuestosAPresentaciones.js            -> modo prueba (no guarda nada)
//   node scripts/convertirCompuestosAPresentaciones.js --aplicar  -> aplica los cambios
//
// El modo prueba corre EXACTAMENTE la misma transacción contra la base real
// y al final la revierte, así que valida todo (nombres, códigos, etc.) sin
// dejar cambios. Si algo falla en --aplicar, no se guarda nada.
//
// Es seguro volver a correrlo: los compuestos que ya están inactivos se
// saltan.
//
// Qué hace con cada compuesto a convertir:
//   1. Crea una presentación en el producto componente con el nombre,
//      precio, códigos de barras, precios por turno y precios especiales
//      de clientes del compuesto.
//   2. El "equivale a" sale de la cantidad del componente, o de
//      CORRECCIONES si está ahí.
//   3. Desactiva (no borra) el compuesto, su presentación y sus códigos,
//      para que el historial de ventas y reportes siga intacto.
//   4. Registra la conversión en la bitácora.

import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

// @prisma/adapter-pg lanza un DeprecationWarning de pg ("client.query()
// when the client is already executing a query") cuando Prisma encola
// varias consultas en la misma transacción. Es inofensivo; se oculta para
// que no ensucie la salida.
process.noDeprecation = true;

const APLICAR = process.argv.includes("--aplicar");

// Compuestos de un solo componente que pasan a ser presentación.
const CONVERTIR = [
  764, // Acetaminofen Blister
  630, // bolsa de chuleta criolla
  584, // Caja de bud ligth
  582, // Caja de coronitas Helada
  884, // Jalapeño 3x10
  79, // Paquete Cigarro belmont original Grande
  562, // Paquete Cigarro Belmot Pequeno
  94, // Paquete Cigarro Mentolado (Grande)
  99, // Paquete Cigarro Mentolado Pequeño
  90, // Paquete Cigarro royal azul Pequeño
  96, // Paquete Cigarro Sandia Pequeño (Lucky Strike)
  488, // Paquete de Bolsas con Agua
  70, // Paquete de Cigarro Doble Click Uva (Grande)
  92, // Paquete de Cigarro Doble Click Uva (Pequeño)
  63, // Paquete de Cigarro Sandia Grande (Lucky Strike)
  86, // Paquete royal azul Grande
  858, // Ristra de ajo
  1029, // Salva Vida (JAIR)
  740, // semitas caseras cuquis
  966, // Ultra Botella (Tomar Aqui)
  1010, // Bud Ligth (Tomar Aqui)
  1024, // Caguama (Tomar Aqui)
  968, // Corona (Tomar Aqui)
  1071, // CORONITA TOMAR AQUI
  979, // Harina (CLIENTES )
  1016, // Pechuga Clientes
  1017, // Pierna Clientes
  901, // Salvavida Botella (TOMAR AQUI)
  1048, // Salva Vida Lata (Tomar aqui)
];

// "Equivale a" corregido, en la unidad de VENTA del componente
// (unidades, lb, L). Reemplaza la cantidad mal registrada en el compuesto.
const CORRECCIONES = {
  92: 12, // tenía 2500
  966: 1, // tenía 45 (se escribió el precio en la cantidad)
  1029: 1, // tenía 1.001
};

// Compuestos "+ envase": ya los cubre el botón Envase de Ventas (+L 5).
// Se desactivan sin crear presentación, para no cobrar el envase dos veces.
const DESACTIVAR = [
  1000, // barena botella + envase
  999, // Barena caguama + envase
  1001, // salvavida botella + envase
  977, // Salvavida Caguama + Envase
];

class RollbackPrueba extends Error {}

const TIPO_POR_UNIDAD = {
  UNIDAD: "PAQUETE",
  GRAMO: "PESO",
  MILILITRO: "VOLUMEN",
};

const UNIDAD_VENTA = {
  UNIDAD: "und",
  GRAMO: "lb",
  MILILITRO: "L",
};

const PARENT_INCLUDE = {
  presentaciones: {
    where: { activo: true },
    include: {
      codigosBarra: { where: { activo: true } },
      preciosHorario: true,
      preciosEspeciales: { where: { activo: true } },
    },
    orderBy: [{ esPrincipal: "desc" }, { id: "asc" }],
  },
  componentes: {
    include: {
      productoComponente: {
        include: {
          presentaciones: {
            where: { activo: true, esPrincipal: true },
            take: 1,
          },
        },
      },
    },
  },
};

function formatQty(value) {
  return new Intl.NumberFormat("es-HN", { maximumFractionDigits: 3 }).format(Number(value));
}

// La base exige nombre único por producto aunque la presentación esté
// inactiva, así que se busca contra TODAS las presentaciones del componente.
async function nombreDisponible(tx, productoId, nombreBase) {
  const base = nombreBase.trim().replace(/\s+/g, " ").slice(0, 74);

  const existentes = await tx.presentacionProducto.findMany({
    where: { productoId },
    select: { nombre: true },
  });

  const usados = new Set(existentes.map((item) => item.nombre.toLowerCase()));

  if (!usados.has(base.toLowerCase())) {
    return base;
  }

  for (let n = 2; n < 100; n += 1) {
    const candidato = `${base} (${n})`;

    if (!usados.has(candidato.toLowerCase())) {
      return candidato;
    }
  }

  throw new Error(`No se encontró un nombre libre para "${base}".`);
}

// Un código puede quedarse si solo lo usa el propio componente o el
// compuesto que se está desactivando. Si lo usa OTRO producto activo, se
// omite y se avisa.
async function codigoEnOtroProducto(tx, codigo, productoComponenteId, productoPadreId) {
  return tx.codigoBarraProducto.findFirst({
    where: {
      codigo,
      activo: true,
      presentacion: {
        activo: true,
        producto: {
          activo: true,
          id: { notIn: [productoComponenteId, productoPadreId] },
        },
      },
    },
    select: {
      presentacion: {
        select: { nombre: true, producto: { select: { nombre: true } } },
      },
    },
  });
}

async function desactivarProducto(tx, producto) {
  const presentacionIds = producto.presentaciones.map((item) => item.id);

  if (presentacionIds.length > 0) {
    await tx.codigoBarraProducto.updateMany({
      where: { presentacionId: { in: presentacionIds } },
      data: { activo: false },
    });

    await tx.presentacionProducto.updateMany({
      where: { id: { in: presentacionIds } },
      data: { activo: false },
    });
  }

  // Los componentes NO se borran: el historial de ventas del compuesto y
  // sus cancelaciones siguen dependiendo de ellos.
  await tx.producto.update({
    where: { id: producto.id },
    data: { activo: false },
  });
}

async function convertir(tx, parentId, reporte) {
  const parent = await tx.producto.findUnique({
    where: { id: parentId },
    include: PARENT_INCLUDE,
  });

  if (!parent) {
    throw new Error(`#${parentId}: no existe.`);
  }

  if (!parent.activo) {
    reporte.saltados.push(`#${parentId} ${parent.nombre}: ya está inactivo (convertido antes).`);
    return;
  }

  if (!parent.esCompuesto || parent.componentes.length !== 1) {
    throw new Error(
      `#${parentId} ${parent.nombre}: debe ser compuesto de un solo componente (tiene ${parent.componentes.length}).`,
    );
  }

  if (parent.presentaciones.length !== 1) {
    throw new Error(
      `#${parentId} ${parent.nombre}: tiene ${parent.presentaciones.length} presentaciones activas; se esperaba 1. Revísalo a mano.`,
    );
  }

  const origen = parent.presentaciones[0];
  const componente = parent.componentes[0].productoComponente;

  if (!componente.activo) {
    throw new Error(`#${parentId} ${parent.nombre}: el componente "${componente.nombre}" está inactivo.`);
  }

  const principalComponente = componente.presentaciones[0];

  if (!principalComponente) {
    throw new Error(`#${parentId}: el componente "${componente.nombre}" no tiene presentación principal.`);
  }

  const factorPrincipal = new Prisma.Decimal(principalComponente.factorInventario);
  const cantidadOriginal = new Prisma.Decimal(parent.componentes[0].cantidad);

  const factor =
    CORRECCIONES[parentId] !== undefined
      ? new Prisma.Decimal(CORRECCIONES[parentId]).mul(factorPrincipal).toDecimalPlaces(3)
      : cantidadOriginal.toDecimalPlaces(3);

  if (factor.lte(0)) {
    throw new Error(`#${parentId} ${parent.nombre}: el factor calculado no es válido.`);
  }

  const nombre = await nombreDisponible(tx, componente.id, parent.nombre);
  const avisos = [];

  // Códigos de barras
  const codigos = [];

  for (const barcode of origen.codigosBarra) {
    const conflicto = await codigoEnOtroProducto(tx, barcode.codigo, componente.id, parent.id);

    if (conflicto) {
      avisos.push(
        `código ${barcode.codigo} omitido: lo usa ${conflicto.presentacion.producto.nombre} (${conflicto.presentacion.nombre})`,
      );
      continue;
    }

    codigos.push({ codigo: barcode.codigo, principal: barcode.principal });
  }

  if (origen.preciosHorario.length > 0 && componente.modoPrecio !== "POR_HORARIO") {
    avisos.push(
      `tenía precios por turno pero "${componente.nombre}" usa precio único: se copian pero no se aplicarán`,
    );
  }

  if (nombre !== parent.nombre.trim().replace(/\s+/g, " ")) {
    avisos.push(`nombre ajustado a "${nombre}" (ya existía)`);
  }

  // Primero se desactiva el compuesto (libera sus códigos) y luego se crea
  // la presentación con esos mismos códigos.
  await desactivarProducto(tx, parent);

  const nueva = await tx.presentacionProducto.create({
    data: {
      productoId: componente.id,
      nombre,
      tipo: TIPO_POR_UNIDAD[componente.unidadInventario] ?? "PAQUETE",
      factorInventario: factor,
      precioBase: origen.precioBase,
      esPrincipal: false,

      ...(codigos.length > 0 ? { codigosBarra: { create: codigos } } : {}),

      ...(origen.preciosHorario.length > 0
        ? {
            preciosHorario: {
              create: origen.preciosHorario.map((item) => ({
                franjaId: item.franjaId,
                precio: item.precio,
              })),
            },
          }
        : {}),

      ...(origen.preciosEspeciales.length > 0
        ? {
            preciosEspeciales: {
              create: origen.preciosEspeciales.map((item) => ({
                clienteId: item.clienteId,
                precio: item.precio,
                activo: true,
              })),
            },
          }
        : {}),
    },
  });

  const cantidadVenta = factor.div(factorPrincipal);

  await tx.bitacora.create({
    data: {
      accion: "CONVERTIR_COMPUESTO_A_PRESENTACION",
      entidad: "Producto",
      entidadId: componente.id,
      detalle: {
        compuestoId: parent.id,
        compuestoNombre: parent.nombre,
        presentacionId: nueva.id,
        presentacion: nombre,
        factorInventario: Number(factor),
        cantidadOriginal: Number(cantidadOriginal),
        corregido: CORRECCIONES[parentId] !== undefined,
        precio: Number(origen.precioBase),
        codigos: codigos.map((item) => item.codigo),
      },
    },
  });

  reporte.convertidos.push({
    compuesto: `#${parent.id} ${parent.nombre}`,
    destino: `#${componente.id} ${componente.nombre}`,
    equivale: `${formatQty(cantidadVenta)} ${UNIDAD_VENTA[componente.unidadInventario] ?? "und"}${
      CORRECCIONES[parentId] !== undefined ? " (corregido)" : ""
    }`,
    precio: `L ${Number(origen.precioBase).toFixed(2)}`,
    codigos: codigos.map((item) => item.codigo).join(", ") || "—",
    especiales: origen.preciosEspeciales.length,
    avisos,
  });
}

async function desactivarEnvase(tx, parentId, reporte) {
  const parent = await tx.producto.findUnique({
    where: { id: parentId },
    include: PARENT_INCLUDE,
  });

  if (!parent) {
    throw new Error(`#${parentId}: no existe.`);
  }

  if (!parent.activo) {
    reporte.saltados.push(`#${parentId} ${parent.nombre}: ya está inactivo.`);
    return;
  }

  if (!parent.esCompuesto) {
    throw new Error(`#${parentId} ${parent.nombre}: no es compuesto, revisa el ID.`);
  }

  await desactivarProducto(tx, parent);

  await tx.bitacora.create({
    data: {
      accion: "DESACTIVAR_COMPUESTO_ENVASE",
      entidad: "Producto",
      entidadId: parent.id,
      detalle: {
        compuestoNombre: parent.nombre,
        motivo: "Cubierto por el botón Envase de Ventas",
      },
    },
  });

  reporte.desactivados.push(`#${parent.id} ${parent.nombre}`);
}

function imprimirReporte(reporte) {
  console.log("");
  console.log(`=== Convertidos a presentación: ${reporte.convertidos.length} ===`);

  for (const item of reporte.convertidos) {
    console.log(`\n${item.compuesto}`);
    console.log(`   -> presentación de ${item.destino}`);
    console.log(`   equivale a ${item.equivale} · ${item.precio} · código: ${item.codigos}`);

    if (item.especiales > 0) {
      console.log(`   precios especiales de cliente copiados: ${item.especiales}`);
    }

    for (const aviso of item.avisos) {
      console.log(`   AVISO: ${aviso}`);
    }
  }

  console.log("");
  console.log(`=== Desactivados (+ envase): ${reporte.desactivados.length} ===`);

  for (const item of reporte.desactivados) {
    console.log(`   ${item}`);
  }

  if (reporte.saltados.length > 0) {
    console.log("");
    console.log(`=== Saltados: ${reporte.saltados.length} ===`);

    for (const item of reporte.saltados) {
      console.log(`   ${item}`);
    }
  }

  console.log("");
}

async function main() {
  const reporte = { convertidos: [], desactivados: [], saltados: [] };

  console.log(
    APLICAR
      ? ">>> MODO APLICAR: los cambios se guardarán en la base de datos."
      : ">>> MODO PRUEBA: no se guardará nada. Usa --aplicar para ejecutar.",
  );

  try {
    await prisma.$transaction(
      async (tx) => {
        const total = CONVERTIR.length + DESACTIVAR.length;
        let paso = 0;

        for (const id of CONVERTIR) {
          paso += 1;
          process.stdout.write(`[${paso}/${total}] Convirtiendo #${id}... `);
          await convertir(tx, id, reporte);
          console.log("ok");
        }

        for (const id of DESACTIVAR) {
          paso += 1;
          process.stdout.write(`[${paso}/${total}] Desactivando #${id}... `);
          await desactivarEnvase(tx, id, reporte);
          console.log("ok");
        }

        if (!APLICAR) {
          throw new RollbackPrueba();
        }
      },
      {
        // Railway está lejos: cada consulta tarda. 10 minutos de margen.
        maxWait: 30_000,
        timeout: 600_000,
      },
    );

    imprimirReporte(reporte);
    console.log(">>> Cambios aplicados correctamente.");
  } catch (error) {
    if (error instanceof RollbackPrueba) {
      imprimirReporte(reporte);
      console.log(">>> Prueba terminada sin errores. Nada se guardó.");
      console.log(">>> Si todo se ve bien: node scripts/convertirCompuestosAPresentaciones.js --aplicar");
      return;
    }

    console.log("FALLÓ");
    console.error("");
    console.error(">>> ERROR — no se guardó ningún cambio:");
    console.error(`    ${error.message}`);
    process.exitCode = 1;
  }
}

main().finally(() => prisma.$disconnect());