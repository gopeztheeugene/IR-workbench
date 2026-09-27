// storyline.js - the Storyline tab: the attacker timeline.
// Rule: this file never calls other tabs. It only reads App.state
// and draws its own panel. It changes data only through the
// helpers in state.js (App.addStory, App.updateStory, App.deleteStory).
//
// Entries get here two ways:
//   1. "+ Add entry" on this tab.
//   2. "-> Storyline" on an evidence row. The Evidence tab puts the
//      evidence ID in App.state.promoteEvidenceId and switches here;
//      render() below notices it and opens a pre-filled form.
//
// Times are saved in UTC and shown in App.state.displayTimeZone
// (helpers in core/time.js).

App.tabs.storyline = {
  // Which entry the pop-up is editing ("ST-001"), or null when adding.
  editingId: null,

  // Draw this tab's content inside its panel.
  // "panel" is the <section> element for this tab.
  // "caseObj" is the selected case (never null here: app.js checks first).
  render: function (panel, caseObj) {
    const tab = App.tabs.storyline;
    const entries = App.sortedStoryline(caseObj);   // oldest first
    const zone = App.state.displayTimeZone;

    let html = `
      <div class="panel-header">
        <h2>Storyline of compromise <span class="muted">(${entries.length})</span></h2>
        <button class="btn btn-primary" id="story-add-btn">+ Add entry</button>
      </div>
    `;

    if (entries.length === 0) {
      html += '<p class="muted">No storyline yet. Add an entry, or use "→ Storyline" ' +
              'on an evidence item.</p>';
    } else {
      html += '<div class="timeline">' + tab.timelineHtml(entries, zone) + '</div>';
    }

    panel.innerHTML = html;

    // Buttons (the HTML was just replaced, so attach new handlers).
    document.getElementById("story-add-btn").addEventListener("click", function () {
      tab.openForm(null, null);
    });
    for (const button of panel.querySelectorAll("[data-edit]")) {
      button.addEventListener("click", function () {
        tab.openForm(button.dataset.edit, null);
      });
    }
    for (const button of panel.querySelectorAll("[data-remove]")) {
      button.addEventListener("click", function () {
        const storyId = button.dataset.remove;
        if (confirm("Remove " + storyId + " from the storyline?")) {
          App.deleteStory(caseObj.id, storyId);
          App.render();
        }
      });
    }

    // Did the Evidence tab ask us to promote something? Take the note,
    // clear it (so it only happens once), and open a pre-filled form.
    if (App.state.promoteEvidenceId !== null) {
      const evidenceId = App.state.promoteEvidenceId;
      App.state.promoteEvidenceId = null;
      tab.openForm(null, evidenceId);
    }
  },

  // The timeline: a day header whenever the date changes, then one
  // row per entry with the time on the left, a dot on the line, and
  // the entry's box on the right.
  timelineHtml: function (entries, zone) {
    const tab = App.tabs.storyline;
    const e = App.escapeHtml;
    let html = "";
    let lastDay = null;          // the day of the previous entry

    for (const st of entries) {
      // Work out the date and clock time in the chosen zone.
      let shown;
      if (st.timestamp === "") {
        shown = { date: "Time unknown", clock: "--:--:--", zoneLabel: "" };
      } else {
        shown = App.time.display(st.timestamp, zone);
      }

      // New day? Add a header line.
      if (shown.date !== lastDay) {
        html += `<div class="tl-day">${e(shown.date)}</div>`;
        lastDay = shown.date;
      }

      // Tactic tag, or nothing when not mapped.
      const tactic = st.tactic === "none"
        ? ""
        : `<span class="tag tag-tactic" title="${e(st.tactic)}">${e(App.tacticLabel(st.tactic))}</span>`;

      // Evidence IDs as small tags.
      const evidenceTags = st.evidenceIds
        .map(function (id) { return `<span class="tag tag-type">${e(id)}</span>`; })
        .join(" ");

      html += `
        <div class="tl-item">
          <div class="tl-time">
            <div class="tl-clock">${e(shown.clock)}</div>
            <div class="tl-zone">${e(shown.zoneLabel)}</div>
          </div>
          <div class="tl-marker">
            <!-- The dot's color shows confidence (CSS: .confidence-high etc.) -->
            <span class="tl-dot confidence-${e(st.confidence)}" title="Confidence: ${e(st.confidence)}"></span>
          </div>
          <div class="tl-card">
            <div class="tl-card-head">
              <strong>${e(st.id)}</strong>
              ${tactic}
              <span class="tag confidence-${e(st.confidence)}">${e(st.confidence)}</span>
              <span class="tl-card-buttons">
                <button class="btn btn-small" data-edit="${e(st.id)}">Edit</button>
                <button class="btn btn-small btn-danger" data-remove="${e(st.id)}">Remove</button>
              </span>
            </div>
            ${st.host ? `<div class="tl-host">${e(st.host)}</div>` : ""}
            <div class="tl-what">${e(st.what)}</div>
            ${st.techniques.length || st.evidenceIds.length ? `
              <div class="tl-foot">
                ${tab.techniquesHtml(st.techniques)}
                ${evidenceTags}
              </div>` : ""}
          </div>
        </div>
      `;
    }
    return html;
  },

  // Technique IDs as links to their MITRE ATT&CK page, e.g.
  // T1566.001 -> https://attack.mitre.org/techniques/T1566/001/
  // The IDs were checked against App.TECHNIQUE_PATTERN when saved, so
  // they're safe to put in a link.
  techniquesHtml: function (techniques) {
    const e = App.escapeHtml;
    return techniques
      .map(function (t) {
        const url = "https://attack.mitre.org/techniques/" + t.replace(".", "/") + "/";
        return `<a href="${e(url)}" target="_blank" rel="noopener noreferrer"><code>${e(t)}</code></a>`;
      })
      .join(" ");
  },

  // Runs once at startup: fill the dropdowns and wire up the pop-up.
  setup: function () {
    const tab = App.tabs.storyline;
    const dialog = document.getElementById("story-dialog");
    const form = document.getElementById("story-form");
    const errorBox = document.getElementById("story-error");
    const pasteBox = document.getElementById("story-paste-time");
    const pasteStatus = document.getElementById("story-paste-status");
    const e = App.escapeHtml;

    // Tactic dropdown shows "TA0001 Initial Access"; "Not mapped" has no ID.
    document.getElementById("story-tactic").innerHTML = App.MITRE_TACTICS
      .map(function (t) {
        const text = t.key === "none" ? t.label : t.key + " " + t.label;
        return `<option value="${e(t.key)}">${e(text)}</option>`;
      })
      .join("");

    document.getElementById("story-confidence").innerHTML = App.CONFIDENCE_LEVELS
      .map(function (x) {
        const def = x.key === "medium" ? " selected" : "";
        return `<option value="${e(x.key)}"${def}>${e(x.label)}</option>`;
      })
      .join("");

    // Pasting / typing a log timestamp: read it and fill the fields.
    // "input" fires on every change to the box, including a paste.
    pasteBox.addEventListener("input", function () {
      const text = pasteBox.value.trim();
      if (text === "") {
        pasteStatus.textContent = "";
        return;
      }
      const result = App.time.parseAny(text);
      if (result === null) {
        pasteStatus.textContent = "Couldn't read that timestamp. Try ISO (2026-09-19T22:41:07Z), " +
                                  "Unix epoch, or Windows FILETIME.";
      } else if (result.utc) {
        // We know the exact moment: show it in the sidebar's zone.
        form.elements["timestamp"].value = App.time.toDisplay(result.utc);
        pasteStatus.textContent = "Read as " + result.kind + " → " +
                                  result.utc.replace("T", " ") + " UTC";
      } else {
        // No zone in the text: it's read as the sidebar's zone.
        form.elements["timestamp"].value = result.wall;
        pasteStatus.textContent = "No time zone in this timestamp, so it's read as " +
                                  App.time.zoneName() + " (the sidebar setting).";
      }
      tab.updateTimePreview();
    });

    // Changing the time updates the "Saved as ..." line.
    document.getElementById("story-timestamp").addEventListener("input", tab.updateTimePreview);

    document.getElementById("story-cancel").addEventListener("click", function () {
      dialog.close();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const caseId = App.state.selectedCaseId;
      const data = new FormData(form);
      const storyData = {
        timestamp: tab.timestampAsUtc(),          // converted to UTC
        host: data.get("host"),
        what: data.get("what"),
        tactic: data.get("tactic"),
        confidence: data.get("confidence"),
        techniques: data.get("techniques"),       // text; state.js splits it
        evidenceIds: data.getAll("evidenceIds")   // every ticked checkbox
      };

      let error;
      if (tab.editingId === null) {
        error = App.addStory(caseId, storyData);
      } else {
        error = App.updateStory(caseId, tab.editingId, storyData);
      }

      if (error) {
        errorBox.textContent = error;
        return;
      }
      dialog.close();
      App.render();
    });
  },

  // The form's time (typed in the sidebar's zone) converted to UTC.
  // "" if no time was entered.
  timestampAsUtc: function () {
    const form = document.getElementById("story-form");
    return App.time.fromDisplay(form.elements["timestamp"].value);
  },

  // Show what will be saved, e.g. "Saved as 2026-09-19 22:41:07 UTC".
  updateTimePreview: function () {
    const preview = document.getElementById("story-time-preview");
    const utc = App.tabs.storyline.timestampAsUtc();
    preview.textContent = utc === ""
      ? "No time: the entry goes under \"Time unknown\"."
      : "Saved as " + utc.replace("T", " ") + " UTC";
  },

  // Open the pop-up.
  //   openForm(null, null)      -> empty form to ADD
  //   openForm("ST-001", null)  -> EDIT ST-001
  //   openForm(null, "EV-002")  -> ADD, pre-filled from evidence EV-002
  openForm: function (storyId, fromEvidenceId) {
    const tab = App.tabs.storyline;
    const e = App.escapeHtml;
    const caseObj = App.getSelectedCase();
    const form = document.getElementById("story-form");
    const title = document.getElementById("story-dialog-title");
    const hint = document.getElementById("story-dialog-hint");
    const submit = document.getElementById("story-submit");
    const reference = document.getElementById("story-reference");

    form.reset();
    document.getElementById("story-error").textContent = "";
    document.getElementById("story-paste-time").value = "";
    document.getElementById("story-paste-status").textContent = "";
    reference.hidden = true;
    reference.innerHTML = "";

    // Which evidence boxes start ticked (filled in below).
    let ticked = [];

    const entry = storyId ? App.findStory(caseObj.id, storyId) : null;
    const ev = fromEvidenceId ? App.findEvidence(caseObj.id, fromEvidenceId) : null;

    if (entry !== null) {
      // ---- EDIT ----
      tab.editingId = entry.id;
      title.textContent = "Edit " + entry.id;
      hint.textContent = "The ID stays the same. Entries are sorted by time.";
      submit.textContent = "Save changes";
      // Saved in UTC; shown in the sidebar's time zone.
      form.elements["timestamp"].value = App.time.toDisplay(entry.timestamp);
      form.elements["host"].value = entry.host;
      form.elements["what"].value = entry.what;
      form.elements["tactic"].value = entry.tactic;
      form.elements["confidence"].value = entry.confidence;
      // The list becomes text again: ["T1566", "T1204"] -> "T1566, T1204"
      form.elements["techniques"].value = entry.techniques.join(", ");
      ticked = entry.evidenceIds;
    } else {
      // ---- ADD (maybe from evidence) ----
      tab.editingId = null;
      title.textContent = "Add storyline entry";
      hint.textContent = "The ID (ST-001, ST-002, ...) is assigned automatically.";
      submit.textContent = "Add entry";

      if (ev !== null) {
        title.textContent = "Add storyline entry from " + ev.id;
        hint.textContent = "Paste the event time from the raw log below " +
                           "(the evidence's collected time is not the event time).";
        form.elements["host"].value = ev.host;
        form.elements["what"].value = ev.notes;
        ticked = [ev.id];

        // Show the evidence's source and raw log for reference.
        reference.innerHTML = `
          <div class="small muted">From ${e(ev.id)} · ${e(ev.source || App.evidenceTypeLabel(ev.type))}</div>
          ${ev.rawLog ? `<pre>${e(ev.rawLog)}</pre>` : '<div class="small muted">No raw log on this evidence.</div>'}
        `;
        reference.hidden = false;
      }
    }

    // One checkbox per evidence item in this case. They all share
    // name="evidenceIds", so FormData.getAll() returns the ticked ones.
    const boxes = document.getElementById("story-evidence");
    if (caseObj.evidence.length === 0) {
      boxes.innerHTML = '<span class="muted small">No evidence in this case yet.</span>';
    } else {
      boxes.innerHTML = caseObj.evidence
        .map(function (item) {
          const checked = ticked.includes(item.id) ? " checked" : "";
          const text = item.id + " " + (item.source || App.evidenceTypeLabel(item.type));
          return `<label class="type-option">
                    <input type="checkbox" name="evidenceIds" value="${e(item.id)}"${checked}>
                    ${e(text)}
                  </label>`;
        })
        .join("");
    }

    App.time.fillZoneHints();           // "(Asia/Manila, UTC+08:00)" in the label
    tab.updateTimePreview();
    document.getElementById("story-dialog").showModal();
  }
};
