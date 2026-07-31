import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

// sku, código de barras, nombre, categoría, tipo, presentación,
// costo, precio normal, stock, stock mínimo, precio turno 2, precio turno 3
const productos = [
  ["PRUEBA-001", "7500000000001", "Arroz blanco 1 lb", "Abarrotes", "PAQUETE", "Paquete", 14, 18, 30, 8],
  ["PRUEBA-002", "7500000000002", "Frijol rojo 1 lb", "Abarrotes", "PAQUETE", "Paquete", 18, 24, 25, 6],
  ["PRUEBA-003", "7500000000003", "Azúcar 1 lb", "Abarrotes", "PAQUETE", "Paquete", 11, 15, 28, 7],
  ["PRUEBA-004", "7500000000004", "Sal yodada 1 lb", "Abarrotes", "PAQUETE", "Paquete", 7, 10, 20, 5],
  ["PRUEBA-005", "7500000000005", "Pasta espagueti 200 g", "Abarrotes", "PAQUETE", "Paquete", 10, 14, 24, 6],
  ["PRUEBA-006", "7500000000006", "Aceite vegetal 1 L", "Abarrotes", "UNIDAD", "Unidad", 45, 55, 18, 5],
  ["PRUEBA-007", "7500000000007", "Harina de trigo 1 lb", "Abarrotes", "PAQUETE", "Paquete", 12, 17, 20, 5],
  ["PRUEBA-008", "7500000000008", "Avena 400 g", "Abarrotes", "PAQUETE", "Paquete", 22, 29, 15, 4],
  ["PRUEBA-009", "7500000000009", "Cereal de maíz 500 g", "Abarrotes", "CAJA", "Caja", 52, 65, 12, 3],
  ["PRUEBA-010", "7500000000010", "Galletas dulces", "Abarrotes", "PAQUETE", "Paquete", 8, 12, 35, 10],

  ["PRUEBA-011", "7500000000011", "Agua purificada 600 ml", "Bebidas", "UNIDAD", "Unidad", 7, 12, 40, 12, 13, 13],
  ["PRUEBA-012", "7500000000012", "Refresco de cola 2 L", "Bebidas", "UNIDAD", "Unidad", 36, 45, 20, 5, 48, 50],
  ["PRUEBA-013", "7500000000013", "Refresco de naranja 500 ml", "Bebidas", "UNIDAD", "Unidad", 13, 18, 30, 8, 20, 20],
  ["PRUEBA-014", "7500000000014", "Jugo de naranja 1 L", "Bebidas", "UNIDAD", "Unidad", 28, 36, 14, 4],

  ["PRUEBA-015", "7500000000015", "Leche entera 1 L", "Refrigerados", "UNIDAD", "Unidad", 24, 31, 18, 5],
  ["PRUEBA-016", "7500000000016", "Yogur natural 200 ml", "Refrigerados", "UNIDAD", "Unidad", 10, 15, 22, 6],
  ["PRUEBA-017", "7500000000017", "Huevos cartón de 30", "Refrigerados", "CAJA", "Cartón", 105, 125, 10, 3],
  ["PRUEBA-018", "7500000000018", "Margarina 400 g", "Refrigerados", "UNIDAD", "Unidad", 29, 38, 14, 4],

  ["PRUEBA-019", "7500000000019", "Detergente en polvo 500 g", "Limpieza", "PAQUETE", "Paquete", 25, 34, 18, 5],
  ["PRUEBA-020", "7500000000020", "Jabón para platos 500 ml", "Limpieza", "UNIDAD", "Unidad", 20, 28, 16, 4],
  ["PRUEBA-021", "7500000000021", "Cloro por litro", "Limpieza", "VOLUMEN", "Litro", 9, 14, 25, 5],
  ["PRUEBA-022", "7500000000022", "Limpiador multiuso por litro", "Limpieza", "VOLUMEN", "Litro", 16, 24, 20, 5],

  ["PRUEBA-023", "7500000000023", "Pasta dental 100 ml", "Higiene personal", "UNIDAD", "Unidad", 24, 33, 15, 4],
  ["PRUEBA-024", "7500000000024", "Papel higiénico paquete de 4", "Higiene personal", "PAQUETE", "Paquete", 34, 45, 16, 4],
  ["PRUEBA-025", "7500000000025", "Champú 400 ml", "Higiene personal", "UNIDAD", "Unidad", 48, 62, 12, 3],

  ["PRUEBA-026", "7500000000026", "Tomate por kilogramo", "Frutas y verduras", "PESO", "Kilogramo", 22, 32, 18, 4],
  ["PRUEBA-027", "7500000000027", "Cebolla por kilogramo", "Frutas y verduras", "PESO", "Kilogramo", 25, 36, 16, 4],
  ["PRUEBA-028", "7500000000028", "Papa por kilogramo", "Frutas y verduras", "PESO", "Kilogramo", 18, 27, 24, 6],
  ["PRUEBA-029", "7500000000029", "Banano por kilogramo", "Frutas y verduras", "PESO", "Kilogramo", 14, 22, 20, 5],

  ["PRUEBA-030", "7500000000030", "Hielo bolsa de 5 kg", "Congelados", "PAQUETE", "Bolsa", 28, 40, 15, 4, 45, 48],
];

