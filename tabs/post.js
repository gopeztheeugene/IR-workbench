// post.js - the Post-incident tab: lessons learned for this case, its key
// numbers, and the same lessons across ALL cases (improvements.json).
// Rule: this file never calls other tabs. It reads the case, changes data
// only through state.js (App.addLesson, App.updateLesson, ...), and
// storage.js writes improvements.json on autosave.

App.tabs.post = {
  REMINDERS: [
    { strong: true, text: "Blameless: write what happened and what would have helped, not who got it wrong." },
    { text: "One lesson per line, specific enough to act on (\"servers at the branch had no EDR\", not \"EDR coverage\")." },
    { text: "Say who should act (Me, Client, Thrive, 3rd party), so the lesson turns into a change." },
    { text: "Tick Addressed once something has actually changed; \"Clear addressed\" then takes it out of improvements.json." }
  ],

  render: function (panel, caseObj) {
    const tab = App.tabs.post;
    panel.innerHTML = `
      <div class="panel-header">
        <h2>Post-incident</h2>
        <div class="header-buttons">
          ${App.remindersTipHtml(tab.REMINDERS)}
        </div>
      </div>
      ${tab.metricsHtml(caseObj)}
      ${tab.lessonsHtml(caseObj)}
      ${tab.acrossHtml()}
    `;
  },

  // ---------------------------------------------------------------
  // Key numbers (read-only, worked out from the case)
  // ---------------------------------------------------------------

  metricsHtml: function (c) {
    const e = App.escapeHtml;
    const m = App.caseMetrics(c);
    const tile = function (label, value, hint) {
      return `<div class="metric" title="${e(hint)}"><div class="metric-value">${e(value)}</div><div class="metric-label">${e(label)}</div></div>`;
    };
    const approvals = m.containmentDone
      ? m.approvalsRecorded + " of " + m.containmentDone
      : "—";
    return `
      <section class="client-section">
        <h3>Key numbers <span class="muted small">(from the case)</span></h3>
        <div class="metrics">
          ${tile("Dwell time", App.formatHours(m.dwellHours), "First attacker activity (Storyline) → detected (Summary and Reports)")}
          ${tile("Time to contain", App.formatHours(m.containHours), "Detected → case status Contained")}
          ${tile("Time to close", App.formatHours(m.closeHours), "Detected → case status Closed")}
          ${tile("Affected assets", String(m.affectedAssets), "Assets tab, not clean")}
          ${tile("Containment actions", String(m.containmentActions), "Containment items in Action Items")}
          ${tile("Approvals recorded", approvals, "Containment actions done with a recorded approval (who / when / how)")}
          ${tile("Calls held", String(m.callsHeld), "Briefs marked held in the Calls tab")}
        </div>
      </section>`;
  },

  // ---------------------------------------------------------------
  // This case's lessons
  // ---------------------------------------------------------------

  lessonsHtml: function (c) {
    const tab = App.tabs.post;
    const e = App.escapeHtml;
    const options = function (list, selected, iconToo) {
      return list.map(function (o) {
        return `<option value="${e(o.key)}"${o.key === selected ? " selected" : ""}>${iconToo && o.icon ? o.icon + " " : ""}${e(o.label)}</option>`;
      }).join("");
    };
    // Grouped by type, in App.LESSON_TYPES order.
    const ordered = App.LESSON_TYPES.flatMap(function (t) {
      return c.post.lessons.filter(function (l) { return l.type === t.key; });
    });
    const rows = ordered.map(function (l) {
      const addressedNote = l.addressed
        ? `<span class="muted small" title="${e(l.cleared ? "Cleared from improvements.json" : "Still in improvements.json until you Clear addressed")}">${e(App.taskForm.when(l.addressedAt))}${l.cleared ? " · cleared" : ""}</span>`
        : "";
      return `
        <div class="lesson-row${l.addressed ? " lesson-addressed" : ""}">
          <select data-lesson="${e(l.id)}" data-key="type">${options(App.LESSON_TYPES, l.type, true)}</select>
          <select data-lesson="${e(l.id)}" data-key="theme">${options(App.LESSON_THEMES, l.theme)}</select>
          <select data-lesson="${e(l.id)}" data-key="actor" title="Who should act on it">${options(App.TASK_OWNERS, l.actor)}</select>
          <input class="grow" data-lesson="${e(l.id)}" data-key="text" value="${e(l.text)}"
                 placeholder="The lesson, in a line or two">
          <label class="check-inline" title="Something has actually changed">
            <input type="checkbox" data-lesson="${e(l.id)}" data-key="addressed"${l.addressed ? " checked" : ""}> Addressed
          </label>
          ${addressedNote}
          <button class="btn btn-small btn-danger" data-action="remove-lesson" data-id="${e(l.id)}" title="Remove">×</button>
        </div>`;
    }).join("");

    return `
      <section class="client-section">
        <div class="section-header">
          <h3>Lessons learned <span class="muted small">(${c.post.lessons.length})</span></h3>
          <button class="btn btn-small btn-primary" data-action="add-lesson">+ Add lesson</button>
        </div>
        ${rows || '<p class="muted small">No lessons yet. Add one, or start from the suggestions below.</p>'}
        ${tab.suggestionsHtml(c)}
      </section>`;
  },

  // Lessons suggested from the case. Each: { key, type, theme, actor, text }.
  // Nothing is added until you click Add.
  suggestions: function (c) {
    const out = [];
    const m = App.caseMetrics(c);

    const noEdr = App.devicesWithoutEdr(c);
    if (noEdr.length) {
      out.push({ key: "no-edr", type: "client-rec", theme: "visibility", actor: "client",
        text: "Deploy EDR on every device: " + noEdr.length + " had none during the incident (" +
              noEdr.map(function (d) { return d.name; }).join(", ") + ")." });
    }
    const noApproval = c.tasks.filter(function (t) { return t.kind === "containment" && t.status === "done" && !App.taskHasApproval(t); });
    if (noApproval.length) {
      out.push({ key: "no-approval", type: "differently", theme: "process", actor: "me",
        text: noApproval.length + " containment action(s) were done without a recorded approval (" +
              noApproval.map(function (t) { return t.id; }).join(", ") + "): record who / when / how before acting." });
    }
    const b = c.clientInfo.backups;
    if (b.immutable === "no") {
      out.push({ key: "backups-immutable", type: "client-rec", theme: "backups", actor: "client",
        text: "Make backups immutable / offline: they weren't during this incident." });
    }
    if (b.allServers === "no") {
      out.push({ key: "backups-coverage", type: "client-rec", theme: "backups", actor: "client",
        text: "Back up every server" + (b.allServersNotes ? " (not covered: " + b.allServersNotes + ")" : "") + "." });
    }
    const tier0 = App.tier0Affected(c);
    if (tier0.length) {
      out.push({ key: "tier0", type: "client-rec", theme: "identity", actor: "client",
        text: "A Tier 0 asset was affected (" + tier0.map(function (a) { return a.name; }).join(", ") +
              "): adopt tiered admin accounts and protect Tier 0 (clean admin workstations, no Tier 0 logons on lower tiers)." });
    }
    const badRmms = App.rmmsWith(c, ["yes", "suspected"]);
    if (badRmms.length) {
      out.push({ key: "rmm", type: "client-rec", theme: "tooling", actor: "msp",
        text: App.rmmNames(badRmms) + " was compromised or suspected: harden the RMM (MFA, patching, admin review, audit log monitoring)." });
    }
    if (m.dwellHours !== null && m.dwellHours > 24) {
      out.push({ key: "dwell", type: "slowed", theme: "detection", actor: "client",
        text: "Dwell time was " + App.formatHours(m.dwellHours) + " from first attacker activity to detection: review detection coverage and alerting." });
    }
    const lowConfidence = c.storyline.filter(function (st) { return st.confidence === "low"; });
    if (lowConfidence.length) {
      out.push({ key: "low-confidence", type: "slowed", theme: "logging", actor: "client",
        text: lowConfidence.length + " timeline entr" + (lowConfidence.length === 1 ? "y" : "ies") +
              " stayed low confidence (" + lowConfidence.map(function (st) { return st.id; }).join(", ") + "): logs to confirm them weren't available." });
    }
    if (c.clientInfo.subscriptions.irRetainer === "yes" && c.clientInfo.subscriptions.binalyze === "no") {
      out.push({ key: "binalyze", type: "slowed", theme: "tooling", actor: "msp",
        text: "The client has an IR retainer but wasn't in the Binalyze console: onboard retainer clients before an incident." });
    }
    const emailCase = c.types.includes("bec") || c.types.includes("account-takeover");
    if (emailCase && !c.clientInfo.environment.oobChannel) {
      out.push({ key: "oob", type: "differently", theme: "communication", actor: "me",
        text: "No out-of-band channel was recorded for an email compromise: agree one (phone bridge, Signal) at the start." });
    }

    const post = c.post;
    return out.filter(function (s) {
      return !post.dismissedSuggestions.includes(s.key) &&
             !post.lessons.some(function (l) { return l.source === s.key; });
    });
  },

  suggestionsHtml: function (c) {
    const e = App.escapeHtml;
    const list = App.tabs.post.suggestions(c);
    if (list.length === 0) {
      return "";
    }
    const rows = list.map(function (s) {
      const type = App.LESSON_TYPES.find(function (t) { return t.key === s.type; });
      return `
        <div class="suggestion">
          <div>💡 <strong>${e(s.text)}</strong>
            <div class="muted small">${e(type.icon + " " + type.label)} · ${e(App.labelFor(App.LESSON_THEMES, s.theme))} · ${e(App.labelFor(App.TASK_OWNERS, s.actor))}</div></div>
          <div class="suggestion-buttons">
            <button class="btn btn-small btn-primary" data-action="add-lesson-suggestion" data-key="${e(s.key)}">Add</button>
            <button class="btn btn-small" data-action="dismiss-lesson-suggestion" data-key="${e(s.key)}">Dismiss</button>
          </div>
        </div>`;
    }).join("");
    return `
      <details id="post-suggestions-box" class="fold"${App.state.postSuggestionsOpen ? " open" : ""}>
        <summary><h4>Suggestions <span class="category-hint">(nothing is added until you click Add)</span>
          <span class="muted small">${list.length} suggestion${list.length === 1 ? "" : "s"}</span></h4></summary>
        <div class="fold-body"><div class="suggestions">${rows}</div></div>
      </details>`;
  },

  // ---------------------------------------------------------------
  // Across all cases (improvements.json)
  // ---------------------------------------------------------------

  acrossHtml: function () {
    const e = App.escapeHtml;
    const all = App.collectImprovements(true);
    const visible = all.lessons.filter(function (x) { return App.state.showAddressed || !x.addressed; });
    const addressedCount = all.lessons.filter(function (x) { return x.addressed; }).length;
    const connected = App.storage.status === "connected";

    // Averages over every case that has the numbers.
    const average = function (key) {
      const values = Object.keys(all.cases).map(function (id) { return all.cases[id][key]; })
        .filter(function (v) { return v !== null && v !== undefined && !isNaN(v) && v >= 0; });
      if (values.length === 0) {
        return "—";
      }
      const sum = values.reduce(function (a, b) { return a + b; }, 0);
      return App.formatHours(sum / values.length) + ` <span class="muted small">(${values.length} case${values.length === 1 ? "" : "s"})</span>`;
    };

    // Grouped by theme, biggest first.
    const themes = App.LESSON_THEMES.map(function (t) {
      const items = visible.filter(function (x) { return x.theme === t.key; });
      const caseCount = items.map(function (x) { return x.caseId; })
        .filter(function (id, i, list) { return list.indexOf(id) === i; }).length;
      return { theme: t, items: items, caseCount: caseCount };
    }).filter(function (g) { return g.items.length; })
      .sort(function (a, b) { return b.items.length - a.items.length; });

    const groups = themes.map(function (g) {
      const items = g.items.map(function (x) {
        const type = App.LESSON_TYPES.find(function (t) { return t.key === x.type; }) || { icon: "", label: x.type };
        const archived = !App.findCase(x.caseId);
        return `
          <li class="${x.addressed ? "lesson-addressed" : ""}">
            <label class="check-inline" title="Addressed: something has actually changed">
              <input type="checkbox" data-improvement="${e(x.caseId)}" data-lesson-id="${e(x.lessonId)}"${x.addressed ? " checked" : ""}>
            </label>
            <span title="${e(type.label)}">${type.icon}</span>
            <span>${e(x.text)}
              <span class="muted small">· ${e(App.labelFor(App.TASK_OWNERS, x.actor))} · ${e(x.caseId)}${x.client ? " " + e(x.client) : ""}${archived ? " (archived case)" : ""}</span></span>
          </li>`;
      }).join("");
      return `
        <div class="across-group">
          <div class="brief-sub">${e(g.theme.label)} <span class="muted small">— ${g.items.length} lesson${g.items.length === 1 ? "" : "s"} across ${g.caseCount} case${g.caseCount === 1 ? "" : "s"}</span></div>
          <ul class="across-list">${items}</ul>
        </div>`;
    }).join("");

    return `
      <section class="client-section">
        <div class="section-header">
          <h3>Across all cases <span class="muted small">(improvements.json)</span></h3>
          <div class="header-buttons">
            <label class="check-inline"><input type="checkbox" data-action-toggle="show-addressed"${App.state.showAddressed ? " checked" : ""}>
              Show addressed (${addressedCount})</label>
            <button class="btn btn-small" data-action="clear-addressed"${addressedCount ? "" : " disabled"}
                    title="Remove addressed lessons from improvements.json (they stay in their cases, marked cleared)">Clear addressed</button>
          </div>
        </div>
        <p class="muted small">${connected
          ? "Saved automatically to improvements.json in your cases folder, including lessons from archived cases."
          : "Not connected to a cases folder: showing the cases open now. improvements.json is written once a folder is connected."}</p>
        <div class="metrics">
          <div class="metric"><div class="metric-value">${average("dwellHours")}</div><div class="metric-label">Average dwell time</div></div>
          <div class="metric"><div class="metric-value">${average("containHours")}</div><div class="metric-label">Average time to contain</div></div>
          <div class="metric"><div class="metric-value">${visible.length}</div><div class="metric-label">${App.state.showAddressed ? "Lessons" : "Open lessons"}</div></div>
        </div>
        ${groups || '<p class="muted small">No lessons yet.</p>'}
      </section>`;
  },

  // ---------------------------------------------------------------
  // Setup: delegated listeners
  // ---------------------------------------------------------------

  setup: function () {
    const tab = App.tabs.post;
    const panel = document.getElementById("post");

    panel.addEventListener("toggle", function (event) {
      if (event.target.id === "post-suggestions-box") {
        App.state.postSuggestionsOpen = event.target.open;
      }
    }, true);

    // TYPING in a lesson's text: save without redrawing.
    panel.addEventListener("input", function (event) {
      const t = event.target;
      if (t.dataset.lesson && t.dataset.key === "text") {
        App.updateLesson(App.state.selectedCaseId, t.dataset.lesson, "text", t.value);
      }
    });

    // CHOOSING: dropdowns and tick boxes save, then redraw.
    panel.addEventListener("change", function (event) {
      const t = event.target;
      const caseId = App.state.selectedCaseId;
      if (t.dataset.lesson && t.dataset.key === "text") {
        App.render();                                  // left the box: refresh the across-cases view
      } else if (t.dataset.lesson) {
        App.updateLesson(caseId, t.dataset.lesson, t.dataset.key, t.type === "checkbox" ? t.checked : t.value);
        App.render();
      } else if (t.dataset.improvement) {
        App.setImprovementAddressed(t.dataset.improvement, t.dataset.lessonId, t.checked);
        App.render();
      } else if (t.dataset.actionToggle === "show-addressed") {
        App.state.showAddressed = t.checked;
        App.render();
      }
    });

    panel.addEventListener("click", function (event) {
      const button = event.target.closest("[data-action]");
      if (!button) {
        return;
      }
      const c = App.getSelectedCase();
      const action = button.dataset.action;
      if (action === "add-lesson") {
        const id = App.addLesson(c.id, {});
        App.render();
        const box = panel.querySelector(`input[data-lesson="${id}"][data-key="text"]`);
        if (box) { box.focus(); }
      } else if (action === "remove-lesson") {
        if (confirm("Remove " + button.dataset.id + "? (To keep it but take it out of improvements.json, tick Addressed and Clear addressed instead.)")) {
          App.deleteLesson(c.id, button.dataset.id);
          App.render();
        }
      } else if (action === "add-lesson-suggestion") {
        const s = tab.suggestions(c).find(function (x) { return x.key === button.dataset.key; });
        if (s) {
          App.addLesson(c.id, { type: s.type, theme: s.theme, actor: s.actor, text: s.text, source: s.key });
          App.render();
        }
      } else if (action === "dismiss-lesson-suggestion") {
        App.dismissLessonSuggestion(c.id, button.dataset.key);
        App.render();
      } else if (action === "clear-addressed") {
        if (confirm("Remove every addressed lesson from improvements.json? They stay in their cases (marked cleared); lessons from archived cases are removed for good.")) {
          const n = App.clearAddressedImprovements();
          App.render();
          console.log("Cleared", n, "addressed lesson(s) from improvements.json");
        }
      }
    });
  }
};
