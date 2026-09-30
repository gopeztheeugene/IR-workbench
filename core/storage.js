// storage.js - saving cases to folders on disk (File System Access API).
//
// Layout of the cases folder (chosen by the user, OUTSIDE this project):
//   IR-Cases/
//     INC-2041_Acme-ransomware/
//       case.json      everything from every tab for this case
//       .history/      the last 20 older copies of case.json
//       evidence/      local evidence files copied in (SHA-256 checked)
//       exports/       CSV exports
//
// How it works:
//   - "Connect cases folder" asks the browser for a folder. The browser
//     gives back a "handle": permission to read/write that one folder.
//   - The handle is remembered in IndexedDB (the browser's built-in
//     database; localStorage can only hold text, not handles). After a
//     browser restart the browser asks again: one click on "Reconnect".
//   - AUTOSAVE: every 2 seconds, each case is turned into JSON text and
//     compared with what was last saved. Only changed cases are written.
//     So no tab needs to remember to "save": any change is picked up.
//   - Sample cases (case.sample === true) are never saved.
//
// Rule: this file never calls a tab. Tabs call App.storage.*.

App.storage = {
  // Does this browser support folders? (Chrome and Edge do.)
  supported: typeof window.showDirectoryPicker === "function",
  dir: null,               // handle of the cases folder
  // "unsupported" | "disconnected" | "needs-permission" | "connected" | "error"
  status: "disconnected",
  busy: false,             // a save is running right now
  lastSavedAt: "",         // UTC text of the last successful save
  lastError: "",
  folders: {},             // case ID -> its folder name
  saved: {},               // case ID -> JSON text of the case as last saved / loaded
  lastHistory: {},         // case ID -> time (ms) of the last .history copy

  SCHEMA_VERSION: 2,      // raise when case.json's layout changes (and convert old files)
  HISTORY_KEEP: 20,        // how many .history copies to keep per case
  HISTORY_EVERY_MS: 5 * 60 * 1000,  // at most one .history copy per 5 minutes
  MAX_VERIFY_BYTES: 1024 ** 3       // copies bigger than 1 GB aren't re-hashed
};

// ---------------------------------------------------------------
// Startup
// ---------------------------------------------------------------

// Runs once at startup (called from app.js).
App.storage.init = async function () {
  const st = App.storage;

  // One click listener for the buttons in the sidebar status box.
  document.getElementById("storage-status").addEventListener("click", function (event) {
    const button = event.target.closest("[data-storage]");
    if (!button) {
      return;
    }
    const action = button.dataset.storage;
    if (action === "connect" || action === "change") {
      st.connect();
    } else if (action === "reconnect") {
      st.reconnect();
    }
  });

  // Warn before closing the page if something isn't saved yet.
  window.addEventListener("beforeunload", function (event) {
    if (st.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = "";     // older browsers need this to show the warning
    }
  });

  if (!st.supported) {
    st.status = "unsupported";
    st.renderStatus();
    return;
  }

  // Was a folder connected before? Try to use it again.
  try {
    const handle = await st.idbGet("casesDir");
    if (handle) {
      st.dir = handle;
      // queryPermission only CHECKS; it never shows a prompt.
      const permission = await handle.queryPermission({ mode: "readwrite" });
      if (permission === "granted") {
        await st.loadAll();
      } else {
        st.status = "needs-permission";      // shows the "Reconnect" button
      }
    }
  } catch (err) {
    console.warn("Could not restore the cases folder:", err);
  }
  st.renderStatus();

  // Autosave loop. setInterval(fn, 2000) runs fn every 2 seconds.
  setInterval(st.autosave, 2000);
};

// ---------------------------------------------------------------
// Connecting a folder
// ---------------------------------------------------------------

// "Connect cases folder" / "Change folder": pick a folder.
App.storage.connect = async function () {
  let handle;
  try {
    // id: the picker remembers where you were last time.
    handle = await window.showDirectoryPicker({ id: "ir-cases", mode: "readwrite" });
  } catch (err) {
    return;                                  // picker cancelled
  }
  await App.storage.useFolder(handle);
};

// "Reconnect": ask again for permission to the remembered folder.
// requestPermission shows the browser's prompt (needs a click first).
App.storage.reconnect = async function () {
  const st = App.storage;
  try {
    const permission = await st.dir.requestPermission({ mode: "readwrite" });
    if (permission === "granted") {
      await st.loadAll();
    }
  } catch (err) {
    st.handleError(err);
  }
  st.renderStatus();
};

// Start using a folder: check it, remember it, load its cases.
// Returns true if the folder is now in use.
App.storage.useFolder = async function (handle) {
  const st = App.storage;
  if (await st.looksLikeProject(handle)) {
    alert("That looks like the IR Workbench project folder (it has index.html and core/).\n\n" +
          "Case data must NOT go in there, because the project is pushed to GitHub. " +
          "Pick or create a separate folder, e.g. IR-Cases.");
    return false;
  }
  st.dir = handle;
  st.folders = {};
  st.saved = {};
  st.lastHistory = {};
  try {
    await st.idbSet("casesDir", handle);     // remember it for next time
  } catch (err) {
    console.warn("Could not remember the folder for next time:", err);
  }
  await st.loadAll();
  st.renderStatus();
  return true;
};

// Is this the app's own project folder? (It has index.html AND core/.)
App.storage.looksLikeProject = async function (handle) {
  try {
    await handle.getFileHandle("index.html");
    await handle.getDirectoryHandle("core");
    return true;
  } catch (err) {
    return false;                            // one of them is missing
  }
};

// ---------------------------------------------------------------
// Loading
// ---------------------------------------------------------------

// Read every <case folder>/case.json in the cases folder into the app.
App.storage.loadAll = async function () {
  const st = App.storage;
  const loaded = [];

  // "for await" loops over things that arrive one at a time (here, the
  // folder's entries), like Python's "async for".
  for await (const [name, entry] of st.dir.entries()) {
    if (entry.kind !== "directory" || name.startsWith(".")) {
      continue;
    }
    try {
      const fileHandle = await entry.getFileHandle("case.json");
      const text = await (await fileHandle.getFile()).text();
      const data = JSON.parse(text);         // like Python's json.loads()
      if (data.format !== "ir-workbench-case" || !data.case || !data.case.id) {
        console.warn("Skipped", name, "- not an IR Workbench case.json");
        continue;
      }
      if (data.schemaVersion > st.SCHEMA_VERSION) {
        console.warn("Skipped", name, "- saved by a newer version of the app");
        continue;
      }
      loaded.push({ folder: name, caseObj: App.upgradeCase(data.case) });
    } catch (err) {
      if (err.name !== "NotFoundError") {     // a folder without case.json is fine
        console.warn("Could not load", name + ":", err);
      }
    }
  }

  // Put them in the app. If a case with the same ID is already open in
  // memory, the version on disk wins.
  for (const item of loaded) {
    const c = item.caseObj;
    const index = App.state.cases.findIndex(function (x) { return x.id === c.id; });
    if (index === -1) {
      App.state.cases.push(c);
    } else {
      if (!App.state.cases[index].sample) {
        console.warn("Case", c.id, "was open in memory; the saved version on disk replaced it.");
      }
      App.state.cases[index] = c;
    }
    st.folders[c.id] = item.folder;
    st.saved[c.id] = JSON.stringify(c);      // "this is what's on disk"
  }

  // Keep the selected case if it still exists, else open the first one.
  if (App.state.cases.length > 0 && App.findCase(App.state.selectedCaseId) === null) {
    App.state.selectedCaseId = App.state.cases[0].id;
  }

  st.status = "connected";
  st.lastError = "";
  console.log("Cases folder connected:", st.dir.name, "-", loaded.length, "case(s) loaded");
  App.render();
};

// ---------------------------------------------------------------
// Saving
// ---------------------------------------------------------------

// Can this case be saved right now? (Connected, and not a sample case.)
App.storage.canSave = function (caseObj) {
  return App.storage.status === "connected" && caseObj !== null && !caseObj.sample;
};

// Is any real (non-sample) case different from what's on disk?
App.storage.hasUnsavedChanges = function () {
  const st = App.storage;
  return App.state.cases.some(function (c) {
    return !c.sample && JSON.stringify(c) !== st.saved[c.id];
  });
};

// Runs every 2 seconds: save every case that changed since last time.
App.storage.autosave = async function () {
  const st = App.storage;
  if (st.status !== "connected" || st.busy) {
    return;
  }
  st.busy = true;
  try {
    for (const c of App.state.cases) {
      if (c.sample) {
        continue;
      }
      const json = JSON.stringify(c);        // the whole case as text
      if (json !== st.saved[c.id]) {
        st.renderStatus("Saving…");
        await st.saveCase(c, json);
      }
    }
  } catch (err) {
    st.handleError(err);
  } finally {
    // finally runs whether it worked or not, like Python's finally.
    st.busy = false;
    st.renderStatus();
  }
};

// Write one case to <case folder>/case.json.
App.storage.saveCase = async function (c, json) {
  const st = App.storage;
  const folder = await st.caseFolder(c);
  await st.snapshot(c.id, folder);           // keep the previous version in .history/

  const wrapper = {
    format: "ir-workbench-case",
    schemaVersion: st.SCHEMA_VERSION,
    savedAt: App.time.nowUtc() + "Z",
    case: c
  };
  // JSON.stringify(x, null, 2) = pretty-printed with 2-space indents,
  // like Python's json.dumps(x, indent=2).
  await st.writeText(folder, "case.json", JSON.stringify(wrapper, null, 2));

  st.saved[c.id] = json;
  st.lastSavedAt = App.time.nowUtc();
};

// The case's folder handle. Created (with evidence/ and exports/) the
// first time a case is saved.
App.storage.caseFolder = async function (c) {
  const st = App.storage;
  let name = st.folders[c.id];
  if (!name) {
    name = await st.freeFolderName(App.storage.folderNameFor(c), c.id);
    st.folders[c.id] = name;
  }
  const folder = await st.dir.getDirectoryHandle(name, { create: true });
  await folder.getDirectoryHandle("evidence", { create: true });
  await folder.getDirectoryHandle("exports", { create: true });
  return folder;
};

// "INC-2041" + "Acme ransomware" -> "INC-2041_Acme-ransomware".
// Anything that isn't a letter, number, dot, dash or underscore becomes "-".
App.storage.folderNameFor = function (c) {
  const raw = c.id + (c.title ? "_" + c.title : "");
  const name = raw.replace(/[^A-Za-z0-9._-]+/g, "-")
                  .replace(/-+/g, "-")
                  .replace(/^[-.]+|[-.]+$/g, "")
                  .slice(0, 80);
  return name || "case";
};

// A folder name that isn't used by a DIFFERENT case: "name", else
// "name-2", "name-3", ...
App.storage.freeFolderName = async function (base, caseId) {
  const st = App.storage;
  for (let n = 1; n < 100; n++) {
    const name = n === 1 ? base : base + "-" + n;
    try {
      const existing = await st.dir.getDirectoryHandle(name);     // no create: fails if missing
      try {
        const text = await (await (await existing.getFileHandle("case.json")).getFile()).text();
        if (JSON.parse(text).case.id === caseId) {
          return name;                        // it's this case's own folder
        }
      } catch (err) {
        // Exists but no readable case.json: don't reuse it, try the next name.
      }
    } catch (err) {
      return name;                            // doesn't exist yet: free
    }
  }
  throw new Error("No free folder name for " + base);
};

// Copy the current case.json into .history/ (at most every 5 minutes),
// then delete the oldest copies beyond HISTORY_KEEP.
App.storage.snapshot = async function (caseId, folder) {
  const st = App.storage;
  const now = Date.now();
  if (st.lastHistory[caseId] && now - st.lastHistory[caseId] < st.HISTORY_EVERY_MS) {
    return;
  }
  let text;
  try {
    text = await (await (await folder.getFileHandle("case.json")).getFile()).text();
  } catch (err) {
    return;                                   // first save: nothing to keep yet
  }
  const history = await folder.getDirectoryHandle(".history", { create: true });
  // "case_2026-09-30T14-05-02Z.json" (":" isn't allowed in Windows file names)
  const name = "case_" + App.time.nowUtc().replaceAll(":", "-") + "Z.json";
  await st.writeText(history, name, text);
  st.lastHistory[caseId] = now;

  // Oldest first (the names sort by time), then remove the extras.
  const names = [];
  for await (const [n, entry] of history.entries()) {
    if (entry.kind === "file" && n.startsWith("case_")) {
      names.push(n);
    }
  }
  names.sort();
  while (names.length > st.HISTORY_KEEP) {
    await history.removeEntry(names.shift());   // shift() = Python's list.pop(0)
  }
};

// Write text to a file in a folder (created if needed). createWritable
// writes to a temporary file and swaps it in on close(), so a crash
// can't leave a half-written file.
App.storage.writeText = async function (folder, fileName, text) {
  const fileHandle = await folder.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();
};

// Something went wrong while saving.
App.storage.handleError = function (err) {
  const st = App.storage;
  console.error("Saving failed:", err);
  if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
    st.status = "needs-permission";          // the browser took the permission back
  } else {
    st.status = "error";
    st.lastError = (err && err.message) || String(err);
  }
  st.renderStatus();
};

// ---------------------------------------------------------------
// Evidence files and exports
// ---------------------------------------------------------------

// Copy a picked local file into <case folder>/evidence/, then check the
// copy's SHA-256 against "expectedHash" (the hash of the original).
// Returns the info saved on the evidence entry (see App.setEvidenceCopy).
App.storage.copyEvidenceFile = async function (caseObj, evidenceId, file, expectedHash) {
  const st = App.storage;
  const folder = await st.caseFolder(caseObj);
  const evidenceDir = await folder.getDirectoryHandle("evidence", { create: true });
  // "EV-004_invoice.eml": the ID in front keeps names unique.
  const name = (evidenceId + "_" + file.name).replace(/[\\/:*?"<>|]+/g, "_");
  const fileHandle = await evidenceDir.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  // stream().pipeTo() copies in chunks, so even huge files don't have to
  // fit in memory. It closes the file when done.
  await file.stream().pipeTo(writable);

  // Check the copy (only if we have the original's hash and the file is
  // small enough to hash in the browser).
  let verified = null;
  if (expectedHash && file.size <= st.MAX_VERIFY_BYTES) {
    const copyHash = await App.sha256Hex(await fileHandle.getFile());
    verified = copyHash === expectedHash;
  }
  return { path: "evidence/" + name, verified: verified, copiedAt: App.time.nowUtc() };
};

// Save an export (CSV) into <case folder>/exports/ when connected,
// otherwise download it like before. Returns where it went:
//   { saved: true, path: "INC-2041_x/exports/..." }  or  { saved: false }
App.storage.saveExport = async function (caseObj, fileName, text) {
  const st = App.storage;
  if (!st.canSave(caseObj)) {
    App.downloadText(fileName, text);
    return { saved: false };
  }
  const folder = await st.caseFolder(caseObj);
  const exportsDir = await folder.getDirectoryHandle("exports", { create: true });
  // Time in front, so exports sort by time: "20260930-140502Z_INC-2041_iocs.csv"
  const stamp = App.time.nowUtc().replaceAll("-", "").replaceAll(":", "").replace("T", "-") + "Z";
  const name = stamp + "_" + fileName;
  await st.writeText(exportsDir, name, "﻿" + text);   // BOM so Excel reads UTF-8
  return { saved: true, path: st.folders[caseObj.id] + "/exports/" + name };
};

// ---------------------------------------------------------------
// Sidebar status box
// ---------------------------------------------------------------

// Draw the status box. "message" (optional) overrides the saved line,
// e.g. "Saving…".
App.storage.renderStatus = function (message) {
  const st = App.storage;
  const box = document.getElementById("storage-status");
  const e = App.escapeHtml;
  let html;

  if (st.status === "unsupported") {
    html = '<p class="storage-warn">Saving to disk needs Chrome or Edge. ' +
           'Changes are lost on refresh.</p>';
  } else if (st.status === "disconnected") {
    html = '<button class="btn btn-small storage-connect" data-storage="connect">Connect cases folder</button>' +
           '<p class="storage-warn">Not saved: changes are lost on refresh.</p>';
  } else if (st.status === "needs-permission") {
    html = `<button class="btn btn-small storage-connect" data-storage="reconnect">Reconnect "${e(st.dir ? st.dir.name : "")}"</button>` +
           '<p class="storage-warn">Changes are not being saved until you reconnect.</p>';
  } else if (st.status === "error") {
    html = `<p class="storage-warn">Saving failed: ${e(st.lastError)}</p>` +
           '<button class="btn btn-small" data-storage="reconnect">Try again</button>';
  } else {
    // Connected.
    let line = message || "";
    if (!line) {
      if (st.lastSavedAt) {
        const shown = App.time.display(st.lastSavedAt, App.state.displayTimeZone);
        line = "✓ Saved " + shown.clock;
      } else {
        line = "✓ All changes saved";
      }
    }
    html = `<div class="storage-folder" title="Cases folder">📁 ${e(st.dir.name)}</div>
            <div class="storage-line">${e(line)}
              <button class="link-button" data-storage="change">change</button>
            </div>`;
  }
  box.innerHTML = html;
};

// ---------------------------------------------------------------
// IndexedDB: remembering the folder handle between visits
// ---------------------------------------------------------------

// Open the app's small database (created the first time).
App.storage.openDb = function () {
  // IndexedDB uses callbacks; new Promise(...) wraps them so we can
  // use "await" (like wrapping a callback API for Python's asyncio).
  return new Promise(function (resolve, reject) {
    const request = indexedDB.open("irWorkbench", 1);
    request.onupgradeneeded = function () {
      request.result.createObjectStore("handles");      // a simple key -> value store
    };
    request.onsuccess = function () { resolve(request.result); };
    request.onerror = function () { reject(request.error); };
  });
};

App.storage.idbGet = async function (key) {
  const db = await App.storage.openDb();
  return new Promise(function (resolve, reject) {
    const request = db.transaction("handles", "readonly").objectStore("handles").get(key);
    request.onsuccess = function () { resolve(request.result); db.close(); };
    request.onerror = function () { reject(request.error); db.close(); };
  });
};

App.storage.idbSet = async function (key, value) {
  const db = await App.storage.openDb();
  return new Promise(function (resolve, reject) {
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").put(value, key);
    tx.oncomplete = function () { resolve(); db.close(); };
    tx.onerror = function () { reject(tx.error); db.close(); };
  });
};
