(function (root) {
  "use strict";

  const DB_NAME = "OPBPrepToolDatabase";
  const DB_VERSION = 1;
  const STORE_NAME = "draftState";
  const RECORD_ID = "activeDraft";
  const FALLBACK_STORAGE_KEY = "OPBPrepToolFallbackState";

  let database = null;
  let saveChain = Promise.resolve();
  let latestQueuedVersion = 0;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const request = root.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = event => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = event => resolve(event.target.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Browser database is blocked by another tab."));
    });
  }

  function readFromIndexedDB() {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(RECORD_ID);

      request.onsuccess = () => resolve(request.result ? request.result.data : null);
      request.onerror = () => reject(request.error);
    });
  }

  function writeToIndexedDB(data) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      store.put({ id: RECORD_ID, data });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Browser save was interrupted."));
    });
  }

  async function loadInitialState({ sanitizeState, createDefaultState, onVersionChange }) {
    let stored = null;
    let fallback = null;

    try {
      const text = root.localStorage.getItem(FALLBACK_STORAGE_KEY);
      if (text) fallback = sanitizeState(JSON.parse(text));
    } catch {
      fallback = null;
    }

    try {
      database = await openDatabase();
      database.onversionchange = () => {
        database.close();
        database = null;
        if (onVersionChange) onVersionChange();
      };
      const value = await readFromIndexedDB();
      if (value) stored = sanitizeState(value);
    } catch {
      if (database) {
        try { database.close(); } catch {}
      }
      database = null;
    }

    if (fallback && (!stored || fallback.updatedAt > stored.updatedAt)) {
      stored = fallback;
    }

    if (stored) {
      return {
        state: stored,
        restored: true,
        hasDatabase: Boolean(database),
        message: "Browser draft restored. Export a backup for portability."
      };
    }

    // Migrate earlier Studio workspace only if no newer draft was found.
    try {
      const rawStudio = root.localStorage.getItem("opb-studio-v1");
      const studio = rawStudio ? JSON.parse(rawStudio) : null;
      if (studio?.reports?.length) {
        const csv = OPB.serialize(studio.reports);
        const reports = OPB.importCSV(csv);
        const migrated = createDefaultState();
        migrated.reports = reports;
        migrated.activeReportId = reports.some(r => r.id === studio.currentId)
          ? studio.currentId
          : reports[0].id;
        migrated.draft = OPB.draftFromReport(
          reports.find(r => r.id === migrated.activeReportId)
        );
        return {
          state: migrated,
          restored: true,
          hasDatabase: Boolean(database),
          message: "Earlier OPB Studio reports restored. Export a backup to preserve them."
        };
      }
    } catch {}

    return {
      state: null,
      restored: false,
      hasDatabase: Boolean(database),
      message: database
        ? "New draft started. Browser saving is available."
        : "Browser database unavailable. Export backups regularly."
    };
  }

  function persistSnapshot(snapshot, version) {
    if (Number.isInteger(version) && version > latestQueuedVersion) {
      latestQueuedVersion = version;
    }

    const run = async () => {
      // Skip writing a superseded snapshot so an older queued save cannot overwrite newer edits.
      if (Number.isInteger(version) && version < latestQueuedVersion) {
        return { saved: true, skipped: true, backend: database ? "indexeddb" : "localStorage" };
      }

      try {
        if (database) {
          await writeToIndexedDB(snapshot);
          return { saved: true, skipped: false, backend: "indexeddb" };
        }
        root.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(snapshot));
        return { saved: true, skipped: false, backend: "localStorage" };
      } catch {
        try {
          root.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(snapshot));
          return { saved: true, skipped: false, backend: "fallback" };
        } catch {
          return { saved: false, skipped: false, backend: "none" };
        }
      }
    };

    saveChain = saveChain.then(run, run);
    return saveChain;
  }

  function hasDatabase() {
    return Boolean(database);
  }

  const api = {
    DB_NAME,
    DB_VERSION,
    STORE_NAME,
    RECORD_ID,
    FALLBACK_STORAGE_KEY,
    loadInitialState,
    persistSnapshot,
    hasDatabase
  };

  if (typeof module !== "undefined") {
    module.exports = api;
  } else {
    root.OPB_STORAGE = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
