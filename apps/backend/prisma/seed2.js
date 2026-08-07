import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";

// Seed de demostración completo para el POS.
// Genera 30 turnos de caja, cientos de ventas, compras, devoluciones,
// inventario, clientes especiales, proveedores y precios por horario.
// Los códigos de barra 200... son EAN-13 internos válidos para pruebas.

const MODULOS = [
  ["VENTAS", "Punto de venta", "OPERATIVO"],
  ["CAJA", "Caja y turnos", "OPERATIVO"],
  ["PRODUCTOS", "Productos", "ADMINISTRATIVO"],
  ["INVENTARIO", "Inventario", "OPERATIVO"],
  ["CLIENTES", "Clientes especiales", "ADMINISTRATIVO"],
  ["PROVEEDORES", "Proveedores", "ADMINISTRATIVO"],
  ["COMPRAS", "Compras", "OPERATIVO"],
  ["REPORTES", "Reportes", "REPORTES"],
  ["USUARIOS", "Usuarios", "ADMINISTRATIVO"],
  ["CONFIGURACION", "Configuración", "ADMINISTRATIVO"],
  ["BITACORA", "Bitácora", "ADMINISTRATIVO"],
  ["DEVOLUCIONES", "Cancelar ventas", "OPERATIVO"],
];

const FRANJAS = [
  { nombre: "Turno 1", minutoInicio: 480, minutoFin: 1320, orden: 1 },
  { nombre: "Turno 2", minutoInicio: 1320, minutoFin: 120, orden: 2 },
  { nombre: "Turno 3", minutoInicio: 120, minutoFin: 480, orden: 3 },
];

const CATEGORIAS = [
  "Bebidas",
  "Jugos y lácteos",
  "Abarrotes",
  "Snacks y dulces",
  "Panadería",
  "Refrigerados",
  "Congelados",
  "Enlatados",
  "Limpieza",
  "Higiene personal",
  "Bebés",
  "Hogar",
  "Frutas y verduras",
  "Carnes y embutidos",
  "Mascotas",
  "Ferretería",
];

const PROVEEDORES = [
  ["Distribuidora La Central", "María López", "9991-1001", "ventas@lacentral.test", "Col. Kennedy, Tegucigalpa"],
  ["Bebidas de Honduras", "Carlos Mejía", "9991-1002", "pedidos@bebidashn.test", "Anillo Periférico, Tegucigalpa"],
  ["Alimentos del Norte", "Sofía Rivera", "9991-1003", "ventas@alimentosnorte.test", "Comayagüela"],
  ["Lácteos y Más", "José Hernández", "9991-1004", "pedidos@lacteosymas.test", "Valle de Ángeles"],
  ["Distribuciones El Ahorro", "Ana Martínez", "9991-1005", "contacto@elahorro.test", "Barrio Abajo, Tegucigalpa"],
  ["Productos de Limpieza Brillo", "Luis Pineda", "9991-1006", "ventas@brillo.test", "Col. Humuya, Tegucigalpa"],
  ["Panificadora Buen Día", "Rosa Flores", "9991-1007", "pedidos@buendia.test", "Col. Palmira, Tegucigalpa"],
  ["Mayorista El Mercado", "Miguel Castro", "9991-1008", "mayoreo@elmercado.test", "Mercado Zonal Belén"],
];

function product(sku, categoria, nombre, costo, precio, options = {}) {
  return {
    sku,
    categoria,
    nombre,
    costo,
    precio,
    stock: options.stock ?? 320,
    minimo: options.minimo ?? 20,
    peso: options.peso ?? 2,
    turnos: options.turnos ?? null,
    activo: options.activo ?? true,
    unidad: options.unidad ?? "UNIDAD",
    presentacion: options.presentacion ?? "Unidad",
    tipo: options.tipo ?? "UNIDAD",
    factor: options.factor ?? 1,
    extras: options.extras ?? [],
  };
}

