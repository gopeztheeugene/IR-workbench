// export.js - shared helpers for getting data IN and OUT of the app:
// reading and building CSV files, downloading, and the clipboard.
// Any tab can use these (they live on App, not inside a tab).

// Turn one value into one safe CSV cell. Python's csv module does
// this for you; here we do it by hand:
//   1. Wrap every cell in double quotes, so commas and line breaks
//      inside the value don't break the columns.
//   2. Double any " inside the value ("" means one literal ").
//   3. CSV INJECTION: Excel runs cells starting with = + - @ (or a
//      tab / carriage return) as formulas. Log text from an attacker
//      could contain =HYPERLINK(...). A leading ' makes Excel show
//      the cell as plain text.
App.csvCell = function (value) {
  let text = (value === undefined || value === null) ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = "'" + text;
  }
  return '"' + text.replaceAll('"', '""') + '"';
};

// Build CSV text from a header list and a list of rows (each row is a
// list of values in the same order as the header). Lines end with
// \r\n, the line ending Excel expects.
// [header, ...rows] puts the header first, like [header] + rows in Python.
App.buildCsv = function (header, rows) {
  return [header, ...rows]
    .map(function (row) { return row.map(App.csvCell).join(","); })
    .join("\r\n");
};

// A file name that's safe on Windows: anything other than letters,
// numbers, dot, dash, or underscore becomes "_".
App.safeFileName = function (text) {
  return text.replace(/[^A-Za-z0-9._-]/g, "_");
};

// Make the browser download some text as a file (goes to Downloads).
// "\uFEFF" at the start is a marker (BOM) that tells Excel the file
// is UTF-8, so characters like é or ü show correctly.
App.downloadText = function (fileName, text) {
  // A Blob is a chunk of file data held in memory.
  const blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" });
  // Give the Blob a temporary URL, then "click" a hidden download link.
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;          // the name of the downloaded file
  link.click();
  // Free the memory a second later, once the download has started.
  // setTimeout(fn, 1000) runs fn after 1000 ms, a bit like a
  // non-blocking version of Python's time.sleep(1) followed by fn().
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
};

// Copy text to the clipboard. Returns a Promise (like a Python
// awaitable) that finishes with true if it worked.
// navigator.clipboard is the modern way; if the browser refuses, we
// fall back to the old trick of selecting a hidden text box and
// running the "copy" command.
App.copyText = async function (text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    const box = document.createElement("textarea");
    box.value = text;
    box.style.position = "fixed";    // keep the page from jumping
    box.style.opacity = "0";
    document.body.appendChild(box);
    box.select();
    const ok = document.execCommand("copy");
    box.remove();
    return ok;
  }
};

// Briefly change a button's text (e.g. "Copy" -> "Copied!") as feedback.
App.flashButton = function (button, text) {
  // Remember the real label only the first time, so a quick double
  // click can't leave the button stuck on "Copied!".
  if (button.dataset.label === undefined) {
    button.dataset.label = button.textContent;
  }
  button.textContent = text;
  setTimeout(function () { button.textContent = button.dataset.label; }, 1200);
};

// Read CSV text into a list of rows (each row a list of cells), like
// Python's list(csv.reader(...)). Handles quoted cells with commas,
// line breaks, and "" inside them. Semicolon- or tab-separated files
// are detected from the first line.
App.parseCsv = function (text) {
  text = text.replace(/^\uFEFF/, "");            // drop an Excel BOM marker
  const firstLine = text.split("\n")[0];
  // Pick whichever separator appears most in the header line.
  const counts = { ",": firstLine.split(",").length, ";": firstLine.split(";").length,
                   "\t": firstLine.split("\t").length };
  let sep = ",";
  if (counts[";"] > counts[sep]) { sep = ";"; }
  if (counts["\t"] > counts[sep]) { sep = "\t"; }

  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  // Go through the text one character at a time.
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {   // "" = one literal quote
        cell += '"';
        i++;                                     // skip the second quote
      } else if (ch === '"') {
        inQuotes = false;                        // closing quote
      } else {
        cell += ch;                              // anything, even commas/newlines
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") {
        i++;                                     // treat \r\n as one line break
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  // The last line may not end with a line break.
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Drop completely empty lines.
  return rows.filter(function (r) { return r.some(function (c) { return c.trim() !== ""; }); });
};

// ---------------------------------------------------------------
// Links to files on disk
// ---------------------------------------------------------------

// Tidy a pasted Windows path. Explorer's "Copy as path" wraps it in
// quotes: "C:\Cases\edr.csv" -> C:\Cases\edr.csv
App.cleanPath = function (path) {
  return String(path || "").trim().replace(/^"(.*)"$/, "$1").trim();
};

// Turn a Windows path into a file:/// link the browser can open.
//   C:\IR Cases\edr.csv   -> file:///C:/IR%20Cases/edr.csv
//   \\server\share\x.csv -> file://server/share/x.csv
// Returns "" if it doesn't look like a full path.
// encodeURI makes spaces and other characters safe in a link (like
// Python's urllib.parse.quote); "#" is done by hand, since encodeURI
// leaves it alone and a browser would read it as a page section.
App.pathToFileUrl = function (path) {
  const p = App.cleanPath(path);
  if (/^[a-z]:\\/i.test(p)) {                  // drive letter: C:\...
    return "file:///" + encodeURI(p.replaceAll("\\", "/")).replaceAll("#", "%23");
  }
  if (p.startsWith("\\\\")) {                   // network share: \\server\...
    return "file:" + encodeURI(p.replaceAll("\\", "/")).replaceAll("#", "%23");
  }
  return "";
};
