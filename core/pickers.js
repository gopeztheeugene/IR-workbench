// pickers.js - reusable form helpers: pick lists for text boxes.
//
// ASSET PICK LIST
// Any text box marked with data-asset-picker gets a drop-down list of
// the selected case's assets (the browser's built-in <datalist>). You
// can still type something new. No per-form code is needed:
//
//   <input name="host" data-asset-picker placeholder="Pick from Assets or type">
//
// Only some asset types? List their keys (from App.ASSET_TYPES):
//
//   <input name="user" data-asset-picker="account,service-account,mailbox">
//
// IOC PICK LIST
// A text box marked with data-ioc-picker lists the case's IOCs instead
// (the real values, e.g. for a firewall deny rule):
//
//   <input name="target" data-ioc-picker>
//
// A form can switch one box between the two by swapping the attribute.
//
// How it works: one listener on the whole page notices when ANY text
// box gets focus. If that box has one of the attributes, its list is
// (re)built right then, so it always shows the current data. This also
// works for boxes a tab draws later with innerHTML.

// Build or refresh the pick list for one text box.
App.refreshPicker = function (input) {
  // First time: create a <datalist> right after the box and connect it
  // with list="...". Each gets its own id, e.g. "asset-picker-3".
  if (!input.getAttribute("list")) {
    App.pickerCount = (App.pickerCount || 0) + 1;
    const list = document.createElement("datalist");
    list.id = "asset-picker-" + App.pickerCount;
    input.after(list);                          // put it right after the box
    input.setAttribute("list", list.id);
    input.setAttribute("autocomplete", "off");  // no browser history mixed in
  }

  const list = document.getElementById(input.getAttribute("list"));
  const caseObj = App.getSelectedCase();
  if (caseObj === null) {
    list.innerHTML = "";
    return;
  }

  if (input.hasAttribute("data-ioc-picker")) {
    list.innerHTML = App.iocDatalistHtml(caseObj);
    return;
  }

  // Optional asset type filter: "account,mailbox" -> ["account", "mailbox"].
  // An empty value means "all types".
  const filter = (input.dataset.assetPicker || "")
    .split(",")
    .map(function (t) { return t.trim(); })
    .filter(function (t) { return t !== ""; });

  list.innerHTML = App.assetDatalistHtml(caseObj, filter);
};

// Old name, kept so nothing breaks.
App.refreshAssetPicker = App.refreshPicker;

// ---------------------------------------------------------------
// HOVER REMINDERS: a circled "?" that shows a list while the mouse is
// over it. Pure CSS (see .help-tip in style.css): no click, no JavaScript.
// reminders = [{ text, strong }] (strong = highlighted).
// Python equivalent: def reminders_tip_html(reminders): ...
// ---------------------------------------------------------------
App.remindersTipHtml = function (reminders) {
  const e = App.escapeHtml;
  const items = reminders
    .map(function (r) { return `<li${r.strong ? ' class="reminder-key"' : ""}>${e(r.text)}</li>`; })
    .join("");
  return `
    <span class="help-tip" aria-label="Reminders">?
      <span class="help-tip-box">
        <strong>Reminders</strong>
        <ul>${items}</ul>
      </span>
    </span>`;
};

// ---------------------------------------------------------------
// HIGHLIGHT EMPTY FIELDS (like Google Forms' red "required" boxes)
// ---------------------------------------------------------------
// A tab that wants it (Client, Summary and Reports):
//   1. puts App.emptyToggleHtml() somewhere at the top, and
//   2. calls App.markEmptyFields(panel) at the end of its render().
// The switch is one shared setting (App.state.highlightEmpty, saved
// with the other view settings). When it's on, the panel gets the class
// "show-empty", and every empty field gets "is-empty"; the CSS draws
// those red. Typing in a field updates it straight away (see below).

// The fields that count: anything that saves to the case.
App.EMPTY_FIELD_SELECTOR = "[data-field], [data-rmm], [data-person], [data-critical], [data-assumption]";

// Is this one field empty? Tick boxes and radio buttons aren't checked
// one by one (an unticked box isn't "empty"); their groups are, below.
App.isEmptyField = function (el) {
  if (el.type === "checkbox" || el.type === "radio" || el.type === "button") {
    return false;
  }
  // A greyed-out (disabled) field isn't expected to be filled in, e.g.
  // the no-EDR list once "All identified devices have EDR" is ticked.
  if (el.disabled) {
    return false;
  }
  return String(el.value || "").trim() === "";
};

// Mark the empty fields in one panel and update its count. Returns the count.
App.markEmptyFields = function (panel) {
  if (!panel) {
    return 0;
  }
  let count = 0;
  for (const el of panel.querySelectorAll(App.EMPTY_FIELD_SELECTOR)) {
    const empty = App.isEmptyField(el);
    el.classList.toggle("is-empty", empty);   // toggle(name, true/false) = add or remove
    if (empty) {
      count = count + 1;
    }
  }
  // Choice groups (the impact option cards): empty when nothing in the
  // group is picked.
  for (const group of panel.querySelectorAll(".impact-options")) {
    const empty = group.querySelector("input:checked") === null;
    group.classList.toggle("is-empty", empty);
    if (empty) {
      count = count + 1;
    }
  }
  panel.classList.toggle("show-empty", App.state.highlightEmpty);
  for (const label of panel.querySelectorAll("[data-empty-count]")) {
    label.textContent = "(" + count + " empty)";
  }
  return count;
};

// The switch, for the top of a tab.
App.emptyToggleHtml = function () {
  return `<label class="empty-toggle" title="Outline every empty field in red, like a form's required fields">
            <input type="checkbox" data-highlight-empty${App.state.highlightEmpty ? " checked" : ""}>
            Highlight empty fields <span class="muted" data-empty-count></span>
          </label>`;
};

// Runs once at startup (called from app.js).
App.setupEmptyFields = function () {
  // The switch: save the setting, then redraw.
  document.addEventListener("change", function (event) {
    if (event.target.matches("[data-highlight-empty]")) {
      App.state.highlightEmpty = event.target.checked;
      App.saveSettings();
      App.render();
    }
  });
  // Typing or picking in a field: re-mark just that panel, so the red
  // goes away (or comes back) straight away, without a full redraw.
  function recheck(event) {
    if (event.target.matches && event.target.matches(App.EMPTY_FIELD_SELECTOR)) {
      App.markEmptyFields(event.target.closest(".panel"));
    }
  }
  document.addEventListener("input", recheck);
  document.addEventListener("change", recheck);
};

// Runs once at startup (called from app.js).
// "focusin" fires whenever any element on the page gets focus; we only
// act when it's a box marked data-asset-picker or data-ioc-picker.
// (Listening once on the whole document like this is called "event
// delegation".)
App.setupAssetPickers = function () {
  document.addEventListener("focusin", function (event) {
    const input = event.target;
    // .matches(selector) asks "does this element fit this CSS selector?"
    if (input.matches("input[data-asset-picker], input[data-ioc-picker]")) {
      App.refreshPicker(input);
    }
  });
};
