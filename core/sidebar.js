// sidebar.js - draws the case list on the left.
// Like the tabs, it only reads App.state and redraws itself.
// It changes data only through the helpers in state.js.

App.renderSidebar = function () {
  const list = document.getElementById("case-list");

  // No cases yet: show a hint and stop.
  // (.length is like Python's len())
  if (App.state.cases.length === 0) {
    list.innerHTML = '<p class="muted">No cases yet.</p>';
    return;
  }

  // Build one row of HTML per case, collected in a list, then joined
  // into one string. Same as Python's "".join(rows).
  const rows = [];
  for (const c of App.state.cases) {
    // Add the "selected" class only to the open case.
    const selected = c.id === App.state.selectedCaseId ? " selected" : "";

    // Short name for escapeHtml, just to keep the lines readable.
    const e = App.escapeHtml;

    // ${...} inside backticks inserts a value, exactly like a
    // Python f-string: f"<div>{c['id']}</div>".
    // data-id stores the case id on the button so the click
    // handler below knows which case was clicked.
    rows.push(`
      <button class="case-row${selected}" data-id="${e(c.id)}">
        <span class="case-top">
          <span class="case-id">${e(c.id)}</span>
          <span class="tag prio-${e(c.priority)}">${e(App.labelFor(App.CASE_PRIORITIES, c.priority))}</span>
        </span>
        <span class="case-title">${e(c.title || "(no title)")}</span>
        <span class="case-meta">${e(App.labelFor(App.CASE_STATUSES, c.status))}${c.client ? " · " + e(c.client) : ""}${c.sample
          ? ' <span class="tag tag-type" title="Sample data: never saved to disk">sample</span>' : ""}</span>
      </button>
    `);
  }
  list.innerHTML = rows.join("");

  // Make each row clickable. We just replaced the HTML, so the old
  // buttons (and their click handlers) are gone. Attach new ones.
  for (const row of list.querySelectorAll(".case-row")) {
    row.addEventListener("click", function () {
      App.selectCase(row.dataset.id);   // change the data...
      App.render();                     // ...then redraw everything
    });
  }
};

// ---------------------------------------------------------------
// "New case" pop-up form
// ---------------------------------------------------------------

// Runs once at startup (called from app.js). Fills in the dropdowns
// and checkboxes, and tells the buttons what to do when clicked.
App.setupNewCaseForm = function () {
  const dialog = document.getElementById("new-case-dialog");
  const form = document.getElementById("new-case-form");
  const errorBox = document.getElementById("new-case-error");
  const e = App.escapeHtml;

  // Build <option> tags from the lists in state.js, so the choices
  // live in one place. .map() is like a list comprehension:
  //   [f"<option>{p['label']}</option>" for p in CASE_PRIORITIES]
  // The "selected" attribute marks the default choice.
  document.getElementById("new-case-priority").innerHTML = App.CASE_PRIORITIES
    .map(function (p) {
      const def = p.key === "p2" ? " selected" : "";
      return `<option value="${p.key}"${def}>${e(p.label)}</option>`;
    })
    .join("");

  document.getElementById("new-case-status").innerHTML = App.CASE_STATUSES
    .map(function (s) {
      const def = s.key === "open" ? " selected" : "";
      return `<option value="${s.key}"${def}>${e(s.label)}</option>`;
    })
    .join("");

  document.getElementById("new-case-types").innerHTML = App.caseTypeBoxesHtml();

  // "+ New case" button: clear the form and open the pop-up.
  document.getElementById("new-case-btn").addEventListener("click", function () {
    form.reset();                  // back to defaults, boxes unchecked
    document.getElementById("new-case-opened").value = App.todayString();
    errorBox.textContent = "";
    dialog.showModal();            // open as a pop-up
  });

  // Cancel button: just close. (Pressing Esc also closes it.)
  document.getElementById("new-case-cancel").addEventListener("click", function () {
    dialog.close();
  });

  // Create button (the form's "submit" event).
  form.addEventListener("submit", function (event) {
    // By default a form submit reloads the page, which would wipe
    // our in-memory cases. preventDefault() stops that.
    event.preventDefault();

    // FormData reads every field in the form by its "name".
    // Think of it as a dict: data.get("id") is like data["id"].
    // getAll() returns a list of every checked "types" box.
    const data = new FormData(form);
    const caseData = {
      id: data.get("id"),
      title: data.get("title"),
      client: data.get("client"),
      priority: data.get("priority"),
      status: data.get("status"),
      opened: data.get("opened"),
      types: data.getAll("types")
    };

    // addCase returns null on success, or an error message.
    const error = App.addCase(caseData);
    if (error) {
      // textContent (not innerHTML) puts in plain text only, so it
      // can never be read as HTML. Safe without escapeHtml.
      errorBox.textContent = error;
      return;                      // leave the pop-up open to fix it
    }

    // Success: open the new case, close the pop-up, redraw.
    App.selectCase(caseData.id.trim());
    dialog.close();
    App.render();
  });
};

