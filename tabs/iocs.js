// iocs.js - the IOCs tab: indicators of compromise.
// Rule: this file never calls other tabs. It only reads App.state
// and draws its own panel. It changes data only through the
// helpers in state.js (App.addIoc, App.updateIoc, App.deleteIoc).
//
// Values are SAVED real ("refanged") and SHOWN defanged, so nothing
// is clickable by accident. "Copy" copies the real value.
// Text helpers are in core/ioc.js, CSV/clipboard in core/export.js.

App.tabs.iocs = {
  // Which IOC the pop-up is editing ("IOC-001"), or null when adding.
  editingId: null,

  // One-time message shown above the table (see render).
  notice: "",

  // The extractor's findings, keyed by "type|value" (see buildCandidates).
  candidates: {},

  // Draw this tab's content inside its panel.
  // "panel" is the <section> element for this tab.
  // "caseObj" is the selected case (never null here: app.js checks first).
  render: function (panel, caseObj) {
    const tab = App.tabs.iocs;
    const e = App.escapeHtml;
    const items = caseObj.iocs;
    const zone = App.state.displayTimeZone;
    const none = items.length === 0 ? "disabled" : "";
    // The extractor needs at least one evidence item with a raw log.
    const hasRawLogs = caseObj.evidence.some(function (ev) { return ev.rawLog; });

    let html = `
      <div class="panel-header">
        <h2>Indicators of compromise <span class="muted">(${items.length})</span></h2>
        <div class="header-buttons">
          <button class="btn" id="ioc-extract-btn" ${hasRawLogs ? "" : "disabled"}
                  title="Find IPs, domains, URLs, hashes, and emails in the evidence raw logs">Extract from raw logs</button>
          <button class="btn" id="ioc-copy-all-btn" ${none}
                  title="One per line, defanged: ready to paste into an email">Copy all (defanged)</button>
          <button class="btn" id="ioc-export-btn" ${none}>Export CSV</button>
          <button class="btn btn-primary" id="ioc-add-btn">+ Add IOC</button>
        </div>
      </div>
    `;

    // A one-time message, e.g. "Added 4 IOCs from raw logs." Shown
    // once, then cleared.
    if (tab.notice) {
      html += `<p class="notice">${e(tab.notice)}</p>`;
      tab.notice = "";
    }

    if (items.length === 0) {
      html += '<p class="muted">No IOCs yet. Paste a value with "+ Add IOC" ' +
              '(defanged values are fine), or use "Extract from raw logs".</p>';
    } else {
      const rows = items.map(function (ioc) {
        const evidenceTags = ioc.evidenceIds
          .map(function (id) { return `<span class="tag tag-type">${e(id)}</span>`; })
          .join(" ");

        // First seen, in the sidebar's display zone.
        let firstSeen = '<span class="muted">unknown</span>';
        if (ioc.firstSeen) {
          const shown = App.time.display(ioc.firstSeen, zone);
          firstSeen = `${e(shown.date)} ${e(shown.clock)}<div class="tl-zone">${e(shown.zoneLabel)}</div>`;
        }

        return `
          <tr>
            <td class="nowrap"><strong>${e(ioc.id)}</strong></td>
            <td class="nowrap">${e(App.iocTypeLabel(ioc.type))}</td>
            <td class="ioc-value">
              <code>${e(App.ioc.defang(ioc.value, ioc.type))}</code>
            </td>
            <td class="nowrap">
              <button class="btn btn-small" data-copy="${e(ioc.id)}"
                      title="Copy the real (not defanged) value">Copy</button>
            </td>
            <td class="nowrap"><span class="tag tlp-${e(ioc.tlp)}">${e(App.tlpLabel(ioc.tlp))}</span></td>
            <td class="nowrap">${firstSeen}</td>
            <td>${evidenceTags || '<span class="muted">none</span>'}</td>
            <td class="notes">${e(ioc.notes)}</td>
            <td class="nowrap">
              <button class="btn btn-small" data-edit="${e(ioc.id)}">Edit</button>
              <button class="btn btn-small btn-danger" data-remove="${e(ioc.id)}">Remove</button>
            </td>
          </tr>
        `;
      });

      html += `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th><th>Type</th><th>Value (defanged)</th><th></th><th>TLP</th>
                <th>First seen</th><th>Evidence</th><th>Notes</th><th></th>
              </tr>
            </thead>
            <tbody>${rows.join("")}</tbody>
          </table>
        </div>
      `;
    }

    panel.innerHTML = html;
    tab.hookUpButtons(panel, caseObj);
  },

  // Attach click handlers to the buttons we just drew.
  hookUpButtons: function (panel, caseObj) {
    const tab = App.tabs.iocs;

    document.getElementById("ioc-add-btn").addEventListener("click", function () {
      tab.openForm(null);
    });

    // Copy all: one defanged value per line.
    document.getElementById("ioc-copy-all-btn").addEventListener("click", async function (event) {
      const text = caseObj.iocs
        .map(function (ioc) { return App.ioc.defang(ioc.value, ioc.type); })
        .join("\n");
      const ok = await App.copyText(text);
      App.flashButton(event.target, ok ? "Copied " + caseObj.iocs.length + "!" : "Copy failed");
    });

    document.getElementById("ioc-export-btn").addEventListener("click", function (event) {
      tab.exportCsv(caseObj, event.currentTarget);
    });

    document.getElementById("ioc-extract-btn").addEventListener("click", function () {
      tab.openExtractor();
    });

    // Copy one real value.
    for (const button of panel.querySelectorAll("[data-copy]")) {
      button.addEventListener("click", async function () {
        const ioc = App.findIoc(caseObj.id, button.dataset.copy);
        const ok = await App.copyText(ioc.value);
        App.flashButton(button, ok ? "Copied!" : "Failed");
      });
    }

    for (const button of panel.querySelectorAll("[data-edit]")) {
      button.addEventListener("click", function () {
        tab.openForm(button.dataset.edit);
      });
    }

    for (const button of panel.querySelectorAll("[data-remove]")) {
      button.addEventListener("click", function () {
        const iocId = button.dataset.remove;
        if (confirm("Remove " + iocId + " from IOCs?")) {
          App.deleteIoc(caseObj.id, iocId);
          App.render();
        }
      });
    }
  },

  // CSV with both the real and the defanged value (real for block
  // lists and tools, defanged for reports and emails).
  // Saved into the case's exports/ folder when a cases folder is
  // connected, otherwise downloaded. "button" shows where it went.
  exportCsv: async function (caseObj, button) {
    const header = ["Case ID", "IOC ID", "Type", "Value", "Value (defanged)", "TLP",
                    "First seen (UTC)", "Linked evidence", "Notes"];
    const rows = caseObj.iocs.map(function (ioc) {
      return [caseObj.id, ioc.id, App.iocTypeLabel(ioc.type), ioc.value,
              App.ioc.defang(ioc.value, ioc.type), App.tlpLabel(ioc.tlp),
              ioc.firstSeen.replace("T", " "), ioc.evidenceIds.join(" "), ioc.notes];
    });
    const result = await App.storage.saveExport(caseObj, App.safeFileName(caseObj.id) + "_iocs.csv",
                                                App.buildCsv(header, rows));
    if (button) {
      App.flashButton(button, result.saved ? "Saved to exports/" : "Downloaded");
    }
    console.log("Exported", caseObj.iocs.length, "IOCs:", result.saved ? result.path : "download");
  },

  // ---------------------------------------------------------------
  // "Add IOC" pop-up form
  // ---------------------------------------------------------------

  // Runs once at startup: fill the dropdowns and wire up the pop-up.
  setup: function () {
    const tab = App.tabs.iocs;
    const dialog = document.getElementById("ioc-dialog");
    const form = document.getElementById("ioc-form");
    const errorBox = document.getElementById("ioc-error");
    const e = App.escapeHtml;

    // Type dropdown: "Auto-detect" first (and the default after reset).
    document.getElementById("ioc-type").innerHTML =
      '<option value="auto" selected>Auto-detect</option>' +
      App.IOC_TYPES
        .map(function (t) { return `<option value="${e(t.key)}">${e(t.label)}</option>`; })
        .join("");

    // TLP dropdown, TLP:AMBER by default.
    document.getElementById("ioc-tlp").innerHTML = App.TLP_LEVELS
      .map(function (t) {
        const def = t.key === "amber" ? " selected" : "";
        return `<option value="${e(t.key)}"${def}>${e(t.label)}</option>`;
      })
      .join("");

    // Live hints while typing.
    document.getElementById("ioc-value").addEventListener("input", tab.updateDetected);
    document.getElementById("ioc-type").addEventListener("change", tab.updateDetected);
    document.getElementById("ioc-first-seen").addEventListener("input", tab.updateTimePreview);

    document.getElementById("ioc-cancel").addEventListener("click", function () {
      dialog.close();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const caseId = App.state.selectedCaseId;
      const data = new FormData(form);
      const iocData = {
        value: data.get("value"),
        type: data.get("type"),             // "auto" = guess it
        tlp: data.get("tlp"),
        firstSeen: App.time.fromDisplay(data.get("firstSeen")),   // sidebar zone -> UTC
        evidenceIds: data.getAll("evidenceIds"),
        notes: data.get("notes")
      };

      let error;
      if (tab.editingId === null) {
        error = App.addIoc(caseId, iocData);
      } else {
        error = App.updateIoc(caseId, tab.editingId, iocData);
      }

      if (error) {
        errorBox.textContent = error;
        return;
      }
      dialog.close();
      App.render();
    });

    tab.setupExtractor();
  },

  // Show what will be saved: "Detected: Domain · saved as evil.com".
  updateDetected: function () {
    const form = document.getElementById("ioc-form");
    const out = document.getElementById("ioc-detected");
    const real = App.ioc.refang(form.elements["value"].value);
    if (real === "") {
      out.textContent = "";
      return;
    }
    const chosen = form.elements["type"].value;
    const type = chosen === "auto" ? App.ioc.guessType(real) : chosen;
    let text = (chosen === "auto" ? "Detected: " : "Type: ") + App.iocTypeLabel(type);
    // Tell the user when a defanged value will be saved as the real one.
    if (real !== form.elements["value"].value.trim()) {
      text += " · will be saved as " + real;
    }
    out.textContent = text;
  },

  updateTimePreview: function () {
    const form = document.getElementById("ioc-form");
    const utc = App.time.fromDisplay(form.elements["firstSeen"].value);
    document.getElementById("ioc-time-preview").textContent = App.time.previewText(utc);
  },

  // openForm(null) = add a new IOC; openForm("IOC-001") = edit it.
  openForm: function (iocId) {
    const tab = App.tabs.iocs;
    const e = App.escapeHtml;
    const caseObj = App.getSelectedCase();
    const form = document.getElementById("ioc-form");
    const title = document.getElementById("ioc-dialog-title");
    const hint = document.getElementById("ioc-dialog-hint");
    const submit = document.getElementById("ioc-submit");

    form.reset();                   // type -> Auto-detect, TLP -> AMBER
    document.getElementById("ioc-error").textContent = "";

    let ticked = [];
    const ioc = iocId ? App.findIoc(caseObj.id, iocId) : null;

    if (ioc === null) {
      tab.editingId = null;
      title.textContent = "Add IOC";
      hint.textContent = "The ID (IOC-001, IOC-002, ...) is assigned automatically.";
      submit.textContent = "Add IOC";
    } else {
      tab.editingId = ioc.id;
      title.textContent = "Edit " + ioc.id;
      hint.textContent = "The ID stays the same.";
      submit.textContent = "Save changes";
      form.elements["value"].value = ioc.value;   // the real value
      form.elements["type"].value = ioc.type;
      form.elements["tlp"].value = ioc.tlp;
      form.elements["firstSeen"].value = App.time.toDisplay(ioc.firstSeen);   // UTC -> sidebar zone
      form.elements["notes"].value = ioc.notes;
      ticked = ioc.evidenceIds;
    }

    // One checkbox per evidence item in this case.
    const boxes = document.getElementById("ioc-evidence");
    if (caseObj.evidence.length === 0) {
      boxes.innerHTML = '<span class="muted small">No evidence in this case yet.</span>';
    } else {
      boxes.innerHTML = caseObj.evidence
        .map(function (item) {
          const checked = ticked.includes(item.id) ? " checked" : "";
          const text = item.id + " " + (item.source || App.evidenceTypeLabel(item.type));
          return `<label class="type-option">
                    <input type="checkbox" name="evidenceIds" value="${e(item.id)}"${checked}>
                    ${e(text)}
                  </label>`;
        })
        .join("");
    }

    App.time.fillZoneHints();       // "(Asia/Manila, UTC+08:00)" in the label
    tab.updateDetected();
    tab.updateTimePreview();
    document.getElementById("ioc-dialog").showModal();
  },

  // ---------------------------------------------------------------
  // "Extract from raw logs" pop-up
  // ---------------------------------------------------------------

  // Runs once at startup (from setup): dropdowns and buttons.
  setupExtractor: function () {
    const tab = App.tabs.iocs;
    const dialog = document.getElementById("extract-dialog");
    const form = document.getElementById("extract-form");
    const e = App.escapeHtml;

    document.getElementById("extract-tlp").innerHTML = App.TLP_LEVELS
      .map(function (t) {
        const def = t.key === "amber" ? " selected" : "";
        return `<option value="${e(t.key)}"${def}>${e(t.label)}</option>`;
      })
      .join("");

    // Select all / none: tick or untick every box that can be ticked.
    document.getElementById("extract-all").addEventListener("click", function () {
      tab.setAllTicks(true);
    });
    document.getElementById("extract-none").addEventListener("click", function () {
      tab.setAllTicks(false);
    });

    document.getElementById("extract-cancel").addEventListener("click", function () {
      dialog.close();
    });

    // "Add selected": add every ticked value as an IOC.
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const caseId = App.state.selectedCaseId;
      const tlp = form.elements["tlp"].value;
      const ticked = form.querySelectorAll('input[name="pick"]:checked');

      if (ticked.length === 0) {
        document.getElementById("extract-error").textContent = "Nothing is ticked.";
        return;
      }

      let added = 0;
      const problems = [];
      for (const box of ticked) {
        const c = tab.candidates[box.value];      // box.value is the "type|value" key
        const error = App.addIoc(caseId, {
          type: c.type,
          value: c.value,
          tlp: tlp,
          firstSeen: c.firstSeen,
          evidenceIds: c.evidenceIds,
          notes: "Extracted from raw log of " + c.evidenceIds.join(", ")
        });
        if (error) {
          problems.push(c.value + ": " + error);
        } else {
          added = added + 1;
        }
      }

      tab.notice = "Added " + added + " IOC" + (added === 1 ? "" : "s") + " from raw logs." +
                   (problems.length ? " Skipped: " + problems.join("; ") : "");
      dialog.close();
      App.render();
    });
  },

  // Open the pop-up: scan the raw logs and show the checklist.
  openExtractor: function () {
    const tab = App.tabs.iocs;
    document.getElementById("extract-form").reset();   // TLP -> AMBER
    document.getElementById("extract-error").textContent = "";
    tab.buildCandidates();
    tab.renderCandidates();
    document.getElementById("extract-dialog").showModal();
  },

  // Scan every evidence raw log and merge what's found, so a value
  // seen in two logs is ONE candidate linked to both evidence items.
  // tab.candidates becomes a dict like:
  //   { "ipv4|203.0.113.45": { type, value, evidenceIds: ["EV-002"],
  //                            firstSeen: "2026-09-19T22:41:07",
  //                            line: "...", existingId: null, isPrivate: false } }
  buildCandidates: function () {
    const tab = App.tabs.iocs;
    const caseObj = App.getSelectedCase();
    // Log times without a zone are read as the sidebar's time zone.
    const logZone = App.state.displayTimeZone;
    const found = {};

    for (const ev of caseObj.evidence) {
      if (!ev.rawLog) {
        continue;
      }
      for (const item of App.ioc.extract(ev.rawLog, logZone)) {
        // Case-insensitive key, so "EVIL.example" and "evil.example" merge.
        const key = item.type + "|" + item.value.toLowerCase();
        if (!found[key]) {                         // first time we see it
          found[key] = { type: item.type, value: item.value, evidenceIds: [],
                         firstSeen: "", line: item.line };
        }
        const c = found[key];
        if (!c.evidenceIds.includes(ev.id)) {
          c.evidenceIds.push(ev.id);
        }
        // Keep the EARLIEST time. UTC text compares correctly as text.
        if (item.timeUtc && (c.firstSeen === "" || item.timeUtc < c.firstSeen)) {
          c.firstSeen = item.timeUtc;
        }
      }
    }

    // Mark ones that are already IOCs, and private IPs.
    for (const key in found) {                     // Python: for key in found:
      const c = found[key];
      const existing = caseObj.iocs.find(function (i) {
        return i.type === c.type && i.value.toLowerCase() === c.value.toLowerCase();
      });
      c.existingId = existing ? existing.id : null;
      c.isPrivate = c.type === "ipv4" && App.ioc.isPrivateIp(c.value);
    }
    tab.candidates = found;
  },

  // Draw the checklist from tab.candidates, grouped in IOC type order.
  renderCandidates: function () {
    const tab = App.tabs.iocs;
    const e = App.escapeHtml;
    const zone = App.state.displayTimeZone;
    const list = document.getElementById("extract-list");
    const caseObj = App.getSelectedCase();

    // Object.keys() lists a dict's keys, like Python's list(d.keys()).
    const keys = Object.keys(tab.candidates);
    const typeOrder = App.IOC_TYPES.map(function (t) { return t.key; });
    keys.sort(function (a, b) {
      const ca = tab.candidates[a];
      const cb = tab.candidates[b];
      return typeOrder.indexOf(ca.type) - typeOrder.indexOf(cb.type) ||   // by type, then
             ca.value.localeCompare(cb.value);                            // by value A-Z
    });

    const logCount = caseObj.evidence.filter(function (ev) { return ev.rawLog; }).length;
    const newCount = keys.filter(function (k) { return !tab.candidates[k].existingId; }).length;
    document.getElementById("extract-summary").textContent =
      "Scanned " + logCount + " raw log" + (logCount === 1 ? "" : "s") + ". Found " +
      keys.length + " value" + (keys.length === 1 ? "" : "s") + ", " + newCount +
      " not yet in IOCs. Tick the ones that are real IOCs. Log times without a " +
      "time zone are read as " + App.time.zoneName() + " (the sidebar setting).";

    if (keys.length === 0) {
      list.innerHTML = '<p class="muted">Nothing that looks like an IOC was found.</p>';
      return;
    }

    const rows = keys.map(function (key) {
      const c = tab.candidates[key];
      // Ticked by default, unless it's already an IOC or a private IP.
      const disabled = c.existingId ? " disabled" : "";
      const checked = !c.existingId && !c.isPrivate ? " checked" : "";

      let status = "";
      if (c.existingId) {
        status = `<span class="muted">already ${e(c.existingId)}</span>`;
      } else if (c.isPrivate) {
        status = '<span class="tag tag-type">internal IP</span>';
      }

      let firstSeen = '<span class="muted">no time on line</span>';
      if (c.firstSeen) {
        const shown = App.time.display(c.firstSeen, zone);
        firstSeen = e(shown.date + " " + shown.clock + " " + shown.zoneLabel);
      }

      return `
        <tr class="${c.existingId ? "extract-existing" : ""}">
          <td><input type="checkbox" name="pick" value="${e(key)}"${checked}${disabled}></td>
          <td class="nowrap">${e(App.iocTypeLabel(c.type))}</td>
          <td class="ioc-value"><code title="${e(c.line)}">${e(App.ioc.defang(c.value, c.type))}</code></td>
          <td class="nowrap">${c.evidenceIds.map(function (id) { return `<span class="tag tag-type">${e(id)}</span>`; }).join(" ")}</td>
          <td class="nowrap small">${firstSeen}</td>
          <td class="nowrap">${status}</td>
        </tr>
      `;
    });

    list.innerHTML = `
      <table class="data-table">
        <thead>
          <tr><th></th><th>Type</th><th>Value (defanged)</th><th>Found in</th><th>First seen</th><th></th></tr>
        </thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    `;
  },

  // Tick or untick every checkbox that isn't greyed out.
  setAllTicks: function (on) {
    for (const box of document.querySelectorAll('#extract-list input[name="pick"]')) {
      if (!box.disabled) {
        box.checked = on;
      }
    }
  }
};
