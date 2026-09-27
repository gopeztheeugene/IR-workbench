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
          <span class="tag sev-${e(c.severity)}">${e(c.severity)}</span>
        </span>
        <span class="case-title">${e(c.title || "(no title)")}</span>
        <span class="case-meta">${e(c.status)}${c.client ? " · " + e(c.client) : ""}</span>
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
  //   [f"<option>{s}</option>" for s in SEVERITIES]
  // The "selected" attribute marks the default choice.
  document.getElementById("new-case-severity").innerHTML = App.SEVERITIES
    .map(function (s) {
      const def = s === "medium" ? " selected" : "";
      return `<option value="${s}"${def}>${s}</option>`;
    })
    .join("");

  document.getElementById("new-case-status").innerHTML = App.STATUSES
    .map(function (s) {
      const def = s === "open" ? " selected" : "";
      return `<option value="${s}"${def}>${s}</option>`;
    })
    .join("");

  // One checkbox per case type. They all share name="types", so the
  // form can hand us every checked one as a list (see getAll below).
  // The value is the key ("bec"); the text shown is the label.
  document.getElementById("new-case-types").innerHTML = App.CASE_TYPES
    .map(function (t) {
      return `<label class="type-option">
                <input type="checkbox" name="types" value="${e(t.key)}">
                ${e(t.label)}
              </label>`;
    })
    .join("");

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
      severity: data.get("severity"),
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
