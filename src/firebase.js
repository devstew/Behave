import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserSessionPersistence, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const firebaseConfigured = Object.values(config).every((value) => Boolean(value?.trim()));
export const auth = firebaseConfigured ? getAuth(initializeApp(config)) : null;
export const db = firebaseConfigured ? getFirestore(auth.app) : null;

// Emulators are deliberately unavailable in production builds.
if (firebaseConfigured && import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export const authReady = auth ? setPersistence(auth, browserSessionPersistence) : Promise.resolve();

export function firebaseErrorMessage(error) {
  switch (error.code) {
    case "auth/invalid-credential": case "auth/invalid-login-credentials":
    case "auth/user-not-found": case "auth/wrong-password":
      return "Неправильний логін або пароль.";
    case "auth/too-many-requests": return "Забагато спроб входу. Спробуйте пізніше.";
    case "auth/network-request-failed": case "unavailable":
      return "Немає зв’язку зі сховищем. Перевірте інтернет та спробуйте знову.";
    case "auth/user-disabled": return "Цей обліковий запис вимкнено. Зверніться до адміністратора.";
    case "permission-denied": return "Немає доступу до даних. Зверніться до адміністратора.";
    case "resource-exhausted": return "Досягнуто ліміт безкоштовного сховища. Спробуйте пізніше.";
    case "auth/weak-password": return "Оберіть надійніший пароль: щонайменше 8 символів.";
    case "auth/operation-not-allowed": return "Вхід ще не налаштовано. Зверніться до адміністратора.";
    default: return error.code ? "Не вдалося виконати дію. Спробуйте знову або зверніться до адміністратора." : error.message;
  }
}
