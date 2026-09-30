// sample.js - fake cases for testing, while everything is in memory.
// Refreshing the page wipes all data, so one click of
// "Load sample data" puts test cases back.
//
// All names here are made up. Never put real client data in this file:
// it's part of the code and will end up on GitHub.
//
// As we build each tab, its sample data gets added here too.

App.SAMPLE_CASES = [
  {
    id: "INC-2041",
    title: "Acme ransomware",
    client: "Acme Corp",
    types: ["phishing", "ransomware"],
    severity: "critical",
    status: "contained",
    opened: "2026-09-20"
  },
  {
    id: "INC-2042",
    title: "CFO mailbox forwarding rule",
    client: "Globex",
    types: ["bec", "account-takeover"],
    severity: "high",
    status: "open",
    opened: "2026-09-24"
  },
  {
    id: "INC-2043",
    title: "VPN appliance exploited",
    client: "Initech",
    types: ["vuln-exploit", "data-exfil"],
    severity: "medium",
    status: "closed",
    opened: "2026-09-02"
  }
];

// Sample evidence, grouped by case ID (like a Python dict of lists).
// Links use example.com, a domain reserved for examples.
// collectedAt times are UTC, like everything the app saves.
// Hashes are fake.
App.SAMPLE_EVIDENCE = {
  "INC-2041": [
    {
      type: "email", source: "Phishing email (invoice lure)", host: "j.doe@acme.example", affected: true,
      collectedAt: "2026-09-20T09:12",
      location: { kind: "file", value: "invoice_0918.eml" },
      hash: "8aedd4573cf9b52ff3ba944ae8f6c93ad36ca640192956aef4feffce93f70a60",
      notes: "Original lure. Macro-enabled attachment."
    },
    {
      type: "logs", source: "Windows Security event log", host: "ACME-FS01", affected: true,
      collectedAt: "2026-09-20T11:40",
      location: { kind: "link", value: "https://storage.example.com/acme/INC-2041/FS01-Security.evtx" },
      hash: "",
      notes: "4624/4625 around encryption start.",
      rawLog: "2026-09-19 22:41:07 EventID=4624 LogonType=10 TargetUserName=svc_backup " +
              "IpAddress=203.0.113.45 WorkstationName=-\n" +
              "2026-09-19 22:43:52 EventID=4672 SubjectUserName=svc_backup " +
              "PrivilegeList=SeDebugPrivilege SeBackupPrivilege"
    },
    {
      type: "memory-dump", source: "Velociraptor", host: "ACME-WS114", affected: true,
      collectedAt: "2026-09-20T13:05",
      location: { kind: "link", value: "https://storage.example.com/acme/INC-2041/WS114.raw" },
      hash: "0a50139ffcb1ce1c5832193562150263ae9e90d9ced79fcf4539961675fd9253",
      notes: "Patient zero. Hash pasted from collection tool."
    }
  ],
  "INC-2042": [
    {
      type: "cloud-audit", source: "M365 Unified Audit Log", host: "cfo@globex.example", affected: true,
      collectedAt: "2026-09-24T16:30",
      location: { kind: "link", value: "https://storage.example.com/globex/INC-2042/ual-export.csv" },
      hash: "",
      notes: "New-InboxRule forwarding to external address.",
      rawLog: '{"CreationTime":"2026-09-23T07:12:44","Operation":"New-InboxRule",' +
              '"UserId":"cfo@globex.example","ClientIP":"198.51.100.23",' +
              '"Parameters":[{"Name":"ForwardTo","Value":"billing-dept@mailbox.example"},' +
              '{"Name":"Name","Value":"."}]}'
    },
    {
      type: "cloud-audit", source: "Entra ID sign-in logs", host: "cfo@globex.example", affected: true,
      collectedAt: "2026-09-24T16:45",
      location: { kind: "link", value: "https://storage.example.com/globex/INC-2042/signins.csv" },
      hash: "",
      notes: "Sign-ins from unfamiliar ASN."
    }
  ],
  "INC-2043": [
    {
      type: "config", source: "VPN appliance config export", host: "INI-VPN01",
      collectedAt: "2026-09-02T10:00",
      location: { kind: "file", value: "vpn01-config.txt" },
      hash: "b824bb5dd49a68ceb28b2439a06b445da12120b1e4efb2fd071efcba07fc5e45",
      notes: ""
    },
    {
      type: "pcap", source: "Perimeter firewall capture", host: "INI-FW01",
      collectedAt: "2026-09-03T08:20",
      location: { kind: "file", value: "fw01-egress.pcap" },
      hash: "c4edac6271c6cfeea72f550a00e6e560b68851a6a4f7939c7e09963f17a5a292",
      notes: "Large outbound transfer to VPS."
    }
  ]
};