// One tick box per case type, shared by the New case and Edit case
// forms. They all share name="types", so a form hands us every ticked
// one as a list (FormData.getAll). The value is the key ("bec"); the
// text shown is the label.
App.caseTypeBoxesHtml = function () {
  const e = App.escapeHtml;
  return App.CASE_TYPES
    .map(function (t) {
      return `<label class="type-option">
                <input type="checkbox" name="types" value="${e(t.key)}">
                ${e(t.label)}
              </label>`;
    })
    .join("");
};

// ---------------------------------------------------------------
// "Edit case" pop-up (opened from the case header)
// ---------------------------------------------------------------

// Runs once at startup (called from app.js).
App.setupEditCaseForm = function () {
  const dialog = document.getElementById("edit-case-dialog");
  const form = document.getElementById("edit-case-form");
  const errorBox = document.getElementById("edit-case-error");
  const e = App.escapeHtml;

  function options(list) {
    return list.map(function (o) { return `<option value="${e(o.key)}">${e(o.label)}</option>`; }).join("");
  }
  document.getElementById("edit-case-priority").innerHTML = options(App.CASE_PRIORITIES);
  document.getElementById("edit-case-status").innerHTML = options(App.CASE_STATUSES);
  document.getElementById("edit-case-types").innerHTML = App.caseTypeBoxesHtml();

  // The "Edit case" button is redrawn with the header every time, so
  // listen on the header itself (it stays) and check what was clicked.
  document.getElementById("case-header").addEventListener("click", function (event) {
    if (event.target.closest("[data-action='edit-case']")) {
      App.openEditCase();
    }
  });

  document.getElementById("edit-case-cancel").addEventListener("click", function () {
    dialog.close();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const c = App.getSelectedCase();
    const data = new FormData(form);
    const details = {
      title: data.get("title"),
      client: data.get("client"),
      priority: data.get("priority"),
      status: data.get("status"),
      opened: data.get("opened"),
      types: data.getAll("types")
    };

    // Closing with action items still open? Warn and list them.
    // confirm() shows OK / Cancel and returns true / false.
    if (details.status === "closed" && c.status !== "closed") {
      const open = c.tasks.filter(App.taskIsOpen);
      if (open.length > 0) {
        const list = open.slice(0, 10).map(function (t) {
          return "• " + t.id + " " + t.title + " (" + App.labelFor(App.TASK_STATUSES, t.status) + ")";
        });
        if (open.length > 10) {
          list.push("• ... and " + (open.length - 10) + " more");
        }
        const ok = confirm(open.length + " action item" + (open.length === 1 ? " is" : "s are") +
          " still open:\n\n" + list.join("\n") +
          "\n\nClose the case anyway? (Cancel to go back and close them first.)");
        if (!ok) {
          return;                  // the pop-up stays open
        }
      }
    }

    const error = App.updateCaseDetails(c.id, details);
    if (error) {
      errorBox.textContent = error;
      return;
    }
    dialog.close();
    App.render();
  });
};

// Open the Edit case pop-up, filled in from the selected case.
App.openEditCase = function () {
  const c = App.getSelectedCase();
  if (c === null) {
    return;
  }
  const e = App.escapeHtml;
  const form = document.getElementById("edit-case-form");
  document.getElementById("edit-case-title").textContent = "Edit case " + c.id;
  form.elements["title"].value = c.title;
  form.elements["client"].value = c.client;
  form.elements["priority"].value = c.priority;
  form.elements["status"].value = c.status;
  form.elements["opened"].value = c.opened;
  for (const box of form.querySelectorAll("input[name='types']")) {
    box.checked = c.types.includes(box.value);
  }

  // Status history, newest first: "Contained 2026-09-30 10:00 UTC (was Open)".
  const history = c.statusHistory.slice().reverse().map(function (h) {
    const shown = App.time.display(h.at, App.state.displayTimeZone);
    const to = App.labelFor(App.CASE_STATUSES, h.to);
    return `<li>${e(to)} ${e(shown.date + " " + shown.clock + " " + shown.zoneLabel)}` +
           (h.from ? ` <span>(was ${e(App.labelFor(App.CASE_STATUSES, h.from))})</span>` : "") + "</li>";
  }).join("");
  document.getElementById("edit-case-history").innerHTML = history
    ? `Status changes:<ul class="status-history">${history}</ul>`
    : "No status changes recorded yet.";

  document.getElementById("edit-case-error").textContent = "";
  document.getElementById("edit-case-dialog").showModal();
};

// ---------------------------------------------------------------
// "Show times in" setting (one for every tab)
// ---------------------------------------------------------------

// Runs once at startup (called from app.js).
App.setupDisplayZone = function () {
  const select = document.getElementById("display-zone");
  // The saved choice (loaded by App.loadSettings) is pre-selected.
  select.innerHTML = App.time.zoneOptionsHtml(App.state.displayTimeZone);

  select.addEventListener("change", function () {
    App.state.displayTimeZone = select.value;
    App.saveSettings();          // remember it for next time
    App.render();                // redraw every tab in the new zone
  });
};
