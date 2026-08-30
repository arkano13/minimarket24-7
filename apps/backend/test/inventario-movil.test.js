import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const state = { products: [], movements: [], audit: [], failOn: null };
const tx = {
  producto: {
    async findFirst({ where }) { return state.products.find((p) => p.id === where.id) ?? null; },
    async update({ where, data }) { const p=state.products.find((x)=>x.id===where.id);p.stockActual=data.stockActual;return p; },
  },
  movimientoInventario: { async create({ data }) { state.movements.push(data); return data; } },
};
const prisma = {
  producto: { async findMany() { return state.products; } },
  async $transaction(callback) { return callback(tx); },
};
mock.module(new URL("../src/lib/prisma.js", import.meta.url).href, { namedExports: { prisma } });
mock.module(new URL("../src/modules/bitacora/bitacora.service.js", import.meta.url).href, { namedExports: { registrarBitacora: async (data) => state.audit.push(data) } });
const { previewMobileAdjustments, applyMobileAdjustments } = await import("../src/modules/inventario/inventario-movil.service.js");
const product=(id,nombre,stock=10)=>({id,nombre,stockActual:String(stock),costoPromedio:"2",unidadInventario:"UNIDAD",presentaciones:[{id, nombre:"Unidad",esPrincipal:true,factorInventario:"1"}]});
beforeEach(()=>{state.products=[product(1,"Coca-Cola Personal"),product(2,"Coca-Cola Lata")];state.movements=[];state.audit=[];});
test("vista previa exige coincidencia única y muestra stock nuevo",async()=>{
 const exact=await previewMobileAdjustments({items:[{nombre:"coca cola personal",cantidad:3}]});
 assert.equal(exact.resultados[0].estado,"LISTO");assert.equal(exact.resultados[0].stockNuevo,13);
 const ambiguous=await previewMobileAdjustments({items:[{nombre:"coca cola",cantidad:3}]});
 assert.equal(ambiguous.resultados[0].estado,"AMBIGUO");assert.equal(ambiguous.resultados[0].coincidencias.length,2);
});
test("aplica ajustes, registra movimientos y rechaza inventario negativo",async()=>{
 const result=await applyMobileAdjustments({items:[{nombre:"Coca-Cola Personal",productoId:1,cantidad:3}]},7);
 assert.equal(result.resultados[0].stockNuevo,13);assert.equal(state.movements[0].tipo,"AJUSTE_POSITIVO");assert.equal(state.audit.length,1);
 await assert.rejects(()=>applyMobileAdjustments({items:[{nombre:"Coca-Cola Personal",productoId:1,cantidad:-20}]},7),/inventario negativo/i);
});