// Sample storyline entries, grouped by case ID. Evidence IDs refer to
// the sample evidence above (EV-001 = first item for that case, etc.).
// Deliberately NOT in time order: the tab sorts them.
App.SAMPLE_STORYLINE = {
  "INC-2041": [
    {
      timestamp: "2026-09-19T22:41:07", host: "ACME-FS01",
      what: "RDP logon as svc_backup from 203.0.113.45 using valid credentials.",
      tactic: "TA0008", techniques: ["T1021.001", "T1078"],
      confidence: "high", evidenceIds: ["EV-002"]
    },
    {
      timestamp: "2026-09-18T14:02:31", host: "j.doe@acme.example",
      what: "User opened macro-enabled invoice attachment from phishing email.",
      tactic: "TA0001", techniques: ["T1566.001", "T1204.002"],
      confidence: "high", evidenceIds: ["EV-001"]
    },
    {
      timestamp: "2026-09-18T14:03:10", host: "ACME-WS114",
      what: "Macro launched PowerShell loader; beacon to C2.",
      tactic: "TA0002", techniques: ["T1059.001"],
      confidence: "medium", evidenceIds: ["EV-003"]
    },
    {
      timestamp: "", host: "ACME-WS114",
      what: "Credentials for svc_backup likely dumped from LSASS (not yet confirmed).",
      tactic: "TA0006", techniques: ["T1003.001"],
      confidence: "low", evidenceIds: []
    }
  ],
  "INC-2042": [
    {
      timestamp: "2026-09-23T07:12:44", host: "cfo@globex.example",
      what: "Inbox rule created forwarding invoices to external mailbox.",
      tactic: "TA0009", techniques: ["T1114.003"],
      confidence: "high", evidenceIds: ["EV-001"]
    }
  ]
};

// Sample IOCs, grouped by case ID. Some values are pasted DEFANGED on
// purpose, to show they're saved as the real value.
// 203.0.113.x and 198.51.100.x are IP ranges reserved for examples.
App.SAMPLE_IOCS = {
  "INC-2041": [
    { value: "203.0.113[.]45", tlp: "amber", firstSeen: "2026-09-19T22:41:07",
      evidenceIds: ["EV-002"], notes: "RDP source for svc_backup logon." },
    { value: "hxxps://invoice-portal[.]example/view.php?id=0918", tlp: "green",
      firstSeen: "2026-09-18T14:02:31", evidenceIds: ["EV-001"], notes: "Link in phishing email." },
    { value: "8aedd4573cf9b52ff3ba944ae8f6c93ad36ca640192956aef4feffce93f70a60", tlp: "green",
      firstSeen: "2026-09-18T14:02:31", evidenceIds: ["EV-001"], notes: "invoice_0918.eml" },
    { value: "powershell.exe -nop -w hidden -enc SQBFAFgA...", type: "command", tlp: "amber",
      firstSeen: "2026-09-18T14:03:10", evidenceIds: ["EV-003"], notes: "Loader launched by macro." },
    { value: "6ece5ece4192683d2d84e25b0ba7e04f9cb7eb7c", type: "certificate", tlp: "amber",
      firstSeen: "", evidenceIds: [], notes: "C2 TLS certificate thumbprint (example)." }
  ],
  "INC-2042": [
    { value: "billing-dept@mailbox.example", tlp: "amber", firstSeen: "2026-09-23T07:12:44",
      evidenceIds: ["EV-001"], notes: "Forwarding target of malicious inbox rule." },
    { value: "198.51.100.23", tlp: "amber", firstSeen: "2026-09-23T07:12:44",
      evidenceIds: ["EV-001", "EV-002"], notes: "Attacker sign-in IP." }
  ]
};

