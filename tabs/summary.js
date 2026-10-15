// summary.js - the Summary and Reports tab.
//   1. Incident summary
//   2. Impact assessment (NIST SP 800-61: functional, information, recoverability)
//   3. Containment strategy: assumptions, the containment actions, then
//      the containment window + notes. The actions ARE
//      containment items in case.tasks, the same list the Action Items
//      tab shows; both use the shared pop-up in core/taskform.js.
//   4. Eradication & Recovery Strategy: before-you-restore facts,
//      suggestions (added only on click), recovery actions in order
//      (recovery items in case.tasks, same idea as containment).
// Sections 1, 3 and 4 have a reminders "?" next to their title.
// Later: pre-call briefs and the client report.
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
      <div class="panel-toolbar">${App.emptyToggleHtml()}</div>
      ${tab.summaryHtml(caseObj)}
      ${tab.impactHtml(caseObj)}
      ${tab.strategyHtml(caseObj)}
      ${tab.recoveryHtml(caseObj)}
    `;
    App.time.fillZoneHints();     // "(UTC)" / "(Asia/Manila, UTC+08:00)"
    App.markEmptyFields(panel);   // red outlines if "Highlight empty fields" is on
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

  // Eradication & Recovery Strategy. Order matters here (unlike containment).
  RECOVERY_REMINDERS: [
    { strong: true, text: "Don't start recovery until containment is complete and credentials are reset, or you restore into a compromised environment." },
    { text: "Eradicate before restoring: remove persistence, attacker accounts and tools everywhere, and close the entry point (patch / MFA)." },
    { text: "Restore from a known-clean point: a backup from before the earliest attacker activity. Assume the attacker was in earlier than the logs show." },
    { text: "Rebuild rather than clean hosts with hands-on-keyboard activity: cleaning can miss persistence." },
    { text: "Every restored device needs EDR, confirmed healthy, before it rejoins the network." },
    { text: "Recover in the agreed order, phased (unlike containment): Tier 0 (identity) first, then the business critical list (BC-01 first)." },
    { text: "Watch closely after recovery: attackers often come back through something that was missed." },
    { text: "The business owner confirms each system works before it's called recovered." }
  ],

  // Credential reset waves (whole domain).
  WAVE_REMINDERS: [
    { strong: true, text: "Not all at once: reset in waves, in order. Each wave finished and checked before the next." },
    { text: "Tier 0 first, by a small trusted team, from clean admin workstations only." },
    { text: "krbtgt twice, never back to back: wait for AD replication on every DC and, ideally, the 10-hour TGT lifetime before the second reset." },
    { text: "Service accounts are the most dangerous phase: inventory first, agree a change window, test with the application owners." },
    { text: "Don't forget local accounts: many ransomware actors capture local admin credentials." },
    { text: "Communicate: the technical work is maybe 30%. Tell executives, IT operations, the helpdesk, application owners and users before you start." },
    { text: "Expect lockouts, cached passwords, mobile device prompts and VPN failures: increase helpdesk staffing for the reset." }
  ],

  // The hover "?" lives in core/pickers.js (App.remindersTipHtml) so other
  // tabs (e.g. Calls) can use it too; this name is kept for this file.
  remindersTipHtml: function (reminders) {
    return App.remindersTipHtml(reminders);
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
    // Coverage is confirmed by the RMM check, or by ticking "All
    // identified devices have EDR installed" (Client tab).
    const edrChecked = c.clientInfo.devices.rmmCheck !== null || c.clientInfo.devices.allHaveEdr;
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

    // 1c. The RMM is compromised (or suspected) -> it reached every
    //     managed device.
    const badRmms = App.rmmsWith(c, ["yes", "suspected"]);
    if (badRmms.length) {
      out.push({ key: "rmm-compromised",
        text: "Assume the attacker could run code on every device managed by " + App.rmmNames(badRmms) +
              ": treat all managed devices as in scope, and don't use the RMM for the response.",
        basis: badRmms.map(function (r) {
          return App.rmmLabel(r) + " marked " + (r.compromised === "yes" ? "compromised" : "suspected") +
                 (r.notes ? " (" + r.notes + ")" : "");
        }).join("; ") + " (Client tab)." });
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
      const action = App.taskAction(t);
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

    // Grouped by Endpoint / Identities / Network / ... (App.CONTAINMENT_GROUPS).
    const typeOptions = App.containmentOptionsHtml("");

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
  // 4. Eradication & Recovery Strategy
  // ---------------------------------------------------------------
  // The actions ARE recovery items in case.tasks (also in Action Items),
  // listed here in recovery order (App.recoveryItems: BC order by default,
  // ↑ / ↓ to change it). Suggestions are only added when you click Add.

  recoveryHtml: function (c) {
    const tab = App.tabs.summary;
    return `
      <section class="client-section">
        <div class="section-header">
          <h3 class="section-title">Eradication &amp; Recovery Strategy</h3>
          ${tab.remindersTipHtml(tab.RECOVERY_REMINDERS)}
        </div>
        ${tab.recoveryBannerHtml(c)}
        ${tab.beforeRestoreHtml(c)}
        ${tab.wavesHtml(c)}
        ${tab.recoverySuggestionsHtml(c)}
        ${tab.recoveryActionsHtml(c)}
      </section>
    `;
  },

  // Containment still running? Recovery shouldn't start yet.
  recoveryBannerHtml: function (c) {
    const open = c.tasks.filter(function (t) { return t.kind === "containment" && App.taskIsOpen(t); }).length;
    if (open === 0) {
      return "";
    }
    return `<div class="alert alert-warning">⚠ ${open} containment action${open === 1 ? " is" : "s are"} still open:
              finish containment (and reset credentials) before starting recovery.</div>`;
  },

  // Facts to have in front of you before restoring anything.
  beforeRestoreHtml: function (c) {
    const e = App.escapeHtml;
    const facts = [];

    // Clean restore point: before the earliest attacker activity.
    const first = App.sortedStoryline(c).find(function (st) { return st.timestamp !== ""; });
    facts.push(first
      ? `Clean restore point: from <strong>before ${e(App.taskForm.when(first.timestamp))}</strong> (${e(first.id)}, the earliest attacker activity in the Storyline). Assume the attacker was in earlier.`
      : "Clean restore point: unknown, no Storyline entries with a time yet.");

    // Backups, from the Client tab.
    const b = c.clientInfo.backups;
    const backupParts = [];
    if (b.product) { backupParts.push(e(b.product)); }
    if (b.immutable === "yes") { backupParts.push("immutable"); }
    if (b.immutable === "no") { backupParts.push('<span class="copy-bad">NOT immutable</span>'); }
    const where = [b.storage.cloud ? "cloud" : "", b.storage.onPrem ? "on-prem" : ""].filter(Boolean).join(" + ");
    if (where) { backupParts.push("stored " + where); }
    if (b.allServers === "no") {
      backupParts.push('<span class="copy-bad">not all servers backed up</span>' + (b.allServersNotes ? ": " + e(b.allServersNotes) : ""));
    }
    facts.push("Backups: " + (backupParts.length ? backupParts.join(" · ") : "not filled in yet (Client tab)."));

    // Tier order: identity first.
    const tierWarning = App.tierOrderWarning(c);
    if (tierWarning) {
      facts.push(`<span class="copy-bad">⚠ ${e(tierWarning)}</span> (Client tab, Critical assets)`);
    }

    return `
      <div class="impact-category">
        <h4>Before you restore</h4>
        <ul class="facts">${facts.map(function (f) { return "<li>" + f + "</li>"; }).join("")}</ul>
      </div>`;
  },

  // Credential reset waves: progress line, Copy / Save buttons and the
  // "?" always visible; the six wave cards fold away (closed when the
  // app opens, App.state.wavesOpen, like Assumptions).
  wavesHtml: function (c) {
    const tab = App.tabs.summary;
    const e = App.escapeHtml;
    const done = App.CREDENTIAL_WAVES.filter(function (w) { return App.waveState(c, w.key).status === "done"; }).length;
    const total = App.CREDENTIAL_WAVES.length;

    const cards = App.CREDENTIAL_WAVES.map(function (w, i) {
      const s = App.waveState(c, w.key);
      const options = App.WAVE_STATUSES.map(function (o) {
        return `<option value="${e(o.key)}"${o.key === s.status ? " selected" : ""}>${e(o.label)}</option>`;
      }).join("");
      const list = function (items) { return items.map(function (x) { return "<li>" + e(x) + "</li>"; }).join(""); };
      return `
        <div class="wave-card wave-${e(s.status || "todo")}">
          <div class="wave-head">
            <strong>Wave ${i + 1}: ${e(w.title)}</strong>
            ${w.tag ? `<span class="tag tag-warning-soft">${e(w.tag)}</span>` : ""}
            <span class="spacer"></span>
            <select class="cell-input" data-wave="${e(w.key)}">${options}</select>
            ${s.doneAt ? `<span class="muted small">done ${e(App.taskForm.when(s.doneAt))}</span>` : ""}
          </div>
          <div class="wave-body">
            <div><span class="muted small">In scope</span><ul>${list(w.what)}</ul></div>
            <div><span class="muted small">How</span><ul>${list(w.how)}</ul></div>
          </div>
          <input class="grow wave-notes" data-wave-notes="${e(w.key)}" value="${e(s.notes)}"
                 placeholder="Notes: who did it, when, issues (included in the shared plan)">
        </div>`;
    }).join("");

    const comms = App.WAVE_COMMS;
    return `
      <div class="impact-category">
        <div class="section-header">
          <h4>Credential reset waves <span class="category-hint">(whole domain: never all at once)</span>
            <span class="muted small">${done} of ${total} done</span></h4>
          <div class="header-buttons">
            <button class="btn btn-small" data-action="copy-waves" title="A plain-text plan for the system administrators (email / Teams)">Copy plan for sysadmins</button>
            <button class="btn btn-small" data-action="save-waves" title="The same plan as a .txt file in the case's exports/ folder">Save as text file</button>
            ${tab.remindersTipHtml(tab.WAVE_REMINDERS)}
          </div>
        </div>
        <details id="waves-box" class="fold"${App.state.wavesOpen ? " open" : ""}>
          <summary><span class="small">Show the waves</span></summary>
          <div class="fold-body">
            ${cards}
            <div class="wave-card">
              <strong>Communicate</strong> <span class="muted small">${e(comms.note)}</span>
              <div class="wave-body">
                <div><span class="muted small">Notify</span><ul>${comms.notify.map(function (x) { return "<li>" + e(x) + "</li>"; }).join("")}</ul></div>
                <div><span class="muted small">Expected issues</span><ul>${comms.issues.map(function (x) { return "<li>" + e(x) + "</li>"; }).join("")}</ul>
                  <span class="small">${e(comms.helpdesk)}</span></div>
              </div>
            </div>
          </div>
        </details>
      </div>`;
  },

  // The waves as plain text, to share with system administrators.
  // Checkboxes ("[ ]" / "[x]") so they can tick them off in an email.
  wavesText: function (c) {
    const lines = [];
    const client = c.client ? " · " + c.client : "";
    lines.push("CREDENTIAL RESET PLAN (in waves) – " + c.id + client);
    lines.push("Prepared " + App.taskForm.when(App.time.nowUtc()) + ". Do the waves in order, one at a time. Never reset everything at once.");
    // This environment's Tier 0 systems (from the critical assets list).
    const tier0 = c.clientInfo.criticalAssets.filter(function (a) { return a.tier === "t0" && a.name; });
    if (tier0.length) {
      lines.push("Tier 0 systems in this environment: " + tier0.map(function (a) { return a.name; }).join(", "));
    }
    App.CREDENTIAL_WAVES.forEach(function (w, i) {
      const s = App.waveState(c, w.key);
      const status = App.labelFor(App.WAVE_STATUSES, s.status) + (s.doneAt ? " " + App.taskForm.when(s.doneAt) : "");
      lines.push("");
      lines.push((s.status === "done" ? "[x] " : "[ ] ") + "WAVE " + (i + 1) + ": " + w.title.toUpperCase() +
                 (w.tag ? " (" + w.tag + ")" : "") + " – " + status);
      lines.push("  In scope:");
      w.what.forEach(function (x) { lines.push("    - " + x); });
      lines.push("  How:");
      w.how.forEach(function (x) { lines.push("    - " + x); });
      if (s.notes) {
        lines.push("  Notes: " + s.notes);
      }
    });
    const comms = App.WAVE_COMMS;
    lines.push("");
    lines.push("COMMUNICATION: " + comms.note);
    lines.push("  Notify: " + comms.notify.join(", "));
    lines.push("  Expected issues: " + comms.issues.join(", "));
    lines.push("  " + comms.helpdesk);
    return lines.join("\n");
  },

  // Recovery items suggested from the case. Each: { key, title, actionType,
  // targets }. Nothing is added until you click Add. Skips ones already
  // added (their item carries auto: "rec:<key>") or dismissed.
  recoverySuggestions: function (c) {
    const out = [];
    const affected = c.assets.filter(function (a) { return a.status !== "clean"; });
    const tactics = c.storyline.map(function (st) { return st.tactic; });

    // Affected computers (not accounts / mailboxes): only these need an
    // eradication sweep and an EDR check.
    const hostsAffected = affected.some(function (a) {
      return !["account", "service-account", "mailbox"].includes(a.type);
    });

    // General: hunt for the attacker everywhere, with every IOC.
    if (hostsAffected || c.iocs.length) {
      out.push({ key: "threat-hunt", actionType: "threat-hunt", targets: [],
        title: "Threat hunt for all available IOCs of the threat actor (" + c.iocs.length + " in the IOCs tab)" });
    }
    // Device: clean persistence the Storyline found.
    const persistence = c.storyline.filter(function (st) { return st.tactic === "TA0003"; });
    if (persistence.length) {
      out.push({ key: "storyline-persistence", actionType: "remove-persistence",
        targets: persistence.map(function (st) { return st.host; }).filter(Boolean)
          .filter(function (h, i, list) { return list.indexOf(h) === i; }),     // no repeats
        title: "Clean persistence found in the Storyline (" + persistence.map(function (st) { return st.id; }).join(", ") + ")" });
    }
    // Control: patch how they got in.
    const entry = c.storyline.filter(function (st) { return st.tactic === "TA0001"; });
    if (entry.length) {
      out.push({ key: "close-entry", actionType: "close-entry", targets: [],
        title: "Patch initial access (" + entry.map(function (st) { return st.id; }).join(", ") + ")" });
    }
    // Credentials: Patient 0 = the host / user of the earliest Storyline entry.
    const firstEntry = App.sortedStoryline(c).find(function (st) { return st.timestamp !== "" && st.host; });
    if (firstEntry) {
      out.push({ key: "patient-zero", actionType: "patient-zero", targets: [firstEntry.host],
        title: "Patient 0: reset credentials for " + firstEntry.host + " (" + firstEntry.id + ", the earliest Storyline entry)" });
    }
    // Credentials: domain-wide, if a domain compromise was assumed.
    const assumed = c.summary.containment.assumptions.map(function (a) { return a.source; });
    if (assumed.includes("domain-credentials") || assumed.includes("tier0-domain")) {
      out.push({ key: "reset-credentials", actionType: "reset-creds-recovery", targets: [],
        title: "Whole domain credential reset by tier (in waves): Tier 0, then Tier 1, then Tier 2" });
      out.push({ key: "rotate-secrets", actionType: "rotate-secrets", targets: [],
        title: "Rotate secrets (API keys, certificates, SSH keys, tokens) reachable from compromised hosts" });
    }

    // Restore / rebuild each affected asset: business critical ones first,
    // in BC order, then the rest.
    const ordered = affected.slice().sort(function (a, b) {
      const pa = App.criticalMatch(c, a.name) ? App.criticalMatch(c, a.name).position : Infinity;
      const pb = App.criticalMatch(c, b.name) ? App.criticalMatch(c, b.name).position : Infinity;
      return pa === pb ? 0 : (pa < pb ? -1 : 1);
    });
    for (const a of ordered) {
      const match = App.criticalMatch(c, a.name);
      const bc = match ? " (" + match.label + ")" : "";
      if (a.type === "account" || a.type === "service-account" || a.type === "mailbox") {
        // Accounts keep their full name in the key (normalizeHost would cut
        // "j.doe@acme.example" down to "j").
        out.push({ key: "account:" + a.name.trim().toLowerCase(), actionType: "reenable-accounts", targets: [a.name],
          title: "Reset and re-enable " + a.name + " (after MFA re-registration)" });
      } else if (a.type === "server") {
        out.push({ key: "restore:" + App.normalizeHost(a.name), actionType: "restore-backup", targets: [a.name],
          title: "Restore " + a.name + " from backup" + bc });
        out.push({ key: "verify-backup:" + App.normalizeHost(a.name), actionType: "verify-backup", targets: [a.name],
          title: "Verify " + a.name + "'s backup is clean before restoring" });
      } else {
        out.push({ key: "rebuild:" + App.normalizeHost(a.name), actionType: "rebuild", targets: [a.name],
          title: "Rebuild / reimage " + a.name + bc });
      }
    }

    // VPN switched off during containment? Bring it back safely.
    const vpnOff = c.tasks.some(function (t) { return t.actionType === "disable-vpn" && t.status === "done"; });
    if (vpnOff) {
      out.push({ key: "reenable-vpn", actionType: "reenable-vpn", targets: [],
        title: "Re-enable VPN (patched, with MFA)" });
    }

    // Cloud: a cloud case or an affected cloud resource. Azure and / or AWS
    // depending on what the Client tab's Environment > Cloud says (both
    // if it doesn't say).
    const cloudCase = c.types.includes("cloud") || affected.some(function (a) { return a.type === "cloud"; });
    if (cloudCase) {
      const env = (c.clientInfo.environment.cloud || "").toLowerCase();
      const azure = /azure|entra/.test(env);
      const aws = /\baws\b|amazon/.test(env);
      if (azure || !aws) {
        out.push({ key: "az-rbac", actionType: "az-rbac", targets: [], title: "Azure: review role assignments and remove attacker ones" });
        out.push({ key: "az-rotate", actionType: "az-rotate", targets: [], title: "Azure: rotate keys and secrets (storage keys, SAS, Key Vault, service principals)" });
        out.push({ key: "az-resources", actionType: "az-resources", targets: [], title: "Azure: remove attacker-created resources" });
        out.push({ key: "az-logging", actionType: "az-logging", targets: [], title: "Azure: Defender for Cloud and log retention on" });
      }
      if (aws || !azure) {
        out.push({ key: "aws-iam", actionType: "aws-iam", targets: [], title: "AWS: review IAM users, roles, access keys and policies" });
        out.push({ key: "aws-rotate", actionType: "aws-rotate", targets: [], title: "AWS: rotate access keys and secrets" });
        out.push({ key: "aws-resources", actionType: "aws-resources", targets: [], title: "AWS: remove attacker-created resources in every region" });
        out.push({ key: "aws-logging", actionType: "aws-logging", targets: [], title: "AWS: CloudTrail (all regions), GuardDuty and Config on" });
      }
    }

    // BEC / account takeover, or affected accounts / mailboxes: the email
    // and identity clean-up.
    const isBec = c.types.includes("bec");
    const accountCase = isBec || c.types.includes("account-takeover");
    const accounts = affected
      .filter(function (a) { return a.type === "account" || a.type === "mailbox"; })
      .map(function (a) { return a.name; });
    if (accountCase || accounts.length) {
      out.push({ key: "bec-reset-mfa", actionType: "bec-reset-mfa", targets: accounts,
        title: "Reset MFA methods and re-register" + (accounts.length ? " for " + accounts.join(", ") : "") });
      out.push({ key: "bec-rule-sweep", actionType: "bec-rule-sweep", targets: [],
        title: "Tenant-wide sweep for malicious inbox / forwarding / transport rules" });
      out.push({ key: "bec-review-sent", actionType: "bec-review-sent", targets: accounts,
        title: "Review mail sent by the attacker (message trace / sent items)" });
      out.push({ key: "bec-oauth-review", actionType: "bec-oauth-review", targets: [],
        title: "Review OAuth app consents tenant-wide" });
      out.push({ key: "bec-conditional-access", actionType: "bec-conditional-access", targets: [],
        title: "Harden sign-in: block legacy auth, Conditional Access" });
    }
    if (isBec) {
      out.push({ key: "bec-notify-contacts", actionType: "bec-notify-contacts", targets: [],
        title: "Notify affected contacts / vendors (fraud warning)" });
      out.push({ key: "bec-payment-recall", actionType: "bec-payment-recall", targets: [],
        title: "Contact the bank to recall / freeze fraudulent payments (if any were made)" });
      out.push({ key: "bec-audit-logging", actionType: "bec-audit-logging", targets: [],
        title: "Make sure mailbox auditing and audit log retention are on" });
    }

    // Validation and monitoring, once there's something to recover.
    if (hostsAffected) {
      out.push({ key: "confirm-edr", actionType: "confirm-edr", targets: [],
        title: "Confirm EDR on every restored device before it rejoins the network" });
    }
    if (affected.length) {
      out.push({ key: "monitoring", actionType: "monitoring", targets: [],
        title: "Enhanced monitoring period after recovery" });
    }

    const r = c.summary.recovery;
    return out.filter(function (s) {
      return !r.dismissedSuggestions.includes(s.key) &&
             !c.tasks.some(function (t) { return t.auto === "rec:" + s.key; });
    });
  },

  recoverySuggestionsHtml: function (c) {
    const e = App.escapeHtml;
    const list = App.tabs.summary.recoverySuggestions(c);
    if (list.length === 0) {
      return "";
    }
    const rows = list.map(function (s) {
      const action = App.RECOVERY_ACTIONS.find(function (a) { return a.key === s.actionType; });
      // The grey line: the catalog action (only if the title doesn't
      // already say it) and the targets.
      const details = [];
      if (action && !s.title.toLowerCase().startsWith(action.label.toLowerCase().slice(0, 20))) {
        details.push(action.label);
      }
      if (s.targets.length) {
        details.push(s.targets.join(", "));
      }
      return `
        <div class="suggestion">
          <div>💡 <strong>${e(s.title)}</strong>
            ${details.length ? `<div class="muted small">${e(details.join(" · "))}</div>` : ""}</div>
          <div class="suggestion-buttons">
            <button class="btn btn-small btn-primary" data-action="add-rec-suggestion" data-key="${e(s.key)}">Add</button>
            <button class="btn btn-small" data-action="dismiss-rec-suggestion" data-key="${e(s.key)}">Dismiss</button>
          </div>
        </div>`;
    }).join("");
    // A fold-away box like Assumptions: closed when the app opens, and it
    // stays the way you left it while you work (App.state, not saved).
    return `
      <div class="impact-category">
        <details id="recovery-suggestions-box" class="fold"${App.state.recoverySuggestionsOpen ? " open" : ""}>
          <summary>
            <h4>Suggestions <span class="category-hint">(nothing is added until you click Add)</span>
              <span class="muted small">${list.length} suggestion${list.length === 1 ? "" : "s"}</span></h4>
          </summary>
          <div class="fold-body">
            <div class="suggestions">${rows}</div>
          </div>
        </details>
      </div>`;
  },

  // Add one suggestion as a recovery item (marked so it isn't suggested again).
  addRecoverySuggestion: function (c, key) {
    const s = App.tabs.summary.recoverySuggestions(c).find(function (x) { return x.key === key; });
    if (!s) {
      return;
    }
    App.addTask(c.id, { kind: "recovery", actionType: s.actionType, title: s.title, targets: s.targets,
                        priority: "p2", owner: "me", status: "planned", auto: "rec:" + s.key });
  },

  recoveryActionsHtml: function (c) {
    const e = App.escapeHtml;
    const tf = App.taskForm;
    const items = App.recoveryItems(c);
    const custom = c.summary.recovery.order.length > 0;

    // Progress line, e.g. "6 actions: 2 done, 4 planned".
    let progress = "";
    if (items.length) {
      const counts = App.TASK_STATUSES
        .map(function (s) {
          const n = items.filter(function (t) { return t.status === s.key; }).length;
          return n ? n + " " + s.label.toLowerCase() : "";
        })
        .filter(Boolean);
      progress = `<p class="small">${items.length} action${items.length === 1 ? "" : "s"}: ${e(counts.join(", "))}
        · <span class="muted">${custom ? "custom order" : "in business critical order (BC-01 first)"}</span>
        ${custom ? '<button class="btn btn-small" data-action="reset-recovery-order">Reset to BC order</button>' : ""}</p>`;
    }

    const rows = items.map(function (t, i) {
      const action = App.taskAction(t);
      // Targets with their asset tags ([Tier 0] [BC-01]) when they're assets.
      const targets = t.targets.map(function (x) {
        const asset = App.findAssetByName(c.id, x);
        const match = App.criticalMatch(c, x);
        const tags = asset ? App.assetTagsHtml(c, asset)
          : (match ? `<span class="tag tag-critical">${e(match.label)}</span>` : "");
        return `<span class="tag tag-type">${e(x)}</span>${tags ? " " + tags : ""}`;
      }).join(" ");
      return `
        <tr class="${App.taskIsOpen(t) ? "" : "task-closed"}">
          <td class="restore-order">${i + 1}</td>
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
          <td>${tf.statusSelectHtml(t)}</td>
          <td class="nowrap">
            <button class="btn btn-small" data-action="move-recovery" data-id="${e(t.id)}" data-step="-1" title="Earlier"${i === 0 ? " disabled" : ""}>↑</button>
            <button class="btn btn-small" data-action="move-recovery" data-id="${e(t.id)}" data-step="1" title="Later"${i === items.length - 1 ? " disabled" : ""}>↓</button>
            <button class="btn btn-small" data-action="edit-task" data-id="${e(t.id)}">Edit</button>
          </td>
        </tr>`;
    }).join("");

    return `
      <div class="impact-category">
        <h4>Eradication &amp; recovery actions <span class="category-hint">(listed and synched with Action Items)</span></h4>
        <div class="add-action-row">
          <select id="recovery-type">${App.actionOptionsHtml("recovery", "")}</select>
          <button class="btn btn-small btn-primary" data-action="add-recovery">+ Add action</button>
        </div>
        ${progress}
        ${items.length ? `
          <div class="table-wrap">
            <table class="data-table task-table">
              <thead><tr><th>#</th><th>ID</th><th>Action</th><th>Owner</th><th>Due</th><th>Status</th><th></th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>` : '<p class="muted small">No recovery actions yet. Add a suggestion above, or pick one.</p>'}
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
      } else if (event.target.id === "recovery-suggestions-box") {
        App.state.recoverySuggestionsOpen = event.target.open;
      } else if (event.target.id === "waves-box") {
        App.state.wavesOpen = event.target.open;
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
      if (t.dataset.waveNotes) {                 // data-wave-notes="w1"
        App.setWaveField(caseId, t.dataset.waveNotes, "notes", t.value);
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
      if (t.dataset.wave) {                      // a wave's status dropdown
        App.setWaveField(caseId, t.dataset.wave, "status", t.value);
        App.render();
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
      } else if (action === "copy-waves") {
        // copyText is async (it returns a Promise, like a Python coroutine):
        // .then() runs when it's finished.
        App.copyText(App.tabs.summary.wavesText(App.getSelectedCase())).then(function (ok) {
          App.flashButton(button, ok ? "Copied!" : "Copy failed");
        });
      } else if (action === "save-waves") {
        const c = App.getSelectedCase();
        const name = App.safeFileName(c.id) + "_credential_reset_waves.txt";
        App.storage.saveExport(c, name, App.tabs.summary.wavesText(c)).then(function (result) {
          App.flashButton(button, result.saved ? "Saved to exports/" : "Downloaded");
        });
      } else if (action === "add-recovery") {
        const type = document.getElementById("recovery-type").value;
        App.taskForm.open(null, { preset: { kind: "recovery", actionType: type, priority: "p2" } });
      } else if (action === "add-rec-suggestion") {
        App.tabs.summary.addRecoverySuggestion(App.getSelectedCase(), button.dataset.key);
        App.render();
      } else if (action === "dismiss-rec-suggestion") {
        App.dismissRecoverySuggestion(caseId, button.dataset.key);
        App.render();
      } else if (action === "move-recovery") {
        App.moveRecoveryItem(caseId, button.dataset.id, Number(button.dataset.step));
        App.render();
      } else if (action === "reset-recovery-order") {
        App.resetRecoveryOrder(caseId);
        App.render();
      } else if (action === "edit-task") {
        App.taskForm.open(button.dataset.id);
      }
    });
  }
};
