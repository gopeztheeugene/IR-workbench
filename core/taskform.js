// taskform.js - the add / edit action item pop-up, plus small display
// helpers, SHARED by the Action Items tab and the Containment Strategy
// (Summary and Reports). It lives in core/ so the two tabs can both use
// it without calling each other.
//
//   App.taskForm.open(null)                                  add an item
//   App.taskForm.open("TK-004")                              edit TK-004
//   App.taskForm.open(null, { preset: { kind: "containment", actionType: "isolate-edr" } })
//   App.taskForm.changeStatus(caseObj, "TK-004", "done")     status from a dropdown

App.taskForm = {
  editingId: null,    // item being edited ("TK-004"), or null when adding
  editTargets: [],    // the target chips in the pop-up

  // ---------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------

  // A saved UTC time in the sidebar zone: "2026-09-30 15:00 UTC+08:00".
  when: function (utcText) {
    if (!utcText) {
      return "";
    }
    const shown = App.time.display(utcText, App.state.displayTimeZone);
    return shown.date + " " + shown.clock.slice(0, 5) + " " + shown.zoneLabel;
  },

  // The due cell: time (or the containment window), plus overdue / due soon.
  DUE_SOON_HOURS: 2,
  dueHtml: function (caseObj, t) {
    const e = App.escapeHtml;
    const d = App.taskDue(caseObj, t);
    if (!d.due) {
      return '<span class="muted">—</span>';
    }
    let html = e(App.taskForm.when(d.due));
    if (d.fromWindow) {
      html += ' <span class="muted small" title="No own due time: uses the containment window">(window)</span>';
    }
    const hoursLeft = (App.time.fromUtcText(d.due).getTime() - Date.now()) / 3600000;
    if (App.taskIsOpen(t) && hoursLeft < 0) {
      html += ' <span class="tag tag-warning">overdue</span>';
    } else if (App.taskIsOpen(t) && hoursLeft <= App.taskForm.DUE_SOON_HOURS) {
      html += ' <span class="tag due-soon">due soon</span>';
    }
    return html;
  },

  // "✓ approved by X" or, for containment done without one, a warning.
  approvalHtml: function (t) {
    const e = App.escapeHtml;
    if (App.taskHasApproval(t)) {
      return `<span class="tag tag-approved" title="Approved ${e(App.taskForm.when(t.approval.at))} by ${e(t.approval.method)}">✓ approved by ${e(t.approval.by)}</span>`;
    }
    if (t.kind === "containment" && t.status === "done") {
      return '<span class="tag tag-warning" title="Done without a recorded approval">⚠ no approval recorded</span>';
    }
    return "";
  },

  // The status dropdown used in both lists.
  statusSelectHtml: function (t) {
    const e = App.escapeHtml;
    return `<select class="cell-input" data-status="${e(t.id)}">` + App.TASK_STATUSES.map(function (s) {
      return `<option value="${e(s.key)}"${s.key === t.status ? " selected" : ""}>${e(s.label)}</option>`;
    }).join("") + "</select>";
  },

  // A status picked from a dropdown. If the new status needs more
  // (approval / a reason), open the pop-up to fill it in instead.
  changeStatus: function (caseObj, taskId, newStatus) {
    const task = App.findTask(caseObj.id, taskId);
    const error = App.updateTask(caseObj.id, taskId, Object.assign({}, task, { status: newStatus, doneAt: "" }));
    if (error) {
      App.taskForm.open(taskId, { forceStatus: newStatus, error: error });
    }
    App.render();
  },

  // ---------------------------------------------------------------
  // The pop-up
  // ---------------------------------------------------------------

  // Runs once at startup (called from app.js).
  setup: function () {
    const tf = App.taskForm;
    const dialog = document.getElementById("task-dialog");
    const form = document.getElementById("task-form");
    const e = App.escapeHtml;

    function options(list) {
      return list.map(function (o) { return `<option value="${e(o.key)}">${e(o.label)}</option>`; }).join("");
    }
    document.getElementById("task-kind").innerHTML = options(App.TASK_KINDS);
    document.getElementById("task-action-type").innerHTML =
      '<option value="">(choose an action type)</option>' + options(App.CONTAINMENT_ACTIONS);
    document.getElementById("task-priority").innerHTML = options(App.TASK_PRIORITIES);
    document.getElementById("task-owner").innerHTML = options(App.TASK_OWNERS);
    document.getElementById("task-status").innerHTML = options(App.TASK_STATUSES);
    document.getElementById("task-approval-method").innerHTML = options(App.APPROVAL_METHODS);

    // Pick list for the Action field (and the Action Items quick-add bar):
    // the containment catalog, minus "Other". A <datalist> only suggests;
    // anything can still be typed.
    document.getElementById("task-title-choices").innerHTML = App.CONTAINMENT_ACTIONS
      .filter(function (a) { return a.key !== "other"; })
      .map(function (a) { return `<option value="${e(a.label)}"></option>`; })
      .join("");

    // Kind / status / action type show or hide the related fields.
    document.getElementById("task-kind").addEventListener("change", tf.updateFormFields);
    document.getElementById("task-status").addEventListener("change", tf.updateFormFields);

    // Picking an action type fills in the action's name (if it's empty or
    // still the previous type's name) and shows its hint.
    let lastTypeLabel = "";
    const typeSelect = document.getElementById("task-action-type");
    typeSelect.addEventListener("focus", function () {
      lastTypeLabel = App.labelFor(App.CONTAINMENT_ACTIONS, typeSelect.value);
    });
    typeSelect.addEventListener("change", function () {
      const title = form.elements["title"];
      if (title.value.trim() === "" || title.value === lastTypeLabel) {
        title.value = typeSelect.value && typeSelect.value !== "other"
          ? App.labelFor(App.CONTAINMENT_ACTIONS, typeSelect.value) : "";
      }
      lastTypeLabel = App.labelFor(App.CONTAINMENT_ACTIONS, typeSelect.value);
      tf.updateFormFields();
    });

    // The other way round: picking a common action in the Action field
    // makes the item that containment action (action type Containment,
    // containment action set, hint shown). Typing something else changes
    // nothing, so free text works as before.
    form.elements["title"].addEventListener("input", function () {
      const action = App.containmentActionForTitle(form.elements["title"].value);
      if (action === null) {
        return;
      }
      form.elements["kind"].value = "containment";
      typeSelect.value = action.key;
      lastTypeLabel = action.label;
      tf.updateFormFields();
    });

    // Targets: Enter or "Add" turns the typed / picked value into a chip.
    const targetInput = document.getElementById("task-target-input");
    function addTarget() {
      const v = targetInput.value.trim();
      if (v !== "" && !tf.editTargets.includes(v)) {
        tf.editTargets.push(v);
        tf.renderTargets();
      }
      targetInput.value = "";
      targetInput.focus();
    }
    tf.addTarget = addTarget;
    targetInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();           // don't submit the whole form
        addTarget();
      }
    });
    document.getElementById("task-target-add").addEventListener("click", addTarget);
    // "×" on a chip removes it.
    document.getElementById("task-targets").addEventListener("click", function (event) {
      const x = event.target.closest("[data-remove-target]");
      if (x) {
        tf.editTargets.splice(Number(x.dataset.removeTarget), 1);   // splice(i, 1) = del list[i]
        tf.renderTargets();
      }
    });

    document.getElementById("task-cancel").addEventListener("click", function () {
      dialog.close();
    });

    document.getElementById("task-delete").addEventListener("click", function () {
      if (confirm("Delete " + tf.editingId + "? Only for mistakes: to close an item, set it to Done or Not needed instead.")) {
        App.deleteTask(App.state.selectedCaseId, tf.editingId);
        dialog.close();
        App.render();
      }
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      // Anything still typed in the target box counts too.
      if (targetInput.value.trim() !== "") {
        addTarget();
      }
      const d = new FormData(form);
      const taskData = {
        kind: d.get("kind"),
        actionType: d.get("actionType"),
        title: d.get("title"),
        targets: tf.editTargets.slice(),
        priority: d.get("priority"),
        owner: d.get("owner"),
        ownerName: d.get("ownerName"),
        due: App.time.fromDisplay(d.get("due")),           // sidebar zone -> UTC
        status: d.get("status"),
        statusReason: d.get("statusReason"),
        approval: {
          by: d.get("approvalBy"),
          at: App.time.fromDisplay(d.get("approvalAt")),
          method: d.get("approvalMethod")
        },
        doneBy: d.get("doneBy"),
        doneAt: App.time.fromDisplay(d.get("doneAt")),
        notes: d.get("notes")
      };
      const caseId = App.state.selectedCaseId;
      let error;
      if (tf.editingId === null) {
        error = App.addTask(caseId, taskData).error;
      } else {
        error = App.updateTask(caseId, tf.editingId, taskData);
      }
      if (error) {
        document.getElementById("task-error").textContent = error;
        return;
      }
      dialog.close();
      App.render();
    });
  },

  // Draw the target chips.
  renderTargets: function () {
    const e = App.escapeHtml;
    document.getElementById("task-targets").innerHTML = App.taskForm.editTargets
      .map(function (t, i) {
        return `<span class="chip">${e(t)}<button type="button" data-remove-target="${i}" title="Remove">×</button></span>`;
      })
      .join("");
  },

  // Show / hide fields for the current kind, action type, and status.
  updateFormFields: function () {
    const form = document.getElementById("task-form");
    const status = form.elements["status"].value;
    const kind = form.elements["kind"].value;
    const isContainment = kind === "containment";
    const action = App.CONTAINMENT_ACTIONS.find(function (a) { return a.key === form.elements["actionType"].value; });

    // Action type + hint: containment only.
    document.getElementById("task-action-type-row").hidden = !isContainment;
    const hint = document.getElementById("task-hint");
    hint.hidden = !(isContainment && action && action.hint);
    hint.innerHTML = action && action.hint ? "<strong>Before you do this:</strong> " + App.escapeHtml(action.hint) : "";

    // Targets pick from IOCs for IOC actions, otherwise from Assets.
    const targetInput = document.getElementById("task-target-input");
    if (isContainment && action && action.targets === "iocs") {
      targetInput.removeAttribute("data-asset-picker");
      targetInput.setAttribute("data-ioc-picker", "");
      targetInput.placeholder = "Pick from IOCs or type, then Enter";
    } else {
      targetInput.removeAttribute("data-ioc-picker");
      targetInput.setAttribute("data-asset-picker", "");
      targetInput.placeholder = "Pick from Assets or type, then Enter";
    }

    document.getElementById("task-reason-field").hidden = !(status === "blocked" || status === "not-needed");
    form.elements["statusReason"].placeholder = status === "blocked"
      ? "What it's waiting on, e.g. the client's network team"
      : "Why it's not needed, e.g. VPN wasn't the entry point";
    document.getElementById("task-done-fields").hidden = status !== "done";
    document.getElementById("task-approval-legend").textContent = isContainment
      ? "Approval (required to mark a containment action Approved)"
      : "Approval (optional)";
  },

  // Open the pop-up.
  //   taskId: null = add, or the ID to edit.
  //   opts.preset: starting values when adding, e.g. { kind: "containment", actionType: "kill-process" }
  //   opts.forceStatus / opts.error: a status change that needs more details.
  open: function (taskId, opts) {
    const tf = App.taskForm;
    opts = opts || {};
    const caseObj = App.getSelectedCase();
    const form = document.getElementById("task-form");
    const e = App.escapeHtml;
    form.reset();
    document.getElementById("task-error").textContent = opts.error || "";

    // Names from the Client tab's IR team & contacts, for the pick lists.
    document.getElementById("task-people").innerHTML = caseObj.clientInfo.people
      .filter(function (p) { return p.name; })
      .map(function (p) { return `<option value="${e(p.name)}" label="${e(App.labelFor(App.PERSON_SIDES, p.side))}"></option>`; })
      .join("");

    const t = taskId ? App.findTask(caseObj.id, taskId) : null;
    tf.editingId = t ? t.id : null;
    tf.editTargets = t ? t.targets.slice() : [];
    document.getElementById("task-dialog-title").textContent = t ? "Edit " + t.id : "Add action item";
    document.getElementById("task-dialog-hint").textContent = t
      ? "Close it by setting the status to Done or Not needed. Closed items are kept for the record."
      : "The ID (TK-001, TK-002, ...) is assigned automatically.";
    document.getElementById("task-submit").textContent = t ? "Save changes" : "Add";
    document.getElementById("task-delete").hidden = !t;

    if (t) {
      form.elements["title"].value = t.title;
      form.elements["kind"].value = t.kind;
      form.elements["actionType"].value = t.actionType || "";
      form.elements["priority"].value = t.priority;
      form.elements["due"].value = App.time.toDisplay(t.due);
      form.elements["owner"].value = t.owner;
      form.elements["ownerName"].value = t.ownerName;
      form.elements["status"].value = opts.forceStatus || t.status;
      form.elements["statusReason"].value = t.statusReason;
      form.elements["approvalBy"].value = t.approval.by;
      form.elements["approvalAt"].value = App.time.toDisplay(t.approval.at);
      form.elements["approvalMethod"].value = t.approval.method;
      form.elements["doneBy"].value = t.doneBy;
      form.elements["doneAt"].value = App.time.toDisplay(t.doneAt);
      form.elements["notes"].value = t.notes;
    } else {
      const p = opts.preset || {};
      form.elements["kind"].value = p.kind || "task";
      form.elements["actionType"].value = p.actionType || "";
      form.elements["priority"].value = p.priority || "p3";
      if (p.actionType && p.actionType !== "other") {
        form.elements["title"].value = App.labelFor(App.CONTAINMENT_ACTIONS, p.actionType);
      }
      if (p.kind === "containment") {
        document.getElementById("task-dialog-title").textContent = "Add containment action";
      }
    }
    tf.renderTargets();
    tf.updateFormFields();
    App.time.fillZoneHints();
    document.getElementById("task-dialog").showModal();
  }
};
