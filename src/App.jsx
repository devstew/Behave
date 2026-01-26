import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "behave:pupils";
const DEFAULT_PUPILS = [
  { id: crypto.randomUUID(), name: "Оля", warnings: 0 },
  { id: crypto.randomUUID(), name: "Максим", warnings: 0 }
];

function loadPupils() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PUPILS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_PUPILS;
  } catch {
    return DEFAULT_PUPILS;
  }
}

export default function App() {
  const [pupils, setPupils] = useState([]);
  const [name, setName] = useState("");
  const [showLoader, setShowLoader] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

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

  function handleAdd(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setPupils((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: trimmed, warnings: 0 }
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
          ? { ...pupil, warnings: Math.max(0, pupil.warnings + delta) }
          : pupil
      )
    );
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
          Відстежуйте попередження за тиждень із турботою та трохи блиску ✨
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
          <div className="stat-label">Всього попереджень</div>
          <div className="stat-value">{totalWarnings}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Дітей без попереджень</div>
          <div className="stat-value">{zeroWarningCount}</div>
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
        {pupils.length === 0 && (
          <div className="empty-state">
            Поки немає учнів. Додайте першого! 🎉
          </div>
        )}
        {pupils.map((pupil) => (
          <div className="pupil-card" key={pupil.id}>
            <div className="pupil-info">
              <div className="pupil-name">{pupil.name}</div>
              <div className="pupil-warnings">
                Попередження: <strong>{pupil.warnings}</strong>
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
        Зірки нагороди для героїв без попереджень ⭐🧡⭐
      </footer>
    </div>
  );
}
