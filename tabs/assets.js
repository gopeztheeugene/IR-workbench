// assets.js - the Assets tab: affected hosts and accounts.
// Rule: this file never calls other tabs. It only reads App.state
// and draws its own panel. It changes data only through the
// helpers in state.js (App.addAsset, App.updateAsset, App.deleteAsset).
//
// Assets get here two ways:
//   1. Automatically, when evidence is saved with
//      "Add host / account to Assets as affected" ticked.
//   2. By hand, with the "+ Add asset" button.

App.tabs.assets = {
  // Which asset the pop-up is editing ("AS-001"), or null when adding.
  editingId: null,

  // Draw this tab's content inside its panel.
  // "panel" is the <section> element for this tab.
  // "caseObj" is the selected case (never null here: app.js checks first).
  render: function (panel, caseObj) {
    const e = App.escapeHtml;
    const items = caseObj.assets;

    let html = `
      <div class="panel-header">
        <h2>Affected assets <span class="muted">(${items.length})</span></h2>
        <button class="btn btn-primary" id="asset-add-btn">+ Add asset</button>
      </div>
    `;

    if (items.length === 0) {
      html += '<p class="muted">No affected assets yet. Tick "Add host / account to Assets" ' +
              'on an evidence item, or add one here.</p>';
    } else {
      const rows = items.map(function (a) {
        // Linked evidence as small tags, or "none".
        let evidenceTags = a.evidenceIds
          .map(function (id) { return `<span class="tag tag-type">${e(id)}</span>`; })
          .join(" ");
        if (evidenceTags === "") {
          evidenceTags = '<span class="muted">none</span>';
        }

        return `
          <tr>
            <td class="nowrap"><strong>${e(a.id)}</strong></td>
            <td>${e(a.name)}${App.assetLacksEdr(caseObj, a)
              ? ' <span class="tag tag-warning" title="Not in the EDR device list (Client tab)">no EDR</span>'
              : ""}</td>
            <td>${e(App.assetTypeLabel(a.type))}</td>
            <td class="nowrap">
              <span class="tag asset-${e(a.status)}">${e(App.assetStatusLabel(a.status))}</span>
            </td>
            <td>${evidenceTags}</td>
            <td class="notes">${e(a.notes)}</td>
            <td class="nowrap">
              <button class="btn btn-small" data-edit="${e(a.id)}">Edit</button>
              <button class="btn btn-small btn-danger" data-remove="${e(a.id)}">Remove</button>
            </td>
          </tr>
        `;
      });

      html += `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th><th>Name</th><th>Type</th><th>Status</th>
                <th>Linked evidence</th><th>Notes</th><th></th>
              </tr>
            </thead>
            <tbody>${rows.join("")}</tbody>
          </table>
        </div>
      `;
    }

    panel.innerHTML = html;

    // Buttons (the HTML was just replaced, so attach new handlers).
    document.getElementById("asset-add-btn").addEventListener("click", function () {
      App.tabs.assets.openForm(null);
    });
    for (const button of panel.querySelectorAll("[data-edit]")) {
      button.addEventListener("click", function () {
        App.tabs.assets.openForm(button.dataset.edit);
      });
    }
    for (const button of panel.querySelectorAll("[data-remove]")) {
      button.addEventListener("click", function () {
        const assetId = button.dataset.remove;
        if (confirm("Remove " + assetId + " from Assets? Evidence entries are not changed.")) {
          App.deleteAsset(caseObj.id, assetId);
          App.render();
        }
      });
    }
  },

  // Runs once at startup: fill the dropdowns and wire up the pop-up.
  setup: function () {
    const tab = App.tabs.assets;
    const dialog = document.getElementById("asset-dialog");
    const form = document.getElementById("asset-form");
    const errorBox = document.getElementById("asset-error");
    const e = App.escapeHtml;

    // Build <option> tags from a { key, label } list.
    function optionsHtml(list) {
      return list
        .map(function (item) {
          return `<option value="${e(item.key)}">${e(item.label)}</option>`;
        })
        .join("");
    }
    document.getElementById("asset-type").innerHTML = optionsHtml(App.ASSET_TYPES);
    document.getElementById("asset-status").innerHTML = optionsHtml(App.ASSET_STATUSES);

    document.getElementById("asset-cancel").addEventListener("click", function () {
      dialog.close();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const caseId = App.state.selectedCaseId;
      const data = new FormData(form);
      const assetData = {
        name: data.get("name"),
        type: data.get("type"),
        status: data.get("status"),
        notes: data.get("notes")
      };

      let error;
      if (tab.editingId === null) {
        error = App.addAsset(caseId, assetData);
      } else {
        error = App.updateAsset(caseId, tab.editingId, assetData);
      }

      if (error) {
        errorBox.textContent = error;
        return;
      }
      dialog.close();
      App.render();
    });
  },

  // openForm(null) = add a new asset; openForm("AS-001") = edit it.
  openForm: function (assetId) {
    const tab = App.tabs.assets;
    const form = document.getElementById("asset-form");
    const title = document.getElementById("asset-dialog-title");
    const hint = document.getElementById("asset-dialog-hint");
    const submit = document.getElementById("asset-submit");

    form.reset();
    document.getElementById("asset-error").textContent = "";

    const asset = assetId ? App.findAsset(App.state.selectedCaseId, assetId) : null;
    if (asset === null) {
      tab.editingId = null;
      title.textContent = "Add asset";
      hint.textContent = "The ID (AS-001, AS-002, ...) is assigned automatically.";
      submit.textContent = "Add asset";
    } else {
      tab.editingId = asset.id;
      title.textContent = "Edit " + asset.id;
      hint.textContent = "Linked evidence is managed from the Evidence tab.";
      submit.textContent = "Save changes";
      form.elements["name"].value = asset.name;
      form.elements["type"].value = asset.type;
      form.elements["status"].value = asset.status;
      form.elements["notes"].value = asset.notes;
    }

    document.getElementById("asset-dialog").showModal();
  }
};
