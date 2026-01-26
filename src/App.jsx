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

function getLastSevenDays() {
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    days.push({
      key: getDateKey(date),
      label: new Intl.DateTimeFormat("uk-UA", { weekday: "short" }).format(date)
    });
  }
  return days;
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

  const lastSevenDays = useMemo(() => getLastSevenDays(), []);

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
        {visiblePupils.map((pupil) => (
          <div className="pupil-card" key={pupil.id}>
            <div className="pupil-info">
              <div className="pupil-name">{pupil.name}</div>
              <div className="pupil-warnings">
                Зауваження: <strong>{pupil.warnings}</strong>
              </div>
              <div className="pupil-history">
                {lastSevenDays.map((day) => (
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
                className="delete-btn"
                type="button"
                onClick={() => handleDelete(pupil.id)}
              >
                Видалити
              </button>
            </div>
          </div>
        ))}
      </section>

      <footer className="footer">
        Зірки нагороди для героїв без зауважень ⭐🧡⭐
      </footer>
    </div>
  );
}
