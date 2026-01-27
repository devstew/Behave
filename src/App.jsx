import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "behave:pupils";
const DEFAULT_PUPILS = [
  { id: crypto.randomUUID(), name: "Оля", warnings: 0, history: {}, note: "" },
  { id: crypto.randomUUID(), name: "Максим", warnings: 0, history: {}, note: "" }
];
const DEV_SETTINGS_KEY = "behave:dev-settings";
const DEFAULT_DEV_SETTINGS = {
  copy: true,
  add: true,
  edit: true,
  remove: true,
  glowMode: "all"
};

function loadDevSettings() {
  if (typeof window === "undefined") return DEFAULT_DEV_SETTINGS;
  try {
    const raw = localStorage.getItem(DEV_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_DEV_SETTINGS;
  } catch {
    return DEFAULT_DEV_SETTINGS;
  }
}

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekdays() {
  const days = [];
  const today = new Date();
  const monday = new Date(today);
  const offset = (today.getDay() + 6) % 7; // 0 -> Mon
  monday.setDate(today.getDate() - offset);
  for (let i = 0; i < 5; i += 1) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    days.push({
      key: getDateKey(date),
      label: new Intl.DateTimeFormat("uk-UA", { weekday: "short" }).format(
        date
      )
    });
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
      history: pupil.history ?? {},
      note: pupil.note ?? ""
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
  const [warningsSortDesc, setWarningsSortDesc] = useState(true);
  const [showWinnersOnly, setShowWinnersOnly] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [devSettings, setDevSettings] = useState(loadDevSettings);
  const [searchTerm, setSearchTerm] = useState("");
  const [bursts, setBursts] = useState([]);
  const [tremorId, setTremorId] = useState(null);
  const [openNotes, setOpenNotes] = useState({});

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(DEV_SETTINGS_KEY, JSON.stringify(devSettings));
    } catch {
      // ignore
    }
  }, [devSettings]);

  const totalWarnings = useMemo(
    () => pupils.reduce((sum, pupil) => sum + pupil.warnings, 0),
    [pupils]
  );

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("uk-UA", { weekday: "long" }).format(new Date()),
    []
  );
  const todayDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("uk-UA", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(new Date()),
    []
  );

  const lastWeekdays = useMemo(() => getWeekdays(), []);
  const todayDay = useMemo(() => new Date().getDay(), []);
  const fakeFriday = devSettings.fakeFriday ?? false;
  const effectiveDay = fakeFriday ? 5 : todayDay;
  const todayKey = useMemo(() => getDateKey(), []);

  const visiblePupils = useMemo(() => {
    const filteredByWarnings = showWinnersOnly
      ? pupils.filter((pupil) => pupil.warnings === 0)
      : pupils;
    const query = searchTerm.trim().toLowerCase();
    const filtered = query
      ? filteredByWarnings.filter((pupil) =>
          pupil.name.toLowerCase().includes(query)
        )
      : filteredByWarnings;
    const sorted = [...filtered];
    if (sortMode === "warnings") {
      const dir = warningsSortDesc ? -1 : 1;
      sorted.sort((a, b) => (a.warnings - b.warnings) * dir);
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "uk"));
    }
    return sorted;
  }, [pupils, sortMode, showWinnersOnly, warningsSortDesc, searchTerm]);

  function handleAdd(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setPupils((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: trimmed,
        warnings: 0,
        history: {},
        note: ""
      }
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

  function handleSnapshot() {
    const html = `
      <html>
        <head>
          <title>Behave snapshot</title>
          <style>
            body { font-family: "Space Grotesk", sans-serif; background: #fff3f1; padding: 24px; }
            .card { border-radius: 16px; border: 1px solid #f6b0a8; padding: 16px; margin-bottom: 16px; }
            .title { font-size: 1.5rem; margin-bottom: 8px; }
            .row { display: flex; justify-content: space-between; align-items: center; }
            .pill { border-radius: 999px; padding: 6px 12px; background: #ffe5e0; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="title">Behave snapshot</div>
            <div class="row">
              <div>${todayLabel}</div>
              <div>${todayDateLabel}</div>
            </div>
          </div>
          ${visiblePupils
            .map(
              (pupil) => `
                <div class="card">
                  <div class="row">
                    <strong>${pupil.name}</strong>
                    <span class="pill">Зауважень: ${pupil.warnings}</span>
                  </div>
                </div>
              `
            )
            .join("")}
        </body>
      </html>
    `;
    const snapshotWindow = window.open("", "_blank");
    if (!snapshotWindow) return;
    snapshotWindow.document.write(html);
    snapshotWindow.document.close();
    snapshotWindow.focus();
    snapshotWindow.print();
  }

  function toggleDevSetting(key) {
    setDevSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function setGlowMode(mode) {
    setDevSettings((prev) => ({ ...prev, glowMode: mode }));
  }

  function fillMockHistory() {
    setPupils((prev) =>
      prev.map((pupil) => {
        const history = { ...pupil.history };
        lastWeekdays.forEach((day) => {
          history[day.key] = Math.floor(Math.random() * 3); // 0–2
        });
        const todaysValue = history[todayKey] ?? 0;
        return { ...pupil, history, warnings: todaysValue };
      })
    );
  }

  function triggerBurst(pupilId, warnings, allow) {
    if (warnings > 0 || !allow) return;
    const left = Math.floor(Math.random() * 90) + 5; // 5–95%
    const top = Math.floor(Math.random() * 40) - 50; // -50% to -10%
    const emojiSet = ["🎉", "🥳", "🎈", "✨", "🎊"];
    const emoji =
      emojiSet[Math.floor(Math.random() * emojiSet.length)] ?? "🎉";
    const key = crypto.randomUUID();
    setBursts((prev) => [...prev, { id: pupilId, key, left, top, emoji }]);
    setTimeout(
      () => setBursts((prev) => prev.filter((b) => b.key !== key)),
      1400
    );
    setTremorId(pupilId);
    setTimeout(() => setTremorId(null), 320);
  }

  function toggleNote(id) {
    setOpenNotes((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleNoteChange(id, value) {
    setPupils((prev) =>
      prev.map((pupil) =>
        pupil.id === id ? { ...pupil, note: value } : pupil
      )
    );
  }

  const showCopyControls = devSettings.copy;
  const showAddForm = devSettings.add;
  const showEditActions = devSettings.edit;
  const showDeleteActions = devSettings.remove;

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

      <div className="above-fold">
        <div className="page-header">
          <div className="page-title">Behave</div>
          <button
            className="burger"
            type="button"
            aria-label="Відкрити налаштування"
            onClick={() => setSettingsOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <div className="hero-card">
          <div className="hero-subtitle">
            Відстежуйте зауваження за тиждень з турботою та трохи блиску ✨
          </div>
          <div className="hero-badges">
            <span>🍎</span>
            <span>📒</span>
            <span>⭐</span>
            <span>🧸</span>
          </div>
        </div>

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Сьогодні</div>
            <div className="stat-value stat-day">{todayLabel}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Дата</div>
            <div className="stat-value">{todayDateLabel}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Всього зауважень</div>
            <div className="stat-value">{totalWarnings}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Дітей без зауважень</div>
            <div className="stat-value">{zeroWarningCount}</div>
          </div>
        </section>
        <button
          type="button"
          className="scroll-btn"
          onClick={() => {
            const target = document.getElementById("list-section");
            if (target) target.scrollIntoView({ behavior: "smooth" });
          }}
        >
          Список учнів ↓
        </button>
      </div>

      {showAddForm && (
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
      )}

      <div id="list-section" />
      <section className="controls-block">
        <div className="sort-buttons">
          <button
            type="button"
            className={`sort-btn ${sortMode === "name" ? "is-active" : ""}`}
            onClick={() => {
              setSortMode("name");
              setWarningsSortDesc(true);
            }}
          >
            За алфавітом
          </button>
          <button
            type="button"
            className={`sort-btn ${sortMode === "warnings" ? "is-active" : ""}`}
            onClick={() => {
              setSortMode("warnings");
              setWarningsSortDesc((prev) =>
                sortMode === "warnings" ? !prev : prev
              );
            }}
          >
            Зауваження {warningsSortDesc ? "↓" : "↑"}
          </button>
        </div>
        <div className="search-row">
          <input
            id="pupilSearch"
            className="search-input"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Шукати учня"
          />
        </div>
        <div className="control-row">
          <label className="control-toggle">
            <input
              type="checkbox"
              checked={showWinnersOnly}
              onChange={(event) => setShowWinnersOnly(event.target.checked)}
            />
            Тільки переможці без зауважень 🏆
          </label>
          <div className="control-actions">
            <button
              className="snapshot-btn"
              type="button"
              onClick={handleSnapshot}
            >
              Знімок PDF
            </button>
            {showCopyControls && (
              <button
                className="copy-button"
                type="button"
                onClick={handleCopyData}
              >
                Скопіювати дані
              </button>
            )}
            {showCopyControls && (
              <button
                className="mock-button"
                type="button"
                onClick={fillMockHistory}
              >
                Згенерувати історію
              </button>
            )}
            {copyStatus && <span className="copy-status">{copyStatus}</span>}
          </div>
        </div>
      </section>

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
          const todayIndex = lastWeekdays.findIndex((d) => d.key === todayKey);
          const yesterdayKey =
            todayIndex > 0 ? lastWeekdays[todayIndex - 1].key : null;
          const todayValue = pupil.history?.[todayKey] ?? 0;
          const yesterdayValue = yesterdayKey
            ? pupil.history?.[yesterdayKey] ?? 0
            : 0;
          const trendDelta = todayValue - yesterdayValue;
          const trendLabel =
            trendDelta < 0 ? "краще" : trendDelta > 0 ? "гірше" : "без змін";
          const trendIcon =
            trendDelta < 0 ? "↘" : trendDelta > 0 ? "↗" : "→";
          const consideredValues =
            todayIndex >= 0
              ? historyValues.slice(0, todayIndex + 1)
              : historyValues;
          const streakCount = (() => {
            let count = 0;
            for (let idx = consideredValues.length - 1; idx >= 0; idx -= 1) {
              if (consideredValues[idx] === 0) count += 1;
              else break;
            }
            return count;
          })();
          const perfectWeek = consideredValues.every((value) => value === 0);
          const points = buildSparklinePoints(historyValues);
          const badges = [];
          if (pupil.warnings === 0) badges.push("🎉 БЕЗ ЗАУВАЖЕНЬ");
          if (perfectWeek) badges.push("🏅 ТИЖДЕНЬ ЧИСТО");
          else if (streakCount >= 3) badges.push(`🔥 ${streakCount}дн.`);
          const devGlow =
            pupil.warnings === 0 &&
            (devSettings.glowMode === "all" ||
              (devSettings.glowMode === "friday" && effectiveDay === 5));
          const showWinnerGlow = showWinnersOnly && pupil.warnings === 0;
          const glowActive = pupil.warnings === 0 && (devGlow || showWinnerGlow);
          const fridayCelebrate = showWinnerGlow && effectiveDay === 5;
          const allowBurst =
            pupil.warnings === 0 &&
            (fridayCelebrate || (effectiveDay === 5 && devSettings.fakeFriday));
          const cardClass = `pupil-card${
            glowActive ? " glow-card" : ""
          }${fridayCelebrate ? " friday-celebrate friday-rain" : ""}${
            tremorId === pupil.id ? " tremor" : ""
          }`;

          return (
            <div
              className={cardClass}
              key={pupil.id}
              onClick={(e) => {
                if ((e.target).closest("button")) return;
                triggerBurst(pupil.id, pupil.warnings, allowBurst);
              }}
            >
              <div className="pupil-info">
                <div className="pupil-heading">
                  <div className="pupil-name-block">
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
                  </div>
                  <div className="reward-badges">
                    {badges.map((badge) => (
                      <span className="reward-badge" key={`${pupil.id}-${badge}`}>
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="pupil-warnings">
                  Зауваження: <strong>{pupil.warnings}</strong>
                </div>
                <div className="pupil-history single-row">
                  {lastWeekdays.map((day) => (
                    <span className="history-chip" key={day.key}>
                      {day.label}: {pupil.history?.[day.key] ?? 0}
                    </span>
                  ))}
                </div>
                <div className="note-block">
                  <button
                    type="button"
                    className="note-toggle"
                    onClick={() => toggleNote(pupil.id)}
                  >
                    {openNotes[pupil.id] ? "Сховати нотатку" : "Додати нотатку"}
                  </button>
                  {openNotes[pupil.id] && (
                    <textarea
                      className="note-input"
                      value={pupil.note ?? ""}
                      onChange={(e) => handleNoteChange(pupil.id, e.target.value)}
                      placeholder="Запишіть нотатку про учня"
                    />
                  )}
                </div>
              </div>
            <div className="pupil-bottom-row">
              <div className="warning-row">
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
              </div>
              <div className="pupil-trend trend-inline">
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
                <svg className="sparkline" viewBox="0 0 120 28" aria-hidden="true">
                  <polyline points={points} className="sparkline-line" />
                </svg>
              </div>
              {bursts
                .filter((b) => b.id === pupil.id)
                .map((b) => (
                  <span
                    key={b.key}
                    className={`emoji-burst ${
                      b.emoji === "🎈" ? "balloon" : "other"
                    }`}
                    style={{ left: `${b.left}%`, top: `${b.top}%` }}
                  >
                    {b.emoji}
                  </span>
                ))}
            </div>
            <div className="pupil-ops">
              {showEditActions && (
                <button
                  className="edit-btn"
                  type="button"
                  onClick={() => startEdit(pupil)}
                >
                  Редагувати
                </button>
              )}
              {showDeleteActions && (
                <button
                  className="delete-btn"
                  type="button"
                  onClick={() => startDelete(pupil)}
                >
                  Видалити
                </button>
              )}
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
              <button
                className="modal-btn modal-cancel"
                onClick={cancelDelete}
                type="button"
              >
                Скасувати
              </button>
              <button
                className="modal-btn modal-confirm"
                onClick={confirmDelete}
                type="button"
              >
                Видалити
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        Зірки нагороди для героїв без зауважень ⭐🧡⭐
      </footer>

      {settingsOpen && (
        <div className="settings-overlay" role="dialog" aria-modal="true">
          <div className="settings-card">
            <div className="settings-header">
              <div className="settings-title">Інструменти</div>
              <button
                className="settings-close"
                type="button"
                onClick={() => setSettingsOpen(false)}
                aria-label="Закрити"
              >
                ×
              </button>
            </div>
            <div className="settings-subtitle">
              Увімкніть або вимкніть режим розробника
            </div>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={devSettings.copy}
                onChange={() => toggleDevSetting("copy")}
              />
              Кнопка копіювання
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={devSettings.add}
                onChange={() => toggleDevSetting("add")}
              />
              Форма додавання учня
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={devSettings.edit}
                onChange={() => toggleDevSetting("edit")}
              />
              Редагування учня
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={devSettings.remove}
                onChange={() => toggleDevSetting("remove")}
              />
              Видалення учня
            </label>
            <div className="settings-subsection">Анімація відзнак</div>
            <div className="glow-options">
              {[
                { value: "all", label: "Кожен день" },
                { value: "friday", label: "Тільки п'ятниця" },
                { value: "off", label: "Вимкнути" }
              ].map((option) => (
                <label key={option.value} className="glow-option">
                  <input
                    type="radio"
                    name="badgeGlow"
                    value={option.value}
                    checked={devSettings.glowMode === option.value}
                    onChange={() => setGlowMode(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={devSettings.fakeFriday ?? false}
                onChange={() =>
                  setDevSettings((prev) => ({
                    ...prev,
                    fakeFriday: !prev.fakeFriday
                  }))
                }
              />
              Увімкнути \"фейкову\" п'ятницю
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
