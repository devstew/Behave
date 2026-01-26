import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "behave:pupils";
const DEFAULT_PUPILS = [
  { id: crypto.randomUUID(), name: "Оля", warnings: 0, history: {} },
  { id: crypto.randomUUID(), name: "Максим", warnings: 0, history: {} }
];

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLastWeekdays(count = 5) {
  const days = [];
  const cursor = new Date();
  while (days.length < count) {
    const dayOfWeek = cursor.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days.unshift({
        key: getDateKey(cursor),
        label: new Intl.DateTimeFormat("uk-UA", { weekday: "short" }).format(
          cursor
        )
      });
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return days;
}

function buildSparklinePoints(values, width = 120, height = 28, padding = 2) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const step = (width - padding * 2) / (values.length - 1);
  return values
    .map((value, index) => {
      const x = padding + index * step;
      const y =
        height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");
}

function loadPupils() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PUPILS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_PUPILS;
    return parsed.map((pupil) => ({
      ...pupil,
      history: pupil.history ?? {}
    }));
  } catch {
    return DEFAULT_PUPILS;
  }
}

export default function App() {
  const [pupils, setPupils] = useState([]);
  const [name, setName] = useState("");
  const [showLoader, setShowLoader] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [sortMode, setSortMode] = useState("name");
  const [showWinnersOnly, setShowWinnersOnly] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    setPupils(loadPupils());
    const timer = setTimeout(() => setShowLoader(false), 1200);
    setIsHydrated(true);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pupils));
  }, [pupils, isHydrated]);

  const totalWarnings = useMemo(
    () => pupils.reduce((sum, pupil) => sum + pupil.warnings, 0),
    [pupils]
  );

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("uk-UA", { weekday: "long" }).format(new Date()),
    []
  );

  const lastWeekdays = useMemo(() => getLastWeekdays(), []);
  const todayKey = useMemo(() => getDateKey(), []);

  const visiblePupils = useMemo(() => {
    const filtered = showWinnersOnly
      ? pupils.filter((pupil) => pupil.warnings === 0)
      : pupils;
    const sorted = [...filtered];
    if (sortMode === "warnings-desc") {
      sorted.sort((a, b) => b.warnings - a.warnings);
    } else if (sortMode === "warnings-asc") {
      sorted.sort((a, b) => a.warnings - b.warnings);
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "uk"));
    }
    return sorted;
  }, [pupils, sortMode, showWinnersOnly]);

  function handleAdd(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setPupils((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: trimmed, warnings: 0, history: {} }
    ]);
    setName("");
  }

  function handleDelete(id) {
    setPupils((prev) => prev.filter((pupil) => pupil.id !== id));
  }

  function startDelete(pupil) {
    setPendingDelete(pupil);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    handleDelete(pendingDelete.id);
    setPendingDelete(null);
  }

  function cancelDelete() {
    setPendingDelete(null);
  }

  function startEdit(pupil) {
    setEditingId(pupil.id);
    setEditingName(pupil.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  function saveEdit(id) {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    setPupils((prev) =>
      prev.map((pupil) =>
        pupil.id === id ? { ...pupil, name: trimmed } : pupil
      )
    );
    cancelEdit();
  }

  function updateWarnings(id, delta) {
    setPupils((prev) =>
      prev.map((pupil) =>
        pupil.id === id
          ? (() => {
              const nextWarnings = Math.max(0, pupil.warnings + delta);
              const dateKey = getDateKey();
              const history = pupil.history ?? {};
              const nextHistoryValue = Math.max(
                0,
                (history[dateKey] ?? 0) + delta
              );
              return {
                ...pupil,
                warnings: nextWarnings,
                history: { ...history, [dateKey]: nextHistoryValue }
              };
            })()
          : pupil
      )
    );
  }

  async function handleCopyData() {
    try {
      const payload = JSON.stringify(pupils, null, 2);
      await navigator.clipboard.writeText(payload);
      setCopyStatus("Скопійовано ✅");
    } catch {
      setCopyStatus("Не вдалося скопіювати");
    }
    setTimeout(() => setCopyStatus(""), 2000);
  }

  const zeroWarningCount = pupils.filter((pupil) => pupil.warnings === 0).length;

  return (
    <div className="page">
      {showLoader && (
        <div className="loader">
          <div className="loader-card">
            <div className="loader-icon">🌟</div>
            <div className="loader-title">Behave</div>
          </div>
        </div>
      )}

      <header className="hero">
        <div className="hero-title">Behave</div>
        <div className="hero-subtitle">
          Відстежуйте зауваження за тиждень із турботою та трохи блиску ✨
        </div>
        <div className="hero-badges">
          <span>🍎</span>
          <span>📒</span>
          <span>⭐</span>
          <span>🧸</span>
        </div>
      </header>

      <section className="stats">
        <div className="stat-card">
          <div className="stat-label">Всього зауважень</div>
          <div className="stat-value">{totalWarnings}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Дітей без зауважень</div>
          <div className="stat-value">{zeroWarningCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Сьогодні</div>
          <div className="stat-value stat-day">{todayLabel}</div>
        </div>
      </section>

      <section className="controls">
        <div className="control-group">
          <label className="control-label" htmlFor="sortMode">
            Сортування
          </label>
          <select
            id="sortMode"
            className="control-select"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
          >
            <option value="name">За алфавітом</option>
            <option value="warnings-desc">Зауважень більше → менше</option>
            <option value="warnings-asc">Зауважень менше → більше</option>
          </select>
        </div>
        <label className="control-toggle">
          <input
            type="checkbox"
            checked={showWinnersOnly}
            onChange={(event) => setShowWinnersOnly(event.target.checked)}
          />
          Тільки переможці без зауважень 🏆
        </label>
        <div className="control-actions">
          <button className="copy-button" type="button" onClick={handleCopyData}>
            Скопіювати дані
          </button>
          {copyStatus && <span className="copy-status">{copyStatus}</span>}
        </div>
      </section>

      <form className="add-form" onSubmit={handleAdd}>
        <input
          className="name-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Додати ім'я учня"
          aria-label="Ім'я учня"
        />
        <button className="add-button" type="submit">
          Додати учня ➕
        </button>
      </form>

      <section className="list">
        {visiblePupils.length === 0 && (
          <div className="empty-state">
            Поки немає учнів. Додайте першого! 🎉
          </div>
        )}
        {visiblePupils.map((pupil) => {
          const historyValues = lastWeekdays.map(
            (day) => pupil.history?.[day.key] ?? 0
          );
          const points = buildSparklinePoints(historyValues);
          const yesterdayKey = lastWeekdays[lastWeekdays.length - 2]?.key;
          const todayValue = pupil.history?.[todayKey] ?? 0;
          const yesterdayValue = yesterdayKey
            ? pupil.history?.[yesterdayKey] ?? 0
            : 0;
          const trendDelta = todayValue - yesterdayValue;
          const trendLabel =
            trendDelta < 0 ? "краще" : trendDelta > 0 ? "гірше" : "без змін";
          const trendIcon =
            trendDelta < 0 ? "↘" : trendDelta > 0 ? "↗" : "→";

          return (
            <div className="pupil-card" key={pupil.id}>
              <div className="pupil-info">
                {editingId === pupil.id ? (
                  <div className="edit-row">
                    <input
                      className="edit-input"
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      aria-label="Нове ім'я учня"
                    />
                    <button
                      className="edit-save"
                      type="button"
                      onClick={() => saveEdit(pupil.id)}
                    >
                      Зберегти
                    </button>
                    <button
                      className="edit-cancel"
                      type="button"
                      onClick={cancelEdit}
                    >
                      Скасувати
                    </button>
                  </div>
                ) : (
                  <div className="pupil-name">{pupil.name}</div>
                )}
                <div className="pupil-warnings">
                  Зауваження: <strong>{pupil.warnings}</strong>
                </div>
                <div className="pupil-history">
                  {lastWeekdays.map((day) => (
                    <span className="history-chip" key={day.key}>
                      {day.label}: {pupil.history?.[day.key] ?? 0}
                    </span>
                  ))}
                </div>
              </div>
              <div className="pupil-actions">
                <button
                  className="warning-btn"
                  type="button"
                  onClick={() => updateWarnings(pupil.id, -1)}
                >
                  ➖
                </button>
                <button
                  className="warning-btn"
                  type="button"
                  onClick={() => updateWarnings(pupil.id, 1)}
                >
                  ➕
                </button>
                <button
                  className="edit-btn"
                  type="button"
                  onClick={() => startEdit(pupil)}
                >
                  Редагувати
                </button>
                <button
                  className="delete-btn"
                  type="button"
                  onClick={() => startDelete(pupil)}
                >
                  Видалити
                </button>
              </div>
              <div className="pupil-trend">
                <div className="trend-header">
                  <span className="trend-title">Тренд</span>
                  <span
                    className={`trend-badge ${
                      trendDelta < 0
                        ? "trend-good"
                        : trendDelta > 0
                        ? "trend-bad"
                        : "trend-flat"
                    }`}
                  >
                    {trendIcon} {trendLabel}
                  </span>
                </div>
                <svg
                  className="sparkline"
                  viewBox="0 0 120 28"
                  aria-hidden="true"
                >
                  <polyline points={points} className="sparkline-line" />
                </svg>
              </div>
            </div>
          );
        })}
      </section>

      {pendingDelete && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-title">Підтвердіть видалення</div>
            <div className="modal-text">
              Ви точно хочете видалити{" "}
              <strong>{pendingDelete.name}</strong> з класу?
            </div>
            <div className="modal-actions">
              <button className="modal-btn modal-cancel" onClick={cancelDelete}>
                Скасувати
              </button>
              <button className="modal-btn modal-confirm" onClick={confirmDelete}>
                Видалити
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        Зірки нагороди для героїв без зауважень ⭐🧡⭐
      </footer>
    </div>
  );
}
