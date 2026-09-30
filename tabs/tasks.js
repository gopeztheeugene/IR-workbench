// tasks.js - the Action Items tab (key "tasks"): every action for the case
// in one list: containment and recovery actions, and ad-hoc action items.
// Rule: this file never calls other tabs. It changes data only through
// App.addTask / App.updateTask (state.js). The add / edit pop-up and the
// status dropdown logic are shared with the Containment Strategy, so they
// live in core/taskform.js (App.taskForm).
//
// "Closing" an item = setting it to Done (done time recorded) or Not
// needed (reason required). Closed items stay in the case, for the record
// and the report, and can be reopened.

App.tabs.tasks = {
  // View filters (not saved; reset on refresh).
  // host: a target name (host / account) or "all".
  filters: { view: "open", kind: "all", owner: "all", host: "all" },

  // Display order of the status groups: most urgent first, closed last.
  GROUP_ORDER: ["blocked", "in-progress", "approved", "planned", "done", "not-needed"],

  render: function (panel, caseObj) {
    const tab = App.tabs.tasks;
    const e = App.escapeHtml;
    const f = tab.filters;
    const openCount = caseObj.tasks.filter(App.taskIsOpen).length;
    const clientOpen = caseObj.tasks.filter(function (t) { return App.taskIsOpen(t) && t.owner === "client"; }).length;

    // Small labelled dropdown for the filter bar.
    function filterSelect(label, name, current, options) {
      return `<label class="filter-label">${e(label)}<select data-filter="${name}">` + options.map(function (o) {
        return `<option value="${e(o.key)}"${o.key === current ? " selected" : ""}>${e(o.label)}</option>`;
      }).join("") + "</select></label>";
    }

    // Host filter choices: the hosts / accounts named in this case's items.
    // A host picked in another case that isn't here goes back to "All".
    const hosts = tab.hostChoices(caseObj);
    if (f.host !== "all" && !hosts.includes(f.host)) {
      f.host = "all";
    }
    const shownItems = tab.shownItems(caseObj);

    let html = `
      <div class="panel-header">
        <h2>Action Items <span class="muted">(${openCount} open of ${caseObj.tasks.length})</span></h2>
        <div class="header-buttons">
          <button class="btn btn-primary" data-action="add">+ Add action item</button>
        </div>
      </div>
      ${tab.readinessHtml(caseObj)}

      <!-- Quick add: type and press Enter (an ad-hoc action item, P3, owner Me) -->
      <form class="quick-add" id="task-quick-form">
        <input id="task-quick" placeholder="Quick add: type an action item and press Enter" autocomplete="off">
      </form>

      <div class="filter-bar">
        ${filterSelect("Status", "view", f.view, [
          { key: "all", label: "All" }, { key: "open", label: "Open" }, { key: "closed", label: "Closed" }])}
        ${filterSelect("Action Type", "kind", f.kind, [{ key: "all", label: "All" }].concat(App.TASK_KINDS))}
        ${filterSelect("Item Owner", "owner", f.owner, [{ key: "all", label: "All" }].concat(App.TASK_OWNERS))}
        ${filterSelect("Host", "host", f.host, [{ key: "all", label: "All" }].concat(
          hosts.map(function (h) { return { key: h, label: h }; })))}
        <span class="spacer"></span>
        <!-- Copy / export buttons, together at the right end -->
        <button class="btn btn-small" data-action="copy-shown" ${shownItems.length ? "" : "disabled"}
                title="The items shown below (with these filters) as a numbered list">Copy shown items (${shownItems.length})</button>
        <button class="btn btn-small" data-action="copy-client" ${clientOpen ? "" : "disabled"}
                title="The client's open items as a numbered list, for an email or Teams (ignores the filters)">Copy client action items</button>
        <button class="btn btn-small" data-action="export" ${caseObj.tasks.length ? "" : "disabled"}
                title="Every action item in the case, whatever the filters show">Export CSV</button>
      </div>
    `;

    const shown = shownItems;
    if (shown.length === 0) {
      html += caseObj.tasks.length === 0
        ? '<p class="muted">No action items yet. Quick-add one above, or use "+ Add action item".</p>'
        : '<p class="muted">Nothing matches these filters.</p>';
      panel.innerHTML = html;
      return;
    }

    // Group by status (in GROUP_ORDER). shownItems is already in that
    // order, sorted by priority then due time inside each group.
    const rows = [];
    for (const status of tab.GROUP_ORDER) {
      const group = shown.filter(function (t) { return t.status === status; });
      if (group.length === 0) {
        continue;
      }
      rows.push(`<tr class="group-row"><td colspan="7">${e(App.labelFor(App.TASK_STATUSES, status))}
                   <span class="muted">(${group.length})</span></td></tr>`);
      for (const t of group) {
        rows.push(tab.rowHtml(caseObj, t));
      }
    }

    html += `
      <div class="table-wrap">
        <table class="data-table task-table">
          <thead>
            <tr><th>ID</th><th>Priority</th><th>Action</th><th>Owner</th><th>Due</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      </div>
    `;
    panel.innerHTML = html;
  },

  // The hosts / accounts named as targets in this case's items, A-Z.
  // IOC targets are left out: everything on an IOC-type action (firewall
  // deny, sinkhole, block IOCs), and any value that's in the IOCs tab.
  hostChoices: function (caseObj) {
    const iocValues = caseObj.iocs.map(function (i) { return i.value.toLowerCase(); });
    const names = [];
    for (const t of caseObj.tasks) {
      const action = App.CONTAINMENT_ACTIONS.find(function (a) { return a.key === t.actionType; });
      if (action && action.targets === "iocs") {
        continue;                   // like Python's "continue": skip this item
      }
      for (const target of t.targets) {
        if (!iocValues.includes(target.toLowerCase()) && !names.includes(target)) {
          names.push(target);
        }
      }
    }
    // localeCompare = alphabetical, like Python's sorted(names, key=str.lower)
    return names.sort(function (a, b) { return a.localeCompare(b, undefined, { sensitivity: "base" }); });
  },

  // The items the filters let through, in display order: status group
  // (GROUP_ORDER), then priority, then due time. Used by the table AND
  // by "Copy shown items", so the copy always matches the screen.
  shownItems: function (caseObj) {
    const tab = App.tabs.tasks;
    const f = tab.filters;
    const passed = caseObj.tasks.filter(function (t) {
      const open = App.taskIsOpen(t);
      if (f.view === "open" && !open) { return false; }
      if (f.view === "closed" && open) { return false; }
      if (f.kind !== "all" && t.kind !== f.kind) { return false; }
      if (f.owner !== "all" && t.owner !== f.owner) { return false; }
      if (f.host !== "all" && !t.targets.includes(f.host)) { return false; }
      return true;
    });
    const compare = tab.comparator(caseObj);
    let ordered = [];
    for (const status of tab.GROUP_ORDER) {
      ordered = ordered.concat(passed.filter(function (t) { return t.status === status; }).sort(compare));
    }
    return ordered;
  },

  // The shown items as a numbered list for an email, Teams, or notes:
  //   Action items – INC-2041 (Open · Host: ACME-FS01) as of 2026-09-30 14:00 UTC
  //   1. TK-009 [P1] Confirm last good restore point – Client Owned: Dana – due ... (ACME-FS01) – In progress
  shownItemsText: function (caseObj) {
    const tab = App.tabs.tasks;
    const f = tab.filters;
    const when = App.taskForm.when;
    // Describe the filters in use, e.g. "Open · Containment · Host: ACME-FS01".
    const used = [f.view === "all" ? "All statuses" : (f.view === "open" ? "Open" : "Closed")];
    if (f.kind !== "all") { used.push(App.labelFor(App.TASK_KINDS, f.kind)); }
    if (f.owner !== "all") { used.push("Owner: " + App.labelFor(App.TASK_OWNERS, f.owner)); }
    if (f.host !== "all") { used.push("Host: " + f.host); }

    const lines = ["Action items – " + caseObj.id + " (" + used.join(" · ") + ") as of " + when(App.time.nowUtc())];
    tab.shownItems(caseObj).forEach(function (t, i) {
      const due = App.taskDue(caseObj, t).due;
      let line = (i + 1) + ". " + t.id + " [" + t.priority.toUpperCase() + "] " + t.title;
      line += " – " + App.labelFor(App.TASK_OWNERS, t.owner) + (t.ownerName ? ": " + t.ownerName : "");
      if (due && App.taskIsOpen(t)) { line += " – due " + when(due); }
      if (t.targets.length) { line += " (" + t.targets.join(", ") + ")"; }
      line += " – " + App.labelFor(App.TASK_STATUSES, t.status);
      if (t.statusReason && (t.status === "blocked" || t.status === "not-needed")) {
        line += " [" + (t.status === "blocked" ? "waiting on: " : "not needed: ") + t.statusReason + "]";
      }
      lines.push(line);
    });
    return lines.join("\n");
  },

  // Banner when containment is in play: warns while evidence preservation
  // items are still open (preserve BEFORE containing), and shows the
  // containment window (Summary and Reports -> Containment Strategy).
  readinessHtml: function (caseObj) {
    const e = App.escapeHtml;
    const openContainment = caseObj.tasks.filter(function (t) {
      return t.kind === "containment" && App.taskIsOpen(t);
    }).length;
    if (openContainment === 0) {
      return "";
    }
    const windowStart = caseObj.summary.containment.windowStart;
    const windowText = windowStart
      ? "Containment window: " + App.taskForm.when(windowStart)
      : "No containment window set";
    const pres = App.preservationProgress(caseObj);
    if (pres.open === 0) {
      return `<div class="alert alert-ok">${openContainment} open containment action${openContainment === 1 ? "" : "s"} · ${e(windowText)}</div>`;
    }
    return `<div class="alert alert-warning">
              ⚠ ${openContainment} open containment action${openContainment === 1 ? "" : "s"}, but
              ${pres.open} evidence preservation item${pres.open === 1 ? " is" : "s are"} still open: preserve before containing.
              · ${e(windowText)}
              <span class="muted small">(Summary and Reports → Containment Strategy)</span>
            </div>`;
  },

  // Sort: priority (p1 first), then due time (items without one last).
  // Uses each item's effective due time (own, or the containment window).
  comparator: function (caseObj) {
    return function (a, b) {
      if (a.priority !== b.priority) {
        return a.priority.localeCompare(b.priority);        // "p1" < "p2" < ...
      }
      const da = App.taskDue(caseObj, a).due;
      const db = App.taskDue(caseObj, b).due;
      if (da === "" && db === "") { return 0; }
      if (da === "") { return 1; }
      if (db === "") { return -1; }
      return da.localeCompare(db);
    };
  },

  // One table row.
  rowHtml: function (caseObj, t) {
    const e = App.escapeHtml;
    const tf = App.taskForm;
    const open = App.taskIsOpen(t);

    // Tags under the title: kind (with the action's hint on hover), targets, approval.
    const tags = [];
    if (t.kind !== "task") {
      const action = App.CONTAINMENT_ACTIONS.find(function (a) { return a.key === t.actionType; });
      const title = action && action.hint ? ` title="Before you do this: ${e(action.hint)}"` : "";
      tags.push(`<span class="tag kind-${e(t.kind)}"${title}>${e(App.labelFor(App.TASK_KINDS, t.kind))}${action && action.hint ? " 💡" : ""}</span>`);
    }
    // Created automatically when the asset was added; the notes say what to collect.
    if (App.isPreservationTask(t)) {
      tags.push(`<span class="tag kind-preserve" title="${e(t.notes)}">Evidence preservation (auto) 💡</span>`);
    }
    for (const target of t.targets) {
      tags.push(`<span class="tag tag-type">${e(target)}</span>`);
    }
    const approval = tf.approvalHtml(t);
    if (approval) {
      tags.push(approval);
    }

    // Status line under the title: blocked / not needed reason, done info.
    let statusLine = "";
    if (t.statusReason && (t.status === "blocked" || t.status === "not-needed")) {
      statusLine = `<div class="task-reason">${t.status === "blocked" ? "Waiting on: " : "Not needed: "}${e(t.statusReason)}</div>`;
    } else if (t.status === "done") {
      statusLine = `<div class="task-done">✔ Done ${e(tf.when(t.doneAt))}${t.doneBy ? " by " + e(t.doneBy) : ""}</div>`;
    }

    const owner = App.labelFor(App.TASK_OWNERS, t.owner) + (t.ownerName ? ": " + t.ownerName : "");

    return `
      <tr class="${open ? "" : "task-closed"}">
        <td class="nowrap"><strong>${e(t.id)}</strong></td>
        <td class="nowrap"><span class="tag prio-${e(t.priority)}">${e(t.priority.toUpperCase())}</span></td>
        <td class="task-title">
          ${e(t.title)}
          ${tags.length ? `<div class="task-tags">${tags.join(" ")}</div>` : ""}
          ${statusLine}
          ${t.notes ? `<div class="task-notes">${e(t.notes)}</div>` : ""}
        </td>
        <td class="nowrap">${e(owner)}</td>
        <td class="nowrap">${tf.dueHtml(caseObj, t)}</td>
        <td>${tf.statusSelectHtml(t)}</td>
        <td class="nowrap"><button class="btn btn-small" data-action="edit" data-id="${e(t.id)}">Edit</button></td>
      </tr>
    `;
  },

  // ---------------------------------------------------------------
  // Setup: delegated listeners on the panel
  // ---------------------------------------------------------------

  setup: function () {
    const tab = App.tabs.tasks;
    const panel = document.getElementById("tasks");

    // Buttons.
    panel.addEventListener("click", async function (event) {
      const button = event.target.closest("[data-action]");
      if (!button) {
        return;
      }
      const caseObj = App.getSelectedCase();
      const action = button.dataset.action;
      if (action === "add") {
        App.taskForm.open(null);
      } else if (action === "edit") {
        App.taskForm.open(button.dataset.id);
      } else if (action === "copy-client") {
        const ok = await App.copyText(tab.clientItemsText(caseObj));
        App.flashButton(button, ok ? "Copied!" : "Copy failed");
      } else if (action === "copy-shown") {
        const ok = await App.copyText(tab.shownItemsText(caseObj));
        App.flashButton(button, ok ? "Copied!" : "Copy failed");
      } else if (action === "export") {
        tab.exportCsv(caseObj, button);
      }
    });

    // Filters and the per-row status dropdown.
    panel.addEventListener("change", function (event) {
      const t = event.target;
      if (t.dataset.filter) {
        tab.filters[t.dataset.filter] = t.value;
        App.render();
      } else if (t.dataset.status) {
        App.taskForm.changeStatus(App.getSelectedCase(), t.dataset.status, t.value);
      }
    });

    // Quick add: Enter adds an ad-hoc item (P3, owner Me, Planned).
    panel.addEventListener("submit", function (event) {
      if (event.target.id !== "task-quick-form") {
        return;
      }
      event.preventDefault();
      const input = document.getElementById("task-quick");
      if (input.value.trim() === "") {
        return;
      }
      App.addTask(App.state.selectedCaseId, { kind: "task", title: input.value, priority: "p3", owner: "me" });
      App.render();
      document.getElementById("task-quick").focus();     // ready for the next one
    });
  },

  // ---------------------------------------------------------------
  // Copy / export
  // ---------------------------------------------------------------

  // The client's open items as a numbered list for an email or Teams:
  //   Client action items – INC-2041 (as of 2026-09-30 14:00 UTC)
  //   1. [P1] Confirm last good restore point – due 2026-09-30 20:00 UTC (ACME-FS01)
  clientItemsText: function (caseObj) {
    const when = App.taskForm.when;
    const items = caseObj.tasks
      .filter(function (t) { return App.taskIsOpen(t) && t.owner === "client"; })
      .sort(App.tabs.tasks.comparator(caseObj));
    const lines = ["Client action items – " + caseObj.id + " (as of " + when(App.time.nowUtc()) + ")"];
    items.forEach(function (t, i) {
      const due = App.taskDue(caseObj, t).due;
      let line = (i + 1) + ". [" + t.priority.toUpperCase() + "] " + t.title;
      if (t.ownerName) { line += " – " + t.ownerName; }
      if (due) { line += " – due " + when(due); }
      if (t.targets.length) { line += " (" + t.targets.join(", ") + ")"; }
      if (t.status === "blocked" && t.statusReason) { line += " [waiting on: " + t.statusReason + "]"; }
      lines.push(line);
    });
    return lines.join("\n");
  },

  exportCsv: async function (caseObj, button) {
    const header = ["Case ID", "ID", "Action type", "Containment action", "Action", "Targets", "Priority", "Owner", "Owner name",
                    "Due (UTC)", "Due from containment window", "Status", "Status reason", "Approved by",
                    "Approved at (UTC)", "Approval method", "Done by", "Done at (UTC)", "Notes", "Created (UTC)"];
    const u = function (text) { return (text || "").replace("T", " "); };
    const rows = caseObj.tasks.map(function (t) {
      const d = App.taskDue(caseObj, t);
      return [caseObj.id, t.id, App.labelFor(App.TASK_KINDS, t.kind),
              t.actionType ? App.labelFor(App.CONTAINMENT_ACTIONS, t.actionType) : "", t.title, t.targets.join("; "),
              App.labelFor(App.TASK_PRIORITIES, t.priority), App.labelFor(App.TASK_OWNERS, t.owner), t.ownerName,
              u(d.due), d.fromWindow ? "yes" : "", App.labelFor(App.TASK_STATUSES, t.status), t.statusReason,
              t.approval.by, u(t.approval.at), App.labelFor(App.APPROVAL_METHODS, t.approval.method),
              t.doneBy, u(t.doneAt), t.notes, u(t.createdAt)];
    });
    const result = await App.storage.saveExport(caseObj, App.safeFileName(caseObj.id) + "_action_items.csv",
                                                App.buildCsv(header, rows));
    if (button) {
      App.flashButton(button, result.saved ? "Saved to exports/" : "Downloaded");
    }
  }
};