const PRODUCTOS = [
  product("BEB-001", "Bebidas", "Coca-Cola 600 ml", 12.5, 20, { stock: 1200, peso: 14, turnos: [20, 22, 24], extras: [["Caja 24", "CAJA", 24, 445, [445, 470, 495]]] }),
  product("BEB-002", "Bebidas", "Coca-Cola 2 litros", 35, 52, { stock: 650, peso: 8, turnos: [52, 56, 60], extras: [["Paquete 6", "PAQUETE", 6, 300, [300, 320, 340]]] }),
  product("BEB-003", "Bebidas", "Coca-Cola Zero 600 ml", 13, 21, { stock: 500, peso: 5, turnos: [21, 23, 25] }),
  product("BEB-004", "Bebidas", "Pepsi 600 ml", 11.5, 19, { stock: 950, peso: 11, turnos: [19, 21, 23], extras: [["Caja 24", "CAJA", 24, 420, [420, 445, 470]]] }),
  product("BEB-005", "Bebidas", "Pepsi 2 litros", 33, 49, { stock: 550, peso: 7, turnos: [49, 53, 57] }),
  product("BEB-006", "Bebidas", "Sprite 600 ml", 12, 20, { stock: 650, peso: 7, turnos: [20, 22, 24] }),
  product("BEB-007", "Bebidas", "Fanta naranja 600 ml", 12, 20, { stock: 550, peso: 6, turnos: [20, 22, 24] }),
  product("BEB-008", "Bebidas", "Tropical banana 500 ml", 10, 17, { stock: 600, peso: 7, turnos: [17, 19, 21] }),
  product("BEB-009", "Bebidas", "Agua purificada 600 ml", 7, 12, { stock: 1000, peso: 10, extras: [["Paquete 12", "PAQUETE", 12, 125]] }),
  product("BEB-010", "Bebidas", "Agua purificada 1.5 litros", 12, 20, { stock: 500, peso: 5 }),
  product("BEB-011", "Bebidas", "Bebida energética 473 ml", 27, 42, { stock: 350, peso: 4, turnos: [42, 46, 50] }),
  product("BEB-012", "Bebidas", "Gatorade naranja 600 ml", 24, 36, { stock: 400, peso: 4, turnos: [36, 39, 42] }),
  product("BEB-013", "Bebidas", "Té frío limón 500 ml", 16, 26, { stock: 350, peso: 3, turnos: [26, 28, 30] }),
  product("LAC-001", "Jugos y lácteos", "Leche entera 1 litro", 25, 34, { stock: 420, peso: 6 }),
  product("LAC-002", "Jugos y lácteos", "Leche semidescremada 1 litro", 27, 37, { stock: 260, peso: 3 }),
  product("LAC-003", "Jugos y lácteos", "Leche chocolatada 250 ml", 11, 17, { stock: 300, peso: 4 }),
  product("LAC-004", "Jugos y lácteos", "Jugo de naranja 1 litro", 28, 40, { stock: 280, peso: 3 }),
  product("LAC-005", "Jugos y lácteos", "Néctar de manzana 330 ml", 12, 20, { stock: 300, peso: 3 }),
  product("ABR-001", "Abarrotes", "Arroz blanco 1 libra", 17, 24, { stock: 700, peso: 7, extras: [["Fardo 25", "PAQUETE", 25, 560]] }),
  product("ABR-002", "Abarrotes", "Frijoles rojos 1 libra", 25, 34, { stock: 650, peso: 6 }),
  product("ABR-003", "Abarrotes", "Azúcar blanca 1 libra", 15, 22, { stock: 650, peso: 6 }),
  product("ABR-004", "Abarrotes", "Sal yodada 400 g", 7, 12, { stock: 300, peso: 3 }),
  product("ABR-005", "Abarrotes", "Harina de trigo 1 libra", 16, 24, { stock: 350, peso: 3 }),
  product("ABR-006", "Abarrotes", "Harina de maíz 1 libra", 18, 27, { stock: 380, peso: 4 }),
  product("ABR-007", "Abarrotes", "Aceite vegetal 443 ml", 30, 42, { stock: 500, peso: 6 }),
  product("ABR-008", "Abarrotes", "Aceite vegetal 1 litro", 55, 73, { stock: 350, peso: 4 }),
  product("ABR-009", "Abarrotes", "Espagueti 200 g", 9, 15, { stock: 450, peso: 5 }),
  product("ABR-010", "Abarrotes", "Salsa de tomate 106 g", 7, 12, { stock: 420, peso: 4 }),
  product("ABR-011", "Abarrotes", "Café molido 250 g", 42, 58, { stock: 280, peso: 3 }),
  product("ABR-012", "Abarrotes", "Café instantáneo 50 g", 31, 44, { stock: 220, peso: 2 }),
  product("ABR-013", "Abarrotes", "Avena en hojuelas 400 g", 28, 40, { stock: 240, peso: 2 }),
  product("ABR-014", "Abarrotes", "Cereal de maíz 300 g", 52, 70, { stock: 210, peso: 2 }),
  product("ABR-015", "Abarrotes", "Sopa instantánea pollo", 8, 14, { stock: 700, peso: 8, extras: [["Caja 24", "CAJA", 24, 300]] }),
  product("ABR-016", "Abarrotes", "Consomé de pollo 8 sobres", 12, 19, { stock: 280, peso: 3 }),
  product("SNK-001", "Snacks y dulces", "Chips de papa clásica 45 g", 11, 18, { stock: 650, peso: 8, turnos: [18, 20, 22] }),
  product("SNK-002", "Snacks y dulces", "Churros de queso 40 g", 8, 14, { stock: 700, peso: 9, turnos: [14, 16, 18] }),
  product("SNK-003", "Snacks y dulces", "Nachos picantes 45 g", 10, 17, { stock: 600, peso: 7, turnos: [17, 19, 21] }),
  product("SNK-004", "Snacks y dulces", "Galletas de chocolate 6 unidades", 10, 16, { stock: 500, peso: 6 }),
  product("SNK-005", "Snacks y dulces", "Galletas tipo soda", 12, 19, { stock: 420, peso: 5 }),
  product("SNK-006", "Snacks y dulces", "Barra de chocolate", 13, 22, { stock: 350, peso: 4, turnos: [22, 24, 26] }),
  product("SNK-007", "Snacks y dulces", "Caramelo surtido", 0.6, 1, { stock: 2500, peso: 5, extras: [["Bolsa 100", "PAQUETE", 100, 85]] }),
  product("SNK-008", "Snacks y dulces", "Chicle de menta", 1, 2, { stock: 1500, peso: 4, extras: [["Caja 50", "CAJA", 50, 85]] }),
  product("SNK-009", "Snacks y dulces", "Maní salado 100 g", 14, 22, { stock: 300, peso: 3 }),
  product("SNK-010", "Snacks y dulces", "Palomitas para microondas", 17, 27, { stock: 250, peso: 2 }),
  product("PAN-001", "Panadería", "Pan molde blanco", 32, 44, { stock: 250, peso: 5 }),
  product("PAN-002", "Panadería", "Pan dulce individual", 4, 7, { stock: 500, peso: 6, extras: [["Bolsa 10", "PAQUETE", 10, 60]] }),
  product("PAN-003", "Panadería", "Tortillas de maíz 20 unidades", 16, 24, { stock: 380, peso: 5 }),
  product("REF-001", "Refrigerados", "Huevos grandes", 3.1, 5, { stock: 1200, peso: 8, extras: [["Cartón 30", "PAQUETE", 30, 135]] }),
  product("REF-002", "Refrigerados", "Mantequilla 400 g", 38, 52, { stock: 230, peso: 2 }),
  product("REF-003", "Refrigerados", "Yogur fresa 200 ml", 13, 21, { stock: 320, peso: 4 }),
  product("REF-004", "Refrigerados", "Crema 400 ml", 31, 43, { stock: 260, peso: 3 }),
  product("REF-005", "Refrigerados", "Queso fresco", 0.11, 0.16, { unidad: "GRAMO", presentacion: "100 gramos", tipo: "PESO", factor: 100, stock: 80000, minimo: 5000, peso: 3, extras: [["Libra", "PESO", 453.592, 70]] }),
  product("CON-001", "Congelados", "Bolsa de hielo 5 libras", 18, 30, { stock: 350, peso: 7, turnos: [30, 34, 38] }),
  product("CON-002", "Congelados", "Helado de vainilla 1 litro", 58, 78, { stock: 180, peso: 2, turnos: [78, 82, 86] }),
  product("CON-003", "Congelados", "Paleta de fruta", 9, 15, { stock: 300, peso: 3, turnos: [15, 17, 19] }),
  product("ENL-001", "Enlatados", "Atún en agua 140 g", 25, 36, { stock: 300, peso: 3 }),
  product("ENL-002", "Enlatados", "Sardinas en salsa de tomate", 19, 29, { stock: 250, peso: 2 }),
  product("ENL-003", "Enlatados", "Frijoles preparados 400 g", 22, 32, { stock: 280, peso: 3 }),
  product("ENL-004", "Enlatados", "Maíz dulce 425 g", 24, 35, { stock: 220, peso: 2 }),
  product("LIM-001", "Limpieza", "Detergente en polvo 500 g", 27, 39, { stock: 300, peso: 3 }),
  product("LIM-002", "Limpieza", "Cloro 1 litro", 18, 28, { stock: 300, peso: 3 }),
  product("LIM-003", "Limpieza", "Jabón para platos 500 ml", 24, 36, { stock: 260, peso: 3 }),
  product("LIM-004", "Limpieza", "Suavizante 850 ml", 32, 45, { stock: 220, peso: 2 }),
  product("LIM-005", "Limpieza", "Limpiador multiusos 900 ml", 29, 42, { stock: 210, peso: 2 }),
  product("LIM-006", "Limpieza", "Esponja lavaplatos", 8, 14, { stock: 250, peso: 2 }),
  product("HIG-001", "Higiene personal", "Jabón de baño", 13, 21, { stock: 350, peso: 4, extras: [["Paquete 3", "PAQUETE", 3, 58]] }),
  product("HIG-002", "Higiene personal", "Champú 400 ml", 52, 70, { stock: 170, peso: 2 }),
  product("HIG-003", "Higiene personal", "Pasta dental 100 ml", 33, 46, { stock: 230, peso: 3 }),
  product("HIG-004", "Higiene personal", "Cepillo dental", 18, 29, { stock: 220, peso: 2 }),
  product("HIG-005", "Higiene personal", "Desodorante roll-on", 39, 55, { stock: 180, peso: 2 }),
  product("HIG-006", "Higiene personal", "Papel higiénico rollo", 10, 16, { stock: 500, peso: 5, extras: [["Paquete 4", "PAQUETE", 4, 58], ["Paquete 12", "PAQUETE", 12, 165]] }),
  product("HIG-007", "Higiene personal", "Toallas sanitarias paquete 10", 34, 48, { stock: 190, peso: 2 }),
  product("BEBE-001", "Bebés", "Pañales talla M paquete 10", 72, 92, { stock: 140, peso: 2 }),
  product("BEBE-002", "Bebés", "Toallitas húmedas paquete 50", 42, 58, { stock: 150, peso: 2 }),
  product("HOG-001", "Hogar", "Servilletas paquete 100", 17, 27, { stock: 240, peso: 2 }),
  product("HOG-002", "Hogar", "Bolsas para basura paquete 10", 21, 32, { stock: 210, peso: 2 }),
  product("HOG-003", "Hogar", "Fósforos caja", 3, 6, { stock: 400, peso: 3, extras: [["Paquete 10", "PAQUETE", 10, 52]] }),
  product("HOG-004", "Hogar", "Pilas AA par", 28, 42, { stock: 180, peso: 2 }),
  product("HOG-005", "Hogar", "Vaso desechable paquete 25", 24, 36, { stock: 160, peso: 2 }),
  product("FRU-001", "Frutas y verduras", "Tomate por libra", 0.024, 18, { unidad: "GRAMO", presentacion: "Libra", tipo: "PESO", factor: 453.592, stock: 90000, minimo: 9000, peso: 4 }),
  product("FRU-002", "Frutas y verduras", "Cebolla por libra", 0.026, 20, { unidad: "GRAMO", presentacion: "Libra", tipo: "PESO", factor: 453.592, stock: 75000, minimo: 7000, peso: 3 }),
  product("FRU-003", "Frutas y verduras", "Papa por libra", 0.018, 15, { unidad: "GRAMO", presentacion: "Libra", tipo: "PESO", factor: 453.592, stock: 100000, minimo: 10000, peso: 4 }),
  product("FRU-004", "Frutas y verduras", "Banano por libra", 0.015, 13, { unidad: "GRAMO", presentacion: "Libra", tipo: "PESO", factor: 453.592, stock: 80000, minimo: 8000, peso: 4 }),
  product("FRU-005", "Frutas y verduras", "Limón por libra", 0.02, 17, { unidad: "GRAMO", presentacion: "Libra", tipo: "PESO", factor: 453.592, stock: 65000, minimo: 6000, peso: 3 }),
  product("FRU-006", "Frutas y verduras", "Zanahoria por libra", 0.019, 16, { unidad: "GRAMO", presentacion: "Libra", tipo: "PESO", factor: 453.592, stock: 60000, minimo: 6000, peso: 2 }),
  product("FRU-007", "Frutas y verduras", "Aguacate mediano", 8, 14, { stock: 300, peso: 3 }),
  product("FRU-008", "Frutas y verduras", "Plátano maduro", 7, 12, { stock: 350, peso: 3 }),
  product("CAR-001", "Carnes y embutidos", "Jamón de pierna 250 g", 36, 49, { stock: 200, peso: 2 }),
  product("CAR-002", "Carnes y embutidos", "Salchichas paquete 8", 29, 40, { stock: 260, peso: 3 }),
  product("CAR-003", "Carnes y embutidos", "Chorizo por libra", 0.062, 39, { unidad: "GRAMO", presentacion: "Libra", tipo: "PESO", factor: 453.592, stock: 50000, minimo: 5000, peso: 2 }),
  product("CAR-004", "Carnes y embutidos", "Pollo fresco por libra", 0.048, 32, { unidad: "GRAMO", presentacion: "Libra", tipo: "PESO", factor: 453.592, stock: 70000, minimo: 7000, peso: 3 }),
  product("CAR-005", "Carnes y embutidos", "Carne molida por libra", 0.084, 55, { unidad: "GRAMO", presentacion: "Libra", tipo: "PESO", factor: 453.592, stock: 50000, minimo: 5000, peso: 2 }),
  product("CAR-006", "Carnes y embutidos", "Mortadela 250 g", 24, 34, { stock: 220, peso: 2 }),
  product("MAS-001", "Mascotas", "Alimento para perro 2 kg", 98, 128, { stock: 130, peso: 2 }),
  product("MAS-002", "Mascotas", "Alimento para gato 1 kg", 65, 85, { stock: 120, peso: 2 }),
  product("MAS-003", "Mascotas", "Arena para gato 4 kg", 72, 95, { stock: 100, peso: 1 }),
  product("MAS-004", "Mascotas", "Comida húmeda para gato", 18, 28, { stock: 220, peso: 2 }),
  product("FER-001", "Ferretería", "Foco LED 9 W", 31, 44, { stock: 180, peso: 2 }),
  product("FER-002", "Ferretería", "Extensión eléctrica 3 metros", 62, 85, { stock: 80, peso: 1 }),
  product("FER-003", "Ferretería", "Cinta aislante", 14, 24, { stock: 140, peso: 1 }),
  product("FER-004", "Ferretería", "Velas paquete 4", 15, 24, { stock: 200, peso: 2 }),
  product("FER-005", "Ferretería", "Linterna pequeña", 48, 68, { stock: 90, peso: 1 }),
  product("FER-006", "Ferretería", "Candado 40 mm", 55, 75, { stock: 70, peso: 1 }),
  product("FER-007", "Ferretería", "Pegamento instantáneo", 16, 27, { stock: 130, peso: 1 }),
  product("TEST-001", "Hogar", "Producto descontinuado de prueba", 10, 15, { stock: 0, minimo: 0, peso: 0, activo: false }),
];

