import { useEffect, useState } from "react";
import {
  EmailAuthProvider, onAuthStateChanged, reauthenticateWithCredential,
  signInWithEmailAndPassword, signOut, updatePassword
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, authReady, db, firebaseConfigured, firebaseErrorMessage } from "./firebase.js";
import { teacherEmail } from "./teacherIdentity.js";

function AuthCard({ children }) {
  return <main className="auth-page"><section className="auth-card">
    <div className="page-title">Behave 🍎</div>{children}
  </section></main>;
}

export default function TeacherAuth({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!firebaseConfigured) return;
    let active = true;
    let unsubscribeAuth = () => {};
    let unsubscribeProfile = () => {};
    authReady.then(() => {
      if (!active) return;
      unsubscribeAuth = onAuthStateChanged(auth, (nextUser) => {
        unsubscribeProfile();
        setUser(nextUser);
        setProfile(null);
        setChecking(Boolean(nextUser));
        if (!nextUser) return;
        unsubscribeProfile = onSnapshot(doc(db, "teachers", nextUser.uid), (snapshot) => {
          const data = snapshot.data();
          let approved = false;
          try { approved = data?.active === true && nextUser.email === teacherEmail(data.username); } catch { /* invalid admin profile */ }
          setProfile(approved ? data : null);
          setChecking(false);
        }, (failure) => { setError(firebaseErrorMessage(failure)); setChecking(false); });
      });
    }).catch((failure) => {
      if (active) { setError(firebaseErrorMessage(failure)); setChecking(false); }
    });
    return () => { active = false; unsubscribeAuth(); unsubscribeProfile(); };
  }, []);

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const email = teacherEmail(username);
      await authReady;
      await signInWithEmailAndPassword(auth, email, password);
      setPassword("");
    } catch (failure) { setError(firebaseErrorMessage(failure)); }
    finally { setBusy(false); }
  }

  if (!firebaseConfigured) return <AuthCard>
    <h1>Завершіть налаштування Behave</h1>
    <p>Власник застосунку має під’єднати сховище та створити облікові записи вчителів за інструкцією налаштування.</p>
  </AuthCard>;

  if (checking) return <AuthCard><p role="status">Перевіряємо обліковий запис…</p></AuthCard>;

  if (user && profile) return children(user, profile);

  if (user) return <AuthCard>
    <h1>Обліковий запис не активовано</h1>
    <p>Зверніться до адміністратора, щоб отримати доступ.</p>
    {error && <p role="alert" className="cloud-error">{error}</p>}
    <button className="auth-submit" onClick={() => signOut(auth).catch((failure) => setError(firebaseErrorMessage(failure)))}>Вийти</button>
  </AuthCard>;

  return <AuthCard>
    <h1>Вхід для вчителя</h1>
    <form className="auth-form" onSubmit={login}>
      <label>Логін<input autoComplete="username" autoCapitalize="none" spellCheck={false}
        required minLength={3} maxLength={32} value={username} disabled={busy}
        onChange={(event) => setUsername(event.target.value)} placeholder="teacher_anna" /></label>
      <label>Пароль<input type="password" autoComplete="current-password" required value={password}
        disabled={busy} onChange={(event) => setPassword(event.target.value)} /></label>
      {error && <p role="alert" className="cloud-error">{error}</p>}
      <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Входимо…" : "Увійти"}</button>
    </form>
    <p className="auth-help">Логін і пароль видає адміністратор. Якщо забули пароль, зверніться до нього.</p>
  </AuthCard>;
}

export function ChangePassword({ user, onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (next !== confirm) { setMessage("Нові паролі не збігаються."); return; }
    setBusy(true);
    setMessage("");
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
      await updatePassword(user, next);
      setCurrent(""); setNext(""); setConfirm("");
      setMessage("Пароль змінено ✅");
    } catch (failure) { setMessage(firebaseErrorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="password-title">
    <section className="modal-card">
      <h2 id="password-title">Змінити пароль</h2>
      <form className="auth-form" onSubmit={submit}>
        <input type="text" autoComplete="username" value={user.email} readOnly hidden />
        <label>Поточний пароль<input type="password" autoComplete="current-password" required value={current}
          disabled={busy} onChange={(event) => setCurrent(event.target.value)} /></label>
        <label>Новий пароль<input type="password" autoComplete="new-password" required minLength={8} value={next}
          disabled={busy} onChange={(event) => setNext(event.target.value)} /></label>
        <label>Повторіть новий пароль<input type="password" autoComplete="new-password" required minLength={8}
          value={confirm} disabled={busy} onChange={(event) => setConfirm(event.target.value)} /></label>
        {message && <p role="status">{message}</p>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Змінюємо…" : "Зберегти пароль"}</button>
        <button className="snapshot-btn" type="button" disabled={busy} onClick={onClose}>Закрити</button>
      </form>
    </section>
  </div>;
}
