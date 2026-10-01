// summary.js - the Summary and Reports tab.
//   1. Incident summary (Incident Summary and Containment Strategy each
//      have a reminders "?" next to their title)
//   2. Impact assessment (NIST SP 800-61: functional, information, recoverability)
//   3. Containment strategy: assumptions, the containment actions, then
//      the containment window + notes. The actions ARE
//      containment items in case.tasks, the same list the Action Items
//      tab shows; both use the shared pop-up in core/taskform.js.
// Later: recovery strategy, pre-call briefs, and the client report.
//
// Rule: this file never calls other tabs. It only READS other case data
// (assets, storyline, client info...) to show supporting facts, and
// changes data through state.js (App.setSummaryField, App.addAssumption...)
// and the shared App.taskForm.
//
// HOW EDITING WORKS (same idea as the Client tab, no Save button):
//   Every field has data-field="path" inside case.summary, e.g.
//   data-field="impact.functional". Typing saves without redrawing;
//   choosing an option (radio / tick box) saves and redraws, so the
//   highlighted card changes. Autosave writes it to disk.

App.tabs.summary = {
  render: function (panel, caseObj) {
    const tab = App.tabs.summary;
    // No "Summary and Reports" heading: the tab button already says it.
    panel.innerHTML = `
      ${tab.summaryHtml(caseObj)}
      ${tab.impactHtml(caseObj)}
      ${tab.strategyHtml(caseObj)}
    `;
    App.time.fillZoneHints();     // "(UTC)" / "(Asia/Manila, UTC+08:00)"
  },

  // The user's IR principles, shown as "?" reminders next to section titles.
  // strong: true = highlighted.
  // Incident Summary: how to talk about the incident.
  SUMMARY_REMINDERS: [
    { text: "Talking to the client: state facts, don't assume. Say \"not seen in the logs available\", not \"it didn't happen\". A working hypothesis is fine if it's labelled as one." }
  ],

  // Containment Strategy. Timing first: it has bitten before.
  CONTAINMENT_REMINDERS: [
    { strong: true, text: "Timing: contain everything at once, in one agreed window. Partial containment tips off the attacker, who may react (e.g. set off ransomware early)." },
    { text: "Containment actions may change the functional impact: isolating a server, disabling the VPN, or segmenting the network can take services down. Warn the client beforehand, and update the Impact Assessment afterwards." },
    { text: "Containment and recovery: assume the worst credible case, and write each assumption down with its basis." },
    { text: "Act on the logs you have, and treat missing logs or telemetry as blind spots, not clean results." },
    { text: "Foothold without enough endpoint / network telemetry: assume credential theft across the domain (privileged + service accounts, krbtgt twice, all users, Entra Connect as tier 0, revoke cloud sessions)." },
    { text: "Before acting: preserve evidence, get approval (who / when / how), coordinate the teams, and use an out-of-band channel if email may be compromised." }
  ],

  // A circled "?" that shows a list of reminders while the mouse is over it.
  // Pure CSS (see .help-tip in style.css): no click, no JavaScript.
  // Python equivalent: def reminders_tip_html(reminders): ...
  remindersTipHtml: function (reminders) {
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
  },

  // ---------------------------------------------------------------
  // 1. Incident summary
  // ---------------------------------------------------------------

  summaryHtml: function (c) {
    const e = App.escapeHtml;
    const s = c.summary;
    const zone = App.state.displayTimeZone;

    // First attacker activity = the earliest storyline entry with a time.
    const first = App.sortedStoryline(c).find(function (st) { return st.timestamp !== ""; });
    let firstText = '<span class="muted">No storyline entries with a time yet</span>';
    if (first) {
      const shown = App.time.display(first.timestamp, zone);
      firstText = `${e(shown.date + " " + shown.clock + " " + shown.zoneLabel)}
                   <span class="muted">(${e(first.id)}: ${e(first.what.slice(0, 80))})</span>`;
    }

    // Quick facts from the rest of the case.
    const affected = c.assets.filter(function (a) { return a.status !== "clean"; }).length;
    const types = c.types.map(function (k) { return App.typeLabel(k); }).join(", ") || "none set";
    const facts = [
      "Case types: " + types,
      "Priority: " + App.labelFor(App.CASE_PRIORITIES, c.priority) +
        " · Status: " + App.labelFor(App.CASE_STATUSES, c.status) + " · Opened: " + c.opened,
      c.evidence.length + " evidence · " + c.storyline.length + " storyline entries · " +
        c.iocs.length + " IOCs · " + affected + " affected assets"
    ];

    // Detection source dropdown; "Other (specify)" adds a text box.
    const sourceOptions = App.DETECTION_SOURCES
      .map(function (d) {
        const picked = d.key === s.detectionSource ? " selected" : "";
        return `<option value="${e(d.key)}"${picked}>${e(d.label)}</option>`;
      })
      .join("");
    const specify = s.detectionSource !== "other" ? "" : `
      <input class="grow" data-field="detectionSourceOther" value="${e(s.detectionSourceOther)}"
             placeholder="Specify: client reported, MDR ticket, vendor notification...">`;

    return `
      <section class="client-section">
        <div class="section-header">
          <h3 class="section-title">Incident Summary</h3>
          ${App.tabs.summary.remindersTipHtml(App.tabs.summary.SUMMARY_REMINDERS)}
        </div>
        <div class="sub-row">
          <span class="sub-label">Detected at <span class="zone-hint" data-zone-hint></span></span>
          <!-- data-time: typed in the sidebar's zone, saved as UTC -->
          <input type="datetime-local" step="1" data-field="detectedAt" data-time
                 value="${e(App.time.toDisplay(s.detectedAt))}">
        </div>
        <div class="sub-row">
          <span class="sub-label">Detection source</span>
          <select data-field="detectionSource">${sourceOptions}</select>
          ${specify}
        </div>
        <div class="sub-row">
          <span class="sub-label">First attacker activity</span>
          <span class="small">${firstText}</span>
        </div>
        <label class="client-field">Overview: what happened
          <textarea data-field="overview" rows="6"
                    placeholder="How the attacker got in, what they did, what's affected, and where things stand now.">${e(s.overview)}</textarea>
        </label>
        <ul class="facts">${facts.map(function (f) { return `<li>${e(f)}</li>`; }).join("")}</ul>
      </section>
    `;
  },

  // ---------------------------------------------------------------
  // 2. Impact assessment (NIST SP 800-61)
  // ---------------------------------------------------------------

  impactHtml: function (c) {
    const tab = App.tabs.summary;
    const e = App.escapeHtml;
    const imp = c.summary.impact;

    let updated = '<span class="muted small">Not assessed yet</span>';
    if (imp.updatedAt) {
      const shown = App.time.display(imp.updatedAt, App.state.displayTimeZone);
      updated = `<span class="muted small">Last updated ${e(shown.date + " " + shown.clock + " " + shown.zoneLabel)}</span>`;
    }

    return `
      <section class="client-section">
        <div class="section-header">
          <div>
            <h3 class="section-title">Impact Assessment</h3>
            <div class="section-subtitle">(NIST SP 800-61)</div>
          </div>
          ${updated}
        </div>
        ${tab.categoryHtml(c, "functional", "Functional Impact",
            "how much the incident affects the organization's ability to deliver its services")}
        ${tab.categoryHtml(c, "information", "Information Impact",
            "what happened to the organization's information; more than one can apply")}
        ${tab.categoryHtml(c, "recoverability", "Recoverability Effort",
            "how much time and resources recovery will take")}
      </section>
    `;
  },

  // One category: option cards, justification box, facts from the case.
  categoryHtml: function (c, key, title, hint) {
    const tab = App.tabs.summary;
    const e = App.escapeHtml;
    const imp = c.summary.impact;
    const multi = key === "information";    // tick boxes instead of one choice

    const cards = App.IMPACT[key]
      .map(function (opt) {
        // Selected? (information: its own true/false; others: the one key)
        const selected = multi ? imp.information[opt.key] === true : imp[key] === opt.key;
        // Radio buttons with the same name = pick one. Tick boxes = any number.
        const input = multi
          ? `<input type="checkbox" data-field="impact.information.${e(opt.key)}"${selected ? " checked" : ""}>`
          : `<input type="radio" name="impact-${key}" data-field="impact.${key}" value="${e(opt.key)}"${selected ? " checked" : ""}>`;
        return `
          <label class="impact-option level-${opt.level}${selected ? " selected" : ""}">
            <span class="impact-option-head">${input} <strong>${e(opt.label)}</strong></span>
            <span class="impact-option-desc">${e(opt.description)}</span>
          </label>
        `;
      })
      .join("");

    const facts = tab.factsFor(c, key);
    const factsHtml = facts.length === 0 ? "" : `
      <div class="muted small">Comments</div>
      <ul class="facts">${facts.map(function (f) {
        // All one color for now (f.kind "warn" / "ok" / "info" is kept for later).
        return `<li>${e(f.text)}</li>`;
      }).join("")}</ul>`;

    return `
      <div class="impact-category">
        <h4>${e(title)} <span class="category-hint">(${e(hint)})</span></h4>
        <div class="impact-options">${cards}</div>
        <div class="impact-body">
          <label class="client-field impact-notes">Justification
            <textarea data-field="impact.${key}Notes" rows="3"
                      placeholder="Why this level? What's affected, for how long, who says so.">${e(imp[key + "Notes"])}</textarea>
          </label>
          ${factsHtml}
        </div>
      </div>
    `;
  },

  // Facts from other tabs that support one category.
  // Each fact: { kind: "warn" | "ok" | "info", text }.
  factsFor: function (c, key) {
    const facts = [];
    const typeKeys = c.types;
    const hasType = function (k) { return typeKeys.includes(k); };
    const info = c.clientInfo;

    if (key === "functional") {
      const affected = c.assets.filter(function (a) { return a.status !== "clean"; });
      if (affected.length === 0) {
        facts.push({ kind: "info", text: "No affected assets recorded yet (Assets tab)." });
      } else {
        // Count by status, e.g. "2 suspected, 1 confirmed compromised".
        const byStatus = {};
        for (const a of affected) {
          const label = App.assetStatusLabel(a.status).toLowerCase();
          byStatus[label] = (byStatus[label] || 0) + 1;
        }
        const parts = Object.keys(byStatus).map(function (k) { return byStatus[k] + " " + k; });
        facts.push({ kind: "warn", text: affected.length + " affected assets: " + parts.join(", ") + "." });
        const servers = affected.filter(function (a) { return a.type === "server"; });
        if (servers.length) {
          facts.push({ kind: "warn", text: "Affected servers: " + servers.map(function (a) { return a.name; }).join(", ") + "." });
        }
      }
      // Critical assets (restore order) that are affected.
      const affectedKeys = affected.map(function (a) { return App.normalizeHost(a.name); });
      info.criticalAssets.forEach(function (ca, i) {
        if (ca.name && affectedKeys.includes(App.normalizeHost(ca.name))) {
          facts.push({ kind: "warn", text: "Critical asset affected: " + ca.name + " (" + App.criticalLabel(i + 1) +
            ", #" + (i + 1) + " in restore order" + (ca.purpose ? ": " + ca.purpose : "") + ")." });
        }
      });
      if (hasType("ransomware") || hasType("wiper") || hasType("dos")) {
        facts.push({ kind: "warn", text: "Case type suggests service disruption (ransomware / wiper / DoS)." });
      }
    }

    if (key === "information") {
      const exfil = c.storyline.filter(function (st) { return st.tactic === "TA0010" || st.tactic === "TA0009"; });
      if (exfil.length) {
        facts.push({ kind: "warn", text: "Storyline has " + exfil.length + " Collection / Exfiltration entr" +
          (exfil.length === 1 ? "y" : "ies") + ": " + exfil.map(function (st) { return st.id; }).join(", ") + "." });
      } else {
        facts.push({ kind: "info", text: "No Collection or Exfiltration entries in the Storyline yet." });
      }
      if (hasType("data-exfil")) {
        facts.push({ kind: "warn", text: "Case type includes Data Exfiltration / Data Breach." });
      }
      if (hasType("bec") || hasType("account-takeover")) {
        facts.push({ kind: "warn", text: "BEC / account takeover: mailbox contents may have been accessed." });
      }
      if (c.iocs.length) {
        facts.push({ kind: "info", text: c.iocs.length + " IOCs recorded." });
      }
    }

    if (key === "recoverability") {
      const b = info.backups;
      if (b.immutable === "no") {
        facts.push({ kind: "warn", text: "Backups are NOT immutable." });
      } else if (b.immutable === "yes") {
        facts.push({ kind: "ok", text: "Backups are immutable." });
      }
      if (b.allServers === "no") {
        facts.push({ kind: "warn", text: "Not all servers are backed up" + (b.allServersNotes ? ": " + b.allServersNotes : ".") });
      } else if (b.allServers === "yes") {
        facts.push({ kind: "ok", text: "All servers are backed up." });
      }
      const where = [b.storage.cloud ? "cloud" : "", b.storage.onPrem ? "on-prem" : ""].filter(Boolean).join(" + ");
      if (where) {
        facts.push({ kind: "info", text: "Backups stored: " + where + (b.product ? " (" + b.product + ")" : "") + "." });
      }
      if (b.immutable === "" && b.allServers === "" && !where) {
        facts.push({ kind: "info", text: "Backup details not filled in yet (Client tab, Backups)." });
      }
      const noEdr = App.devicesWithoutEdr(c).length;
      if (noEdr) {
        facts.push({ kind: "warn", text: noEdr + " devices without EDR (blind spots during recovery)." });
      }
      if (info.criticalAssets.length) {
        facts.push({ kind: "info", text: info.criticalAssets.length + " critical assets in the restore order (Client tab)." });
      }
      if (hasType("ransomware") || hasType("wiper")) {
        facts.push({ kind: "warn", text: "Ransomware / wiper: recovery depends on clean, restorable backups." });
      }
    }
    return facts;
  },

  // ---------------------------------------------------------------
  // 3. Containment strategy
  // ---------------------------------------------------------------

  strategyHtml: function (c) {
    const tab = App.tabs.summary;
    return `
      <section class="client-section">
        <div class="section-header">
          <h3 class="section-title">Containment Strategy</h3>
          ${tab.remindersTipHtml(tab.CONTAINMENT_REMINDERS)}
        </div>
        ${tab.assumptionsHtml(c)}
        ${tab.actionsHtml(c)}
        ${tab.windowHtml(c)}
      </section>
    `;
  },

  // Assumptions suggested from the case. Each: { key, text, basis }.
  // Skips ones already added or dismissed.
  suggestions: function (c) {
    const plan = c.summary.containment;
    const has = function (k) { return c.types.includes(k); };
    const affected = c.assets.filter(function (a) { return a.status !== "clean"; });
    const tactics = c.storyline.map(function (st) { return st.tactic; });
    const noEdr = App.devicesWithoutEdr(c).length;
    const out = [];

    // 1. Foothold + telemetry gap -> credential theft across the domain.
    const foothold = affected.length > 0 || c.storyline.length > 0;
    const edrChecked = c.clientInfo.devices.rmmCheck !== null;
    if (foothold && (noEdr > 0 || !edrChecked)) {
      const basis = [];
      basis.push(noEdr > 0 ? noEdr + " devices without EDR" : "EDR coverage not confirmed (RMM not checked)");
      const servers = affected.filter(function (a) { return a.type === "server"; }).map(function (a) { return a.name; });
      if (servers.length) { basis.push("attacker reached server(s): " + servers.join(", ")); }
      if (tactics.includes("TA0006")) { basis.push("Credential Access in the Storyline"); }
      if (tactics.includes("TA0008")) { basis.push("Lateral Movement in the Storyline"); }
      out.push({ key: "domain-credentials",
        text: "Assume credential theft across the domain: reset privileged and service accounts, krbtgt twice, and all user passwords; revoke cloud sessions.",
        basis: basis.join("; ") + "." });
    }

    // 1b. A Tier 0 asset is affected -> full domain compromise.
    const tier0 = App.tier0Affected(c);
    if (tier0.length) {
      out.push({ key: "tier0-domain",
        text: "Assume full domain compromise: the attacker reached a Tier 0 asset. Treat every account and every domain-joined system as untrusted until rebuilt or reset (krbtgt twice, all privileged and service accounts, Entra Connect).",
        basis: "Tier 0 asset affected: " + tier0.map(function (a) { return a.name; }).join(", ") + "." });
    }

    // 2. BEC / account takeover -> stolen session tokens.
    const accounts = affected.filter(function (a) { return a.type === "account" || a.type === "mailbox"; });
    if (has("bec") || has("account-takeover") || accounts.length) {
      out.push({ key: "cloud-tokens",
        text: "Assume session tokens for affected accounts were stolen: a password reset alone isn't enough. Revoke sessions and check MFA methods, inbox rules, and app consents.",
        basis: (accounts.length ? "Affected account(s): " + accounts.map(function (a) { return a.name; }).join(", ") : "BEC / account takeover case") + "." });
    }

    // 3. Ransomware + backups not confirmed immutable -> backups at risk.
    const b = c.clientInfo.backups;
    if ((has("ransomware") || has("wiper")) && b.immutable !== "yes") {
      out.push({ key: "backups-at-risk",
        text: "Assume backups reachable from the domain can be encrypted or tampered with: protect them before and during containment.",
        basis: (b.immutable === "no" ? "Backups are not immutable" : "Backup immutability not confirmed") +
               (b.storage.onPrem ? "; stored on-prem" : "") + "." });
    }

    // 4. Ransomware / data breach, no exfiltration seen -> assume exfiltration.
    if ((has("ransomware") || has("data-exfil")) && !tactics.includes("TA0010")) {
      out.push({ key: "exfiltration",
        text: "Assume data was exfiltrated until the logs show otherwise (double extortion).",
        basis: "No Exfiltration entries in the Storyline, and outbound visibility isn't confirmed." });
    }

    return out.filter(function (s) {
      return !plan.dismissedSuggestions.includes(s.key) &&
             !plan.assumptions.some(function (a) { return a.source === s.key; });
    });
  },

  assumptionsHtml: function (c) {
    const tab = App.tabs.summary;
    const e = App.escapeHtml;
    const plan = c.summary.containment;

    const rows = plan.assumptions.map(function (a) {
      return `
        <div class="assumption">
          <textarea data-assumption="${e(a.id)}" data-key="text" rows="2"
                    placeholder="What you assume">${e(a.text)}</textarea>
          <input data-assumption="${e(a.id)}" data-key="basis" value="${e(a.basis)}"
                 placeholder="Basis: why (facts, gaps in logs / telemetry)">
          <button class="btn btn-small btn-danger" data-action="remove-assumption" data-id="${e(a.id)}">Remove</button>
        </div>
      `;
    }).join("");

    const suggestions = tab.suggestions(c).map(function (s) {
      return `
        <div class="suggestion">
          <div>💡 <strong>${e(s.text)}</strong><div class="muted small">Basis: ${e(s.basis)}</div></div>
          <div class="suggestion-buttons">
            <button class="btn btn-small btn-primary" data-action="accept-suggestion" data-key="${e(s.key)}">Add</button>
            <button class="btn btn-small" data-action="dismiss-suggestion" data-key="${e(s.key)}">Dismiss</button>
          </div>
        </div>
      `;
    }).join("");

    // Counts for the folded title, e.g. "(2 written · 3 suggested)".
    const suggestedCount = tab.suggestions(c).length;
    const counts = [plan.assumptions.length + " written"];
    if (suggestedCount) {
      counts.push(suggestedCount + " suggested");
    }

    // <details> = a box that folds open / closed when you click its
    // <summary> line. No JavaScript needed for the folding itself.
    return `
      <div class="impact-category">
        <details id="assumptions-box" class="fold"${App.state.assumptionsOpen ? " open" : ""}>
          <summary>
            <h4>Assumptions <span class="category-hint">(what you assume, and why)</span>
              <span class="muted small">${e(counts.join(" · "))}</span></h4>
          </summary>
          <div class="fold-body">
            <div class="fold-actions">
              <button class="btn btn-small" data-action="add-assumption">+ Add assumption</button>
            </div>
            ${rows || '<p class="muted small">No assumptions written down yet.</p>'}
            ${suggestions ? `<div class="suggestions"><div class="muted small">Suggested from the case:</div>${suggestions}</div>` : ""}
          </div>
        </details>
      </div>
    `;
  },

  // The containment window (when everything happens together) and notes.
  windowHtml: function (c) {
    const e = App.escapeHtml;
    const plan = c.summary.containment;
    return `
      <div class="impact-category">
        <div class="sub-row">
          <span class="sub-label">Containment window <span class="zone-hint" data-zone-hint></span></span>
          <!-- data-time: typed in the sidebar's zone, saved as UTC. Also the
               default due time of containment actions without their own. -->
          <input type="datetime-local" step="1" data-field="containment.windowStart" data-time
                 value="${e(App.time.toDisplay(plan.windowStart))}">
          <span class="muted small">Containment actions without their own due time use this.</span>
        </div>
        <label class="client-field">Notes
          <textarea data-field="containment.checklistNotes" rows="2"
                    placeholder="Who was notified, which channel, ticket / change numbers...">${e(plan.checklistNotes)}</textarea>
        </label>
      </div>
    `;
  },

  actionsHtml: function (c) {
    const e = App.escapeHtml;
    const tf = App.taskForm;
    const items = c.tasks.filter(function (t) { return t.kind === "containment"; });

    // Progress line, e.g. "8 actions: 4 done, 1 blocked ... · 1 done without approval".
    let progress = "";
    if (items.length) {
      const counts = App.TASK_STATUSES
        .map(function (s) {
          const n = items.filter(function (t) { return t.status === s.key; }).length;
          return n ? n + " " + s.label.toLowerCase() : "";
        })
        .filter(Boolean);
      const noApproval = items.filter(function (t) { return t.status === "done" && !App.taskHasApproval(t); }).length;
      progress = `<p class="small">${items.length} action${items.length === 1 ? "" : "s"}: ${e(counts.join(", "))}` +
        (noApproval ? ` · <span class="copy-bad">${noApproval} done without recorded approval</span>` : "") + "</p>";
    }

    // Evidence preservation (one action item per affected asset):
    // preserve BEFORE containing, so show how far along it is.
    const pres = App.preservationProgress(c);
    let presLine = "";
    if (pres.total) {
      presLine = pres.open
        ? `<p class="small"><span class="copy-bad">⚠ Evidence preservation: ${pres.open} of ${pres.total} action items still open</span> <span class="muted">(Action Items)</span></p>`
        : `<p class="small copy-ok">✓ Evidence preservation: all ${pres.total} action items closed</p>`;
    }

    const rows = items.map(function (t) {
      const action = App.CONTAINMENT_ACTIONS.find(function (a) { return a.key === t.actionType; });
      const targets = t.targets.map(function (x) { return `<span class="tag tag-type">${e(x)}</span>`; }).join(" ");
      const approval = tf.approvalHtml(t) ||
        (App.taskIsOpen(t) ? '<span class="muted small">needs approval</span>' : "");
      return `
        <tr class="${App.taskIsOpen(t) ? "" : "task-closed"}">
          <td class="nowrap"><strong>${e(t.id)}</strong></td>
          <td class="task-title">
            ${e(t.title)}
            ${action && action.key !== "other" && action.label !== t.title ? `<div class="muted small">${e(action.label)}</div>` : ""}
            ${targets ? `<div class="task-tags">${targets}</div>` : ""}
            ${action && action.hint && App.taskIsOpen(t) ? `<div class="hint-inline">💡 <strong>Before you do this:</strong> ${e(action.hint)}</div>` : ""}
            ${t.statusReason && (t.status === "blocked" || t.status === "not-needed")
              ? `<div class="task-reason">${t.status === "blocked" ? "Waiting on: " : "Not needed: "}${e(t.statusReason)}</div>` : ""}
          </td>
          <td class="nowrap">${e(App.labelFor(App.TASK_OWNERS, t.owner) + (t.ownerName ? ": " + t.ownerName : ""))}</td>
          <td class="nowrap">${tf.dueHtml(c, t)}</td>
          <td>${approval}</td>
          <td>${tf.statusSelectHtml(t)}</td>
          <td class="nowrap"><button class="btn btn-small" data-action="edit-task" data-id="${e(t.id)}">Edit</button></td>
        </tr>
      `;
    }).join("");

    const typeOptions = App.CONTAINMENT_ACTIONS
      .map(function (a) { return `<option value="${e(a.key)}">${e(a.label)}</option>`; })
      .join("");

    return `
      <div class="impact-category">
        <h4>Containment actions <span class="category-hint">(listed and synched with Action Items)</span></h4>
        <div class="add-action-row">
          <select id="containment-type">${typeOptions}</select>
          <button class="btn btn-small btn-primary" data-action="add-containment">+ Add action</button>
        </div>
        ${progress}
        ${presLine}
        ${items.length ? `
          <div class="table-wrap">
            <table class="data-table task-table">
              <thead><tr><th>ID</th><th>Action</th><th>Owner</th><th>Due</th><th>Approval</th><th>Status</th><th></th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>` : '<p class="muted small">No containment actions yet. Pick one above.</p>'}
      </div>
    `;
  },

  // ---------------------------------------------------------------
  // Setup: delegated listeners (like the Client tab)
  // ---------------------------------------------------------------

  setup: function () {
    const tab = App.tabs.summary;
    const panel = document.getElementById("summary");

    // FOLDING: remember whether the Assumptions box is open, so a redraw
    // keeps it the way you left it. "toggle" doesn't bubble up like a
    // click does, so we listen in the "capture" phase (the "true" at the
    // end), which sees events on their way DOWN to the element.
    panel.addEventListener("toggle", function (event) {
      if (event.target.id === "assumptions-box") {
        App.state.assumptionsOpen = event.target.open;
      }
    }, true);

    // TYPING: save without redrawing (you keep your place).
    panel.addEventListener("input", function (event) {
      const t = event.target;
      const caseId = App.state.selectedCaseId;
      if (t.dataset.assumption) {
        App.updateAssumption(caseId, t.dataset.assumption, t.dataset.key, t.value);
        return;
      }
      if (!t.dataset.field || t.type === "radio" || t.type === "checkbox") {
        return;                                  // handled in "change"
      }
      // Time boxes (data-time) are typed in the sidebar's zone; save UTC.
      const value = t.dataset.time !== undefined ? App.time.fromDisplay(t.value) : t.value;
      App.setSummaryField(caseId, t.dataset.field, value);
    });

    // CHOOSING: radio buttons, tick boxes, and status dropdowns save, then
    // redraw. A time box also redraws when you leave it (the window time
    // changes containment due times).
    panel.addEventListener("change", function (event) {
      const t = event.target;
      const caseId = App.state.selectedCaseId;
      if (t.dataset.status) {
        App.taskForm.changeStatus(App.getSelectedCase(), t.dataset.status, t.value);
        return;
      }
      if (!t.dataset.field) {
        return;
      }
      const field = t.dataset.field;
      if (t.type === "radio") {
        App.setSummaryField(caseId, field, t.value);
        App.render();
      } else if (t.type === "checkbox") {
        // Information impact: "None" and the others exclude each other.
        if (field.startsWith("impact.information.")) {
          if (t.checked && field === "impact.information.none") {
            for (const k of ["privacy", "proprietary", "integrity"]) {
              App.setSummaryField(caseId, "impact.information." + k, false);
            }
          } else if (t.checked) {
            App.setSummaryField(caseId, "impact.information.none", false);
          }
        }
        App.setSummaryField(caseId, field, t.checked);
        App.render();
      } else if (t.dataset.time !== undefined || t.tagName === "SELECT") {
        // (A dropdown already saved in "input"; redraw so e.g. the
        // detection source's "specify" box appears or disappears.)
        App.render();
      }
    });

    // BUTTONS.
    panel.addEventListener("click", function (event) {
      const button = event.target.closest("[data-action]");
      if (!button) {
        return;
      }
      const caseId = App.state.selectedCaseId;
      const action = button.dataset.action;
      if (action === "add-assumption") {
        App.addAssumption(caseId, {});
        App.render();
      } else if (action === "remove-assumption") {
        if (confirm("Remove this assumption?")) {
          App.deleteAssumption(caseId, button.dataset.id);
          App.render();
        }
      } else if (action === "accept-suggestion") {
        const s = tab.suggestions(App.getSelectedCase()).find(function (x) { return x.key === button.dataset.key; });
        if (s) {
          App.addAssumption(caseId, { text: s.text, basis: s.basis, source: s.key });
          App.render();
        }
      } else if (action === "dismiss-suggestion") {
        App.dismissSuggestion(caseId, button.dataset.key);
        App.render();
      } else if (action === "add-containment") {
        const type = document.getElementById("containment-type").value;
        App.taskForm.open(null, { preset: { kind: "containment", actionType: type, priority: "p1" } });
      } else if (action === "edit-task") {
        App.taskForm.open(button.dataset.id);
      }
    });
  }
};
