// calls.js - the Calls tab: one pre-call brief per client call.
// Rule: this file never calls other tabs. It READS the case (storyline,
// assets, impact, action items...) to draft a brief, and changes data only
// through state.js (App.addCall, App.updateCall, ...).
//
// Each brief is a SNAPSHOT: when you click "+ New brief" the sections are
// drafted from the case as it is right now, then they're plain text you
// edit. Later changes to the case don't change old briefs (that's the
// record of what was said). "↻ Redraft" re-drafts one section on purpose.

App.tabs.calls = {
  // Reminders for the call (hover "?"), from the user's principles.
  REMINDERS: [
    { strong: true, text: "State facts, don't assume. Say \"not seen in the logs available\", not \"it didn't happen\". A working hypothesis is fine if it's labelled as one." },
    { text: "Use the out-of-band channel if email / M365 may be compromised (Client tab, Environment)." },
    { text: "Warn before containment actions that may change the functional impact (services going down)." },
    { text: "Record approvals as who / when / how on the containment action (Action Items)." },
    { text: "End with: who owns each next step, by when, and the next call time." }
  ],

  // The drafted sections, in order. internal: true = left out of the
  // client agenda copy (assumptions aren't facts to send to the client).
  SECTIONS: [
    { key: "where",       label: "Where we are" },
    { key: "since",       label: "New since the last call" },
    { key: "impact",      label: "Current impact" },
    { key: "containment", label: "Containment" },
    { key: "recovery",    label: "Eradication & recovery" },
    { key: "assumptions", label: "Working assumptions (not confirmed)", internal: true },
    { key: "asks",        label: "Asks for the client (actions and approvals needed)" },
    { key: "next",        label: "Next steps" }
  ],

  render: function (panel, caseObj) {
    const tab = App.tabs.calls;
    const e = App.escapeHtml;
    const calls = caseObj.calls;

    let html = `
      <div class="panel-header">
        <h2>Calls <span class="muted">(${calls.length} brief${calls.length === 1 ? "" : "s"})</span></h2>
        <div class="header-buttons">
          <label class="filter-label">Call type
            <select id="call-new-type">${tab.typeOptions("status")}</select>
          </label>
          <button class="btn btn-primary" data-action="new-call"
                  title="Draft a brief from the case as it is now">+ New brief</button>
          ${App.remindersTipHtml(tab.REMINDERS)}
        </div>
      </div>`;

    if (calls.length === 0) {
      html += '<p class="muted">No briefs yet. Before a client call, pick the call type and click "+ New brief": ' +
              'it\'s drafted from the case, then it\'s yours to edit.</p>';
    }

    // Newest first. By default only the newest is open.
    const newestId = calls.length ? calls[calls.length - 1].id : null;
    calls.slice().reverse().forEach(function (b) {
      const open = b.id in App.state.openCalls ? App.state.openCalls[b.id] : b.id === newestId;
      html += tab.briefHtml(caseObj, b, open);
    });

    panel.innerHTML = html;
    App.time.fillZoneHints();
  },

  typeOptions: function (selected) {
    const e = App.escapeHtml;
    return App.CALL_TYPES.map(function (t) {
      return `<option value="${e(t.key)}"${t.key === selected ? " selected" : ""}>${e(t.label)}</option>`;
    }).join("");
  },

  // One brief: a fold-away card.
  briefHtml: function (c, b, open) {
    const tab = App.tabs.calls;
    const e = App.escapeHtml;
    const when = b.callAt ? App.taskForm.when(b.callAt) : "time not set";
    const held = b.heldAt
      ? `<span class="tag copy-ok" title="Marked held ${e(App.taskForm.when(b.heldAt))}">✓ held</span>`
      : '<span class="tag tag-warning-soft">not held yet</span>';

    // Attendees: one tick box per named person in the IR team list.
    const people = c.clientInfo.people.filter(function (p) { return p.name; });
    const attendeeBoxes = people.map(function (p) {
      const checked = b.attendees.includes(p.name) ? " checked" : "";
      return `<label class="check-inline">
                <input type="checkbox" data-call-attendee="${e(b.id)}" value="${e(p.name)}"${checked}>
                ${e(p.name)} <span class="muted small">(${e(App.labelFor(App.PERSON_SIDES, p.side))})</span>
              </label>`;
    }).join("");

    // The drafted sections: a formatted view (sub-headings, bullets), or
    // the text box while you edit it ("Edit" / "Done"), plus ↻ Redraft.
    const sections = tab.SECTIONS.map(function (s) {
      const text = b.sections[s.key] || "";
      const editing = App.state.editingBriefSection === b.id + ":" + s.key;
      let body;
      if (editing) {
        // Grow with the text: one row per line, plus extra rows for long
        // lines that wrap (about 140 characters fit on one row).
        const lineRows = text.split("\n").reduce(function (sum, line) { return sum + Math.max(1, Math.ceil(line.length / 140)); }, 0);
        const rows = Math.min(20, Math.max(3, lineRows + 1));
        body = `<textarea data-call="${e(b.id)}" data-key="sections.${e(s.key)}" rows="${rows}">${e(text)}</textarea>
                <p class="muted small">"## " starts a sub-heading, "- " a bullet. Saved as you type.</p>`;
      } else {
        body = `<div class="brief-view">${tab.renderSectionHtml(text)}</div>`;
      }
      return `
        <div class="brief-section${s.internal ? " brief-internal" : ""}">
          <div class="brief-section-head">
            <span class="brief-title">${e(s.label)}</span>
            ${s.internal ? '<span class="tag tag-warning-soft" title="Left out of the client agenda copy">internal</span>' : ""}
            <span class="spacer"></span>
            <button class="btn btn-small" data-action="edit-section" data-id="${e(b.id)}" data-section="${e(s.key)}">${editing ? "Done" : "Edit"}</button>
            <button class="btn btn-small" data-action="redraft" data-id="${e(b.id)}" data-section="${e(s.key)}"
                    title="Replace this section with a fresh draft from the case as it is now">↻ Redraft</button>
          </div>
          ${body}
        </div>`;
    }).join("");

    return `
      <details class="brief" data-brief="${e(b.id)}"${open ? " open" : ""}>
        <summary>
          <strong>${e(b.id)}</strong> · ${e(App.labelFor(App.CALL_TYPES, b.type))} · ${e(when)} ${held}
        </summary>
        <div class="brief-body">
          <div class="sub-row">
            <span class="sub-label">Call time <span class="zone-hint" data-zone-hint></span></span>
            <input type="datetime-local" step="1" data-call="${e(b.id)}" data-key="callAt" data-time
                   value="${e(App.time.toDisplay(b.callAt))}">
            <span class="sub-inline-label">Type</span>
            <select data-call="${e(b.id)}" data-key="type">${tab.typeOptions(b.type)}</select>
          </div>
          <div class="sub-row">
            <span class="sub-label">Attendees</span>
            <div class="grow">
              <div class="check-row">${attendeeBoxes || '<span class="muted small">Add people in the Client tab (IR team & contacts) to tick them here.</span>'}</div>
              <input class="grow" data-call="${e(b.id)}" data-key="attendeesOther" value="${e(b.attendeesOther)}"
                     placeholder="Others: e.g. insurer, breach coach, Thrive account manager">
            </div>
          </div>

          ${sections}

          <h4 class="brief-after">After the call</h4>
          <div class="sub-row">
            <span class="sub-label">Next call <span class="zone-hint" data-zone-hint></span></span>
            <input type="datetime-local" step="1" data-call="${e(b.id)}" data-key="nextCallAt" data-time
                   value="${e(App.time.toDisplay(b.nextCallAt))}">
          </div>
          <label class="client-field">Notes
            <textarea data-call="${e(b.id)}" data-key="notes" rows="3"
                      placeholder="What was discussed, questions raised, anything new learned">${e(b.notes)}</textarea>
          </label>
          <label class="client-field">Decisions
            <textarea data-call="${e(b.id)}" data-key="decisions" rows="3"
                      placeholder="What was decided, by whom (approvals also go on the action item: who / when / how)">${e(b.decisions)}</textarea>
          </label>

          <div class="form-buttons">
            <button class="btn btn-small btn-danger" data-action="delete-call" data-id="${e(b.id)}">Delete brief</button>
            <span class="spacer"></span>
            <button class="btn btn-small" data-action="copy-internal" data-id="${e(b.id)}"
                    title="Everything, as plain text">Copy brief (internal)</button>
            <button class="btn btn-small" data-action="copy-agenda" data-id="${e(b.id)}"
                    title="Facts only: no assumptions, no notes. Safe to send to the client before the call">Copy agenda for client</button>
            <button class="btn btn-small" data-action="save-call" data-id="${e(b.id)}"
                    title="The internal brief as a .txt file in the case's exports/ folder">Save as text file</button>
            <button class="btn btn-small btn-primary" data-action="toggle-held" data-id="${e(b.id)}">
              ${b.heldAt ? "Mark as not held" : "Mark as held"}</button>
          </div>
        </div>
      </details>`;
  },

  // ---------------------------------------------------------------
  // Drafting: build each section's text from the case
  // ---------------------------------------------------------------

  // The brief before this one (to know what's "new since"), or null.
  previousBrief: function (c, b) {
    const i = c.calls.findIndex(function (x) { return x.id === b.id; });
    return i > 0 ? c.calls[i - 1] : null;
  },

  // Draft every section (used for a new brief).
  draftAll: function (c, b) {
    const out = {};
    for (const s of App.tabs.calls.SECTIONS) {
      out[s.key] = App.tabs.calls.draft(c, b, s.key);
    }
    return out;
  },

  // Draft one section as text. The text uses two simple marks, so it stays
  // easy to edit but can be shown nicely (see renderSectionHtml):
  //   "## Heading"  a sub-heading
  //   "- text"      a bullet
  //   anything else a plain paragraph
  // b may be a brief that isn't saved yet (when creating one); then
  // "previous" = the newest saved brief.
  draft: function (c, b, key) {
    const when = App.taskForm.when;
    const lines = [];
    const prev = b ? App.tabs.calls.previousBrief(c, b) : (c.calls[c.calls.length - 1] || null);
    const open = c.tasks.filter(App.taskIsOpen);
    const kindItems = function (kind) { return c.tasks.filter(function (t) { return t.kind === kind; }); };

    // A sub-heading followed by its bullets; skipped when there are none.
    const group = function (heading, bullets) {
      if (bullets.length) {
        lines.push("## " + heading);
        bullets.forEach(function (x) { lines.push("- " + x); });
      }
    };
    // One action item: "TK-009 · Firewall deny rule — Approved · due 14 Oct 23:51 UTC"
    const itemText = function (t) {
      const due = App.taskDue(c, t).due;
      let text = t.id + " · " + t.title + " — " + App.labelFor(App.TASK_STATUSES, t.status);
      if (due && App.taskIsOpen(t)) { text += " · due " + when(due); }
      if (t.status === "blocked" && t.statusReason) { text += " · waiting on: " + t.statusReason; }
      if (t.status === "not-needed" && t.statusReason) { text += " · " + t.statusReason; }
      return text;
    };

    if (key === "where") {
      const containedAt = App.statusChangedAt(c, "contained");
      const types = c.types.map(function (k) { return App.typeLabel(k); }).join(", ");
      const facts = ["Status: " + App.labelFor(App.CASE_STATUSES, c.status) +
                     (c.status !== "open" && containedAt ? " (contained " + when(containedAt) + ")" : ""),
                     "Priority: " + App.labelFor(App.CASE_PRIORITIES, c.priority)];
      if (types) { facts.push("Case type: " + types); }
      group("Status", facts);
      if (c.summary.overview) {
        lines.push("## Overview");
        lines.push(c.summary.overview);
      }
    }

    if (key === "since") {
      // What's new since the previous brief was DRAFTED: that's what it
      // knew about. (Measuring from its call / held time would let
      // anything that happened in between fall through the gap.)
      const since = prev ? prev.createdAt : "";
      const counters = prev ? prev.counters : null;
      const isNew = function (id, counterKey) { return !counters || App.idNumber(id) >= counters[counterKey]; };
      const after = function (time) { return !since || (time && time >= since); };   // ">=": same second counts
      lines.push(prev ? "Since " + prev.id + " (drafted " + when(since) + ")" : "First call: everything so far.");

      group("New in the Storyline", App.sortedStoryline(c)
        .filter(function (st) { return isNew(st.id, "story"); })
        .map(function (st) {
          return (st.timestamp ? when(st.timestamp) + " · " : "") + (st.host ? st.host + ": " : "") + st.what + " (" + st.id + ")";
        }));
      group("Newly affected assets", c.assets
        .filter(function (a) { return a.status !== "clean" && isNew(a.id, "asset"); })
        .map(function (a) {
          const extra = [];
          const tier = App.assetTier(c, a);
          if (tier) { extra.push(App.labelFor(App.AD_TIERS, tier)); }
          const match = App.criticalMatch(c, a.name);
          if (match) { extra.push(match.label); }
          if (App.assetLacksEdr(c, a)) { extra.push("no EDR"); }
          return a.name + (extra.length ? " [" + extra.join(", ") + "]" : "");
        }));
      group("New IOCs", c.iocs
        .filter(function (i) { return isNew(i.id, "ioc"); })
        .map(function (i) { return i.id + " · " + App.labelFor(App.IOC_TYPES, i.type) + ": " + App.ioc.defang(i.value, i.type); }));
      group("Action items done", c.tasks
        .filter(function (t) { return t.status === "done" && after(t.doneAt); })
        .map(function (t) { return t.id + " · " + t.title; }));
      // closedAt = when it was closed (core/state.js updateTask).
      group("Closed as not needed", c.tasks
        .filter(function (t) { return t.status === "not-needed" && after(t.closedAt); })
        .map(function (t) { return t.id + " · " + t.title + (t.statusReason ? " — " + t.statusReason : ""); }));
      group("Case status changes", c.statusHistory
        .filter(function (h) { return h.from && after(h.at); })
        .map(function (h) {
          return App.labelFor(App.CASE_STATUSES, h.from) + " → " + App.labelFor(App.CASE_STATUSES, h.to) + " (" + when(h.at) + ")";
        }));
      if (lines.length === 1) { lines.push("- Nothing new recorded."); }
    }

    if (key === "impact") {
      // Functional, Recoverability, Information: level as the heading,
      // the justification (Summary and Reports) as the bullet.
      const imp = c.summary.impact;
      const level = function (k) { return imp[k] ? App.labelFor(App.IMPACT[k], imp[k]) : "not assessed yet"; };
      const info = App.IMPACT.information.filter(function (o) { return imp.information[o.key]; })
        .map(function (o) { return o.label; }).join(", ") || "not assessed yet";
      [["Functional", level("functional"), imp.functionalNotes],
       ["Recoverability", level("recoverability"), imp.recoverabilityNotes],
       ["Information", info, imp.informationNotes]].forEach(function (row) {
        lines.push("## " + row[0] + ": " + row[1]);
        lines.push("- " + (row[2] || "No justification written yet."));
      });
    }

    if (key === "containment") {
      const items = kindItems("containment");
      const openItems = items.filter(App.taskIsOpen);
      group("Progress", [items.length
        ? (items.length - openItems.length) + " of " + items.length + " containment actions closed"
        : "No containment actions yet"]);
      group("Still open", openItems.map(itemText));
      if (c.summary.containment.windowStart) {
        group("Containment window", [when(c.summary.containment.windowStart)]);
      }
    }

    if (key === "recovery") {
      const waves = App.CREDENTIAL_WAVES.map(function (w, i) {
        const s = App.waveState(c, w.key);
        return "Wave " + (i + 1) + ": " + w.title + " — " + App.labelFor(App.WAVE_STATUSES, s.status);
      });
      group("Credential reset waves", waves);
      const items = App.recoveryItems(c);
      const openItems = items.filter(App.taskIsOpen);
      group("Progress", [items.length
        ? (items.length - openItems.length) + " of " + items.length + " recovery actions closed"
        : "No recovery actions yet"]);
      group("Still open (in recovery order)", openItems.map(itemText));
    }

    if (key === "assumptions") {
      const list = c.summary.containment.assumptions.filter(function (a) { return a.text; });
      // Just bullets: the section title already says what they are.
      list.forEach(function (a) {
        lines.push("- ASSUMPTION: " + a.text + (a.basis ? " (basis: " + a.basis + ")" : ""));
      });
      if (list.length === 0) { lines.push("- None recorded."); }
    }

    if (key === "asks") {
      const client = open.filter(function (t) { return t.owner === "client"; });
      group("Client action items", client.map(function (t) {
        return itemText(t) + (t.ownerName ? " · " + t.ownerName : "");
      }));
      // Containment actions still waiting for an approval (who / when / how).
      group("Approvals needed", open
        .filter(function (t) { return t.kind === "containment" && !App.taskHasApproval(t); })
        .map(function (t) { return t.id + " · " + t.title; }));
      if (lines.length === 0) { lines.push("- Nothing needed from the client right now."); }
    }

    if (key === "next") {
      const ours = open.filter(function (t) { return t.owner === "me" || t.owner === "msp"; })
        .sort(App.taskForm.comparator(c));
      const bullets = ours.slice(0, 10).map(itemText);
      if (ours.length > 10) { bullets.push("... and " + (ours.length - 10) + " more (Action Items)"); }
      bullets.forEach(function (x) { lines.push("- " + x); });   // the title already says "Next steps"
      if (lines.length === 0) { lines.push("- No open items on our side."); }
    }

    return lines.join("\n");
  },

  // Formatting lives in core/doctext.js (App.docText), shared with the
  // insurer / breach coach summary. These names are kept for this file.
  renderSectionHtml: function (text) {
    return App.docText.render(text);
  },

  // ---------------------------------------------------------------
  // Plain-text copies
  // ---------------------------------------------------------------

  plainText: function (text) {
    return App.docText.plain(text);
  },

  // mode "internal": everything. mode "agenda": for the client, facts only
  // (no internal sections, no notes / decisions).
  briefText: function (c, b, mode) {
    const tab = App.tabs.calls;
    const when = App.taskForm.when;
    const lines = [];
    const agenda = mode === "agenda";
    lines.push((agenda ? "CALL AGENDA – " : "PRE-CALL BRIEF – ") + c.id + (c.client ? " · " + c.client : "") +
               " · " + App.labelFor(App.CALL_TYPES, b.type));
    lines.push("Call: " + (b.callAt ? when(b.callAt) : "time to be confirmed"));
    const attendees = b.attendees.slice();
    if (b.attendeesOther) { attendees.push(b.attendeesOther); }
    if (attendees.length) { lines.push("Attendees: " + attendees.join(", ")); }
    tab.SECTIONS.forEach(function (s) {
      if (agenda && s.internal) {
        return;                       // like Python's "continue" inside forEach
      }
      lines.push("");
      lines.push(s.label.toUpperCase());
      lines.push(tab.plainText(b.sections[s.key]));
    });
    if (!agenda) {
      if (b.notes) { lines.push(""); lines.push("NOTES"); lines.push(b.notes); }
      if (b.decisions) { lines.push(""); lines.push("DECISIONS"); lines.push(b.decisions); }
    }
    if (b.nextCallAt) { lines.push(""); lines.push("Next call: " + when(b.nextCallAt)); }
    return lines.join("\n");
  },

  // ---------------------------------------------------------------
  // Setup: delegated listeners on the panel
  // ---------------------------------------------------------------

  setup: function () {
    const tab = App.tabs.calls;
    const panel = document.getElementById("calls");

    // Remember which briefs are folded open ("toggle" doesn't bubble, so
    // listen in the capture phase, like the Summary tab does).
    panel.addEventListener("toggle", function (event) {
      if (event.target.dataset && event.target.dataset.brief) {
        App.state.openCalls[event.target.dataset.brief] = event.target.open;
      }
    }, true);

    // TYPING: save without redrawing.
    panel.addEventListener("input", function (event) {
      const t = event.target;
      if (!t.dataset.call || t.tagName === "SELECT") {
        return;
      }
      const value = t.dataset.time !== undefined ? App.time.fromDisplay(t.value) : t.value;
      App.updateCall(App.state.selectedCaseId, t.dataset.call, t.dataset.key, value);
    });

    // CHOOSING: type dropdown, attendee tick boxes, times (redraw so the
    // card's title line updates).
    panel.addEventListener("change", function (event) {
      const t = event.target;
      const caseId = App.state.selectedCaseId;
      if (t.dataset.callAttendee) {
        App.toggleCallAttendee(caseId, t.dataset.callAttendee, t.value, t.checked);
      } else if (t.dataset.call && t.tagName === "SELECT") {
        App.updateCall(caseId, t.dataset.call, t.dataset.key, t.value);
        App.render();
      } else if (t.dataset.call && t.dataset.time !== undefined) {
        App.render();
      }
    });

    // BUTTONS.
    panel.addEventListener("click", function (event) {
      const button = event.target.closest("[data-action]");
      if (!button) {
        return;
      }
      const c = App.getSelectedCase();
      const action = button.dataset.action;
      const b = button.dataset.id ? App.findCall(c.id, button.dataset.id) : null;

      if (action === "new-call") {
        const type = document.getElementById("call-new-type").value;
        const sections = tab.draftAll(c, null);         // drafted against the newest saved brief
        const id = App.addCall(c.id, { type: type, sections: sections });
        App.state.openCalls = {};                       // only the new one open
        App.state.openCalls[id] = true;
        App.render();
      } else if (action === "edit-section" && b) {
        // Switch this section between the formatted view and its text box.
        const key = b.id + ":" + button.dataset.section;
        App.state.editingBriefSection = App.state.editingBriefSection === key ? null : key;
        App.render();
        if (App.state.editingBriefSection) {
          const box = panel.querySelector(`textarea[data-call="${b.id}"][data-key="sections.${button.dataset.section}"]`);
          if (box) { box.focus(); }
        }
      } else if (action === "redraft" && b) {
        const key = button.dataset.section;
        if ((b.sections[key] || "").trim() === "" ||
            confirm("Replace this section with a fresh draft from the case as it is now? Your edits to it will be lost.")) {
          App.updateCall(c.id, b.id, "sections." + key, tab.draft(c, b, key));
          App.render();
        }
      } else if (action === "copy-internal" && b) {
        App.copyText(tab.briefText(c, b, "internal")).then(function (ok) {
          App.flashButton(button, ok ? "Copied!" : "Copy failed");
        });
      } else if (action === "copy-agenda" && b) {
        App.copyText(tab.briefText(c, b, "agenda")).then(function (ok) {
          App.flashButton(button, ok ? "Copied!" : "Copy failed");
        });
      } else if (action === "save-call" && b) {
        const name = App.safeFileName(c.id) + "_" + b.id + "_brief.txt";
        App.storage.saveExport(c, name, tab.briefText(c, b, "internal")).then(function (result) {
          App.flashButton(button, result.saved ? "Saved to exports/" : "Downloaded");
        });
      } else if (action === "toggle-held" && b) {
        App.updateCall(c.id, b.id, "heldAt", b.heldAt ? "" : App.time.nowUtc());
        App.render();
      } else if (action === "delete-call" && b) {
        if (confirm("Delete " + b.id + "? It's the record of that call; this can't be undone.")) {
          App.deleteCall(c.id, b.id);
          App.render();
        }
      }
    });
  }
};
