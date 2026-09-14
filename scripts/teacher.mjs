import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { normalizeUsername, teacherEmail } from "../src/teacherIdentity.js";

const [command, rawUsername, ...nameParts] = process.argv.slice(2);
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId || !["create", "reset", "disable", "enable"].includes(command) || !rawUsername) {
  console.error("Set FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS, then run:\n  npm run teacher -- create teacher_anna Anna\n  npm run teacher -- reset teacher_anna\n  npm run teacher -- disable teacher_anna\n  npm run teacher -- enable teacher_anna\nPasswords are prompted privately, never supplied as command arguments.");
  process.exit(1);
}

async function readPassword() {
  if (!process.stdin.isTTY) throw new Error("Run in an interactive terminal so the password is not echoed.");
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const readline = createInterface({ input: process.stdin, output, terminal: true });
  try {
    process.stdout.write("Password (at least 8 characters): ");
    const password = await readline.question("");
    process.stdout.write("\nConfirm password: ");
    const confirmation = await readline.question("");
    process.stdout.write("\n");
    if (password.length < 8) throw new Error("Password must have at least 8 characters.");
    if (password !== confirmation) throw new Error("Passwords do not match.");
    return password;
  } finally { readline.close(); }
}

try {
  const username = normalizeUsername(rawUsername);
  const app = initializeApp({ credential: applicationDefault(), projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const email = teacherEmail(username);
  if (command === "create") {
    const password = await readPassword();
    const displayName = nameParts.join(" ") || username;
    const user = await auth.createUser({ email, password, displayName });
    try {
      await db.doc(`teachers/${user.uid}`).create({ username, displayName, active: true, createdAt: FieldValue.serverTimestamp() });
    } catch (failure) {
      await auth.deleteUser(user.uid);
      throw failure;
    }
    console.log(`Created ${username} (${user.uid}). Share the username and password privately; the teacher can change the password in Behave.`);
  } else {
    const user = await auth.getUserByEmail(email);
    const reference = db.doc(`teachers/${user.uid}`);
    if (!(await reference.get()).exists) throw new Error("Teacher approval document is missing; create it before managing this account.");
    if (command === "reset") {
      await auth.updateUser(user.uid, { password: await readPassword() });
      await auth.revokeRefreshTokens(user.uid);
      console.log(`Password reset for ${username}. Existing ID tokens expire within one hour; disable the teacher first if immediate access removal is needed.`);
    } else if (command === "disable") {
      await reference.update({ active: false });
      await auth.updateUser(user.uid, { disabled: true });
      await auth.revokeRefreshTokens(user.uid);
      console.log(`Disabled ${username}. Firestore access is blocked immediately.`);
    } else {
      await auth.updateUser(user.uid, { disabled: false });
      await reference.update({ active: true });
      console.log(`Enabled ${username}.`);
    }
  }
} catch (failure) {
  console.error(failure.message);
  process.exitCode = 1;
}