const CLIENTES = [
  { nombre: "Pulpería Don José", telefono: "9800-1101", notas: "Precio fijo en refrescos y agua.", descuentos: { "BEB-001": 18, "BEB-004": 17, "BEB-009": 10 } },
  { nombre: "Cafetería Las Flores", telefono: "9800-1102", notas: "Compra productos de desayuno.", descuentos: { "LAC-001": 31, "ABR-011": 53, "PAN-001": 40, "REF-001": 4.5 } },
  { nombre: "Comedor El Buen Sabor", telefono: "9800-1103", notas: "Precios acordados para abarrotes.", descuentos: { "ABR-001": 22, "ABR-002": 31, "ABR-007": 39, "ABR-010": 10 } },
  { nombre: "Cliente Vecino", telefono: "9800-1104", notas: "Beneficio especial en hielo y bebidas.", descuentos: { "CON-001": 25, "BEB-002": 48, "BEB-008": 15 } },
  { nombre: "Eventos Familiares Rivera", telefono: "9800-1105", notas: "Compra cajas y paquetes para eventos.", descuentos: { "BEB-001": 18.5, "BEB-004": 17.5, "HIG-006": 14 } },
  { nombre: "Cliente inactivo de prueba", telefono: "9800-1199", notas: "Registro para probar filtros de inactivos.", activo: false, descuentos: {} },
];

