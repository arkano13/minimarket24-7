import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

// =========================================================
// Catálogo grande de productos ficticios para pruebas.
// Usa el prefijo "CAT-" en el SKU y códigos 76xxxxxxxxxx
// para no chocar con los que ya haya creado
// seed-productos-prueba.js.
//
// Columnas: sku, código de barras, nombre, categoría, tipo,
// presentación, costo, precio normal, stock, stock mínimo,
// [precio turno 2, precio turno 3] (opcional)
// =========================================================

let siguienteCodigo = 760000000001;

function codigo() {
  const valor = String(siguienteCodigo);
  siguienteCodigo += 1;
  return valor;
}

const productos = [
  // --- Abarrotes ---
  ["CAT-001", codigo(), "Frijol rojo 1 lb", "Abarrotes", "PAQUETE", "Paquete", 18, 24, 40, 10],
  ["CAT-002", codigo(), "Sal yodada 1 lb", "Abarrotes", "PAQUETE", "Paquete", 7, 10, 35, 8],
  ["CAT-003", codigo(), "Pasta espagueti 200 g", "Abarrotes", "PAQUETE", "Paquete", 10, 14, 45, 10],
  ["CAT-004", codigo(), "Harina de trigo 1 lb", "Abarrotes", "PAQUETE", "Paquete", 12, 17, 30, 8],
  ["CAT-005", codigo(), "Consomé de pollo 227 g", "Abarrotes", "UNIDAD", "Unidad", 34, 44, 20, 5],
  ["CAT-006", codigo(), "Mayonesa 400 g", "Abarrotes", "UNIDAD", "Unidad", 38, 49, 22, 5],
  ["CAT-007", codigo(), "Salsa de tomate 397 g", "Abarrotes", "UNIDAD", "Unidad", 18, 25, 26, 6],
  ["CAT-008", codigo(), "Vinagre blanco 500 ml", "Abarrotes", "UNIDAD", "Unidad", 14, 20, 18, 5],
  ["CAT-009", codigo(), "Café molido 200 g", "Abarrotes", "UNIDAD", "Unidad", 42, 55, 24, 6],
  ["CAT-010", codigo(), "Chocolate en polvo 400 g", "Abarrotes", "UNIDAD", "Unidad", 45, 58, 16, 4],
  ["CAT-011", codigo(), "Lentejas 1 lb", "Abarrotes", "PAQUETE", "Paquete", 20, 27, 24, 6],
  ["CAT-012", codigo(), "Maicena 200 g", "Abarrotes", "UNIDAD", "Unidad", 16, 22, 20, 5],
  ["CAT-013", codigo(), "Atún en lata 170 g", "Abarrotes", "UNIDAD", "Unidad", 22, 30, 40, 10],
  ["CAT-014", codigo(), "Sardinas en lata 425 g", "Abarrotes", "UNIDAD", "Unidad", 24, 32, 30, 8],
  ["CAT-015", codigo(), "Aceitunas 200 g", "Abarrotes", "UNIDAD", "Unidad", 30, 40, 14, 4],

  // --- Bebidas ---
  ["CAT-016", codigo(), "Refresco de cola 2 L", "Bebidas", "UNIDAD", "Unidad", 36, 45, 30, 8, 48, 50],
  ["CAT-017", codigo(), "Refresco de naranja 500 ml", "Bebidas", "UNIDAD", "Unidad", 13, 18, 35, 8, 20, 20],
  ["CAT-018", codigo(), "Jugo de naranja 1 L", "Bebidas", "UNIDAD", "Unidad", 28, 36, 22, 5],
  ["CAT-019", codigo(), "Jugo de manzana 500 ml", "Bebidas", "UNIDAD", "Unidad", 16, 22, 24, 6],
  ["CAT-020", codigo(), "Agua purificada 1 L", "Bebidas", "UNIDAD", "Unidad", 10, 15, 40, 10],
  ["CAT-021", codigo(), "Bebida energética 473 ml", "Bebidas", "UNIDAD", "Unidad", 32, 42, 28, 6],
  ["CAT-022", codigo(), "Café frío en lata 350 ml", "Bebidas", "UNIDAD", "Unidad", 24, 32, 18, 4],
  ["CAT-023", codigo(), "Té helado 500 ml", "Bebidas", "UNIDAD", "Unidad", 15, 21, 26, 6],
  ["CAT-024", codigo(), "Refresco de uva 2 L", "Bebidas", "UNIDAD", "Unidad", 34, 43, 20, 5],
  ["CAT-025", codigo(), "Agua con gas 355 ml", "Bebidas", "UNIDAD", "Unidad", 12, 17, 22, 5],
  ["CAT-026", codigo(), "Bebida isotónica 600 ml", "Bebidas", "UNIDAD", "Unidad", 20, 28, 24, 6],
  ["CAT-027", codigo(), "Refresco de cola lata 355 ml", "Bebidas", "UNIDAD", "Unidad", 11, 16, 40, 10],

  // --- Refrigerados ---
  ["CAT-028", codigo(), "Leche entera 1 L", "Refrigerados", "UNIDAD", "Unidad", 24, 31, 26, 6],
  ["CAT-029", codigo(), "Leche deslactosada 1 L", "Refrigerados", "UNIDAD", "Unidad", 27, 35, 18, 4],
  ["CAT-030", codigo(), "Yogur natural 200 ml", "Refrigerados", "UNIDAD", "Unidad", 10, 15, 30, 8],
  ["CAT-031", codigo(), "Yogur de fresa 150 ml", "Refrigerados", "UNIDAD", "Unidad", 9, 14, 28, 6],
  ["CAT-032", codigo(), "Huevos cartón de 30", "Refrigerados", "CAJA", "Cartón", 105, 125, 16, 4],
  ["CAT-033", codigo(), "Margarina 400 g", "Refrigerados", "UNIDAD", "Unidad", 29, 38, 20, 5],
  ["CAT-034", codigo(), "Queso fresco 8 oz", "Refrigerados", "UNIDAD", "Unidad", 40, 52, 16, 4],
  ["CAT-035", codigo(), "Crema ácida 8 oz", "Refrigerados", "UNIDAD", "Unidad", 26, 34, 18, 4],

  // --- Congelados ---
  ["CAT-036", codigo(), "Hielo bolsa de 5 kg", "Congelados", "PAQUETE", "Bolsa", 28, 40, 20, 5, 45, 48],
  ["CAT-037", codigo(), "Nuggets de pollo 400 g", "Congelados", "UNIDAD", "Unidad", 55, 70, 14, 4],
  ["CAT-038", codigo(), "Papas fritas congeladas 900 g", "Congelados", "UNIDAD", "Unidad", 60, 78, 12, 3],
  ["CAT-039", codigo(), "Helado de vainilla 1 L", "Congelados", "UNIDAD", "Unidad", 65, 85, 10, 3],
  ["CAT-040", codigo(), "Paleta de hielo", "Congelados", "UNIDAD", "Unidad", 4, 7, 60, 15],
  ["CAT-041", codigo(), "Pizza congelada individual", "Congelados", "UNIDAD", "Unidad", 45, 60, 12, 3],

  // --- Limpieza ---
  ["CAT-042", codigo(), "Detergente en polvo 500 g", "Limpieza", "PAQUETE", "Paquete", 25, 34, 30, 8],
  ["CAT-043", codigo(), "Jabón para platos 500 ml", "Limpieza", "UNIDAD", "Unidad", 20, 28, 26, 6],
  ["CAT-044", codigo(), "Cloro por litro", "Limpieza", "VOLUMEN", "Litro", 9, 14, 40, 10],
  ["CAT-045", codigo(), "Limpiador multiuso por litro", "Limpieza", "VOLUMEN", "Litro", 16, 24, 30, 6],
  ["CAT-046", codigo(), "Servilletas paquete de 100", "Limpieza", "PAQUETE", "Paquete", 12, 18, 35, 8],
  ["CAT-047", codigo(), "Papel toalla", "Limpieza", "UNIDAD", "Unidad", 22, 30, 24, 6],
  ["CAT-048", codigo(), "Esponjas paquete de 3", "Limpieza", "PAQUETE", "Paquete", 10, 15, 30, 6],
  ["CAT-049", codigo(), "Bolsas de basura paquete de 10", "Limpieza", "PAQUETE", "Paquete", 15, 22, 28, 6],
  ["CAT-050", codigo(), "Suavizante de telas 500 ml", "Limpieza", "UNIDAD", "Unidad", 24, 33, 18, 4],
  ["CAT-051", codigo(), "Desinfectante en aerosol", "Limpieza", "UNIDAD", "Unidad", 36, 47, 14, 3],

  // --- Higiene personal ---
  ["CAT-052", codigo(), "Pasta dental 100 ml", "Higiene personal", "UNIDAD", "Unidad", 24, 33, 26, 6],
  ["CAT-053", codigo(), "Papel higiénico paquete de 4", "Higiene personal", "PAQUETE", "Paquete", 34, 45, 30, 8],
  ["CAT-054", codigo(), "Champú 400 ml", "Higiene personal", "UNIDAD", "Unidad", 48, 62, 18, 4],
  ["CAT-055", codigo(), "Jabón de baño", "Higiene personal", "UNIDAD", "Unidad", 8, 13, 40, 10],
  ["CAT-056", codigo(), "Desodorante en barra", "Higiene personal", "UNIDAD", "Unidad", 32, 42, 24, 6],
  ["CAT-057", codigo(), "Rastrillo desechable", "Higiene personal", "UNIDAD", "Unidad", 10, 15, 30, 6],
  ["CAT-058", codigo(), "Toallas sanitarias paquete", "Higiene personal", "PAQUETE", "Paquete", 28, 38, 22, 5],
  ["CAT-059", codigo(), "Algodón 100 g", "Higiene personal", "UNIDAD", "Unidad", 14, 20, 18, 4],

  // --- Frutas y verduras ---
  ["CAT-060", codigo(), "Tomate por libra", "Frutas y verduras", "PESO", "Libra", 10, 15, 25, 5],
  ["CAT-061", codigo(), "Cebolla por libra", "Frutas y verduras", "PESO", "Libra", 11, 16, 22, 5],
  ["CAT-062", codigo(), "Papa por libra", "Frutas y verduras", "PESO", "Libra", 8, 12, 30, 6],
  ["CAT-063", codigo(), "Banano por libra", "Frutas y verduras", "PESO", "Libra", 6, 10, 28, 6],
  ["CAT-064", codigo(), "Limón por libra", "Frutas y verduras", "PESO", "Libra", 7, 11, 20, 5],
  ["CAT-065", codigo(), "Zanahoria por libra", "Frutas y verduras", "PESO", "Libra", 7, 10, 18, 4],
  ["CAT-066", codigo(), "Aguacate por unidad", "Frutas y verduras", "UNIDAD", "Unidad", 8, 14, 30, 6],
  ["CAT-067", codigo(), "Chile verde por libra", "Frutas y verduras", "PESO", "Libra", 9, 14, 15, 3],

  // --- Snacks y dulces ---
  ["CAT-068", codigo(), "Galletas dulces", "Snacks y dulces", "PAQUETE", "Paquete", 8, 12, 45, 10],
  ["CAT-069", codigo(), "Papas fritas bolsa individual", "Snacks y dulces", "UNIDAD", "Unidad", 9, 14, 50, 12],
  ["CAT-070", codigo(), "Tortillas de maíz fritas", "Snacks y dulces", "UNIDAD", "Unidad", 8, 13, 40, 8],
  ["CAT-071", codigo(), "Chocolate en barra", "Snacks y dulces", "UNIDAD", "Unidad", 12, 18, 36, 8],
  ["CAT-072", codigo(), "Chicles paquete", "Snacks y dulces", "PAQUETE", "Paquete", 6, 10, 40, 8],
  ["CAT-073", codigo(), "Caramelos surtidos bolsa", "Snacks y dulces", "PAQUETE", "Paquete", 14, 20, 25, 5],
  ["CAT-074", codigo(), "Galletas saladas", "Snacks y dulces", "PAQUETE", "Paquete", 9, 14, 38, 8],
  ["CAT-075", codigo(), "Maní salado bolsa", "Snacks y dulces", "UNIDAD", "Unidad", 10, 16, 30, 6],
  ["CAT-076", codigo(), "Barra de granola", "Snacks y dulces", "UNIDAD", "Unidad", 14, 20, 24, 5],
  ["CAT-077", codigo(), "Palomitas de microondas", "Snacks y dulces", "UNIDAD", "Unidad", 18, 25, 20, 4],

  // --- Panadería ---
  ["CAT-078", codigo(), "Pan de sándwich", "Panadería", "UNIDAD", "Unidad", 22, 30, 20, 5],
  ["CAT-079", codigo(), "Pan dulce por unidad", "Panadería", "UNIDAD", "Unidad", 3, 5, 60, 15],
  ["CAT-080", codigo(), "Tortillas de harina paquete", "Panadería", "PAQUETE", "Paquete", 16, 22, 30, 6],
  ["CAT-081", codigo(), "Pan baguette", "Panadería", "UNIDAD", "Unidad", 10, 15, 24, 5],
  ["CAT-082", codigo(), "Pastelitos individuales", "Panadería", "UNIDAD", "Unidad", 6, 10, 40, 8],
  ["CAT-083", codigo(), "Rosquillas paquete", "Panadería", "PAQUETE", "Paquete", 14, 20, 22, 5],

  // --- Carnes y embutidos ---
  ["CAT-084", codigo(), "Jamón de pierna 250 g", "Carnes y embutidos", "UNIDAD", "Unidad", 34, 45, 18, 4],
  ["CAT-085", codigo(), "Salchichas paquete", "Carnes y embutidos", "UNIDAD", "Unidad", 28, 38, 22, 5],
  ["CAT-086", codigo(), "Chorizo por libra", "Carnes y embutidos", "PESO", "Libra", 27, 36, 12, 3],
  ["CAT-087", codigo(), "Pollo entero por libra", "Carnes y embutidos", "PESO", "Libra", 20, 27, 20, 4],
  ["CAT-088", codigo(), "Carne molida por libra", "Carnes y embutidos", "PESO", "Libra", 34, 43, 14, 3],
  ["CAT-089", codigo(), "Tocino 250 g", "Carnes y embutidos", "UNIDAD", "Unidad", 38, 50, 14, 3],

  // --- Mascotas ---
  ["CAT-090", codigo(), "Alimento para perro 2 kg", "Mascotas", "UNIDAD", "Unidad", 95, 120, 12, 3],
  ["CAT-091", codigo(), "Alimento para gato 1 kg", "Mascotas", "UNIDAD", "Unidad", 60, 78, 10, 3],
  ["CAT-092", codigo(), "Arena para gato 4 kg", "Mascotas", "UNIDAD", "Unidad", 70, 90, 8, 2],
  ["CAT-093", codigo(), "Snacks para perro", "Mascotas", "UNIDAD", "Unidad", 25, 34, 16, 4],

  // --- Ferretería y hogar ---
  ["CAT-094", codigo(), "Foco LED 9 W", "Ferretería y hogar", "UNIDAD", "Unidad", 30, 42, 20, 5],
  ["CAT-095", codigo(), "Pilas AA paquete de 2", "Ferretería y hogar", "PAQUETE", "Paquete", 20, 28, 26, 6],
  ["CAT-096", codigo(), "Encendedor", "Ferretería y hogar", "UNIDAD", "Unidad", 6, 10, 35, 8],
  ["CAT-097", codigo(), "Velas paquete de 4", "Ferretería y hogar", "PAQUETE", "Paquete", 14, 20, 22, 5],
];

