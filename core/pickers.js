// pickers.js - reusable form helpers.
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
// How it works: one listener on the whole page notices when ANY text
// box gets focus. If that box has data-asset-picker, the list is
// (re)built right then, so it always shows the current assets. This
// also works for boxes a tab draws later with innerHTML.

// Build or refresh the pick list for one text box.
App.refreshAssetPicker = function (input) {
  // First time: create a <datalist> right after the box and connect it
  // with list="...". Each gets its own id, e.g. "asset-picker-3".
  if (!input.getAttribute("list")) {
    App.assetPickerCount = (App.assetPickerCount || 0) + 1;
    const list = document.createElement("datalist");
    list.id = "asset-picker-" + App.assetPickerCount;
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

  // Optional type filter: "account,mailbox" -> ["account", "mailbox"].
  // An empty value means "all types".
  const filter = (input.dataset.assetPicker || "")
    .split(",")
    .map(function (t) { return t.trim(); })
    .filter(function (t) { return t !== ""; });

  list.innerHTML = App.assetDatalistHtml(caseObj, filter);
};

// Runs once at startup (called from app.js).
// "focusin" fires whenever any element on the page gets focus; we only
// act when it's a box marked data-asset-picker. (Listening once on the
// whole document like this is called "event delegation".)
App.setupAssetPickers = function () {
  document.addEventListener("focusin", function (event) {
    const input = event.target;
    // .matches(selector) asks "does this element fit this CSS selector?"
    if (input.matches("input[data-asset-picker]")) {
      App.refreshAssetPicker(input);
    }
  });
};
