import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { advanceWeek, emptyWorkspace, getDateKey, validateWorkspace } from "./workspace.js";

export async function transactWorkspace(database, uid, transform = (workspace) => workspace, key = getDateKey()) {
  const reference = doc(database, "workspaces", uid);
  return runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const original = snapshot.exists() ? snapshot.data() : emptyWorkspace(key);
    const current = advanceWeek(original, key);
    const next = validateWorkspace(transform(current));
    if (!snapshot.exists() || JSON.stringify(original) !== JSON.stringify(next)) {
      transaction.set(reference, { ...next, updatedAt: serverTimestamp() });
    }
    return next;
  });
}
