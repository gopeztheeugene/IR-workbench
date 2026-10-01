// app.js - loaded LAST, after state.js and all the tab files.
// It starts the app and handles switching between tabs.

// This prints to the browser Console (press F12 to see it).
// It's the JavaScript version of Python's print().
console.log("app.js loaded");

// Find every tab button and every panel on the page.
// querySelectorAll returns a list, like a Python list.
const tabButtons = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

// Which tab is showing right now. "let" (not "const") because
// it changes. In Python every variable can change; in JavaScript
// you choose: const = never reassigned, let = can be reassigned.
let currentTab = "client";

// Ask one tab to draw itself into its panel.
// The panel's id ("client", "summary", ...) matches the key in App.tabs.
function renderTab(name) {
  const panel = document.getElementById(name);
  const caseObj = App.getSelectedCase();

  // No case selected: show a hint instead of the tab. Checking here,
  // in one place, means the tab files never have to.
  if (caseObj === null) {
    panel.innerHTML = '<p class="muted">Select a case on the left, or create one with "+ New case".</p>';
    return;
  }

  // Hand the tab its panel AND the selected case, so it can draw
  // that case's data.
  const tab = App.tabs[name];   // like App.tabs["client"] in Python
  tab.render(panel, caseObj);
}

// Draw the summary header for the selected case.
function renderCaseHeader() {
  const header = document.getElementById("case-header");
  const c = App.getSelectedCase();

  // No case: empty it and hide it.
  if (c === null) {
    header.innerHTML = "";
    header.hidden = true;        // "hidden" is a built-in on/off switch
    return;
  }
  header.hidden = false;

  const e = App.escapeHtml;

  // One tag per case type, shown with its readable label.
  // If there are none, show a gray "no type" hint.
  let typeTags = c.types
    .map(function (key) {
      return `<span class="tag tag-type">${e(App.typeLabel(key))}</span>`;
    })
    .join("");
  if (typeTags === "") {
    typeTags = '<span class="muted">No case type set</span>';
  }

  // Devices without EDR (Client tab): a red warning on EVERY tab,
  // so it can't be missed.
  const noEdrCount = App.devicesWithoutEdr(c).length;
  const noEdrTag = noEdrCount === 0 ? "" :
    `<span class="tag tag-warning" title="See the Client tab, Device lists">⚠ ${noEdrCount} device${noEdrCount === 1 ? "" : "s"} without EDR</span>`;

  // A Tier 0 asset (DC, Entra Connect, ...) is affected: the whole
  // domain is at risk, so this is shown on every tab too.
  const tier0 = App.tier0Affected(c);
  const tier0Tag = tier0.length === 0 ? "" :
    `<span class="tag tag-warning" title="${e(tier0.map(function (a) { return a.name; }).join(", "))} (see the Assets tab)">⚠ Tier 0 asset affected</span>`;

  // Dates on the right: "Opened 2026-09-20 · Contained 2026-09-30 10:00 UTC".
  // Contained shows once the case is contained or closed; Closed only
  // while it's closed (a reopened case isn't closed any more).
  const dates = ["Opened " + c.opened];
  const containedAt = App.statusChangedAt(c, "contained");
  const closedAt = App.statusChangedAt(c, "closed");
  if (containedAt && (c.status === "contained" || c.status === "closed")) {
    dates.push("Contained " + App.taskForm.when(containedAt));
  }
  if (closedAt && c.status === "closed") {
    dates.push("Closed " + App.taskForm.when(closedAt));
  }

  header.innerHTML = `
    <div class="case-header-top">
      <h2>${e(c.id)}${c.title ? " · " + e(c.title) : ""}</h2>
      <span class="tag prio-${e(c.priority)}" title="Case priority">${e(App.labelFor(App.CASE_PRIORITIES, c.priority))}</span>
      <span class="tag status-${e(c.status)}">${e(App.labelFor(App.CASE_STATUSES, c.status))}</span>
      ${noEdrTag}
      ${tier0Tag}
      <span class="case-opened">${e(dates.join(" · "))}
        <button class="btn btn-small" data-action="edit-case" title="Change title, client, priority, status, opened date, case types">Edit case</button>
      </span>
    </div>
    <div class="case-header-meta">
      ${c.client ? "Client: " + e(c.client) : "No client set"}
    </div>
    <div class="case-header-types">${typeTags}</div>
  `;
}

// Show one tab and hide the rest.
// Python equivalent: def show_tab(name):
function showTab(name) {
  // Loop over the buttons: mark the matching one active, the others not.
  for (const button of tabButtons) {
    if (button.dataset.tab === name) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  }

  // Same idea for the panels, matching on the panel's id.
  for (const panel of panels) {
    if (panel.id === name) {
      panel.classList.add("active");
    } else {
      panel.classList.remove("active");
    }
  }

  // Remember the choice, then redraw that tab so it shows the latest data.
  currentTab = name;
  renderTab(name);

  console.log("Switched to tab:", name);
}

// Let other files switch tabs (e.g. Evidence's "-> Storyline" button).
App.showTab = showTab;

// "Events": tell each button what to do when it's clicked.
// The page then waits. Nothing runs until you click.
for (const button of tabButtons) {
  button.addEventListener("click", function () {
    showTab(button.dataset.tab);
  });
}

// Redraw the whole screen from App.state.
// The pattern for every change in this app is:
//   1. change the data (e.g. App.addCase, App.selectCase)
//   2. call App.render()
// Nothing draws itself directly; everything redraws from the data.
App.render = function () {
  App.renderSidebar();
  renderCaseHeader();
  updateTabLabels();
  renderTab(currentTab);
};

// Tab buttons that show a live count, e.g. "Action Items (5 open)".
function updateTabLabels() {
  const c = App.getSelectedCase();
  const open = c ? c.tasks.filter(App.taskIsOpen).length : 0;
  document.querySelector('[data-tab="tasks"]').textContent =
    "Action Items" + (open ? " (" + open + " open)" : "");
}

// Redraw only the sidebar and the case header, NOT the current tab.
// Used while typing (e.g. the client name), so the box you're typing
// in isn't redrawn under your cursor.
App.renderChrome = function () {
  App.renderSidebar();
  renderCaseHeader();
};

// Startup: load saved settings, prepare the sidebar, show the first
// tab, then draw everything.
App.loadSettings();
App.setupDisplayZone();
App.setupAssetPickers();     // any box with data-asset-picker gets the asset list
App.taskForm.setup();        // the shared add / edit action item pop-up
App.setupNewCaseForm();
App.setupEditCaseForm();     // "Edit case" in the case header

// Some tabs have a one-time setup() (e.g. wiring up a pop-up form).
// "for (const name in App.tabs)" loops over the keys, exactly like
// Python's "for name in tabs:" over a dict.
for (const name in App.tabs) {
  if (App.tabs[name].setup) {       // only if this tab has a setup()
    App.tabs[name].setup();
  }
}
showTab("client");
App.render();

// Connect to the cases folder used last time (if any) and start
// autosaving. It's async (it may read case files), so it runs on its own.
App.storage.init();
