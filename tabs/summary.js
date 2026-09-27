// summary.js - the Summary and Reports tab.
// Rule: this file never calls other tabs. It only reads App.state
// and draws its own panel.

App.tabs.summary = {
  // Draw this tab's content inside its panel.
  // "panel" is the <section> element for this tab.
  // "caseObj" is the selected case (never null here: app.js checks first).
  render: function (panel, caseObj) {
    // Backticks `...` make a template string, a bit like a Python
    // triple-quoted string. innerHTML replaces the panel's content.
    panel.innerHTML = `
      <h2>Summary and Reports</h2>
      <p>Case summary, pre-call briefs, and reports for the client.</p>
    `;
  }
};
