// Firebase's password provider requires an email-shaped identifier. These are
// account identifiers, not mailboxes; password recovery is handled by the admin.
export const TEACHER_LOGIN_DOMAIN = "teachers.behave.invalid";
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normalizeUsername(value) {
  const username = String(value).trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username) || username.endsWith(".") || username.includes("..")) {
    throw new Error("Логін: 3–32 латинські літери, цифри, крапка, _ або -. Почніть з літери або цифри.");
  }
  return username;
}

export function teacherEmail(username) {
  return `${normalizeUsername(username)}@${TEACHER_LOGIN_DOMAIN}`;
}

// Let Firebase validate login identifiers; an account address must not have
// the teacher domain appended a second time.
export function teacherLoginEmail(value) {
  const login = String(value).trim().toLowerCase();
  if (!login) throw new Error("Введіть логін.");
  return login.includes("@") ? login : `${login}@${TEACHER_LOGIN_DOMAIN}`;
}
