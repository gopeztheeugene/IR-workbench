// post.js - the Post-incident tab.
// Rule: this file never calls other tabs. It only reads App.state
// and draws its own panel.

App.tabs.post = {
  // Draw this tab's content inside its panel.
  // "panel" is the <section> element for this tab.
  // "caseObj" is the selected case (never null here: app.js checks first).
  render: function (panel, caseObj) {
    // Backticks `...` make a template string, a bit like a Python
    // triple-quoted string. innerHTML replaces the panel's content.
    panel.innerHTML = `
      <h2>Post-incident</h2>
      <p>What to improve next time.</p>
    `;
  }
};