// Sample Client tab data (only for INC-2041). The RMM check finds
// ACME-FS01 and ACME-WS130 with EDR "not installed", to show the warnings.
App.SAMPLE_CLIENT = {
  "INC-2041": {
    fields: {
      "org.industry": "Manufacturing",
      "org.headcount": "~250 staff, 2 sites",
      "org.timeZone": "America/Chicago",
      "subscriptions.edr": "sentinelone",
      "subscriptions.siem": "sentinel",
      "subscriptions.rmm": "kaseya",
      "subscriptions.firewallManaged": "yes",
      "subscriptions.firewallVendor": "fortigate",
      "subscriptions.irRetainer": "yes",
      "subscriptions.binalyze": "no",
      "environment.identity": "On-prem AD + Entra ID (hybrid). MFA on M365 only.",
      "environment.email": "Microsoft 365 E3",
      "backups.responsible": "msp",
      "backups.responsibleName": "Thrive backup team",
      "backups.product": "Veeam Backup & Replication 12",
      "backups.allServers": "no",
      "backups.allServersNotes": "ACME-ERP01 SQL only has native SQL backups, not in Veeam",
      "backups.retention": "14 daily, 4 weekly",
      "backups.rpo": "Nightly at 22:00, RPO 24 hours",
      "backups.storage.onPrem": true,
      "backups.storageNotes": "Synology NAS in the HQ server room (domain-joined)",
      "backups.immutable": "no",
      "insurance.hasCyber": "yes",
      "insurance.provider": "Example Cyber Mutual",
      "environment.network": "Flat network, HQ + 1 branch, FortiGate at both",
      "environment.vpn.ssl": true,
      "environment.vpn.siteToSite": true,
      "environment.vpnNotes": "FortiClient SSL VPN, no MFA. Site-to-site HQ <-> branch.",
      "environment.topologyLink": "https://sharepoint.example/sites/acme-it/Network%20Topology.pdf",
      "environment.oobChannel": "Phone bridge +1 555 0100 (PIN 4417) and a Signal group with Dana; no M365 Teams until the tenant is cleared.",
      "scope.inScope": "All Windows endpoints and servers, M365 tenant",
      "scope.outOfScope": "Shop-floor OT network",
      "devices.manualNoEdr": "ACME-KIOSK02",
      "adTriage.ranOn": "ADMIN-WS01 (remote, RSAT)",
      "adTriage.ranAt": "2026-09-20T15:10:00",
      "adTriage.ranBy": "ir-analyst",
      "adTriage.output": [
        "================== Domain Information ==================",
        "DNSRoot             : hq.acme.example",
        "NetBIOSName         : ACME",
        "DomainMode          : Windows2016Domain",
        "",
        "================== Forest Information ==================",
        "Name       : acme.example",
        "RootDomain : acme.example",
        "ForestMode : Windows2016Forest",
        "",
        "Sites:",
        "HQ",
        "Branch",
        "",
        "================== Trusts ==================",
        "Direction    : BiDirectional",
        "ForestTransitive : True",
        "Name         : partner.example",
        "SIDFilteringQuarantined : False",
        "SelectiveAuthentication : False"
      ].join("\n")
    },
    people: [
      { name: "Dana Reyes", role: "support", side: "client", email: "dana.reyes@acme.example", phone: "+1 555 0101", primary: true },
      { name: "Sam Ortiz", role: "account-manager", side: "msp", email: "sam.ortiz@msp.example", phone: "+1 555 0142" },
      { name: "Lee Park", role: "legal", side: "third-party", company: "Breach Coach LLP", email: "lpark@coach.example" }
    ],
    // Restore / recovery order (#1 first).
    critical: [
      { name: "ACME-DC01", purpose: "Domain controller: everything needs AD", backup: "Veeam nightly, system state" },
      { name: "ACME-ERP01", purpose: "ERP database: production stops without it", backup: "SQL native backups + Veeam" },
      { name: "ACME-FS01", purpose: "File server: shared drives", backup: "Veeam nightly (encrypted, restore from NAS)" }
    ],
    // Paths are set in App.loadSampleClient (they point at this
    // project's samples/ folder). The RMM check result:
    rmmCheck: {
      fileName: "rmm_devices.csv", hostColumn: "Machine ID", edrColumn: "EDR", total: 6,
      noEdr: ["acme-fs01.hq.acme", "acme-ws130.branch.acme"]
    }
  }
};

// Sample Summary and Reports data (only for INC-2041). Paths are inside
// case.summary (see App.setSummaryField).
App.SAMPLE_SUMMARY = {
  "INC-2041": {
    "detectedAt": "2026-09-20T06:12:00",
    "detectionSource": "sentinelone",
    "overview": "Phishing email with a macro-enabled invoice (EV-001) led to a PowerShell loader on ACME-WS114 on 2026-09-18. " +
                "The attacker obtained svc_backup credentials and used RDP to reach ACME-FS01, where file encryption started overnight on 2026-09-19/20. " +
                "Affected hosts have been isolated; the file server is down and shared drives are unavailable. Backups are on a domain-joined NAS and are not immutable.",
    "impact.functional": "high",
    "impact.functionalNotes": "File server ACME-FS01 encrypted: shared drives unavailable to all staff at HQ and the branch.",
    "impact.information.integrity": true,
    "impact.informationNotes": "Files on FS01 encrypted (integrity loss). No evidence of exfiltration yet; outbound traffic review pending.",
    "impact.recoverability": "extended",
    "impact.recoverabilityNotes": "Backups not immutable and ERP01 SQL not in Veeam; restore feasibility still being confirmed.",
    "containment.checklistNotes": "Client IT (Dana), Thrive network team, SentinelOne and the breach coach notified on the 09:00 call."
  }
};

