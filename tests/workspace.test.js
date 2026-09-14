import { test } from "node:test";
import assert from "node:assert/strict";
import { teacherEmail } from "../src/teacherIdentity.js";
import {
  advanceWeek, emptyWorkspace, getDateKey, getMondayKey, getWeekdays,
  importLegacyWorkspace, readLegacyWorkspace, readBackupWorkspace,
  updatePupilWarnings, validateWorkspace
} from "../src/workspace.js";

const pupil = { id: "one", name: "Anna", warnings: 2, history: { "2026-09-11": 2 }, note: "Remember" };
const previous = { ...emptyWorkspace("2026-09-11"), pupils: [pupil] };

test("usernames are normalized without exposing a username directory", () => {
  assert.equal(teacherEmail(" Teacher_Anna "), "teacher_anna@teachers.behave.invalid");
  for (const value of ["ab", "anna@example.com", "<script>", "аnna", "-anna", "anna.", "anna..bob", "a".repeat(33)]) {
    assert.throws(() => teacherEmail(value));
  }
});

test("dates and week boundaries use Kyiv even when another device is in UTC", () => {
  assert.equal(getDateKey(new Date("2026-09-13T21:30:00Z")), "2026-09-14");
  assert.equal(getMondayKey("2026-09-13"), "2026-09-07");
  assert.equal(getMondayKey("2026-09-14"), "2026-09-14");
  assert.equal(getWeekdays("2026-09-14")[4].key, "2026-09-18");
});

test("Monday resets once and preserves last week's report, notes and history", () => {
  const next = advanceWeek(previous, "2026-09-14");
  assert.equal(next.pupils[0].warnings, 0);
  assert.equal(next.pupils[0].note, pupil.note);
  assert.deepEqual(next.pupils[0].history, pupil.history);
  assert.equal(next.previousWeekPupils[0].warnings, 2);
  assert.equal(next.previousWeekKey, "2026-09-07");
  assert.equal(advanceWeek(next, "2026-09-15"), next);
  assert.deepEqual(advanceWeek(previous, "2026-10-05").previousWeekPupils, []);
  assert.equal(previous.pupils[0].warnings, 2);
});

test("warning changes respect the new week and never become negative", () => {
  const next = updatePupilWarnings(previous, "one", 1, "2026-09-14");
  assert.equal(next.pupils[0].warnings, 1);
  assert.equal(next.pupils[0].history["2026-09-14"], 1);
  const zero = updatePupilWarnings(next, "one", -1, "2026-09-14");
  assert.equal(updatePupilWarnings(zero, "one", -1, "2026-09-14").pupils[0].warnings, 0);
});

test("legacy migration preserves the source and refuses to replace cloud data", () => {
  const values = new Map([
    ["behave:pupils", JSON.stringify([pupil])],
    ["behave:lastWeekReset", "2026-09-07"]
  ]);
  const storage = { getItem: (key) => values.get(key) ?? null };
  const legacy = readLegacyWorkspace(storage, "2026-09-11");
  assert.deepEqual(legacy.pupils, [pupil]);
  assert.equal(values.get("behave:pupils"), JSON.stringify([pupil]));
  const imported = importLegacyWorkspace(emptyWorkspace("2026-09-11"), legacy);
  assert.throws(() => importLegacyWorkspace(imported, legacy));
  assert.throws(() => importLegacyWorkspace(previous, legacy));
});

test("backup imports accept old pupil arrays and complete workspace exports", () => {
  assert.deepEqual(readBackupWorkspace([pupil], "2026-09-11").pupils, [pupil]);
  assert.deepEqual(readBackupWorkspace(previous, "2026-09-11").pupils, [pupil]);
  assert.throws(() => readBackupWorkspace({ pupils: [pupil] }));
});

test("invalid or oversized imports fail without silently discarding records", () => {
  const invalid = [
    [pupil, pupil], [{ ...pupil, warnings: -1 }], [{ ...pupil, history: { "2026-02-30": 1 } }],
    [{ ...pupil, note: "x".repeat(4001) }]
  ];
  for (const pupils of invalid) assert.throws(() => validateWorkspace({ ...previous, pupils }));
  const pupils = Array.from({ length: 250 }, (_, i) => ({ ...pupil, id: String(i), note: "x".repeat(4000) }));
  assert.throws(() => validateWorkspace({ ...previous, pupils }));
});
