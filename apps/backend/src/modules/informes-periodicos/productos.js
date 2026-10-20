// apps/backend/src/modules/informes-periodicos/productos.js

// Los cigarros se compran y venden por cajetilla/cartón: en los informes
// semanal y mensual son lo único que se muestra por presentación. El resto
// va en unidades del producto.
export function esCigarro(producto, nombreProducto) {
  const texto = `${producto?.categoria?.nombre ?? ""} ${nombreProducto ?? ""}`.toLowerCase();
  return texto.includes("cigarr") || texto.includes("tabac");
}

// "Paquete Cigarro belmont Grande" ya dice de qué producto es; "Grande" no.
export function nombreConPresentacion(producto, presentacion) {
  const primeraPalabra = (producto ?? "").trim().split(/\s+/)[0]?.toLowerCase();
  return primeraPalabra && (presentacion ?? "").toLowerCase().includes(primeraPalabra)
    ? presentacion
    : `${producto} · ${presentacion}`;
}
