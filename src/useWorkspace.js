import { useCallback, useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, firebaseErrorMessage } from "./firebase.js";
import { advanceWeek, getDateKey, getMondayKey } from "./workspace.js";
import { transactWorkspace } from "./workspaceStore.js";

export function useSchoolDate() {
  const [key, setKey] = useState(getDateKey);
  useEffect(() => {
    const refresh = () => setKey(getDateKey());
    const interval = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, []);
  return key;
}

export function useWorkspace(uid, dateKey) {
  const [workspace, setWorkspace] = useState(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [connected, setConnected] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const online = () => setOffline(!navigator.onLine);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    const unsubscribe = onSnapshot(doc(db, "workspaces", uid), { includeMetadataChanges: true },
      (snapshot) => {
        setWorkspace(snapshot.exists() ? snapshot.data() : null);
        setConnected(!snapshot.metadata.fromCache);
      }, (failure) => { setConnected(false); setError(firebaseErrorMessage(failure)); });
    return () => {
      mounted.current = false;
      unsubscribe();
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, [uid]);

  const write = useCallback(async (transform) => {
    setError("");
    setPending((value) => value + 1);
    try {
      await transactWorkspace(db, uid, transform);
      return true;
    } catch (failure) {
      if (mounted.current) setError(firebaseErrorMessage(failure));
      return false;
    } finally {
      if (mounted.current) setPending((value) => value - 1);
    }
  }, [uid]);

  const monday = getMondayKey(dateKey);
  useEffect(() => { void write((current) => current); }, [write, monday]);

  return {
    workspace: workspace ? advanceWeek(workspace, dateKey) : null,
    saving: pending > 0, offline, connected, error, setError, write
  };
}