// Sample action items (only for INC-2041). Times are given as "hours from
// now" (h: -30 = 30 hours ago), so overdue / due soon always show up.
App.SAMPLE_TASKS = {
  "INC-2041": [
    { kind: "containment", actionType: "isolate-edr", title: "Isolate hosts via SentinelOne", targets: ["ACME-WS114", "ACME-FS01"],
      priority: "p1", owner: "msp", status: "done", doneBy: "Thrive (ir-analyst)", doneH: -29,
      approval: { by: "Dana Reyes", h: -30, method: "call" },
      notes: "Binalyze triage + memory captured on both hosts before isolation." },
    { kind: "containment", actionType: "disable-accounts", title: "Disable svc_backup and reset its password", targets: ["ACME\\svc_backup"],
      priority: "p1", owner: "client", ownerName: "Dana Reyes", status: "done", doneH: -28,
      approval: { by: "Dana Reyes", h: -30, method: "call" } },
    { kind: "containment", actionType: "revoke-sessions", title: "Revoke sessions for j.doe", targets: ["j.doe@acme.example"],
      priority: "p2", owner: "msp", status: "done", doneH: -27,
      notes: "Done during the call; approval not written down." },
    { kind: "containment", actionType: "disable-vpn", title: "Disable SSL-VPN", priority: "p2", owner: "client", status: "not-needed",
      statusReason: "Entry point was the phishing email (EV-001), not the VPN. VPN logs exported first." },
    { kind: "containment", actionType: "block-lateral", title: "Block lateral movement: SMB / WinRM / RDP between workstations",
      priority: "p1", owner: "client", ownerName: "Dana Reyes", dueH: -2, status: "blocked",
      statusReason: "Client network team's change window",
      approval: { by: "Dana Reyes", h: -20, method: "email" } },
    { kind: "containment", actionType: "fw-deny", title: "Firewall deny rule for attacker IPs", targets: ["203.0.113.45", "203.0.113.99"],
      priority: "p2", owner: "msp", dueH: 1, status: "approved",
      approval: { by: "Dana Reyes", h: -3, method: "teams" } },
    { kind: "containment", actionType: "protect-backups", title: "Take the Synology NAS offline (protect backups)",
      targets: ["ACME-NAS01"], priority: "p1", owner: "client", ownerName: "Dana Reyes", status: "planned" },
    { kind: "task", title: "Send the list of servers not covered by Veeam", priority: "p2",
      owner: "client", ownerName: "Dana Reyes", dueH: -3, status: "planned" },
    { kind: "task", title: "Confirm last good restore point for ACME-FS01", targets: ["ACME-FS01"],
      priority: "p1", owner: "client", dueH: 6, status: "in-progress" },
    { kind: "task", title: "Notify the cyber insurer (Example Cyber Mutual)", priority: "p2",
      owner: "third-party", ownerName: "Lee Park", status: "done", doneH: -40 },
    { kind: "task", title: "Schedule the next war room call", priority: "p3", owner: "me", dueH: 20, status: "planned" }
  ]
};

// Add a case's sample action items.
App.loadSampleTasks = function (caseId) {
  // "hours from now" -> UTC text
  function at(hours) {
    return hours === undefined ? "" : App.time.toUtcText(new Date(Date.now() + hours * 3600000));
  }
  for (const s of App.SAMPLE_TASKS[caseId] || []) {
    const approval = s.approval ? { by: s.approval.by, at: at(s.approval.h), method: s.approval.method } : {};
    App.addTask(caseId, Object.assign({}, s, { due: at(s.dueH), doneAt: at(s.doneH), approval: approval }));
  }

  // The "Preserve evidence" items were created automatically when the
  // sample evidence added its assets. The hosts were captured before
  // isolation, so mark those done; the rest stay open.
  const done = App.SAMPLE_PRESERVED[caseId] || [];
  for (const t of App.findCase(caseId).tasks) {
    if (App.isPreservationTask(t) && done.includes(t.targets[0])) {
      App.updateTask(caseId, t.id, Object.assign({}, t, {
        status: "done", doneBy: "Thrive (ir-analyst)", doneAt: at(-30),
        notes: t.notes + " Done: Binalyze triage + memory captured before isolation."
      }));
    }
  }
};

