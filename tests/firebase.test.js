import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, serverTimestamp, setLogLevel } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, getAuth, inMemoryPersistence, setPersistence, signInWithEmailAndPassword,
  EmailAuthProvider, reauthenticateWithCredential, signOut, updatePassword } from "firebase/auth";
import { emptyWorkspace, importLegacyWorkspace, updatePupilWarnings } from "../src/workspace.js";
import { transactWorkspace } from "../src/workspaceStore.js";
import { teacherEmail, teacherLoginEmail } from "../src/teacherIdentity.js";

let env;
setLogLevel("silent");
const key = "2026-09-14";
const pupil = { id: "one", name: "Anna", warnings: 0, history: {}, note: "" };
const state = () => ({ ...emptyWorkspace(key), pupils: [pupil], updatedAt: serverTimestamp() });
const teacherDb = (uid) => env.authenticatedContext(uid, { email: teacherEmail(uid) }).firestore();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-behave",
    firestore: { host: "127.0.0.1", port: 8080, rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8") }
  });
  await env.withSecurityRulesDisabled(async (context) => {
    for (const username of ["anna", "bob", "disabled", "concurrent", "migration", "revoke"]) {
      // Reset only fixtures owned by this suite, so repeated tests can share a
      // running emulator with a browser demo without deleting its workspace.
      await deleteDoc(doc(context.firestore(), "workspaces", username));
      await setDoc(doc(context.firestore(), "teachers", username), { username, active: username !== "disabled" });
    }
  });
});
after(async () => { await env?.cleanup(); });

test("approved teacher can save and read their own workspace", async () => {
  const reference = doc(teacherDb("anna"), "workspaces", "anna");
  await assertSucceeds(setDoc(reference, state()));
  assert.equal((await assertSucceeds(getDoc(reference))).data().pupils[0].name, "Anna");
});

test("another teacher cannot read, edit or list other teachers' data", async () => {
  const db = teacherDb("bob");
  await assertFails(getDoc(doc(db, "workspaces", "anna")));
  await assertFails(setDoc(doc(db, "workspaces", "anna"), state()));
  await assertFails(getDoc(doc(db, "teachers", "anna")));
  await assertFails(getDocs(collection(db, "workspaces")));
  await assertFails(getDocs(collection(db, "teachers")));
});

test("anonymous, unapproved, disabled or mismatched identities cannot access workspaces", async () => {
  const contexts = [
    env.unauthenticatedContext(), env.authenticatedContext("unapproved", { email: teacherEmail("unapproved") }),
    env.authenticatedContext("disabled", { email: teacherEmail("disabled") }),
    env.authenticatedContext("anna", { email: teacherEmail("bob") })
  ];
  for (const context of contexts) {
    await assertFails(getDoc(doc(context.firestore(), "workspaces", "anna")));
    const uid = context === contexts[2] ? "disabled" : "unapproved";
    await assertFails(setDoc(doc(context.firestore(), "workspaces", uid), state()));
  }
  await assertFails(getDoc(doc(teacherDb("disabled"), "workspaces", "disabled")));
  await assertFails(getDoc(doc(teacherDb("unapproved"), "workspaces", "unapproved")));
});

test("users cannot approve or re-enable themselves", async () => {
  await assertFails(setDoc(doc(teacherDb("unapproved"), "teachers", "unapproved"), { active: true, username: "unapproved" }));
  await assertFails(updateDoc(doc(teacherDb("disabled"), "teachers", "disabled"), { active: true }));
  await assertFails(deleteDoc(doc(teacherDb("anna"), "teachers", "anna")));
});

test("workspace schema, timestamp and pupil limit are enforced", async () => {
  const reference = doc(teacherDb("anna"), "workspaces", "anna");
  await assertFails(setDoc(reference, { ...state(), unexpected: true }));
  await assertFails(setDoc(reference, { ...state(), updatedAt: new Date(0) }));
  await assertFails(setDoc(reference, { ...state(), pupils: "not a list" }));
  await assertFails(setDoc(reference, { ...state(), pupils: Array(301).fill(pupil) }));
  await assertFails(deleteDoc(reference));
  await assertSucceeds(setDoc(reference, { ...state(), legacyImported: true }));
  await assertFails(updateDoc(reference, { legacyImported: false, updatedAt: serverTimestamp() }));
});

test("concurrent transactions preserve both warning increments", async () => {
  const first = teacherDb("concurrent");
  const second = teacherDb("concurrent");
  await transactWorkspace(first, "concurrent", (current) => ({ ...current, pupils: [pupil] }), key);
  await Promise.all([
    transactWorkspace(first, "concurrent", (current) => updatePupilWarnings(current, "one", 1, key), key),
    transactWorkspace(second, "concurrent", (current) => updatePupilWarnings(current, "one", 1, key), key)
  ]);
  const saved = (await getDoc(doc(first, "workspaces", "concurrent"))).data();
  assert.equal(saved.pupils[0].warnings, 2);
  assert.equal(saved.pupils[0].history[key], 2);
});

test("simultaneous migration cannot replace an already imported workspace", async () => {
  const db = teacherDb("migration");
  const legacy = { ...emptyWorkspace(key), pupils: [pupil], legacyImported: true };
  const results = await Promise.allSettled([
    transactWorkspace(db, "migration", (current) => importLegacyWorkspace(current, legacy), key),
    transactWorkspace(db, "migration", (current) => importLegacyWorkspace(current, legacy), key)
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
});

test("disabling approval immediately blocks subsequent workspace access", async () => {
  const db = teacherDb("revoke");
  await setDoc(doc(db, "workspaces", "revoke"), state());
  await env.withSecurityRulesDisabled((context) => updateDoc(doc(context.firestore(), "teachers", "revoke"), { active: false }));
  await assertFails(getDoc(doc(db, "workspaces", "revoke")));
  await assertFails(updateDoc(doc(db, "workspaces", "revoke"), { updatedAt: serverTimestamp() }));
});

test("short and full-address login, wrong-password rejection and authenticated password changes work", async () => {
  const app = initializeApp({ apiKey: "fake-api-key", projectId: "demo-behave" }, "auth-test");
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  await setPersistence(auth, inMemoryPersistence);
  const username = `login_teacher_${Date.now()}`;
  const email = teacherEmail(username);
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test-only-password", returnSecureToken: true })
  });
  assert.equal(response.status, 200);
  try {
    await assert.rejects(signInWithEmailAndPassword(auth, email, "wrong-password"));
    const shortLoginUser = (await signInWithEmailAndPassword(auth, teacherLoginEmail(` ${username.toUpperCase()} `), "test-only-password")).user;
    await signOut(auth);
    const user = (await signInWithEmailAndPassword(auth, teacherLoginEmail(` ${email.toUpperCase()} `), "test-only-password")).user;
    assert.equal(user.uid, shortLoginUser.uid);
    assert.equal(user.email, email);
    await assert.rejects(reauthenticateWithCredential(user, EmailAuthProvider.credential(email, "wrong-password")));
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(email, "test-only-password"));
    await updatePassword(user, "another-test-password");
    await assert.rejects(signInWithEmailAndPassword(auth, email, "test-only-password"));
    assert.equal((await signInWithEmailAndPassword(auth, email, "another-test-password")).user.email, email);
  } finally { await deleteApp(app); }
});