const tipos = {
  UNIDAD: { unidadInventario: "UNIDAD", factor: 1 },
  PAQUETE: { unidadInventario: "UNIDAD", factor: 1 },
  CAJA: { unidadInventario: "UNIDAD", factor: 1 },
  PESO: { unidadInventario: "GRAMO", factor: 454 },
  VOLUMEN: { unidadInventario: "MILILITRO", factor: 1000 },
};

async function main() {
  const administrador = await prisma.usuario.findUnique({
    where: { usuario: "admin" },
  });

  if (!administrador) {
    throw new Error("Primero ejecuta: npx prisma db seed");
  }

  const turnos = await prisma.franjaHorariaPrecio.findMany({
    where: { activo: true, orden: { in: [1, 2, 3] } },
    orderBy: { orden: "asc" },
  });

  if (turnos.length !== 3) {
    throw new Error("Primero ejecuta: npx prisma db seed");
  }

  const nombresCategorias = [...new Set(productos.map((producto) => producto[3]))];
  const categorias = new Map();

  for (const nombre of nombresCategorias) {
    const categoria = await prisma.categoria.upsert({
      where: { nombre },
      update: { activo: true },
      create: { nombre },
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

    const existente = await prisma.producto.findUnique({ where: { sku } });

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
              create: { codigo: codigoBarra, principal: true },
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

  console.log(`Categorías: ${nombresCategorias.length}`);
  console.log(`Productos creados: ${creados}`);
  console.log(`Productos que ya existían: ${existentes}`);
}

main()
  .catch((error) => {
    console.error("No se pudo crear el catálogo:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });