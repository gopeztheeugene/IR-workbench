// evidence.js - the Evidence tab.
// Rule: this file never calls other tabs. It only reads App.state
// and draws its own panel. It changes data only through the
// helpers in state.js (App.addEvidence, App.deleteEvidence).

App.tabs.evidence = {
  // Draw this tab's content inside its panel.
  // "panel" is the <section> element for this tab.
  // "caseObj" is the selected case (never null here: app.js checks first).
  render: function (panel, caseObj) {
    const e = App.escapeHtml;
    const items = caseObj.evidence;
    // Display zone: the sidebar's "Show times in" (times are saved in UTC).
    const zone = App.state.displayTimeZone;

    // Top line: heading with a count, e.g. "Evidence (3)", and the
    // buttons on the right.
    let html = `
      <div class="panel-header">
        <h2>Evidence <span class="muted">(${items.length})</span></h2>
        <div class="header-buttons">
          <!-- "disabled" when there's nothing to export -->
          <button class="btn" id="evidence-export-btn" ${items.length === 0 ? "disabled" : ""}>Export CSV</button>
          <button class="btn btn-primary" id="evidence-add-btn">+ Add evidence</button>
        </div>
      </div>
    `;

    // Nothing yet: show a hint.
    if (items.length === 0) {
      panel.innerHTML = html + '<p class="muted">No evidence yet.</p>';
      App.tabs.evidence.hookUpButtons(panel, caseObj);
      return;
    }

    // One table row per evidence entry.
    const rows = items.map(function (ev) {
      return `
        <tr>
          <td class="nowrap"><strong>${e(ev.id)}</strong></td>
          <td>${e(App.evidenceTypeLabel(ev.type))}</td>
          <td>${e(ev.source)}</td>
          <td>${e(ev.host)}${App.tabs.evidence.assetTagHtml(caseObj.id, ev.id)}</td>
          <td class="nowrap">${App.tabs.evidence.collectedHtml(ev.collectedAt, zone)}</td>
          <td>${App.tabs.evidence.locationHtml(ev.location)}${App.tabs.evidence.copyHtml(ev.storedCopy)}</td>
          <td>${App.tabs.evidence.hashHtml(ev.hash)}</td>
          <td class="notes">${e(ev.notes)}</td>
          <td>${App.tabs.evidence.rawLogHtml(ev.rawLog)}</td>
          <td class="nowrap">
            <button class="btn btn-small" data-promote="${e(ev.id)}"
                    title="Create a storyline entry from this evidence">→ Storyline</button>
            <button class="btn btn-small" data-edit="${e(ev.id)}">Edit</button>
            <button class="btn btn-small btn-danger" data-remove="${e(ev.id)}">Remove</button>
          </td>
        </tr>
      `;
    });

    // .join("") glues the rows together, like Python's "".join(rows).
    // The wrapper div lets a wide table scroll sideways.
    html += `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th><th>Type</th><th>Source</th><th>Host / account</th>
              <th>Collected</th><th>Location</th><th>SHA-256</th><th>Notes</th><th>Raw log</th><th></th>
            </tr>
          </thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      </div>
    `;
    panel.innerHTML = html;
    App.tabs.evidence.hookUpButtons(panel, caseObj);
  },

  // Attach click handlers to the buttons we just drew. The HTML was
  // replaced, so the old buttons (and their handlers) are gone.
  hookUpButtons: function (panel, caseObj) {

    document.getElementById("evidence-add-btn").addEventListener("click", function () {
      App.tabs.evidence.openForm(null);          // null = add a new one
    });

    document.getElementById("evidence-export-btn").addEventListener("click", function (event) {
      App.tabs.evidence.exportCsv(caseObj, event.currentTarget);
    });

    // "-> Storyline" buttons. We don't call the Storyline tab. We leave
    // a note in the shared state and switch tabs; the Storyline tab
    // reads the note when it draws and opens a pre-filled form.
    for (const button of panel.querySelectorAll("[data-promote]")) {
      button.addEventListener("click", function () {
        App.state.promoteEvidenceId = button.dataset.promote;   // e.g. "EV-002"
        App.showTab("storyline");
      });
    }

    // Edit buttons, one per row.
    for (const button of panel.querySelectorAll("[data-edit]")) {
      button.addEventListener("click", function () {
        App.tabs.evidence.openForm(button.dataset.edit);   // e.g. "EV-002"
      });
    }

    // Remove buttons, one per row.
    for (const button of panel.querySelectorAll("[data-remove]")) {
      button.addEventListener("click", function () {
        const evidenceId = button.dataset.remove;
        // confirm() shows an OK / Cancel box and returns true or false.
        // Python has no built-in equivalent; think of input("y/n").
        if (confirm("Remove " + evidenceId + "? This can't be undone.")) {
          App.deleteEvidence(caseObj.id, evidenceId);
          App.render();
        }
      });
    }
  },

  // A small "AS-001" tag after the host when it's linked to an
  // affected asset, so you can see at a glance what's in Assets.
  assetTagHtml: function (caseId, evidenceId) {
    const e = App.escapeHtml;
    return App.assetsLinkedTo(caseId, evidenceId)
      .map(function (a) {
        return ` <span class="tag tag-type" title="Affected asset">${e(a.id)}</span>`;
      })
      .join("");
  },

  // The collected time in the display zone: date and time, with the
  // zone label ("UTC", "UTC+08:00") underneath.
  collectedHtml: function (utcText, zone) {
    const e = App.escapeHtml;
    if (!utcText) {
      return '<span class="muted">none</span>';
    }
    const shown = App.time.display(utcText, zone);
    return `${e(shown.date)} ${e(shown.clock)}<div class="tl-zone">${e(shown.zoneLabel)}</div>`;
  },

  // "2026-09-20T14:05:00" -> "2026-09-20 14:05:00". Empty stays empty.
  formatDateTime: function (value) {
    return (value || "").replace("T", " ");
  },

  // A link becomes a clickable "Open link"; a file shows its name.
  // Under the location: was the file copied into the case folder, and
  // did the copy's SHA-256 match? (See App.storage.copyEvidenceFile.)
  copyHtml: function (copy) {
    const e = App.escapeHtml;
    if (!copy) {
      return "";
    }
    let check;
    if (copy.verified === true) {
      check = '<span class="copy-ok">✓ hash verified</span>';
    } else if (copy.verified === false) {
      check = '<span class="copy-bad">⚠ HASH MISMATCH</span>';
    } else {
      check = '<span class="muted">not verified (too large or no hash)</span>';
    }
    return `<div class="copy-status small" title="${e(copy.path)}">📁 copied to case folder · ${check}</div>`;
  },

  locationHtml: function (location) {
    const e = App.escapeHtml;
    if (!location || location.value === "") {
      return '<span class="muted">none</span>';
    }
    if (location.kind === "link") {
      // target="_blank" opens a new browser tab. rel="noopener
      // noreferrer" stops that page from reaching back into this one.
      // title="..." shows the full URL when you hover.
      return `<a href="${e(location.value)}" target="_blank"
                 rel="noopener noreferrer" title="${e(location.value)}">Open link</a>`;
    }
    return `<span title="Local file">File: ${e(location.value)}</span>`;
  },

  // Show only the first 12 characters of the hash; hover shows it all.
  hashHtml: function (hash) {
    const e = App.escapeHtml;
    if (!hash) {
      return '<span class="muted">none</span>';
    }
    // .slice(0, 12) is Python's hash[0:12].
    return `<code title="${e(hash)}">${e(hash.slice(0, 12))}…</code>`;
  },

  // Raw log: a clickable "▸ 3 lines" that opens to show the text.
  // <details> and <summary> are built into HTML: click the summary
  // to show or hide the rest. No JavaScript needed.
  // <pre> keeps line breaks and spacing exactly as pasted.
  rawLogHtml: function (rawLog) {
    if (!rawLog) {
      return '<span class="muted">none</span>';
    }
    // .split("\n") is Python's str.split("\n"); .length is len().
    const lineCount = rawLog.split("\n").length;
    const label = lineCount === 1 ? "1 line" : lineCount + " lines";
    return `<details class="raw-log">
              <summary>${label}</summary>
              <pre>${App.escapeHtml(rawLog)}</pre>
            </details>`;
  },

  // ---------------------------------------------------------------
  // CSV export (helpers are shared, in core/export.js)
  // ---------------------------------------------------------------

  // Build the CSV text for a case. Saved into the case's exports/ folder
  // when a cases folder is connected, otherwise downloaded. "button" is
  // the Export button, used to show where it went.
  exportCsv: async function (caseObj, button) {
    const tab = App.tabs.evidence;

    const header = ["Case ID", "Evidence ID", "Type", "Source", "Host / account",
                    "Collected at (UTC)", "Location kind", "Location", "SHA-256",
                    "Notes", "Raw log", "Copy in case folder", "Copy hash verified"];

    // One list of values per evidence entry, in the same order as the header.
    const rows = caseObj.evidence.map(function (ev) {
      const copy = ev.storedCopy;
      const verified = !copy ? "" : copy.verified === true ? "yes" : copy.verified === false ? "MISMATCH" : "not checked";
      return [caseObj.id, ev.id, App.evidenceTypeLabel(ev.type), ev.source, ev.host,
              tab.formatDateTime(ev.collectedAt), ev.location.kind, ev.location.value,
              ev.hash, ev.notes, ev.rawLog, copy ? copy.path : "", verified];
    });

    const result = await App.storage.saveExport(caseObj, App.safeFileName(caseObj.id) + "_evidence.csv",
                                                App.buildCsv(header, rows));
    if (button) {
      App.flashButton(button, result.saved ? "Saved to exports/" : "Downloaded");
    }
    console.log("Exported", caseObj.evidence.length, "evidence rows:", result.saved ? result.path : "download");
  },

  // ---------------------------------------------------------------
  // "Add evidence" pop-up form
  // ---------------------------------------------------------------

  // Files bigger than this aren't hashed in the browser: it has to
  // load the whole file into memory first. 1024 ** 3 bytes = 1 GB
  // (** is "to the power of", same as Python).
  MAX_HASH_BYTES: 1024 ** 3,

  // Counts hashing runs. If you pick file A, then file B before A is
  // done, A's result must be ignored. Each run remembers its number
  // and only fills in the hash if it's still the latest run.
  hashRun: 0,

  // Which entry the pop-up is editing, e.g. "EV-002".
  // null means the pop-up is adding a NEW entry.
  editingId: null,

  // When editing a local-file entry: its current file name. Browsers
  // don't let a page pre-fill a file picker, so we remember the name
  // here and keep it unless a new file is picked.
  currentFileName: "",
  currentFileHash: "",

  // Runs once at startup (app.js calls every tab's setup()).
  setup: function () {
    const tab = App.tabs.evidence;   // short name for this tab object
    const dialog = document.getElementById("evidence-dialog");
    const form = document.getElementById("evidence-form");
    const fileInput = document.getElementById("evidence-file");
    const hashInput = document.getElementById("evidence-hash");
    const hashStatus = document.getElementById("evidence-hash-status");
    const submitBtn = document.getElementById("evidence-submit");
    const errorBox = document.getElementById("evidence-error");
    const e = App.escapeHtml;

    // Fill the Type dropdown from App.EVIDENCE_TYPES.
    document.getElementById("evidence-type").innerHTML = App.EVIDENCE_TYPES
      .map(function (t) {
        return `<option value="${e(t.key)}">${e(t.label)}</option>`;
      })
      .join("");

    // Changing the time updates the "Saved as ..." line.
    document.getElementById("evidence-collected").addEventListener("input", tab.updateTimePreview);

    // Host picked from (or typed to match) an existing asset: tick
    // "Add to Assets as affected" so this evidence links to it.
    // The user can still untick it afterwards.
    form.elements["host"].addEventListener("input", function () {
      const match = App.findAssetByName(App.state.selectedCaseId, form.elements["host"].value);
      if (match !== null) {
        form.elements["affected"].checked = true;
      }
    });

    // Radio buttons: show the Link box OR the File picker.
    // "change" fires when you pick a different radio button.
    for (const radio of form.querySelectorAll('input[name="kind"]')) {
      radio.addEventListener("change", function () {
        tab.showLocationField(radio.value);
      });
    }

    // A file was picked: hash it.
    // "async function" can pause at "await" until slow work finishes,
    // without freezing the page. Same idea as Python's async/await.
    fileInput.addEventListener("change", async function () {
      tab.hashRun = tab.hashRun + 1;
      const myRun = tab.hashRun;     // remember which run this is
      hashInput.value = "";

      // .files is a list of the picked files; we allow only one.
      const file = fileInput.files[0];
      if (!file) {                   // picker was cancelled
        // When editing, put back the hash of the file we're keeping.
        hashInput.value = tab.currentFileHash;
        hashStatus.textContent = "";
        return;
      }

      if (file.size > tab.MAX_HASH_BYTES) {
        // .toFixed(1) rounds to 1 decimal, like Python's f"{x:.1f}".
        const gb = (file.size / 1024 ** 3).toFixed(1);
        hashStatus.textContent = "This file is " + gb + " GB, too large to hash in the " +
          "browser. Paste the SHA-256 from your forensic tool instead.";
        return;
      }

      hashStatus.textContent = "Calculating SHA-256...";
      submitBtn.disabled = true;     // can't add until the hash is ready

      // try / catch / finally works like Python's try / except / finally.
      try {
        const hex = await tab.sha256Hex(file);
        if (myRun === tab.hashRun) {  // ignore if a newer file was picked
          hashInput.value = hex;
          hashStatus.textContent = "SHA-256 calculated from the file.";
        }
      } catch (err) {
        if (myRun === tab.hashRun) {
          hashStatus.textContent = "Could not hash the file: " + err.message;
        }
      } finally {
        if (myRun === tab.hashRun) {
          submitBtn.disabled = false;
        }
      }
    });

    // Cancel: close. (Esc also closes.)
    document.getElementById("evidence-cancel").addEventListener("click", function () {
      tab.hashRun = tab.hashRun + 1;  // ignore any hash still running
      dialog.close();
    });

    // "Add evidence" / "Save changes" button: read the form, then
    // add a new entry or update the one being edited.
    // "async" because copying a file into the case folder takes a moment.
    form.addEventListener("submit", async function (event) {
      event.preventDefault();         // don't reload the page

      const caseObj = App.getSelectedCase();
      const data = new FormData(form);
      const kind = data.get("kind");  // "link" or "file"

      // For a link, use the typed URL. For a file, use the newly
      // picked file's name, or (when editing) the file we're keeping.
      let value = "";
      if (kind === "link") {
        value = data.get("link");
      } else if (fileInput.files[0]) {
        value = fileInput.files[0].name;
      } else {
        value = tab.currentFileName;
      }

      const evidenceData = {
        type: data.get("type"),
        source: data.get("source"),
        host: data.get("host"),
        // Typed in the sidebar's time zone, saved as UTC.
        collectedAt: App.time.fromDisplay(data.get("collectedAt")),
        location: { kind: kind, value: value },
        hash: data.get("hash"),
        notes: data.get("notes"),
        rawLog: data.get("rawLog"),
        // A ticked checkbox sends "on"; an unticked one sends nothing (null).
        affected: data.get("affected") === "on"
      };

      // Adding or editing? Both return null, or an error message.
      let error;
      if (tab.editingId === null) {
        error = App.addEvidence(caseObj.id, evidenceData);
      } else {
        error = App.updateEvidence(caseObj.id, tab.editingId, evidenceData);
      }

      if (error) {
        errorBox.textContent = error;  // keep the pop-up open to fix it
        return;
      }

      // Copy a newly picked local file into the case's evidence/ folder,
      // if a cases folder is connected and the box is ticked.
      const file = fileInput.files[0];
      const wantCopy = document.getElementById("evidence-copy").checked;
      if (kind === "file" && file && wantCopy && App.storage.canSave(caseObj)) {
        // The entry's ID: the one being edited, or the one just added (last).
        const evidenceId = tab.editingId || caseObj.evidence[caseObj.evidence.length - 1].id;
        const saved = App.findEvidence(caseObj.id, evidenceId);
        submitBtn.disabled = true;
        errorBox.textContent = "";
        hashStatus.textContent = "Copying into the case folder...";
        try {
          const info = await App.storage.copyEvidenceFile(caseObj, evidenceId, file, saved.hash);
          App.setEvidenceCopy(caseObj.id, evidenceId, info);
        } catch (err) {
          // The entry is saved either way; only the copy failed.
          alert("The evidence entry was saved, but copying the file failed:\n" + err.message);
        } finally {
          submitBtn.disabled = false;
        }
      }

      dialog.close();
      App.render();
    });
  },

  // Update the "Saved as ... UTC" line under Collected at.
  updateTimePreview: function () {
    const form = document.getElementById("evidence-form");
    const utc = App.time.fromDisplay(form.elements["collectedAt"].value);
    document.getElementById("evidence-time-preview").textContent = App.time.previewText(utc);
  },

  // Show the Link box for "link", or the File picker for "file".
  showLocationField: function (kind) {
    document.getElementById("evidence-link-field").hidden = kind !== "link";
    document.getElementById("evidence-file-field").hidden = kind !== "file";
  },

  // Open the pop-up.
  //   openForm(null)      -> empty form to ADD a new entry
  //   openForm("EV-002")  -> form filled in to EDIT EV-002
  openForm: function (evidenceId) {
    const tab = App.tabs.evidence;
    const form = document.getElementById("evidence-form");
    const currentFileNote = document.getElementById("evidence-current-file");

    tab.hashRun = tab.hashRun + 1;    // forget any earlier hashing
    form.reset();                     // back to empty defaults
    document.getElementById("evidence-hash-status").textContent = "";
    document.getElementById("evidence-error").textContent = "";
    document.getElementById("evidence-submit").disabled = false;
    tab.editingId = null;
    tab.currentFileName = "";
    tab.currentFileHash = "";
    currentFileNote.textContent = "";

    // Look up the entry to edit (null when adding).
    const ev = evidenceId ? App.findEvidence(App.state.selectedCaseId, evidenceId) : null;

    if (ev === null) {
      // ---- ADD mode ----
      document.getElementById("evidence-dialog-title").textContent = "Add evidence";
      document.getElementById("evidence-dialog-hint").textContent =
        "The ID (EV-001, EV-002, ...) is assigned automatically.";
      document.getElementById("evidence-submit").textContent = "Add evidence";
      // Default: now, shown in the sidebar's time zone.
      document.getElementById("evidence-collected").value = App.time.toDisplay(App.time.nowUtc());
      tab.showLocationField("link");
    } else {
      // ---- EDIT mode: copy the entry's values into the form ----
      tab.editingId = ev.id;
      document.getElementById("evidence-dialog-title").textContent = "Edit " + ev.id;
      document.getElementById("evidence-dialog-hint").textContent = "The ID stays the same.";
      document.getElementById("evidence-submit").textContent = "Save changes";

      // form.elements["name"] finds a field by its name="...",
      // like looking up a key in a dict.
      form.elements["type"].value = ev.type;
      // Saved in UTC; shown in the sidebar's time zone.
      form.elements["collectedAt"].value = App.time.toDisplay(ev.collectedAt);
      form.elements["source"].value = ev.source;
      form.elements["host"].value = ev.host;
      form.elements["hash"].value = ev.hash;
      form.elements["notes"].value = ev.notes;
      // "|| ''" in case an older entry has no rawLog field yet.
      form.elements["rawLog"].value = ev.rawLog || "";
      // Ticked if this evidence is already linked to an asset.
      form.elements["affected"].checked =
        App.assetsLinkedTo(App.state.selectedCaseId, ev.id).length > 0;

      // Tick the matching radio button ("link" or "file").
      form.querySelector('input[name="kind"][value="' + ev.location.kind + '"]').checked = true;
      tab.showLocationField(ev.location.kind);

      if (ev.location.kind === "link") {
        form.elements["link"].value = ev.location.value;
      } else if (ev.location.value !== "") {
        tab.currentFileName = ev.location.value;
        tab.currentFileHash = ev.hash;
        currentFileNote.textContent =
          "Current file: " + ev.location.value + " (kept unless you pick a new one)";
      }
    }

    // "Copy into the case's evidence/ folder": only when this case can be
    // saved (a cases folder is connected and it's not a sample case).
    document.getElementById("evidence-copy-row").hidden = !App.storage.canSave(App.getSelectedCase());

    App.time.fillZoneHints();           // "(Asia/Manila, UTC+08:00)" in the label
    tab.updateTimePreview();
    document.getElementById("evidence-dialog").showModal();
  },

  // SHA-256 of a file. The real work is in App.sha256Hex (core/export.js),
  // shared with the storage code that verifies copied evidence files.
  sha256Hex: function (file) {
    return App.sha256Hex(file);
  }
};
