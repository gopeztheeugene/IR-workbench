// client.js - the Client tab: organization, subscriptions, IR team &
// contacts, environment, scope, and device lists (EDR / RMM / SIEM).
// Rule: this file never calls other tabs. It only reads App.state
// and draws its own panel. It changes data only through the helpers
// in state.js (App.setClientField, App.addPerson, App.setRmmCheck...).
//
// HOW EDITING WORKS (no Save button):
//   Every field has data-field="path", e.g. data-field="org.industry".
//   Typing saves straight into the case with App.setClientField.
//   Text boxes do NOT redraw the tab (you'd lose your place), but
//   dropdowns and tick boxes do, because they can show/hide fields.
//   All of this is handled by 3 listeners set up once in setup()
//   ("event delegation"), so adding a field is just adding HTML.

App.tabs.client = {
  // The RMM CSV being checked: { fileName, header, rows } (see setup).
  pendingImport: null,

  // Draw this tab's content inside its panel.
  // "panel" is the <section> element for this tab.
  // "caseObj" is the selected case (never null here: app.js checks first).
  render: function (panel, caseObj) {
    const tab = App.tabs.client;
    const missing = App.devicesWithoutEdr(caseObj);

    let html = '<div class="panel-header"><h2>Client</h2></div>';

    // Devices without EDR: a red banner at the very top so it can't be missed.
    if (missing.length > 0) {
      html += `<div class="alert alert-danger">
                 <strong>⚠ ${missing.length} device${missing.length === 1 ? "" : "s"} without EDR.</strong>
                 See <em>Device lists</em> below.
               </div>`;
    }

    html += tab.orgHtml(caseObj) +
            tab.subscriptionsHtml(caseObj) +
            tab.peopleHtml(caseObj) +
            tab.environmentHtml(caseObj) +
            tab.scopeHtml(caseObj) +
            tab.devicesHtml(caseObj, missing);

    panel.innerHTML = html;
  },

  // ---------------------------------------------------------------
  // Small HTML builders, so each section reads like a list of fields
  // ---------------------------------------------------------------

  // Read a field by path, e.g. "org.industry" -> clientInfo.org.industry.
  // .reduce walks down the keys one by one, like a loop of obj = obj[key].
  get: function (caseObj, path) {
    if (path === "clientName") {
      return caseObj.client;
    }
    return path.split(".").reduce(function (obj, key) { return obj[key]; }, caseObj.clientInfo);
  },

  // A labelled text box that saves to "path" as you type.
  text: function (caseObj, label, path, placeholder) {
    const e = App.escapeHtml;
    return `<label class="client-field">${e(label)}
              <input data-field="${e(path)}" value="${e(App.tabs.client.get(caseObj, path))}"
                     placeholder="${e(placeholder || "")}">
            </label>`;
  },

  // A labelled multi-line box.
  area: function (caseObj, label, path, placeholder) {
    const e = App.escapeHtml;
    return `<label class="client-field">${e(label)}
              <textarea data-field="${e(path)}" rows="2"
                        placeholder="${e(placeholder || "")}">${e(App.tabs.client.get(caseObj, path))}</textarea>
            </label>`;
  },

  // Just the <select> (no label) from a { key, label } list.
  bareSelect: function (caseObj, path, list) {
    const e = App.escapeHtml;
    const current = App.tabs.client.get(caseObj, path);
    const options = list
      .map(function (o) {
        const sel = o.key === current ? " selected" : "";
        return `<option value="${e(o.key)}"${sel}>${e(o.label)}</option>`;
      })
      .join("");
    return `<select data-field="${e(path)}">${options}</select>`;
  },

  // Just the text box (no label).
  bareText: function (caseObj, path, placeholder) {
    const e = App.escapeHtml;
    return `<input data-field="${e(path)}" value="${e(App.tabs.client.get(caseObj, path))}"
                   placeholder="${e(placeholder || "")}">`;
  },

  // ---------------------------------------------------------------
  // Sections
  // ---------------------------------------------------------------

  orgHtml: function (c) {
    const tab = App.tabs.client;
    const zone = c.clientInfo.org.timeZone;
    const sidebarZone = App.state.displayTimeZone;

    // "Use as sidebar time zone": greyed out if no zone is set, or the
    // sidebar already uses it.
    let zoneButton;
    if (zone === "") {
      zoneButton = '<button class="btn btn-small" disabled>Use as sidebar time zone</button>';
    } else if (zone === sidebarZone) {
      zoneButton = '<span class="muted small">✓ The sidebar uses this zone</span>';
    } else {
      zoneButton = `<button class="btn btn-small" data-action="use-zone">Use as sidebar time zone</button>`;
    }

    return `
      <section class="client-section">
        <h3>Organization</h3>
        <div class="client-grid">
          ${tab.text(c, "Client name", "clientName", "Acme Corp")}
          ${tab.text(c, "Industry", "org.industry", "Manufacturing, healthcare, legal...")}
          ${tab.text(c, "Headcount / size", "org.headcount", "~250 staff, 3 sites")}
          <label class="client-field">Primary time zone
            <select data-field="org.timeZone">
              <option value="">Not set</option>
              ${App.time.zoneOptionsHtml(zone)}
            </select>
            <span class="field-action">${zoneButton}</span>
          </label>
        </div>
      </section>
    `;
  },

  // One line per tool:  EDR  [SentinelOne ▾]  [specify...]
  subscriptionsHtml: function (c) {
    const tab = App.tabs.client;
    const s = c.clientInfo.subscriptions;
    const C = App.CLIENT_CHOICES;

    // One row: the tool name, its dropdown, and (if "Other") a specify box.
    function toolRow(label, path, list, otherPath) {
      const specify = tab.get(c, path) === "other" ? tab.bareText(c, otherPath, "Specify vendor / product") : "";
      return `<div class="sub-row">
                <span class="sub-label">${label}</span>
                ${tab.bareSelect(c, path, list)}
                ${specify}
              </div>`;
    }

    // Managed firewall: Yes/No, then the vendor (and specify) if Yes.
    let firewallExtra = "";
    if (s.firewallManaged === "yes") {
      firewallExtra = '<span class="sub-inline-label">Vendor</span>' +
        tab.bareSelect(c, "subscriptions.firewallVendor", C.firewallVendor) +
        (s.firewallVendor === "other" ? tab.bareText(c, "subscriptions.firewallOther", "Specify vendor") : "");
    }

    // IR retainer: Yes/No, then "In Binalyze console?" if Yes.
    let retainerExtra = "";
    if (s.irRetainer === "yes") {
      retainerExtra = '<span class="sub-inline-label">In Binalyze console?</span>' +
        tab.bareSelect(c, "subscriptions.binalyze", C.yesNo);
      if (s.binalyze === "no") {
        retainerExtra += '<span class="tag tag-warning">⚠ not in Binalyze yet</span>';
      }
    }

    return `
      <section class="client-section">
        <h3>Subscriptions</h3>
        ${toolRow("EDR", "subscriptions.edr", C.edr, "subscriptions.edrOther")}
        ${toolRow("SIEM", "subscriptions.siem", C.siem, "subscriptions.siemOther")}
        ${toolRow("RMM", "subscriptions.rmm", C.rmm, "subscriptions.rmmOther")}
        <div class="sub-row">
          <span class="sub-label">Managed firewall</span>
          ${tab.bareSelect(c, "subscriptions.firewallManaged", C.yesNo)}
          ${firewallExtra}
        </div>
        <div class="sub-row">
          <span class="sub-label">IR retainer</span>
          ${tab.bareSelect(c, "subscriptions.irRetainer", C.yesNo)}
          ${retainerExtra}
        </div>
      </section>
    `;
  },

  peopleHtml: function (c) {
    const e = App.escapeHtml;
    const people = c.clientInfo.people;

    // A small dropdown inside a table cell.
    function cellSelect(person, key, list) {
      const options = list
        .map(function (o) {
          const sel = o.key === person[key] ? " selected" : "";
          return `<option value="${e(o.key)}"${sel}>${e(o.label)}</option>`;
        })
        .join("");
      return `<select class="cell-input" data-person="${e(person.id)}" data-key="${key}">${options}</select>`;
    }
    // A small text box inside a table cell.
    function cellText(person, key, placeholder) {
      return `<input class="cell-input" data-person="${e(person.id)}" data-key="${key}"
                     value="${e(person[key])}" placeholder="${e(placeholder)}">`;
    }

    let body;
    if (people.length === 0) {
      body = '<p class="muted">No one added yet.</p>';
    } else {
      const rows = people.map(function (p) {
        // Company only matters for third parties.
        const company = p.side === "third-party"
          ? cellText(p, "company", "Company")
          : '<span class="muted">—</span>';
        return `
          <tr>
            <td>${cellText(p, "name", "Name")}</td>
            <td>${cellSelect(p, "role", App.PERSON_ROLES)}</td>
            <td>${cellSelect(p, "side", App.PERSON_SIDES)}</td>
            <td>${company}</td>
            <td>${cellText(p, "email", "email@example.com")}</td>
            <td>${cellText(p, "phone", "+1 555 0100")}</td>
            <td class="center">
              <input type="checkbox" data-person="${e(p.id)}" data-key="primary"
                     title="Primary contact"${p.primary ? " checked" : ""}>
            </td>
            <td><button class="btn btn-small btn-danger" data-action="remove-person"
                        data-id="${e(p.id)}">Remove</button></td>
          </tr>
        `;
      });
      body = `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Name</th><th>Role</th><th>Managed by</th><th>Company</th>
                  <th>Email</th><th>Phone</th><th>Primary</th><th></th></tr>
            </thead>
            <tbody>${rows.join("")}</tbody>
          </table>
        </div>
      `;
    }

    return `
      <section class="client-section">
        <div class="section-header">
          <h3>Incident response team &amp; contacts</h3>
          <button class="btn btn-small" data-action="add-person">+ Add person</button>
        </div>
        ${body}
      </section>
    `;
  },

  environmentHtml: function (c) {
    const tab = App.tabs.client;
    return `
      <section class="client-section">
        <h3>Environment</h3>
        <div class="client-grid">
          ${tab.area(c, "Identity", "environment.identity", "On-prem AD + Entra ID (hybrid), MFA on VPN only")}
          ${tab.area(c, "Email", "environment.email", "Microsoft 365 E3, Defender for Office")}
          ${tab.area(c, "Backups", "environment.backups", "Veeam to NAS, immutable copy offsite? Last tested?")}
          ${tab.area(c, "Network / VPN", "environment.network", "FortiGate VPN, flat network, 3 sites")}
          ${tab.area(c, "Cloud", "environment.cloud", "Azure (1 subscription), no AWS")}
          ${tab.area(c, "OS mix", "environment.os", "Windows 10/11, Server 2019, a few Linux")}
          ${tab.area(c, "Other", "environment.other", "Anything else worth knowing")}
        </div>
      </section>
    `;
  },

  scopeHtml: function (c) {
    const tab = App.tabs.client;
    return `
      <section class="client-section">
        <h3>Scope</h3>
        <div class="client-grid">
          ${tab.area(c, "In scope", "scope.inScope", "All Windows endpoints and M365 tenant")}
          ${tab.area(c, "Out of scope", "scope.outOfScope", "OT network, third-party hosted ERP")}
          ${tab.area(c, "Authorization / SOW notes", "scope.authorization", "Approved by CIO on call 2026-09-20")}
        </div>
      </section>
    `;
  },

  // Device lists: a link to each CSV on disk (EDR, RMM, SIEM), plus the
  // RMM check for "EDR: not installed", plus the manual no-EDR list.
  devicesHtml: function (c, missing) {
    const tab = App.tabs.client;
    const e = App.escapeHtml;
    const d = c.clientInfo.devices;
    const zone = App.state.displayTimeZone;

    // Vendor names from Subscriptions, e.g. "EDR (SentinelOne)".
    const subs = c.clientInfo.subscriptions;
    function vendorName(key) {
      if (subs[key] === "other") { return subs[key + "Other"]; }
      if (subs[key] === "") { return ""; }
      return App.labelFor(App.CLIENT_CHOICES[key], subs[key]);
    }

    const cards = App.DEVICE_SOURCES.map(function (src) {
      const v = vendorName(src.key);
      const path = d.paths[src.key];
      const url = App.pathToFileUrl(path);

      // Open / Copy path buttons, once a full path is pasted.
      let links = "";
      if (url) {
        links = `<div class="device-card-buttons">
                   <a class="btn btn-small" href="${e(url)}" target="_blank"
                      title="Opens in the browser; use Copy path to open it in Excel">Open</a>
                   <button class="btn btn-small" data-action="copy-path" data-source="${src.key}">Copy path</button>
                 </div>`;
      } else if (path.trim() !== "") {
        links = '<p class="error small">Not a full path. It should start with C:\\ or \\\\server\\</p>';
      }

      // RMM only: the "EDR: not installed" check.
      let rmm = "";
      if (src.key === "rmm") {
        const check = d.rmmCheck;
        if (check === null) {
          rmm = `<div class="rmm-check">
                   <button class="btn btn-small btn-primary" data-action="check-rmm">Check RMM CSV for missing EDR</button>
                   <p class="muted small">Reads the CSV's "EDR" column and lists devices marked "not installed".</p>
                 </div>`;
        } else {
          const shown = App.time.display(check.checkedAt, zone);
          rmm = `<div class="rmm-check">
                   <div class="device-count${check.noEdr.length ? " text-danger" : ""}">
                     ${check.noEdr.length} of ${check.total} without EDR
                   </div>
                   <p class="muted small">
                     ${e(check.fileName)} · columns "${e(check.hostColumn)}" / "${e(check.edrColumn)}"<br>
                     checked ${e(shown.date + " " + shown.clock + " " + shown.zoneLabel)}
                   </p>
                   <div class="device-card-buttons">
                     <button class="btn btn-small" data-action="check-rmm">Check again</button>
                     <button class="btn btn-small btn-danger" data-action="clear-rmm">Clear</button>
                   </div>
                 </div>`;
        }
      }

      return `
        <div class="device-card">
          <div class="device-card-head"><strong>${src.label}</strong>${v ? ` <span class="muted">(${e(v)})</span>` : ""}</div>
          <label class="client-field">Path to CSV
            <input data-field="devices.paths.${src.key}" class="mono" value="${e(path)}"
                   placeholder="C:\\IR-Cases\\${e(c.id)}\\${src.key}_devices.csv">
          </label>
          ${links}
          ${rmm}
        </div>
      `;
    });

    // Coverage result.
    let coverage;
    if (missing.length > 0) {
      const items = missing
        .map(function (m) {
          const where = m.seenIn.map(function (w) { return `<span class="tag tag-type">${e(w)}</span>`; }).join(" ");
          return `<li><strong>${e(m.name)}</strong> ${where}</li>`;
        })
        .join("");
      coverage = `<div class="alert alert-danger">
                    <strong>⚠ ${missing.length} device${missing.length === 1 ? "" : "s"} without EDR</strong>
                    <ul class="no-edr-list">${items}</ul>
                  </div>`;
    } else if (d.rmmCheck) {
      coverage = '<div class="alert alert-ok">✓ The RMM export shows EDR installed on every device.</div>';
    } else {
      coverage = '<p class="muted small">Check the RMM CSV (above) or add devices by hand (below) ' +
                 'to track devices without EDR.</p>';
    }

    return `
      <section class="client-section">
        <h3>Device lists</h3>
        <p class="muted small">Paste each file's path (in File Explorer: Shift + right-click the file →
          <em>Copy as path</em>). To open a CSV in Excel: Copy path, then Win + R, paste, Enter.</p>
        <div class="device-cards">${cards.join("")}</div>
        ${coverage}
        <label class="client-field">Other devices known to have NO EDR (one per line)
          <textarea data-field="devices.manualNoEdr" rows="3" class="mono"
                    placeholder="ACME-OLD-XP01&#10;ACME-KIOSK02">${e(d.manualNoEdr)}</textarea>
        </label>
      </section>
    `;
  },

  // ---------------------------------------------------------------
  // Guessing CSV columns
  // ---------------------------------------------------------------

  // Header names are compared lowercase with spaces/symbols removed,
  // so "Machine ID", "machine_id" and "MachineID" all match.
  HOST_COLUMNS: ["hostname", "host", "computername", "computer", "endpointname", "endpoint",
                 "devicename", "device", "machinename", "machineid", "machine", "agentname",
                 "dnsname", "displayname", "name"],

  cleanHeader: function (header) {
    return header.map(function (h) { return h.toLowerCase().replace(/[^a-z0-9]/g, ""); });
  },

  // The best-guess device-name column.
  guessHostColumn: function (header) {
    const clean = App.tabs.client.cleanHeader(header);
    for (const wanted of App.tabs.client.HOST_COLUMNS) {
      const i = clean.indexOf(wanted);              // like Python's list.index(), but -1 if missing
      if (i !== -1) {
        return i;
      }
    }
    // Otherwise, anything with "name" or "host" in it, else the first column.
    const loose = clean.findIndex(function (h) { return h.includes("name") || h.includes("host"); });
    return loose !== -1 ? loose : 0;
  },

  // The column named "EDR" (or, failing that, containing "edr").
  // Returns -1 if there's none.
  guessEdrColumn: function (header) {
    const clean = App.tabs.client.cleanHeader(header);
    const exact = clean.indexOf("edr");
    return exact !== -1 ? exact : clean.findIndex(function (h) { return h.includes("edr"); });
  },

  // ---------------------------------------------------------------
  // Setup: the 3 delegated listeners, plus the RMM check pop-up
  // ---------------------------------------------------------------

  setup: function () {
    const tab = App.tabs.client;
    const panel = document.getElementById("client");
    const fileInput = document.getElementById("device-file-input");
    const dialog = document.getElementById("device-dialog");
    const form = document.getElementById("device-form");

    // 1. TYPING: save text as you type. No redraw, so you keep your place.
    panel.addEventListener("input", function (event) {
      const t = event.target;
      const caseId = App.state.selectedCaseId;
      if (t.dataset.field && t.tagName !== "SELECT") {
        App.setClientField(caseId, t.dataset.field, t.value);
        if (t.dataset.field === "clientName") {
          App.renderChrome();                     // sidebar + header show the name
        }
      } else if (t.dataset.person && t.type !== "checkbox" && t.tagName !== "SELECT") {
        App.updatePerson(caseId, t.dataset.person, t.dataset.key, t.value);
      }
    });

    // 2. CHOOSING: dropdowns and tick boxes save, then redraw (they can
    //    show or hide other fields). A few text boxes also redraw when
    //    you leave them: file paths (to show the Open link) and the
    //    manual "no EDR" list (to update the warnings).
    panel.addEventListener("change", function (event) {
      const t = event.target;
      const caseId = App.state.selectedCaseId;
      const field = t.dataset.field || "";
      if (field && t.tagName === "SELECT") {
        App.setClientField(caseId, field, t.value);
        App.render();
      } else if (field.startsWith("devices.paths.")) {
        App.setClientField(caseId, field, App.cleanPath(t.value));   // drop the quotes
        App.render();
      } else if (field === "devices.manualNoEdr") {
        App.render();
      } else if (t.dataset.person && (t.tagName === "SELECT" || t.type === "checkbox")) {
        const value = t.type === "checkbox" ? t.checked : t.value;
        // Only one primary contact: ticking one unticks the others.
        if (t.dataset.key === "primary" && value) {
          for (const p of App.getSelectedCase().clientInfo.people) {
            App.updatePerson(caseId, p.id, "primary", false);
          }
        }
        App.updatePerson(caseId, t.dataset.person, t.dataset.key, value);
        App.render();
      }
    });

    // 3. BUTTONS: each has data-action="...". closest() finds the
    //    button even if you click on text inside it.
    panel.addEventListener("click", async function (event) {
      const button = event.target.closest("[data-action]");
      if (!button) {
        return;
      }
      const caseObj = App.getSelectedCase();
      const action = button.dataset.action;

      if (action === "add-person") {
        App.addPerson(caseObj.id);
        App.render();
      } else if (action === "remove-person") {
        if (confirm("Remove this person?")) {
          App.deletePerson(caseObj.id, button.dataset.id);
          App.render();
        }
      } else if (action === "use-zone") {
        // Same as picking it in the sidebar: save the setting, redraw.
        App.state.displayTimeZone = caseObj.clientInfo.org.timeZone;
        App.saveSettings();
        document.getElementById("display-zone").value = App.state.displayTimeZone;
        App.render();
      } else if (action === "copy-path") {
        const path = App.cleanPath(caseObj.clientInfo.devices.paths[button.dataset.source]);
        const ok = await App.copyText(path);
        App.flashButton(button, ok ? "Copied!" : "Copy failed");
      } else if (action === "check-rmm") {
        fileInput.value = "";                   // so picking the same file again still fires
        fileInput.click();                      // opens the file picker
      } else if (action === "clear-rmm") {
        if (confirm("Clear the RMM check result?")) {
          App.clearRmmCheck(caseObj.id);
          App.render();
        }
      }
    });

    // The RMM CSV was picked: read it and open the check pop-up.
    fileInput.addEventListener("change", async function () {
      const file = fileInput.files[0];
      if (!file) {
        return;
      }
      // file.text() reads the whole file as text, like Python's
      // open(path).read(). Nothing is uploaded or copied anywhere.
      const rows = App.parseCsv(await file.text());
      const e = App.escapeHtml;
      document.getElementById("device-error").textContent = "";
      document.getElementById("device-dialog-summary").textContent = file.name;

      if (rows.length < 2) {
        tab.pendingImport = null;
        document.getElementById("device-host-column").innerHTML = "";
        document.getElementById("device-edr-column").innerHTML = "";
        document.getElementById("device-preview-title").textContent = "";
        document.getElementById("device-preview").textContent = "";
        document.getElementById("device-error").textContent =
          "This file needs a header row and at least one device.";
        dialog.showModal();
        return;
      }

      const header = rows[0];
      tab.pendingImport = { fileName: file.name, header: header, rows: rows.slice(1) };   // slice(1) = rows[1:]
      document.getElementById("device-dialog-summary").textContent =
        file.name + " · " + (rows.length - 1) + " devices";

      // Both dropdowns list every column; the best guesses are pre-selected.
      function columnOptions(selected) {
        return header
          .map(function (h, i) {
            return `<option value="${i}"${i === selected ? " selected" : ""}>${e(h || "(column " + (i + 1) + ")")}</option>`;
          })
          .join("");
      }
      const edrCol = tab.guessEdrColumn(header);
      document.getElementById("device-host-column").innerHTML = columnOptions(tab.guessHostColumn(header));
      document.getElementById("device-edr-column").innerHTML = columnOptions(edrCol);
      if (edrCol === -1) {
        document.getElementById("device-error").textContent =
          'No column named "EDR" was found. Pick the column that shows the EDR status.';
      }
      tab.updateDevicePreview();
      dialog.showModal();
    });

    document.getElementById("device-host-column").addEventListener("change", tab.updateDevicePreview);
    document.getElementById("device-edr-column").addEventListener("change", tab.updateDevicePreview);

    document.getElementById("device-cancel").addEventListener("click", function () {
      dialog.close();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const imp = tab.pendingImport;
      if (imp === null) {
        return;
      }
      const hostCol = Number(form.elements["hostColumn"].value);   // "2" -> 2, like int()
      const edrCol = Number(form.elements["edrColumn"].value);
      App.setRmmCheck(App.state.selectedCaseId, {
        fileName: imp.fileName,
        hostColumn: imp.header[hostCol],
        edrColumn: imp.header[edrCol],
        total: imp.rows.length,
        noEdr: App.findNoEdrInRmm(imp.rows, hostCol, edrCol)
      });
      tab.pendingImport = null;
      dialog.close();
      App.render();
    });
  },

  // Preview: which devices will be listed as "EDR not installed".
  updateDevicePreview: function () {
    const imp = App.tabs.client.pendingImport;
    if (imp === null) {
      return;
    }
    const hostCol = Number(document.getElementById("device-host-column").value);
    const edrCol = Number(document.getElementById("device-edr-column").value);
    const found = App.findNoEdrInRmm(imp.rows, hostCol, edrCol);
    document.getElementById("device-preview-title").textContent =
      found.length + " device" + (found.length === 1 ? "" : "s") + ' with EDR "not installed":';
    document.getElementById("device-preview").textContent =
      found.length ? found.join("\n") : "(none)";
  }
};
