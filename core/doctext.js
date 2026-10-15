// doctext.js - shared helpers for the app's "documents": the pre-call
// briefs (Calls tab) and the insurer / breach coach summary (Summary and
// Reports). A document is made of sections; each section is plain text
// with two simple marks, so it's easy to edit but can be shown nicely:
//   "## Heading"  a sub-heading
//   "- text"      a bullet
//   anything else a plain paragraph
// Lives in core/ so both tabs can use it without calling each other.

App.docText = {
  // Show a section's text formatted: sub-headings, bullet lists,
  // paragraphs. Everything is escaped first, so typed text can't turn
  // into HTML.
  render: function (text) {
    const e = App.escapeHtml;
    let html = "";
    let inList = false;
    const closeList = function () { if (inList) { html += "</ul>"; inList = false; } };
    for (const raw of String(text || "").split("\n")) {
      const line = raw.trim();
      if (line === "") {
        closeList();
      } else if (line.startsWith("## ")) {
        closeList();
        html += `<div class="brief-sub">${e(line.slice(3))}</div>`;
      } else if (line.startsWith("- ") || line.startsWith("• ")) {
        if (!inList) { html += "<ul>"; inList = true; }
        html += `<li>${App.docText.lightenIds(e(line.slice(2)))}</li>`;
      } else {
        closeList();
        html += `<p>${App.docText.lightenIds(e(line))}</p>`;
      }
    }
    closeList();
    return html || '<p class="muted">Empty. Click Edit to write something, or ↻ Redraft.</p>';
  },

  // Make IDs (TK-009, ST-005, EV-001, IOC-003, BR-001...) a lighter colour,
  // so the words stand out. Works on already-escaped text.
  lightenIds: function (escaped) {
    return escaped.replace(/\b(TK|ST|EV|IOC|AS|AN|BR|BC)-\d{2,3}\b/g, '<span class="brief-id">$&</span>');
  },

  // A section's text for an email / Teams / a document: "## Heading"
  // becomes "Heading:" and "- item" becomes "  • item".
  plain: function (text) {
    if (!text) {
      return "  • -";
    }
    return text.split("\n").map(function (line) {
      if (line.startsWith("## ")) {
        const heading = line.slice(3);
        return heading.includes(":") ? heading : heading + ":";   // no "Functional: High:"
      }
      if (line.startsWith("- ")) { return "  • " + line.slice(2); }
      return line;
    }).join("\n");
  }
};