// Sample assets whose evidence is already preserved.
App.SAMPLE_PRESERVED = {
  "INC-2041": ["ACME-WS114", "ACME-FS01"]
};

// Fill in a case's Summary and Reports tab from App.SAMPLE_SUMMARY.
App.loadSampleSummary = function (caseId) {
  const sample = App.SAMPLE_SUMMARY[caseId];
  if (!sample) {
    return;
  }
  for (const path in sample) {
    App.setSummaryField(caseId, path, sample[path]);
  }
  // Containment window: 3 hours from now, so it always shows as upcoming.
  App.setSummaryField(caseId, "containment.windowStart",
                      App.time.toUtcText(new Date(Date.now() + 3 * 3600000)));
  // One assumption already written down (the others show as suggestions).
  App.addAssumption(caseId, {
    text: "Assume credential theft across the domain: reset privileged and service accounts, krbtgt twice, and all user passwords; revoke cloud sessions.",
    basis: "Attacker used svc_backup over RDP to reach ACME-FS01; 3 devices without EDR; Security logs on FS01 only reach back 4 days.",
    source: "domain-credentials"
  });
};

// Fill in a case's Client tab from App.SAMPLE_CLIENT.
App.loadSampleClient = function (caseId) {
  const sample = App.SAMPLE_CLIENT[caseId];
  if (!sample) {
    return;
  }
  for (const path in sample.fields) {
    App.setClientField(caseId, path, sample.fields[path]);
  }
  for (const person of sample.people) {
    const id = App.addPerson(caseId);
    for (const key in person) {
      App.updatePerson(caseId, id, key, person[key]);
    }
  }
  for (const item of sample.critical) {
    const id = App.addCriticalAsset(caseId);
    for (const key in item) {
      App.updateCriticalAsset(caseId, id, key, item[key]);
    }
  }
  // Point the device list paths at this project's samples/ folder.
  // location.pathname is this page's own path, e.g.
  // "/C:/Users/me/IR-Workbench/index.html"; we swap the file name.
  const folder = decodeURI(location.pathname).replace(/^\//, "").replace(/\/[^\/]*$/, "");
  for (const source of ["edr", "rmm", "siem"]) {
    App.setClientField(caseId, "devices.paths." + source,
      (folder + "/samples/" + source + "_devices.csv").replaceAll("/", "\\"));
  }
  App.setRmmCheck(caseId, sample.rmmCheck);
};

// Add every sample case that isn't already loaded.
App.loadSampleData = function () {
  let added = 0;                     // "let" because we count up
  for (const c of App.SAMPLE_CASES) {
    // addCase returns null on success, or an error such as
    // "already exists". We skip errors so a 2nd click is harmless.
    if (App.addCase(c) === null) {
      added = added + 1;             // Python: added += 1 (also works in JS)

      // Mark it as a sample: sample cases are never saved to disk
      // (core/storage.js skips them), so fake data never mixes with real cases.
      App.findCase(c.id).sample = true;

      // Only a NEW case gets its sample evidence, so a 2nd click
      // doesn't add the same evidence twice.
      // "|| []" means: if this case has no sample evidence, use an empty list.
      for (const ev of App.SAMPLE_EVIDENCE[c.id] || []) {
        App.addEvidence(c.id, ev);
      }
      // Storyline after evidence, so the linked evidence IDs exist.
      for (const st of App.SAMPLE_STORYLINE[c.id] || []) {
        App.addStory(c.id, st);
      }
      for (const ioc of App.SAMPLE_IOCS[c.id] || []) {
        App.addIoc(c.id, ioc);
      }
      App.loadSampleClient(c.id);
      App.loadSampleSummary(c.id);
      App.loadSampleTasks(c.id);
    }
  }

  // If nothing is open yet, open the first sample case.
  if (App.state.selectedCaseId === null && App.state.cases.length > 0) {
    App.selectCase(App.state.cases[0].id);
  }

  console.log("Sample data loaded:", added, "new case(s)");
  App.render();
};

// Hook up the button. The page already exists (scripts load at the
// end of <body>), so we can find the button right away.
document.getElementById("sample-data-btn").addEventListener("click", function () {
  App.loadSampleData();
});
