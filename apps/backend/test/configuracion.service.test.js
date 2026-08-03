import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const initialShifts = () => [
  { id: 1, nombre: "Turno 1", orden: 1, minutoInicio: 480, minutoFin: 1320, activo: true },
  { id: 2, nombre: "Turno 2", orden: 2, minutoInicio: 1320, minutoFin: 120, activo: true },
  { id: 3, nombre: "Turno 3", orden: 3, minutoInicio: 120, minutoFin: 480, activo: true },
];

const state = {
  shifts: initialShifts(),
  configuration: null,
  shiftUpdates: [],
};

const configuracionSistema = {
  async upsert({ update, create }) {
    state.configuration = {
      id: 1,
      nombreNegocio: "Minisúper",
      direccion: null,
      telefono: null,
      simboloMoneda: "L",
      fondoInicial: 500,
      mensajeReportes: null,
      actualizadoEn: new Date("2026-08-03T10:00:00Z"),
      ...state.configuration,
      ...(state.configuration ? update : create),
    };
    return state.configuration;
  },
};

const franjaHorariaPrecio = {
  async findMany() {
    return state.shifts.map((shift) => ({ ...shift }));
  },
  async update({ where, data }) {
    state.shiftUpdates.push({ where, data });
    const shift = state.shifts.find((item) => item.id === where.id);
    Object.assign(shift, data);
    return shift;
  },
};

const prisma = {
  configuracionSistema,
  franjaHorariaPrecio,
  async $transaction(callback) {
    return callback({ configuracionSistema, franjaHorariaPrecio });
  },
};

const prismaModule = new URL("../src/lib/prisma.js", import.meta.url);
mock.module(prismaModule.href, { namedExports: { prisma } });

const { getConfiguration, updateConfiguration } = await import(
  "../src/modules/configuracion/configuracion.service.js"
);

const validPayload = () => ({
  nombreNegocio: "  Minisúper   24/7 ",
  direccion: " Barrio   Centro ",
  telefono: " 9999-9999 ",
  simboloMoneda: " L ",
  fondoInicial: "750.126",
  mensajeReportes: " Gracias   por su compra ",
  turnos: [
    { id: 1, horaInicio: "08:00", horaFin: "22:00" },
    { id: 2, horaInicio: "22:00", horaFin: "02:00" },
    { id: 3, horaInicio: "02:00", horaFin: "08:00" },
  ],
});

beforeEach(() => {
  state.shifts = initialShifts();
  state.configuration = null;
  state.shiftUpdates = [];
});

test("exige exactamente tres turnos continuos que cubran 24 horas", async () => {
  const missing = validPayload();
  missing.turnos.pop();
  await assert.rejects(
    () => updateConfiguration(missing),
    /exactamente tres turnos/i,
  );

  const gap = validPayload();
  gap.turnos[0].horaFin = "21:00";
  await assert.rejects(
    () => updateConfiguration(gap),
    /deben ser continuos/i,
  );

  const repeated = validPayload();
  repeated.turnos[1].id = 1;
  await assert.rejects(
    () => updateConfiguration(repeated),
    /repetir el mismo turno/i,
  );
});

test("rechaza horarios y montos inválidos", async () => {
  const invalidTime = validPayload();
  invalidTime.turnos[0].horaInicio = "24:00";
  await assert.rejects(
    () => updateConfiguration(invalidTime),
    /horarios no es válido/i,
  );

  const invalidFund = validPayload();
  invalidFund.fondoInicial = -1;
  await assert.rejects(
    () => updateConfiguration(invalidFund),
    /fondo inicial debe ser un monto válido/i,
  );
});

test("normaliza datos y conserva los IDs de las franjas", async () => {
  const result = await updateConfiguration(validPayload());

  assert.equal(result.nombreNegocio, "Minisúper 24/7");
  assert.equal(result.direccion, "Barrio Centro");
  assert.equal(result.telefono, "9999-9999");
  assert.equal(result.fondoInicial, 750.13);
  assert.equal(result.mensajeReportes, "Gracias por su compra");
  assert.deepEqual(
    result.turnos.map(({ id, horaInicio, horaFin }) => ({ id, horaInicio, horaFin })),
    validPayload().turnos,
  );
  assert.deepEqual(
    state.shiftUpdates.map(({ where }) => where.id),
    [1, 2, 3],
  );
});

test("detecta una configuración incompleta al consultarla", async () => {
  state.shifts.pop();

  await assert.rejects(
    () => getConfiguration(),
    (error) => error.status === 500 && /exactamente tres/i.test(error.message),
  );
});
