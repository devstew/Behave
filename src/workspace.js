export const SCHOOL_TIME_ZONE = "Europe/Kyiv";
export const MAX_PUPILS = 300;
export const MAX_WORKSPACE_BYTES = 750 * 1024;

export function getDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function shiftDateKey(key, days) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getMondayKey(key = getDateKey()) {
  const day = new Date(`${key}T12:00:00Z`).getUTCDay();
  return shiftDateKey(key, -((day + 6) % 7));
}

export function getWeekdays(key = getDateKey()) {
  const monday = getMondayKey(key);
  return Array.from({ length: 5 }, (_, index) => {
    const day = shiftDateKey(monday, index);
    return { key: day, label: new Intl.DateTimeFormat("uk-UA", {
      weekday: "short", timeZone: "UTC"
    }).format(new Date(`${day}T12:00:00Z`)) };
  });
}

function validDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T12:00:00Z`))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

function count(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100000) {
    throw new Error("Кількість зауважень має бути цілим числом від 0 до 100000.");
  }
  return value;
}

export function normalizePupils(input) {
  if (!Array.isArray(input) || input.length > MAX_PUPILS) {
    throw new Error(`Можна зберігати до ${MAX_PUPILS} учнів в одному обліковому записі.`);
  }
  const ids = new Set();
  return input.map((pupil) => {
    if (!pupil || typeof pupil !== "object" || typeof pupil.id !== "string"
      || !pupil.id || pupil.id.length > 128 || ids.has(pupil.id)
      || typeof pupil.name !== "string" || !pupil.name.trim() || pupil.name.length > 120
      || (pupil.note != null && (typeof pupil.note !== "string" || pupil.note.length > 4000))) {
      throw new Error("Некоректні дані учня. Ім’я: до 120 символів; нотатка: до 4000 символів; ID має бути унікальним.");
    }
    ids.add(pupil.id);
    const history = pupil.history ?? {};
    if (typeof history !== "object" || history === null || Array.isArray(history)) {
      throw new Error("Некоректна історія зауважень.");
    }
    const entries = Object.entries(history).map(([key, value]) => {
      if (!validDateKey(key)) throw new Error("Некоректна дата в історії зауважень.");
      return [key, count(value)];
    });
    return {
      id: pupil.id, name: pupil.name.trim(), warnings: count(pupil.warnings ?? 0),
      history: Object.fromEntries(entries), note: pupil.note ?? ""
    };
  });
}

export function emptyWorkspace(key = getDateKey()) {
  return {
    schemaVersion: 1, pupils: [], previousWeekPupils: [],
    weekKey: getMondayKey(key), previousWeekKey: "", legacyImported: false
  };
}

export function advanceWeek(workspace, key = getDateKey()) {
  const monday = getMondayKey(key);
  if (workspace.weekKey === monday) return workspace;
  const previousMonday = shiftDateKey(monday, -7);
  return {
    ...workspace,
    previousWeekPupils: workspace.weekKey === previousMonday
      ? workspace.pupils.map(({ id, name, warnings }) => ({ id, name, warnings })) : [],
    previousWeekKey: previousMonday,
    pupils: workspace.pupils.map((pupil) => ({ ...pupil, warnings: 0 })),
    weekKey: monday
  };
}

export function updatePupilWarnings(workspace, id, delta, key = getDateKey()) {
  if (delta !== 1 && delta !== -1) throw new Error("Некоректна зміна зауважень.");
  const current = advanceWeek(workspace, key);
  return { ...current, pupils: current.pupils.map((pupil) => pupil.id === id ? {
    ...pupil, warnings: Math.max(0, pupil.warnings + delta),
    history: { ...pupil.history, [key]: Math.max(0, (pupil.history[key] ?? 0) + delta) }
  } : pupil) };
}

export function validateWorkspace(workspace) {
  const pupils = normalizePupils(workspace.pupils);
  if (!validDateKey(workspace.weekKey)) throw new Error("Некоректний тиждень.");
  const result = { ...workspace, pupils };
  // Leave headroom below Firestore's 1 MiB document limit, including its binary
  // encoding overhead and the previous-week report. Never truncate user data.
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_WORKSPACE_BYTES) {
    throw new Error("Дані перевищують розмір сховища цього облікового запису. Експортуйте резервну копію та скоротіть дані.");
  }
  return result;
}

export function readLegacyWorkspace(storage, key = getDateKey()) {
  const raw = storage.getItem("behave:pupils");
  if (!raw) return null;
  const pupils = normalizePupils(JSON.parse(raw));
  const lastReset = storage.getItem("behave:lastWeekReset");
  const oldPrevious = storage.getItem("behave:prevWeekPupils");
  const workspace = {
    ...emptyWorkspace(key), pupils,
    weekKey: validDateKey(lastReset) ? getMondayKey(lastReset) : getMondayKey(key),
    previousWeekPupils: oldPrevious ? normalizePupils(JSON.parse(oldPrevious))
      .map(({ id, name, warnings }) => ({ id, name, warnings })) : [],
    previousWeekKey: validDateKey(lastReset) ? shiftDateKey(getMondayKey(lastReset), -7) : "",
    legacyImported: true
  };
  return validateWorkspace(advanceWeek(workspace, key));
}

export function importLegacyWorkspace(current, legacy) {
  if (current.pupils.length || current.legacyImported) {
    throw new Error("Імпорт доступний лише для порожнього облікового запису та лише один раз.");
  }
  return { ...legacy, legacyImported: true };
}

export function readBackupWorkspace(data, key = getDateKey()) {
  if (Array.isArray(data)) {
    return validateWorkspace({ ...emptyWorkspace(key), pupils: normalizePupils(data), legacyImported: true });
  }
  if (!data || data.schemaVersion !== 1 || !validDateKey(data.weekKey)
    || !Array.isArray(data.previousWeekPupils)
    || !(data.previousWeekKey === "" || validDateKey(data.previousWeekKey))) {
    throw new Error("Оберіть JSON-файл резервної копії Behave або список учнів.");
  }
  return validateWorkspace(advanceWeek({
    ...emptyWorkspace(key), pupils: normalizePupils(data.pupils), weekKey: data.weekKey,
    previousWeekKey: data.previousWeekKey,
    previousWeekPupils: normalizePupils(data.previousWeekPupils).map(({ id, name, warnings }) => ({ id, name, warnings })),
    legacyImported: true
  }, key));
}