const adminPassword = process.env.SEED_ADMIN_PASSWORD;
const resetDemo = String(process.env.SEED_DEMO_RESET ?? "false").toLowerCase() === "true";

if (!adminPassword || adminPassword.length < 8) {
  throw new Error("Define SEED_ADMIN_PASSWORD con al menos 8 caracteres en apps/backend/.env");
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function businessDate(date, hour, minute) {
  const offsetHours = hour >= 8 ? hour - 8 : 16 + hour;
  return addMinutes(date, offsetHours * 60 + minute);
}

function currentBusinessStart(now = new Date()) {
  const start = new Date(now);
  start.setHours(8, 0, 0, 0);
  if (now < start) start.setDate(start.getDate() - 1);
  return start;
}

function createRandom(seed = 24_7_2026) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const random = createRandom();
const randomInt = (min, max) => Math.floor(random() * (max - min + 1)) + min;
const pick = (items) => items[randomInt(0, items.length - 1)];

function ean13(sequence) {
  const first12 = `200${String(sequence).padStart(9, "0")}`;
  const sum = [...first12].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return `${first12}${(10 - (sum % 10)) % 10}`;
}

function hourPrice(presentation, date) {
  if (!presentation.turnos) {
    return { precio: presentation.precio, origen: "NORMAL" };
  }
  const hour = date.getHours();
  const turno = hour >= 8 && hour < 22 ? 0 : hour >= 22 || hour < 2 ? 1 : 2;
  return { precio: presentation.turnos[turno], origen: `TURNO_${turno + 1}` };
}

async function clearDemoData() {
  await prisma.devolucionDetalle.deleteMany();
  await prisma.devolucion.deleteMany();
  await prisma.movimientoInventario.deleteMany();
  await prisma.pagoVenta.deleteMany();
  await prisma.ventaDetalle.deleteMany();
  await prisma.venta.deleteMany();
  await prisma.movimientoCaja.deleteMany();
  await prisma.turnoCaja.deleteMany();
  await prisma.compraDetalle.deleteMany();
  await prisma.compra.deleteMany();
  await prisma.precioEspecialCliente.deleteMany();
  await prisma.clienteEspecial.deleteMany();
  await prisma.codigoBarraProducto.deleteMany();
  await prisma.precioPresentacionHorario.deleteMany();
  await prisma.presentacionProducto.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.proveedor.deleteMany();
  await prisma.bitacora.deleteMany();
  await prisma.usuarioModulo.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.configuracionSistema.deleteMany();
}

async function main() {
  const [productCount, saleCount, purchaseCount, categoryCount, supplierCount, clientCount] = await Promise.all([
    prisma.producto.count(),
    prisma.venta.count(),
    prisma.compra.count(),
    prisma.categoria.count(),
    prisma.proveedor.count(),
    prisma.clienteEspecial.count(),
  ]);

  if ((productCount || saleCount || purchaseCount || categoryCount || supplierCount || clientCount) && !resetDemo) {
    throw new Error(
      "Ya existen productos o transacciones. Para reemplazarlos conscientemente con datos demo usa SEED_DEMO_RESET=true.",
    );
  }

  if (resetDemo) {
    console.log("SEED_DEMO_RESET=true: eliminando los datos actuales de prueba...");
    await clearDemoData();
  }

  for (const [codigo, nombre, tipo] of MODULOS) {
    await prisma.modulo.upsert({
      where: { codigo },
      update: { nombre, tipo, activo: true },
      create: { codigo, nombre, tipo },
    });
  }

  const franjas = [];
  for (const franja of FRANJAS) {
    franjas.push(await prisma.franjaHorariaPrecio.upsert({
      where: { nombre: franja.nombre },
      update: { ...franja, activo: true },
      create: franja,
    }));
  }

  await prisma.configuracionSistema.upsert({
    where: { id: 1 },
    update: {
      nombreNegocio: "Minisúper 24/7 - DEMO",
      direccion: "Tegucigalpa, Honduras",
      telefono: "2234-5678",
      simboloMoneda: "L",
      fondoInicial: 1500,
      mensajeReportes: "Base de demostración con 30 días de operaciones.",
    },
    create: {
      id: 1,
      nombreNegocio: "Minisúper 24/7 - DEMO",
      direccion: "Tegucigalpa, Honduras",
      telefono: "2234-5678",
      simboloMoneda: "L",
      fondoInicial: 1500,
      mensajeReportes: "Base de demostración con 30 días de operaciones.",
    },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  /** @type {Array<{usuario: string, nombre: string, rol: import("@prisma/client").RolUsuario, modulos: string[]}>} */
  const userSpecs = [
    { usuario: "admin", nombre: "Administrador Demo", rol: "ADMINISTRADOR", modulos: MODULOS.map(([codigo]) => codigo) },
    { usuario: "supervisor", nombre: "Supervisor Demo", rol: "SUPERVISOR", modulos: MODULOS.map(([codigo]) => codigo).filter((codigo) => !["USUARIOS", "CONFIGURACION"].includes(codigo)) },
    { usuario: "cajero", nombre: "Cajero Demo", rol: "CAJERO", modulos: ["VENTAS", "CAJA", "CLIENTES", "DEVOLUCIONES"] },
    { usuario: "bodega", nombre: "Encargado de Bodega", rol: "BODEGA", modulos: ["PRODUCTOS", "INVENTARIO", "PROVEEDORES", "COMPRAS", "DEVOLUCIONES"] },
  ];
  const users = {};

  for (const spec of userSpecs) {
    const user = await prisma.usuario.upsert({
      where: { usuario: spec.usuario },
      update: { nombre: spec.nombre, contrasenaHash: passwordHash, rol: spec.rol, activo: true },
      create: { nombre: spec.nombre, usuario: spec.usuario, contrasenaHash: passwordHash, rol: spec.rol },
    });
    users[spec.usuario] = user;
    await prisma.usuarioModulo.deleteMany({ where: { usuarioId: user.id } });
    await prisma.usuarioModulo.createMany({
      data: spec.modulos.map((moduloCodigo) => ({ usuarioId: user.id, moduloCodigo, permitido: true })),
    });
  }

  const categories = {};
  for (const nombre of CATEGORIAS) {
    categories[nombre] = await prisma.categoria.create({ data: { nombre } });
  }

  const suppliers = [];
  for (const [nombre, contacto, telefono, correo, direccion] of PROVEEDORES) {
    suppliers.push(await prisma.proveedor.create({
      data: { nombre, contacto, telefono, correo, direccion, notas: "Proveedor generado para pruebas integrales." },
    }));
  }
  await prisma.proveedor.create({
    data: { nombre: "Proveedor inactivo de prueba", contacto: "Registro archivado", activo: false, notas: "Permite probar filtros de estado." },
  });

  let barcodeSequence = 1;
  const products = [];
  const productBySku = new Map();
  const presentations = [];
  const primaryBySku = new Map();

  for (const spec of PRODUCTOS) {
    const created = await prisma.producto.create({
      data: {
        sku: spec.sku,
        nombre: spec.nombre,
        descripcion: `Producto de demostración: ${spec.nombre}.`,
        categoriaId: categories[spec.categoria].id,
        unidadInventario: spec.unidad,
        modoPrecio: spec.turnos ? "POR_HORARIO" : "UNICO",
        stockActual: 0,
        stockMinimo: spec.minimo,
        costoPromedio: spec.costo,
        controlaInventario: true,
        activo: spec.activo,
      },
    });
    const complete = { ...created, spec };
    products.push(complete);
    productBySku.set(spec.sku, complete);

    const presentationSpecs = [
      { nombre: spec.presentacion, tipo: spec.tipo, factor: spec.factor, precio: spec.precio, turnos: spec.turnos },
      ...spec.extras.map(([nombre, tipo, factor, precio, turnos = null]) => ({ nombre, tipo, factor, precio, turnos })),
    ];

    for (let index = 0; index < presentationSpecs.length; index += 1) {
      const presentationSpec = presentationSpecs[index];
      const createdPresentation = await prisma.presentacionProducto.create({
        data: {
          productoId: created.id,
          nombre: presentationSpec.nombre,
          tipo: presentationSpec.tipo,
          factorInventario: presentationSpec.factor,
          precioBase: presentationSpec.precio,
          esPrincipal: index === 0,
          activo: spec.activo,
          codigosBarra: {
            create: { codigo: ean13(barcodeSequence++), principal: true, activo: spec.activo },
          },
          preciosHorario: presentationSpec.turnos
            ? { create: franjas.map((franja, shiftIndex) => ({ franjaId: franja.id, precio: presentationSpec.turnos[shiftIndex] })) }
            : undefined,
        },
      });
      const fullPresentation = { ...createdPresentation, producto: complete, precio: presentationSpec.precio, turnos: presentationSpec.turnos };
      presentations.push(fullPresentation);
      if (index === 0) primaryBySku.set(spec.sku, fullPresentation);
    }
  }

  const clients = [];
  const specialPrice = new Map();
  for (const clientSpec of CLIENTES) {
    const client = await prisma.clienteEspecial.create({
      data: { nombre: clientSpec.nombre, telefono: clientSpec.telefono, notas: clientSpec.notas, activo: clientSpec.activo ?? true },
    });
    clients.push(client);
    for (const [sku, precio] of Object.entries(clientSpec.descuentos)) {
      const presentation = primaryBySku.get(sku);
      await prisma.precioEspecialCliente.create({
        data: { clienteId: client.id, presentacionId: presentation.id, precio, activo: true },
      });
      specialPrice.set(`${client.id}:${presentation.id}`, precio);
    }
  }

  const now = new Date();
  const currentShiftStart = currentBusinessStart(now);
  const firstShiftStart = addDays(currentShiftStart, -29);
  const balances = new Map();
  /** @type {import("@prisma/client").Prisma.MovimientoInventarioCreateManyInput[]} */
  const initialMovements = [];
  for (const item of products) {
    balances.set(item.id, item.spec.stock);
    if (item.spec.stock > 0) {
      initialMovements.push({
        productoId: item.id,
        usuarioId: users.bodega.id,
        tipo: "INVENTARIO_INICIAL",
        cantidad: item.spec.stock,
        saldoPosterior: item.spec.stock,
        costoUnitario: item.spec.costo,
        motivo: "Inventario inicial del conjunto de datos demo.",
        creadoEn: addDays(firstShiftStart, -2),
      });
    }
  }
  await prisma.movimientoInventario.createMany({ data: initialMovements });

  const weightedProducts = products.filter((item) => item.spec.activo && item.spec.peso > 0);
  const totalWeight = weightedProducts.reduce((sum, item) => sum + item.spec.peso, 0);
  function weightedProduct() {
    let value = random() * totalWeight;
    for (const item of weightedProducts) {
      value -= item.spec.peso;
      if (value <= 0) return item;
    }
    return weightedProducts.at(-1);
  }

  const stats = { ventas: 0, completadas: 0, canceladas: 0, detalles: 0, compras: 0, devoluciones: 0, devolucionesProveedor: 0 };
  let documentSequence = 1001;

  for (let dayIndex = 0; dayIndex < 30; dayIndex += 1) {
    const shiftStart = addDays(firstShiftStart, dayIndex);
    const isCurrent = dayIndex === 29;

    if (dayIndex % 3 === 0) {
      const supplier = suppliers[(dayIndex / 3) % suppliers.length];
      const purchaseDate = addMinutes(shiftStart, -45);
      const selectedProducts = [];
      while (selectedProducts.length < 8) {
        const candidate = pick(weightedProducts);
        if (!selectedProducts.some((item) => item.id === candidate.id)) selectedProducts.push(candidate);
      }
      const details = [];
      /** @type {import("@prisma/client").Prisma.MovimientoInventarioUncheckedCreateWithoutCompraInput[]} */
      const movements = [];
      let total = 0;
      for (const item of selectedProducts) {
        const presentation = primaryBySku.get(item.spec.sku);
        const quantity = randomInt(24, 72);
        const inventoryQuantity = round2(quantity * Number(presentation.factorInventario));
        const presentationCost = round2(item.spec.costo * Number(presentation.factorInventario));
        const subtotal = round2(quantity * presentationCost);
        const newBalance = round2(balances.get(item.id) + inventoryQuantity);
        balances.set(item.id, newBalance);
        total += subtotal;
        details.push({
          productoId: item.id,
          presentacionId: presentation.id,
          productoNombre: item.nombre,
          presentacionNombre: presentation.nombre,
          cantidad: quantity,
          factorInventario: presentation.factorInventario,
          cantidadInventario: inventoryQuantity,
          costoPresentacion: presentationCost,
          costoUnitarioInventario: item.spec.costo,
          subtotal,
        });
        movements.push({
          productoId: item.id,
          usuarioId: users.bodega.id,
          tipo: "COMPRA",
          cantidad: inventoryQuantity,
          saldoPosterior: newBalance,
          costoUnitario: item.spec.costo,
          motivo: `Entrada por compra demo ${documentSequence}.`,
          creadoEn: purchaseDate,
        });
      }
      const purchase = await prisma.compra.create({
        data: {
          proveedorId: supplier.id,
          usuarioId: users.bodega.id,
          proveedorNombre: supplier.nombre,
          numeroDocumento: `FAC-DEMO-${documentSequence++}`,
          notas: "Reposición programada generada por el seed.",
          total: round2(total),
          estado: "RECIBIDA",
          creadoEn: purchaseDate,
          detalles: { create: details },
          movimientos: { create: movements },
        },
      });
      stats.compras += 1;

      if (dayIndex === 9) {
        const detail = details[0];
        const returnedQuantity = Math.min(2, Number(detail.cantidad));
        const returnedInventory = round2(returnedQuantity * Number(detail.factorInventario));
        const newBalance = round2(balances.get(detail.productoId) - returnedInventory);
        const returnedAt = addMinutes(purchaseDate, 30);
        balances.set(detail.productoId, newBalance);
        await prisma.devolucion.create({
          data: {
            tipo: "PROVEEDOR",
            compraId: purchase.id,
            usuarioId: users.bodega.id,
            total: round2(returnedQuantity * Number(detail.costoPresentacion)),
            motivo: "Mercadería dañada devuelta al proveedor (dato demo).",
            creadoEn: returnedAt,
            detalles: { create: {
              productoId: detail.productoId,
              presentacionId: detail.presentacionId,
              productoNombre: detail.productoNombre,
              presentacionNombre: detail.presentacionNombre,
              cantidad: returnedQuantity,
              factorInventario: detail.factorInventario,
              cantidadInventario: returnedInventory,
              precioUnitario: detail.costoPresentacion,
              subtotal: round2(returnedQuantity * Number(detail.costoPresentacion)),
            } },
          },
        });
        await prisma.movimientoInventario.create({
          data: {
            productoId: detail.productoId,
            usuarioId: users.bodega.id,
            compraId: purchase.id,
            tipo: "DEVOLUCION_PROVEEDOR",
            cantidad: returnedInventory,
            saldoPosterior: newBalance,
            costoUnitario: detail.costoUnitarioInventario,
            motivo: `Devolución al proveedor, compra #${purchase.id}.`,
            creadoEn: returnedAt,
          },
        });
        stats.devolucionesProveedor += 1;
      }
    }

    const shift = await prisma.turnoCaja.create({
      data: {
        usuarioAperturaId: dayIndex % 2 === 0 ? users.cajero.id : users.supervisor.id,
        fondoInicial: 1500,
        estado: isCurrent ? "ABIERTO" : "CERRADO",
        abiertoEn: shiftStart,
      },
    });

    let income = 0;
    let withdrawal = 0;
    if (!isCurrent || now > addMinutes(shiftStart, 30)) {
      if (dayIndex % 5 === 0) {
        income = 200;
        await prisma.movimientoCaja.create({
          data: { turnoCajaId: shift.id, usuarioId: users.supervisor.id, tipo: "INGRESO", monto: income, motivo: "Reposición de efectivo para cambio.", creadoEn: addMinutes(shiftStart, 20) },
        });
      }
      if (dayIndex % 3 === 1) {
        withdrawal = 500;
        await prisma.movimientoCaja.create({
          data: { turnoCajaId: shift.id, usuarioId: users.supervisor.id, tipo: "RETIRO", monto: withdrawal, motivo: "Retiro preventivo de efectivo.", creadoEn: addMinutes(shiftStart, 240) },
        });
      }
    }

    const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - shiftStart.getTime()) / 60_000));
    const daySales = isCurrent ? Math.min(18, Math.floor(elapsedMinutes / 7)) : randomInt(45, 65);
    let completedCash = 0;

    for (let saleIndex = 0; saleIndex < daySales; saleIndex += 1) {
      let saleDate;
      if (isCurrent) {
        const usable = Math.max(1, elapsedMinutes - 2);
        saleDate = addMinutes(shiftStart, Math.floor(((saleIndex + 1) * usable) / (daySales + 1)));
      } else {
        const phase = random();
        const hour = phase < 0.64 ? randomInt(8, 21) : phase < 0.84 ? pick([22, 23, 0, 1]) : randomInt(2, 7);
        saleDate = businessDate(shiftStart, hour, randomInt(0, 59));
      }

      const activeClients = clients.filter((client) => client.activo);
      const client = random() < 0.14 ? pick(activeClients) : null;
      const itemCount = randomInt(1, 5);
      const itemMap = new Map();
      for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
        const selectedProduct = weightedProduct();
        const availablePresentations = presentations.filter((presentation) => presentation.producto.id === selectedProduct.id && presentation.activo);
        const presentation = availablePresentations.length > 1 && random() < 0.04 ? availablePresentations[1] : availablePresentations[0];
        const key = presentation.id;
        const quantity = Number(presentation.factorInventario) > 10 ? 1 : randomInt(1, 3);
        itemMap.set(key, { presentation, quantity: (itemMap.get(key)?.quantity ?? 0) + quantity });
      }

      const details = [];
      const deductions = new Map();
      let total = 0;
      for (const { presentation, quantity } of itemMap.values()) {
        const item = presentation.producto;
        const inventoryQuantity = round2(quantity * Number(presentation.factorInventario));
        if (balances.get(item.id) < inventoryQuantity) continue;
        const clientPrice = client ? specialPrice.get(`${client.id}:${presentation.id}`) : null;
        const calculated = clientPrice != null ? { precio: clientPrice, origen: "CLIENTE_ESPECIAL" } : hourPrice(presentation, saleDate);
        const subtotal = round2(quantity * calculated.precio);
        total += subtotal;
        details.push({
          productoId: item.id,
          presentacionId: presentation.id,
          productoNombre: item.nombre,
          presentacionNombre: presentation.nombre,
          cantidad: quantity,
          factorInventario: presentation.factorInventario,
          cantidadInventario: inventoryQuantity,
          costoUnitario: round2(item.spec.costo * Number(presentation.factorInventario)),
          precioUnitario: calculated.precio,
          subtotal,
          precioOrigen: calculated.origen,
        });
        deductions.set(item.id, (deductions.get(item.id) ?? 0) + inventoryQuantity);
      }
      if (!details.length) continue;
      total = round2(total);

      stats.ventas += 1;
      const canceled = stats.ventas % 83 === 0;
      /** @type {import("@prisma/client").Prisma.MovimientoInventarioUncheckedCreateWithoutVentaInput[]} */
      const inventoryMovements = [];
      for (const [productId, quantity] of deductions) {
        const item = products.find((candidate) => candidate.id === productId);
        const afterSale = round2(balances.get(productId) - quantity);
        balances.set(productId, afterSale);
        inventoryMovements.push({
          productoId: productId,
          usuarioId: users.cajero.id,
          tipo: "VENTA",
          cantidad: quantity,
          saldoPosterior: afterSale,
          costoUnitario: item.spec.costo,
          motivo: "Salida por venta demo.",
          creadoEn: saleDate,
        });
        if (canceled) {
          const restored = round2(afterSale + quantity);
          balances.set(productId, restored);
          inventoryMovements.push({
            productoId: productId,
            usuarioId: users.supervisor.id,
            tipo: "CANCELACION_VENTA",
            cantidad: quantity,
            saldoPosterior: restored,
            costoUnitario: item.spec.costo,
            motivo: "Reposición por cancelación de venta demo.",
            creadoEn: addMinutes(saleDate, 5),
          });
        }
      }

      const paymentRoll = random();
      /** @type {import("@prisma/client").Prisma.PagoVentaUncheckedCreateWithoutVentaInput[]} */
      const payments = [];
      if (paymentRoll < 0.66) {
        const received = Math.ceil(total / 50) * 50;
        payments.push({ metodo: "EFECTIVO", monto: total, recibido: received, cambio: round2(received - total), creadoEn: saleDate });
      } else if (paymentRoll < 0.84) {
        payments.push({ metodo: "TARJETA", monto: total, cambio: 0, referencia: `POS-${String(stats.ventas).padStart(6, "0")}`, creadoEn: saleDate });
      } else if (paymentRoll < 0.96) {
        payments.push({ metodo: "TRANSFERENCIA", monto: total, cambio: 0, referencia: `TRX-${String(stats.ventas).padStart(6, "0")}`, creadoEn: saleDate });
      } else {
        const cashPart = round2(total / 2);
        payments.push({ metodo: "EFECTIVO", monto: cashPart, recibido: cashPart, cambio: 0, creadoEn: saleDate });
        payments.push({ metodo: "TARJETA", monto: round2(total - cashPart), cambio: 0, referencia: `MIX-${String(stats.ventas).padStart(6, "0")}`, creadoEn: saleDate });
      }

      const sale = await prisma.venta.create({
        data: {
          usuarioId: saleIndex % 5 === 0 ? users.supervisor.id : users.cajero.id,
          turnoCajaId: shift.id,
          clienteEspecialId: client?.id ?? null,
          clienteNombre: client?.nombre ?? null,
          subtotal: total,
          total,
          estado: canceled ? "CANCELADA" : "COMPLETADA",
          creadoEn: saleDate,
          canceladoEn: canceled ? addMinutes(saleDate, 5) : null,
          detalles: { create: details },
          pagos: { create: payments },
          movimientos: { create: inventoryMovements },
        },
      });

      stats.detalles += details.length;
      if (canceled) {
        stats.canceladas += 1;
      } else {
        stats.completadas += 1;
        completedCash += payments
          .filter((payment) => payment.metodo === "EFECTIVO")
          .reduce((sum, payment) => sum + Number(payment.monto), 0);
      }

      if (!canceled && stats.completadas % 97 === 0) {
        const detail = details[0];
        const returnedInventory = Number(detail.cantidadInventario);
        const newBalance = round2(balances.get(detail.productoId) + returnedInventory);
        balances.set(detail.productoId, newBalance);
        const returnedAt = addMinutes(saleDate, 30);
        await prisma.devolucion.create({
          data: {
            tipo: "CLIENTE",
            ventaId: sale.id,
            usuarioId: users.supervisor.id,
            total: detail.subtotal,
            motivo: "Producto devuelto por cliente (dato demo).",
            creadoEn: returnedAt,
            detalles: { create: {
              productoId: detail.productoId,
              presentacionId: detail.presentacionId,
              productoNombre: detail.productoNombre,
              presentacionNombre: detail.presentacionNombre,
              cantidad: detail.cantidad,
              factorInventario: detail.factorInventario,
              cantidadInventario: detail.cantidadInventario,
              precioUnitario: detail.precioUnitario,
              subtotal: detail.subtotal,
            } },
          },
        });
        await prisma.movimientoInventario.create({
          data: {
            productoId: detail.productoId,
            usuarioId: users.supervisor.id,
            ventaId: sale.id,
            tipo: "DEVOLUCION_CLIENTE",
            cantidad: returnedInventory,
            saldoPosterior: newBalance,
            costoUnitario: products.find((item) => item.id === detail.productoId).spec.costo,
            motivo: `Devolución de cliente, venta #${sale.id}.`,
            creadoEn: returnedAt,
          },
        });
        stats.devoluciones += 1;
      }
    }

    if (!isCurrent) {
      const expected = round2(1500 + completedCash + income - withdrawal);
      const difference = dayIndex % 11 === 0 ? -2 : dayIndex % 13 === 0 ? 1 : 0;
      await prisma.turnoCaja.update({
        where: { id: shift.id },
        data: {
          usuarioCierreId: users.supervisor.id,
          efectivoEsperadoCierre: expected,
          efectivoContado: round2(expected + difference),
          diferencia: difference,
          cerradoEn: addMinutes(addDays(shiftStart, 1), -5),
        },
      });
    }
  }

  // Compra anulada para probar el historial y los filtros sin alterar existencias.
  const annulledProduct = productBySku.get("ABR-014");
  const annulledPresentation = primaryBySku.get("ABR-014");
  const annulledQuantity = 20;
  const annulledInventory = annulledQuantity * Number(annulledPresentation.factorInventario);
  const annulledDate = addDays(firstShiftStart, 12);
  await prisma.compra.create({
    data: {
      proveedorId: suppliers[2].id,
      usuarioId: users.bodega.id,
      proveedorNombre: suppliers[2].nombre,
      numeroDocumento: "FAC-DEMO-ANULADA",
      notas: "Compra anulada creada para pruebas.",
      total: round2(annulledQuantity * annulledProduct.spec.costo),
      estado: "ANULADA",
      creadoEn: annulledDate,
      anuladaEn: addMinutes(annulledDate, 20),
      detalles: { create: {
        productoId: annulledProduct.id,
        presentacionId: annulledPresentation.id,
        productoNombre: annulledProduct.nombre,
        presentacionNombre: annulledPresentation.nombre,
        cantidad: annulledQuantity,
        factorInventario: annulledPresentation.factorInventario,
        cantidadInventario: annulledInventory,
        costoPresentacion: annulledProduct.spec.costo,
        costoUnitarioInventario: annulledProduct.spec.costo,
        subtotal: round2(annulledQuantity * annulledProduct.spec.costo),
      } },
      movimientos: { create: [
        { productoId: annulledProduct.id, usuarioId: users.bodega.id, tipo: "COMPRA", cantidad: annulledInventory, saldoPosterior: round2(balances.get(annulledProduct.id) + annulledInventory), costoUnitario: annulledProduct.spec.costo, motivo: "Entrada de compra posteriormente anulada.", creadoEn: annulledDate },
        { productoId: annulledProduct.id, usuarioId: users.supervisor.id, tipo: "ANULACION_COMPRA", cantidad: annulledInventory, saldoPosterior: balances.get(annulledProduct.id), costoUnitario: annulledProduct.spec.costo, motivo: "Anulación de compra demo.", creadoEn: addMinutes(annulledDate, 20) },
      ] },
    },
  });
  stats.compras += 1;

  // Fuerza varios productos a existencia baja para probar alertas de inventario.
  const lowStockTargets = { "BEBE-001": 5, "HOG-004": 7, "LIM-004": 8, "ENL-004": 6, "HIG-005": 4 };
  for (const [sku, target] of Object.entries(lowStockTargets)) {
    const item = productBySku.get(sku);
    const current = balances.get(item.id);
    if (current > target) {
      const quantity = round2(current - target);
      balances.set(item.id, target);
      await prisma.movimientoInventario.create({
        data: {
          productoId: item.id,
          usuarioId: users.bodega.id,
          tipo: "AJUSTE_NEGATIVO",
          cantidad: quantity,
          saldoPosterior: target,
          costoUnitario: item.spec.costo,
          motivo: "Ajuste demo para probar alerta de existencia baja.",
          creadoEn: addMinutes(now, -10),
        },
      });
    }
  }

  for (const item of products) {
    await prisma.producto.update({
      where: { id: item.id },
      data: { stockActual: balances.get(item.id) },
    });
  }

  await prisma.bitacora.createMany({
    data: [
      { usuarioId: users.admin.id, accion: "EJECUTAR_SEED_DEMO", entidad: "Sistema", detalle: { productos: products.length, ventas: stats.ventas, dias: 30 }, creadoEn: now },
      { usuarioId: users.supervisor.id, accion: "AJUSTAR_INVENTARIO", entidad: "Producto", detalle: { motivo: "Preparar productos con existencia baja" }, creadoEn: addMinutes(now, -10) },
      { usuarioId: users.bodega.id, accion: "REGISTRAR_COMPRA", entidad: "Compra", detalle: { comprasGeneradas: stats.compras }, creadoEn: addMinutes(now, -20) },
    ],
  });

  console.log("\nSeed demo creado correctamente.");
  console.table({
    productos: products.length,
    presentaciones: presentations.length,
    proveedores: PROVEEDORES.length + 1,
    clientesEspeciales: clients.length,
    turnosCaja: 30,
    ventas: stats.ventas,
    ventasCompletadas: stats.completadas,
    ventasCanceladas: stats.canceladas,
    detallesVenta: stats.detalles,
    compras: stats.compras,
    devolucionesCliente: stats.devoluciones,
    devolucionesProveedor: stats.devolucionesProveedor,
  });
  console.log("Usuarios: admin, supervisor, cajero y bodega");
  console.log("Todos usan la contraseña definida en SEED_ADMIN_PASSWORD.");
  console.log("La caja del turno actual queda ABIERTA para comenzar a vender.");
  console.log("Los códigos de barra demo empiezan por 200 y son EAN-13 válidos.\n");
}

main()
  .catch((error) => {
    console.error("No se pudieron crear los datos demo:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
