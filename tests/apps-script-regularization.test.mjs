import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
const context = vm.createContext({ console, Date, JSON, Math, Object, RegExp, String, Number, Array, Error });
vm.runInContext(source, context, { filename: "Code.gs" });

test("regularization keeps existing date, lots and detail", () => {
  const map = { dateTime: 0, name: 1, phone: 2, role: 3, license: 4, category: 5, lots: 6, detail: 7, code: 8, motive: 9, plate: 10, zone: 11, guard: 12, responsible: 13 };
  const original = [new Date("2026-08-20T12:00:00Z"), "PEPE EXISTENTE", "999999999", "CONDUCTOR", "Q12345678", "A-IIB", "4", "LOTE ORIGINAL", "LT-01", "PROCESO", "ABC123", "ZONA 1", "GUARDIA A", "OPERADOR"];
  const completed = context.completeExistingRow_(
    { raw: original.slice() },
    map,
    { name: "Pepe Existente", phone: "999999999", role: "CONDUCTOR", license: "Q12345678", category: "A-IIB", lots: "", detail: "", lotCodes: [] },
    { plate: "ABC123", zone: "ZONA 1" },
  );

  assert.equal(completed[map.dateTime].toISOString(), original[map.dateTime].toISOString());
  assert.equal(completed[map.lots], "4");
  assert.equal(completed[map.detail], "LOTE ORIGINAL");
  assert.equal(completed[map.code], "LT-01");
});

test("regularization only fills missing cargo fields", () => {
  const map = { name: 0, phone: 1, role: 2, license: 3, category: 4, lots: 5, detail: 6, code: 7, motive: 8, plate: 9, zone: 10, guard: 11, responsible: 12 };
  const original = ["PROVEEDOR", "999999999", "PROVEEDOR", "", "", "", "", "", "PROCESO", "ABC123", "ZONA 1", "GUARDIA A", "OPERADOR"];
  const completed = context.completeExistingRow_(
    { raw: original.slice() },
    map,
    { role: "PROVEEDOR", lots: "3", detail: "60 20 40", lotCodes: ["LT-20"] },
    {},
  );

  assert.equal(completed[map.lots], "3");
  assert.equal(completed[map.detail], "60 20 40");
  assert.equal(completed[map.code], "LT-20");
});

test("duplicate participants are reduced to one person", () => {
  const people = context.uniqueParticipants_([
    { dni: "12345678", name: "PEPE", role: "CONDUCTOR", lots: "2", detail: "ORIGINAL", lotCodes: [] },
    { dni: "12345678", name: "PEPE", role: "CONDUCTOR", lots: "", detail: "", lotCodes: [] },
  ]);

  assert.equal(people.length, 1);
  assert.equal(people[0].lots, "2");
  assert.equal(people[0].detail, "ORIGINAL");
});

test("report output shows one person when old rows are duplicated", () => {
  const rows = [
    { dni: "12345678", name: "PEPE", phone: "", role: "CONDUCTOR", license: "", category: "", lots: "2", detail: "DETALLE", code: "" },
    { dni: "12345678", name: "PEPE", phone: "", role: "CONDUCTOR", license: "", category: "", lots: "", detail: "", code: "" },
  ];
  const people = context.eventPersons_("EV-1", rows, {}, {});

  assert.equal(people.length, 1);
  assert.equal(people[0].lots, "2");
  assert.equal(people[0].detail, "DETALLE");
});

test("lot header variants used by the spreadsheet are recognized", () => {
  assert.equal(context.norm_("N.º LOTES"), "N LOTES");
  assert.equal(context.norm_("N° LOTES"), "N LOTES");
  const accepted = Array.from(context.MF.lots, value => context.norm_(value));
  assert.ok(accepted.includes("N LOTES"));
  assert.ok(accepted.includes("NUMERO LOTES"));
});

test("light backend no longer depends on auxiliary sheets", () => {
  assert.doesNotMatch(source, /BD LOTES|CONTROL REGULARIZACIONES|HISTORIAL CAMBIOS|CONTROL SINCRONIZACION/);
});