const tipos = {
  UNIDAD: {
    unidadInventario: "UNIDAD",
    factor: 1,
  },
  PAQUETE: {
    unidadInventario: "UNIDAD",
    factor: 1,
  },
  CAJA: {
    unidadInventario: "UNIDAD",
    factor: 1,
  },
  PESO: {
    unidadInventario: "GRAMO",
    factor: 1000,
  },
  VOLUMEN: {
    unidadInventario: "MILILITRO",
    factor: 1000,
  },
};

async function main() {
  const administrador = await prisma.usuario.findUnique({
    where: {
      usuario: "admin",
    },
  });

  if (!administrador) {
    throw new Error(
      "Primero ejecuta npx prisma db seed para crear el usuario admin.",
    );
  }

  const turnos = await prisma.franjaHorariaPrecio.findMany({
    where: {
      activo: true,
      orden: {
        in: [1, 2, 3],
      },
    },
    orderBy: {
      orden: "asc",
    },
  });

  if (turnos.length !== 3) {
    throw new Error(
      "Primero ejecuta npx prisma db seed para crear los tres turnos.",
    );
  }

  const nombresCategorias = [
    ...new Set(productos.map((producto) => producto[3])),
  ];

  const categorias = new Map();

  for (const nombre of nombresCategorias) {
    const categoria = await prisma.categoria.upsert({
      where: {
        nombre,
      },
      update: {
        activo: true,
      },
      create: {
        nombre,
      },
    });

    categorias.set(nombre, categoria.id);
  }

  let creados = 0;
  let existentes = 0;

  for (const datos of productos) {
    const [
      sku,
      codigoBarra,
      nombre,
      categoria,
      tipo,
      presentacion,
      costo,
      precio,
      stock,
      stockMinimo,
      precioTurno2,
      precioTurno3,
    ] = datos;

    const existente = await prisma.producto.findUnique({
      where: {
        sku,
      },
    });

    if (existente) {
      existentes += 1;
      continue;
    }

    const { unidadInventario, factor } = tipos[tipo];

    const stockInterno = stock * factor;
    const stockMinimoInterno = stockMinimo * factor;
    const costoInterno = costo / factor;
    const cambiaPorTurno = precioTurno2 !== undefined;

    await prisma.producto.create({
      data: {
        sku,
        nombre,
        descripcion: "Producto ficticio para realizar pruebas.",
        categoriaId: categorias.get(categoria),
        unidadInventario,
        modoPrecio: cambiaPorTurno ? "POR_HORARIO" : "UNICO",
        stockActual: stockInterno,
        stockMinimo: stockMinimoInterno,
        costoPromedio: costoInterno,

        presentaciones: {
          create: {
            nombre: presentacion,
            tipo,
            factorInventario: factor,
            precioBase: precio,
            esPrincipal: true,

            codigosBarra: {
              create: {
                codigo: codigoBarra,
                principal: true,
              },
            },

            ...(cambiaPorTurno
              ? {
                  preciosHorario: {
                    create: turnos.map((turno) => ({
                      franjaId: turno.id,
                      precio:
                        turno.orden === 1
                          ? precio
                          : turno.orden === 2
                            ? precioTurno2
                            : precioTurno3,
                    })),
                  },
                }
              : {}),
          },
        },

        movimientos: {
          create: {
            usuarioId: administrador.id,
            tipo: "INVENTARIO_INICIAL",
            cantidad: stockInterno,
            saldoPosterior: stockInterno,
            costoUnitario: costoInterno,
            motivo: "Inventario inicial de producto ficticio.",
          },
        },
      },
    });

    creados += 1;
  }

  console.log(`Productos ficticios creados: ${creados}`);
  console.log(`Productos que ya existían: ${existentes}`);
}

main()
  .catch((error) => {
    console.error("No se pudieron crear los productos ficticios:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });