const hourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Tegucigalpa",
  hour: "2-digit",
  hourCycle: "h23",
});

export function shiftIdForDate(value) {
  const hour = Number(hourFormatter.format(new Date(value)));
  return hour >= 8 && hour < 18 ? 1 : hour >= 18 && hour < 22 ? 2 : 3;
}

export function emptyShifts() {
  return [
    { id: 1, name: "Turno 1", schedule: "8:00 a. m. – 6:00 p. m.", operations: 0, total: 0 },
    { id: 2, name: "Turno 2", schedule: "6:00 p. m. – 10:00 p. m.", operations: 0, total: 0 },
    { id: 3, name: "Turno 3", schedule: "10:00 p. m. – 8:00 a. m.", operations: 0, total: 0 },
  ];
}
