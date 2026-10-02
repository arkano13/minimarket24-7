// Decide qué nombre se muestra grande en Ventas y Compras. En la
// presentación principal (la unidad) manda el nombre del producto; en un
// paquete, caja o six-pack manda el nombre de la presentación, que es lo
// que distingue una tarjeta de otra.
export function presentationLabel(item) {
  const factor = Number(item.factorInventario ?? 1);
  const principal = item.esPrincipal ?? factor === 1;

  if (principal || !item.presentacion) {
    return { titulo: item.nombre, detalle: item.presentacion ?? "", factor };
  }

  return { titulo: item.presentacion, detalle: item.nombre, factor };
}

export function formatUnits(value) {
  return new Intl.NumberFormat("es-HN", { maximumFractionDigits: 3 }).format(value);
}
