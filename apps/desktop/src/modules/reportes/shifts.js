const hourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Tegucigalpa",
  hour: "2-digit",
  hourCycle: "h23",
});

// Mismos turnos que "Mi actividad" en caja: A (2am-8am), B (8am-6pm),
// C (6pm-2am). Antes esto tenía otra definición (8am-6pm/6pm-10pm/10pm-8am)
// que no coincidía con el resto del sistema.
export function shiftIdForDate(value) {
  const hour = Number(hourFormatter.format(new Date(value)));

  if (hour >= 2 && hour < 8) {
    return "A";
  }

  if (hour >= 8 && hour < 18) {
    return "B";
  }

  return "C";
}

export function emptyShifts() {
  return [
    { id: "A", name: "Turno A", schedule: "2:00 a. m. – 8:00 a. m.", operations: 0, total: 0 },
    { id: "B", name: "Turno B", schedule: "8:00 a. m. – 6:00 p. m.", operations: 0, total: 0 },
    { id: "C", name: "Turno C", schedule: "6:00 p. m. – 2:00 a. m.", operations: 0, total: 0 },
  ];
}
