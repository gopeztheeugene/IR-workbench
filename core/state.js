// state.js - loaded FIRST, before every other script.
//
// It creates the one global object, App, that all files share.
// We can't use Python-style "import" here (browsers block it when you
// double-click index.html), so instead every file reads and writes App.
// Think of App like a shared module that every file has already imported.

const App = {
  // The data for the whole app.
  state: {
    cases: [],            // list of case objects (like a Python list of dicts)
    selectedCaseId: null, // id of the open case (null is like Python's None)

    // Set by the Evidence tab's "-> Storyline" button, e.g. "EV-002".
    // The Storyline tab sees it when it draws, opens a pre-filled
    // form, and sets it back to null. This way the two tabs never
    // call each other directly.
    promoteEvidenceId: null,

    // Which time zone every tab shows times in (the sidebar's
    // "Show times in"). Times are always SAVED in UTC; this only
    // changes the display. Remembered in localStorage (see below).
    displayTimeZone: "UTC",

    // Is the Containment Strategy's Assumptions box open? Starts closed
    // every time the app opens (NOT saved), and stays open while you work
    // in it, so adding an assumption (which redraws) doesn't fold it away.
    assumptionsOpen: false
  },

  // Each tab file adds itself here, e.g. App.tabs.client = { ... }.
  // Like a Python dict: { "client": {...}, "summary": {...} }
  tabs: {}
};

// ---------------------------------------------------------------
// Fixed choices. Each has a "key" (short, never changes, saved to
// case.json) and a "label" (what you see on screen). Keeping keys
// separate means we can reword a label later without breaking
// saved cases.
// ---------------------------------------------------------------

App.CASE_TYPES = [
  { key: "malware",          label: "Malware" },
  { key: "ransomware",       label: "Ransomware" },
  { key: "phishing",         label: "Phishing & Social Engineering" },
  { key: "account-takeover", label: "Account Takeover" },
  { key: "bec",              label: "Business Email Compromise" },
  { key: "supply-chain",     label: "Supply Chain Attack" },
  { key: "vuln-exploit",     label: "Vulnerability Exploitation" },
  { key: "brute-force",      label: "Brute Force & Password Spraying" },
  { key: "data-exfil",       label: "Data Exfiltration / Data Breach" },
  { key: "insider",          label: "Insider Threat" },
  { key: "cloud",            label: "Cloud Compromise / Misconfiguration" },
  { key: "web-app",          label: "Web Application Attack" },
  { key: "dos",              label: "Denial of Service" },
  { key: "wiper",            label: "Wiper / Destructive Attack" },
  { key: "cryptojacking",    label: "Cryptojacking" },
  { key: "unauthorized",     label: "Unauthorized Access" },
  { key: "lost-device",      label: "Lost or Stolen Device" },
  { key: "other",            label: "Other" }
];

// What kind of thing a piece of evidence is.
App.EVIDENCE_TYPES = [
  { key: "logs",            label: "Logs (event, firewall, proxy, etc.)" },
  { key: "cloud-audit",     label: "Cloud / SaaS audit log" },
  { key: "alert",           label: "EDR / SIEM alert" },
  { key: "email",           label: "Email / message headers" },
  { key: "binary",          label: "Binary / malware sample" },
  { key: "script",          label: "Script (PowerShell, batch, macro)" },
  { key: "document",        label: "Document / attachment" },
  { key: "disk-image",      label: "Disk image" },
  { key: "memory-dump",     label: "Memory dump" },
  { key: "triage",          label: "Triage collection (KAPE, Velociraptor)" },
  { key: "forensic",        label: "Forensic artifact (registry, prefetch, MFT)" },
  { key: "pcap",            label: "Network capture (PCAP)" },
  { key: "config",          label: "Configuration export" },
  { key: "screenshot",      label: "Screenshot" },
  { key: "report",          label: "Report / threat intel" },
  { key: "other",           label: "Other" }
];

// What kind of thing an affected asset is.
App.ASSET_TYPES = [
  { key: "host",            label: "Host / workstation" },
  { key: "server",          label: "Server" },
  { key: "account",         label: "User account" },
  { key: "service-account", label: "Service account" },
  { key: "mailbox",         label: "Mailbox" },
  { key: "cloud",           label: "Cloud resource / tenant" },
  { key: "network-device",  label: "Network device (VPN, firewall)" },
  { key: "other",           label: "Other" }
];

// Microsoft's AD tier model (Enterprise Access Model): what controlling
// the asset gives an attacker. "" = not set.
App.AD_TIERS = [
  { key: "",   label: "Not set" },
  { key: "t0", label: "Tier 0",
    description: "Identity / control plane: domain controllers, Entra Connect, AD CS, ADFS, PAM; also backup servers, hypervisors, RMM with domain admin rights. Compromise = the whole domain." },
  { key: "t1", label: "Tier 1",
    description: "Servers and applications: file, SQL, ERP, app servers." },
  { key: "t2", label: "Tier 2",
    description: "User devices and accounts: workstations, laptops, users." }
];

// How far along an affected asset is. Order = typical progression.
App.ASSET_STATUSES = [
  { key: "suspected",  label: "Suspected" },
  { key: "confirmed",  label: "Confirmed compromised" },
  { key: "contained",  label: "Contained" },
  { key: "remediated", label: "Remediated" },
  { key: "clean",      label: "Clean (ruled out)" }
];

// MITRE ATT&CK Enterprise tactics, in attack-chain order.
// The key is the official tactic ID.
App.MITRE_TACTICS = [
  { key: "none",   label: "Not mapped" },
  { key: "TA0043", label: "Reconnaissance" },
  { key: "TA0042", label: "Resource Development" },
  { key: "TA0001", label: "Initial Access" },
  { key: "TA0002", label: "Execution" },
  { key: "TA0003", label: "Persistence" },
  { key: "TA0004", label: "Privilege Escalation" },
  { key: "TA0005", label: "Defense Evasion" },
  { key: "TA0006", label: "Credential Access" },
  { key: "TA0007", label: "Discovery" },
  { key: "TA0008", label: "Lateral Movement" },
  { key: "TA0009", label: "Collection" },
  { key: "TA0011", label: "Command and Control" },
  { key: "TA0010", label: "Exfiltration" },
  { key: "TA0040", label: "Impact" }
];

// How sure we are that a storyline event happened as described.
App.CONFIDENCE_LEVELS = [
  { key: "high",   label: "High (confirmed)" },
  { key: "medium", label: "Medium (likely)" },
  { key: "low",    label: "Low (possible)" }
];

// Kinds of IOC (indicator of compromise).
// App.ioc.guessType (core/ioc.js) picks one of these automatically.
App.IOC_TYPES = [
  { key: "ipv4",            label: "IP address (IPv4)" },
  { key: "ipv6",            label: "IP address (IPv6)" },
  { key: "domain",          label: "Domain" },
  { key: "url",             label: "URL" },
  { key: "email",           label: "Email address" },
  { key: "md5",             label: "File hash (MD5)" },
  { key: "sha1",            label: "File hash (SHA-1)" },
  { key: "sha256",          label: "File hash (SHA-256)" },
  { key: "filename",        label: "File name / path" },
  { key: "registry",        label: "Registry key" },
  { key: "command",         label: "Process / command line" },
  { key: "user-agent",      label: "User agent" },
  { key: "certificate",     label: "Certificate (thumbprint / serial)" },
  { key: "tls-fingerprint", label: "TLS fingerprint (JA3 / JA4)" },
  { key: "mutex",           label: "Mutex / named pipe" },
  { key: "wallet",          label: "Crypto wallet address" },
  { key: "other",           label: "Other" }
];

// Traffic Light Protocol 2.0: who an IOC may be shared with.
App.TLP_LEVELS = [
  { key: "clear",        label: "TLP:CLEAR" },
  { key: "green",        label: "TLP:GREEN" },
  { key: "amber",        label: "TLP:AMBER" },
  { key: "amber-strict", label: "TLP:AMBER+STRICT" },
  { key: "red",          label: "TLP:RED" }
];

// Summary and Reports: how the incident was detected. "other" shows a
// "specify" box (saved in summary.detectionSourceOther).
App.DETECTION_SOURCES = [
  { key: "",            label: "Not set" },
  { key: "sentinelone", label: "SentinelOne" },
  { key: "defender",    label: "Microsoft Defender" },
  { key: "sentinel",    label: "Microsoft Sentinel" },
  { key: "fortiedr",    label: "FortiEDR" },
  { key: "fortisiem",   label: "FortiSIEM" },
  { key: "elastic",     label: "Elastic" },
  { key: "saas-alerts", label: "SaaS Alerts" },
  { key: "threat-hunt", label: "Threat hunt" },
  { key: "other",       label: "Other (specify)" }
];

// Choices for the Client tab. "" = not set yet.
App.CLIENT_CHOICES = {
  edr: [
    { key: "",            label: "Not set" },
    { key: "sentinelone", label: "SentinelOne" },
    { key: "fortiedr",    label: "FortiEDR" },
    { key: "defender",    label: "Microsoft Defender for Endpoint" },
    { key: "other",       label: "Other (specify)" },
    { key: "none",        label: "None" }
  ],
  siem: [
    { key: "",          label: "Not set" },
    { key: "sentinel",  label: "Microsoft Sentinel" },
    { key: "fortisiem", label: "FortiSIEM" },
    { key: "elastic",   label: "Elastic" },
    { key: "other",     label: "Other (specify)" },
    { key: "none",      label: "None" }
  ],
  rmm: [
    { key: "",       label: "Not set" },
    { key: "kaseya", label: "Kaseya" },
    { key: "other",  label: "Other (specify)" },
    { key: "none",   label: "N/A" }
  ],
  firewallVendor: [
    { key: "",          label: "Not set" },
    { key: "fortigate", label: "FortiGate" },
    { key: "other",     label: "Other (specify)" }
  ],
  yesNo: [
    { key: "",    label: "Not set" },
    { key: "yes", label: "Yes" },
    { key: "no",  label: "No" }
  ]
};

// Kinds of VPN a client can have (tick boxes; several can apply).
App.VPN_TYPES = [
  { key: "ssl",        label: "Remote access SSL VPN" },
  { key: "web",        label: "Web / clientless portal" },
  { key: "siteToSite", label: "Site-to-site" },
  { key: "ipsec",      label: "Remote access IPsec" }
];

// People on the incident response team and client contacts.
App.PERSON_ROLES = [
  { key: "support",         label: "Support / IT" },
  { key: "network",         label: "Network team" },
  { key: "ir-analyst",      label: "IR analyst" },
  { key: "account-manager", label: "Account / client manager" },
  { key: "security-lead",   label: "Security lead / CISO" },
  { key: "executive",       label: "Executive / decision maker" },
  { key: "legal",           label: "Legal / breach coach" },
  { key: "insurance",       label: "Insurance" },
  { key: "other",           label: "Other" }
];

// Who a person works for / who is responsible for something.
// Used by "Managed by" (IR team & contacts) and "Responsible party"
// (Backups). Only the labels are shown; the keys are what's saved.
App.PERSON_SIDES = [
  { key: "client",      label: "Client Owned" },
  { key: "msp",         label: "Thrive" },
  { key: "third-party", label: "3rd Party" }
];

// The three device lists that can be imported from CSV.
App.DEVICE_SOURCES = [
  { key: "edr",  label: "EDR" },
  { key: "rmm",  label: "RMM" },
  { key: "siem", label: "SIEM" }
];

// Case priority: P1 is the most urgent. (Before schema 3 this was
// "severity" low / medium / high / critical; see App.upgradeCase.)
App.CASE_PRIORITIES = [
  { key: "p1", label: "P1" },
  { key: "p2", label: "P2" },
  { key: "p3", label: "P3" }
];

App.CASE_STATUSES = [
  { key: "open",      label: "Open" },
  { key: "contained", label: "Contained" },
  { key: "closed",    label: "Closed" }
];

// ---------------------------------------------------------------
// Helper functions. Other files change case data ONLY through
// these, so the rules (required fields, no duplicates) live in
// one place.
// ---------------------------------------------------------------

// The current LOCAL date and time as "YYYY-MM-DD" + "T" + "HH:MM",
// e.g. "2026-09-27T14:03". This is the format date/time inputs use.
// toISOString() always gives UTC time, so we first shift the date by
// our time zone offset (getTimezoneOffset() is in minutes).
// slice(0, 16) keeps the first 16 characters, like Python's text[0:16].
App.nowLocalString = function () {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

// Today's local date as "YYYY-MM-DD", e.g. "2026-09-27".
App.todayString = function () {
  return App.nowLocalString().slice(0, 10);
};

// Add a new case. Returns null if it worked, or an error message
// (a string) if it didn't. Python equivalent:
//   def add_case(case_data): ...
App.addCase = function (caseData) {
  // .trim() removes spaces at the ends, like Python's .strip().
  // "|| """ means: if the value is missing, use an empty string.
  const id = (caseData.id || "").trim();

  if (id === "") {
    return "Ticket ID is required.";
  }

  // .some() asks "is any item true for this test?", like
  // Python's any(c["id"] == id for c in cases).
  const exists = App.state.cases.some(function (c) {
    return c.id === id;
  });
  if (exists) {
    return "A case with ticket ID " + id + " already exists.";
  }

  // Only keep type keys that are in App.CASE_TYPES, so a typo
  // can't sneak in. .map() is like a list comprehension:
  // [t["key"] for t in CASE_TYPES]
  const validTypes = App.CASE_TYPES.map(function (t) { return t.key; });
  const types = (caseData.types || []).filter(function (key) {
    return validTypes.includes(key);   // like: key in valid_types
  });

  // Start from the defaults, then fill in what was given.
  // Object.assign(a, b) copies b's fields over a, like Python's a.update(b).
  const newCase = Object.assign(App.caseDefaults(), {
    id: id,
    title: (caseData.title || "").trim(),
    client: (caseData.client || "").trim(),
    types: types,                               // list of type keys
    priority: App.CASE_PRIORITIES.some(function (p) { return p.key === caseData.priority; })
      ? caseData.priority : "p2",
    status: caseData.status || "open",
    opened: caseData.opened || App.todayString()
  });
  // The starting status counts as the first status change.
  newCase.statusHistory.push({ from: "", to: newCase.status, at: App.time.nowUtc() });

  App.state.cases.push(newCase);   // like Python's list.append()
  console.log("Case added:", newCase);
  return null;
};

// Change a case's details (the "Edit case" pop-up). The ticket ID can't
// change: it names the case's folder on disk. Returns null if it worked,
// or an error message. A status change is time-stamped in statusHistory.
App.updateCaseDetails = function (caseId, data) {
  const c = App.findCase(caseId);
  if (c === null) {
    return "No case with ID " + caseId + ".";
  }
  const keysOf = function (list) { return list.map(function (x) { return x.key; }); };
  if (!keysOf(App.CASE_PRIORITIES).includes(data.priority)) {
    return "Pick a priority.";
  }
  if (!keysOf(App.CASE_STATUSES).includes(data.status)) {
    return "Pick a status.";
  }
  // "YYYY-MM-DD" only. /^...$/ is a regex, like Python's re.fullmatch.
  const opened = (data.opened || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opened)) {
    return "Opened must be a date.";
  }
  const validTypes = keysOf(App.CASE_TYPES);

  c.title = (data.title || "").trim();
  c.client = (data.client || "").trim();
  c.priority = data.priority;
  c.opened = opened;
  c.types = (data.types || []).filter(function (k) { return validTypes.includes(k); });
  if (data.status !== c.status) {
    c.statusHistory.push({ from: c.status, to: data.status, at: App.time.nowUtc() });
    c.status = data.status;
  }
  console.log("Case details updated:", c.id);
  return null;
};

// When the case last moved INTO a status (UTC text), or "" if never.
// e.g. App.statusChangedAt(c, "contained") -> "2026-09-30T10:00:00"
App.statusChangedAt = function (c, status) {
  let at = "";
  for (const change of c.statusHistory) {
    if (change.to === status) {
      at = change.at;             // keep going: the LAST one wins
    }
  }
  return at;
};

// Every field a case has, with its starting value. Used for new cases
// AND to fill in fields missing from cases saved by an older version
// of the app (App.upgradeCase). Add new case fields HERE.
App.caseDefaults = function () {
  return {
    id: "",
    title: "",
    client: "",
    types: [],                // list of case type keys
    priority: "p2",           // key from App.CASE_PRIORITIES (P1 = most urgent)
    status: "open",           // key from App.CASE_STATUSES
    opened: App.todayString(),
    // Every status change, oldest first: { from: "open", to: "contained",
    // at: "UTC time" }. Cases from before this feature start empty.
    statusHistory: [],

    // Evidence entries for this case (see App.addEvidence below).
    evidence: [],
    // Counter for evidence IDs. Only ever goes up, so an ID like
    // EV-002 is never reused, even after EV-002 is removed.
    nextEvidenceNumber: 1,

    // Affected hosts and accounts (see App.addAsset below).
    // Same never-reused counter idea: AS-001, AS-002, ...
    assets: [],
    nextAssetNumber: 1,

    // Attacker timeline (see App.addStory below). ST-001, ST-002, ...
    storyline: [],
    nextStoryNumber: 1,

    // Indicators of compromise (see App.addIoc below). IOC-001, ...
    iocs: [],
    nextIocNumber: 1,

    // Everything on the Client tab (see App.newClientInfo below).
    clientInfo: App.newClientInfo(),

    // Action Items (tab key "tasks"): containment / recovery actions and
    // ad-hoc action items, all in one list. TK-001, TK-002, ...
    // Closed items (done / not needed) are kept, never deleted.
    tasks: [],
    nextTaskNumber: 1,

    // Summary and Reports tab: incident summary + impact assessment.
    summary: {
      detectedAt: "",          // UTC
      detectionSource: "",       // a key from App.DETECTION_SOURCES
      detectionSourceOther: "",  // the "specify" text when detectionSource is "other"
      overview: "",
      // NIST SP 800-61 impact categories (keys from App.IMPACT).
      impact: {
        functional: "",
        functionalNotes: "",
        // Information impact: several can apply, so one true/false each.
        information: { none: false, privacy: false, proprietary: false, integrity: false },
        informationNotes: "",
        recoverability: "",
        recoverabilityNotes: "",
        updatedAt: ""          // UTC, set automatically when the assessment changes
      },
      // Containment Strategy: the PLAN around the containment actions.
      // (The actions themselves are containment items in case.tasks.)
      containment: {
        assumptions: [],       // { id: "AN-001", text, basis, source: "manual" | suggestion key }
        nextAssumptionNumber: 1,
        dismissedSuggestions: [],   // suggestion keys the user dismissed
        // (Older files may also have a "checklist" object from the removed
        // pre-containment checklist. It's ignored.)
        // Notes under the containment window. (Named checklistNotes for
        // older files; it's just "Notes" on screen.)
        checklistNotes: "",
        windowStart: ""        // UTC. Also the default due time of containment items.
      }
    }
  };
};

// Set a nested field by its "path", e.g. setPath(obj, "impact.functional", "high")
// is like Python's obj["impact"]["functional"] = "high". Only EXISTING
// fields can be set, so a typo can't create junk keys. Returns true if set.
App.setPath = function (obj, path, value) {
  const keys = path.split(".");                  // "impact.functional" -> ["impact", "functional"]
  for (let i = 0; i < keys.length - 1; i++) {    // walk down to the parent object
    obj = obj[keys[i]];
    if (typeof obj !== "object" || obj === null) {
      return false;
    }
  }
  const last = keys[keys.length - 1];
  if (!(last in obj)) {                          // "in" = Python's "key in dict"
    console.warn("Unknown field:", path);
    return false;
  }
  obj[last] = value;
  return true;
};

// Set a Summary and Reports field, e.g. ("INC-1", "impact.functional", "high").
// Any change to the impact assessment also stamps impact.updatedAt.
App.setSummaryField = function (caseId, path, value) {
  const c = App.findCase(caseId);
  if (c === null || !App.setPath(c.summary, path, value)) {
    return false;
  }
  if (path.startsWith("impact.")) {
    c.summary.impact.updatedAt = App.time.nowUtc();
  }
  return true;
};

// ---------------------------------------------------------------
// Action items (tab label "Action Items", key and data name "tasks")
// ---------------------------------------------------------------
//
// An action item looks like:
//   { id: "TK-001", kind: "containment", title: "Isolate ACME-WS114",
//     targets: ["ACME-WS114"], priority: "p1", owner: "msp", ownerName: "",
//     due: "2026-09-30T15:00:00",                    // UTC, or ""
//     status: "done", statusReason: "",             // reason for blocked / not needed
//     approval: { by: "Dana Reyes", at: "...", method: "call" },
//     doneBy: "Thrive", doneAt: "...",              // set automatically on Done
//     notes: "", createdAt: "..." }

App.TASK_KINDS = [
  { key: "containment", label: "Containment" },
  { key: "recovery",    label: "Recovery" },
  { key: "task",        label: "General" }     // any other follow-up / to-do
];

// "open" = still needs doing. Done / Not needed = closed (kept for the record).
App.TASK_STATUSES = [
  { key: "planned",     label: "Planned",     open: true },
  { key: "approved",    label: "Approved",    open: true },
  { key: "in-progress", label: "In progress", open: true },
  { key: "blocked",     label: "Blocked",     open: true },
  { key: "done",        label: "Done",        open: false },
  { key: "not-needed",  label: "Not needed",  open: false }
];

// Action item priority. The keys stay p1-p4 (so sorting "p1" < "p2"
// works and older files need no change); only the labels are words.
App.TASK_PRIORITIES = [
  { key: "p1", label: "Critical" },
  { key: "p2", label: "High" },
  { key: "p3", label: "Medium" },
  { key: "p4", label: "Low" }
];

// Who does it: me, or one of the same sides as the IR team list.
App.TASK_OWNERS = [{ key: "me", label: "Me" }].concat(App.PERSON_SIDES);

App.APPROVAL_METHODS = [
  { key: "",          label: "Not set" },
  { key: "call",      label: "Call" },
  { key: "email",     label: "Email" },
  { key: "teams",     label: "Teams / chat" },
  { key: "ticket",    label: "Ticket" },
  { key: "in-person", label: "In person" },
  { key: "other",     label: "Other" }
];

// Is this action item still open?
App.taskIsOpen = function (t) {
  const s = App.TASK_STATUSES.find(function (x) { return x.key === t.status; });
  return s ? s.open : true;
};

// Does this action item have a complete approval (who, when, how)?
App.taskHasApproval = function (t) {
  return Boolean(t.approval && t.approval.by && t.approval.at && t.approval.method);
};

// The rules for action item fields (shared by add and update).
// Returns { error: "..." } or { fields: {...} }.
App.cleanTask = function (taskData) {
  const title = (taskData.title || "").trim();
  if (title === "") {
    return { error: "Describe the action." };
  }
  const keysOf = function (list) { return list.map(function (x) { return x.key; }); };
  const pick = function (value, list, fallback) { return keysOf(list).includes(value) ? value : fallback; };

  const kind = pick(taskData.kind, App.TASK_KINDS, "task");
  // Action type (catalog) only applies to containment items.
  const actionType = kind === "containment" ? pick(taskData.actionType, App.CONTAINMENT_ACTIONS, "") : "";
  const status = pick(taskData.status, App.TASK_STATUSES, "planned");
  const statusReason = (taskData.statusReason || "").trim();
  const a = taskData.approval || {};
  const approval = {
    by: (a.by || "").trim(),
    at: App.time.withSeconds((a.at || "").trim()),
    method: pick(a.method, App.APPROVAL_METHODS, "")
  };

  // Status rules.
  if (status === "approved" && kind === "containment" && !App.taskHasApproval({ approval: approval })) {
    return { error: "To mark a containment action Approved, record who approved it, when, and how." };
  }
  if (status === "blocked" && statusReason === "") {
    return { error: "Say what it's blocked on (waiting on ...)." };
  }
  if (status === "not-needed" && statusReason === "") {
    return { error: "Give the reason it's not needed." };
  }

  // Targets: a list of hosts / accounts / values, no blanks or repeats.
  const targets = [];
  for (const t of taskData.targets || []) {
    const v = String(t).trim();
    if (v !== "" && !targets.includes(v)) {
      targets.push(v);
    }
  }

  const owner = pick(taskData.owner, App.TASK_OWNERS, "me");
  const ownerName = (taskData.ownerName || "").trim();

  // Done: stamp the time (and "done by") automatically if not given.
  // Not done: no done time (e.g. when a task is reopened).
  let doneAt = "";
  let doneBy = "";
  if (status === "done") {
    doneBy = (taskData.doneBy || "").trim();
    doneAt = App.time.withSeconds((taskData.doneAt || "").trim()) || App.time.nowUtc();
    if (doneBy === "") {
      doneBy = ownerName || App.labelFor(App.TASK_OWNERS, owner);
    }
  }

  return {
    fields: {
      kind: kind,
      actionType: actionType,
      title: title,
      targets: targets,
      priority: pick(taskData.priority, App.TASK_PRIORITIES, "p3"),
      owner: owner,
      ownerName: ownerName,
      due: App.time.withSeconds((taskData.due || "").trim()),
      status: status,
      statusReason: statusReason,
      approval: approval,
      doneBy: doneBy,
      doneAt: doneAt,
      notes: (taskData.notes || "").trim()
    }
  };
};

// Add an action item. Returns { error } or { id } (the new ID).
App.addTask = function (caseId, taskData) {
  const c = App.findCase(caseId);
  if (c === null) {
    return { error: "No case with ID " + caseId + "." };
  }
  const result = App.cleanTask(taskData);
  if (result.error) {
    return result;
  }
  const id = "TK-" + String(c.nextTaskNumber).padStart(3, "0");
  // "auto": set on items the app creates by itself, e.g.
  // "preserve-evidence:AS-001" (see App.addPreservationTask). "" = added by hand.
  c.tasks.push({ id: id, ...result.fields, auto: taskData.auto || "", createdAt: App.time.nowUtc() });
  c.nextTaskNumber = c.nextTaskNumber + 1;
  return { id: id };
};

App.findTask = function (caseId, taskId) {
  const c = App.findCase(caseId);
  if (c === null) {
    return null;
  }
  return c.tasks.find(function (t) { return t.id === taskId; }) || null;
};

// Change an action item. Returns null if it worked, or an error message.
App.updateTask = function (caseId, taskId, taskData) {
  const t = App.findTask(caseId, taskId);
  if (t === null) {
    return "No action item " + taskId + ".";
  }
  const result = App.cleanTask(taskData);
  if (result.error) {
    return result.error;
  }
  Object.assign(t, result.fields);
  return null;
};

// Only for mistakes: closed items are normally kept, not deleted.
App.deleteTask = function (caseId, taskId) {
  const c = App.findCase(caseId);
  if (c !== null) {
    c.tasks = c.tasks.filter(function (t) { return t.id !== taskId; });
  }
};

// ---------------------------------------------------------------
// Containment Strategy (Summary and Reports)
// ---------------------------------------------------------------

// The containment action catalog. "targets" says what the targets box
// picks from: "assets" (hosts / accounts) or "iocs" (the IOCs tab).
// "hint" = what to do BEFORE the action (shown as "Before you do this").
App.CONTAINMENT_ACTIONS = [
  { key: "disable-accounts", label: "Disable accounts / block sign-in", targets: "assets",
    hint: "Pair it with a password reset and Revoke sessions. For BEC also check inbox rules, forwarding, OAuth app consents, and registered MFA methods / devices: they survive a reset." },
  { key: "revoke-sessions", label: "Revoke sessions", targets: "assets",
    hint: "Do it AFTER disabling or resetting the account, or the attacker just signs in again. Access tokens can stay valid for about an hour unless Continuous Access Evaluation (CAE) is on." },
  { key: "reset-credentials", label: "Reset credentials (privileged / service accounts, krbtgt ×2)", targets: "assets",
    hint: "krbtgt: reset TWICE, with replication (ideally the 10-hour ticket lifetime) in between. Update service account passwords where they're used, or services break. Treat the Entra Connect server as tier 0." },
  { key: "isolate-edr", label: "Isolate host (EDR / Binalyze)", targets: "assets",
    hint: "Isolation keeps the machine on, so memory is preserved. Capture triage / memory (Binalyze) BEFORE anyone reboots or reimages." },
  { key: "kill-process", label: "Kill process", targets: "assets",
    hint: "Dump the process FIRST (ProcDump / Binalyze). Record the command line, parent process, and hash. Check persistence, or it may just restart." },
  { key: "hypervisor-isolation", label: "Hypervisor / cloud isolation (VM, AWS SG, Azure NSG)", targets: "assets",
    hint: "Snapshot the VM first. AWS security groups are stateful: swapping one doesn't cut open connections, so add a network ACL (NACL) deny and remove / revoke the instance's IAM role." },
  { key: "network-segmentation", label: "Network segmentation (VLAN / ACL / firewall between segments)", targets: "assets",
    hint: "Keep a path open for your IR tooling (EDR and Binalyze consoles) and log forwarding, so you don't cut off your own visibility." },
  { key: "block-lateral", label: "Block lateral movement (PsExec, SMB, WinRM, WMI, RDP)", targets: "assets",
    hint: "Use GPO, host firewall, or EDR / ASR rules. Keep a path for your jump host, EDR, and Binalyze so you don't lock yourself out." },
  { key: "disable-vpn", label: "Disable SSL-VPN (if it's the entry point)", targets: "assets",
    hint: "Export the VPN logs FIRST: FortiGate logs roll over quickly. Plan how remote staff will work without it." },
  { key: "fw-deny", label: "Firewall deny rule", targets: "iocs",
    hint: "Turn on logging for the rule: blocked connection attempts reveal hosts that are still infected." },
  { key: "sinkhole", label: "Sinkhole domain", targets: "iocs",
    hint: "Watch the queries to the sinkhole: they show which hosts are still infected. Malware with hard-coded IPs or DNS-over-HTTPS bypasses it." },
  { key: "block-iocs", label: "Block IOCs (EDR / email gateway / proxy)", targets: "iocs",
    hint: "Block in every control that applies (EDR, email gateway, proxy, firewall), and note where each was blocked." },
  { key: "purge-emails", label: "Purge emails", targets: "assets",
    hint: "Export a copy of the phishing email FIRST (it's evidence). Record the message IDs and how many copies were purged." },
  { key: "remove-inbox-rules", label: "Remove malicious inbox / forwarding rules", targets: "assets",
    hint: "Export the rules FIRST (Get-InboxRule). Also check mailbox forwarding, transport rules, and other mailboxes for similar rules." },
  { key: "remove-app-consents", label: "Remove malicious app consent registrations", targets: "assets",
    hint: "Record the app ID, its permissions, and when it was consented FIRST, then revoke. Check whether other users consented too." },
  { key: "protect-backups", label: "Protect backups (take offline / isolate)", targets: "assets",
    hint: "Do it EARLY in a ransomware case. Confirm the last good restore point and that the backup server / NAS isn't reachable with domain credentials." },
  { key: "other", label: "Other (custom action)", targets: "assets", hint: "" }
];

// Is this text exactly one of the catalog's actions (e.g. picked from the
// Action pick list)? Returns that action, or null. Ignores upper / lower case.
App.containmentActionForTitle = function (title) {
  const wanted = String(title || "").trim().toLowerCase();
  return App.CONTAINMENT_ACTIONS.find(function (a) {
    return a.key !== "other" && a.label.toLowerCase() === wanted;
  }) || null;
};

// ---- Evidence preservation: one action item per affected asset ----

// What to preserve, by asset type (goes in the item's notes).
App.PRESERVATION_NOTES = {
  host: "Triage + memory capture (Binalyze) BEFORE isolation, reboot, or reimage. VM snapshot if it's virtual.",
  server: "Triage + memory capture (Binalyze) BEFORE isolation, reboot, or reimage. VM snapshot if it's virtual. Export event logs before they roll over.",
  account: "Export sign-in and audit logs (Entra ID / AD) before they age out. Record MFA methods and registered devices.",
  "service-account": "Export AD security logs (4624 / 4625 / 4768 / 4769) for the account, and where it's used, before they roll over.",
  mailbox: "Export the mailbox audit log, inbox / forwarding rules, and a message trace. Keep a copy of malicious emails before purging.",
  cloud: "Export activity / audit logs and snapshot the resource before changing it.",
  "network-device": "Export logs and the running config before they roll over or the device is changed.",
  other: "Collect and hash what proves the compromise before anything is changed."
};

// The "auto" marker for an asset's preservation item.
App.preservationKey = function (assetId) {
  return "preserve-evidence:" + assetId;
};

// Is this one of the automatic evidence preservation items?
App.isPreservationTask = function (t) {
  return String(t.auto || "").startsWith("preserve-evidence:");
};

// Add a "Preserve evidence on <asset>" action item, unless the asset
// already has one (open or closed) or is marked clean. Called when an
// asset is added (by hand or from Evidence), so the tabs never have to.
App.addPreservationTask = function (caseId, asset) {
  const c = App.findCase(caseId);
  if (c === null || asset.status === "clean") {
    return;
  }
  const key = App.preservationKey(asset.id);
  if (c.tasks.some(function (t) { return t.auto === key; })) {
    return;
  }
  App.addTask(caseId, {
    kind: "task",
    title: "Preserve evidence on " + asset.name,
    targets: [asset.name],
    priority: "p1",
    owner: "me",
    status: "planned",
    notes: App.PRESERVATION_NOTES[asset.type] || App.PRESERVATION_NOTES.other,
    auto: key
  });
};

// How far along evidence preservation is: { total, open }.
// (Shared by the Containment Strategy and the Action Items banner.)
App.preservationProgress = function (caseObj) {
  const items = caseObj.tasks.filter(App.isPreservationTask);
  return { total: items.length, open: items.filter(App.taskIsOpen).length };
};

// An action item's due time: its own, or, for OPEN containment items
// without one, the containment window (everything happens together).
// Returns { due: "UTC text" or "", fromWindow: true / false }.
App.taskDue = function (caseObj, t) {
  if (t.due) {
    return { due: t.due, fromWindow: false };
  }
  const windowStart = caseObj.summary.containment.windowStart;
  if (t.kind === "containment" && windowStart && App.taskIsOpen(t)) {
    return { due: windowStart, fromWindow: true };
  }
  return { due: "", fromWindow: false };
};

// ---- Assumptions ----

App.addAssumption = function (caseId, data) {
  const plan = App.findCase(caseId).summary.containment;
  const id = "AN-" + String(plan.nextAssumptionNumber).padStart(3, "0");
  plan.assumptions.push({ id: id, text: (data.text || "").trim(), basis: (data.basis || "").trim(),
                          source: data.source || "manual" });
  plan.nextAssumptionNumber = plan.nextAssumptionNumber + 1;
  return id;
};

App.updateAssumption = function (caseId, id, key, value) {
  const a = App.findCase(caseId).summary.containment.assumptions.find(function (x) { return x.id === id; });
  if (a && (key === "text" || key === "basis")) {
    a[key] = value;
  }
};

App.deleteAssumption = function (caseId, id) {
  const plan = App.findCase(caseId).summary.containment;
  plan.assumptions = plan.assumptions.filter(function (x) { return x.id !== id; });
};

App.dismissSuggestion = function (caseId, key) {
  const plan = App.findCase(caseId).summary.containment;
  if (!plan.dismissedSuggestions.includes(key)) {
    plan.dismissedSuggestions.push(key);
  }
};

// NIST SP 800-61 Rev. 2 incident impact categories (Tables 3-2, 3-3, 3-4).
// "level" 0-3 is only for coloring (green -> red).
App.IMPACT = {
  functional: [
    { key: "none",   level: 0, label: "None",
      description: "No effect to the organization's ability to provide all services to all users." },
    { key: "low",    level: 1, label: "Low",
      description: "Minimal effect; the organization can still provide all critical services to all users but has lost efficiency." },
    { key: "medium", level: 2, label: "Medium",
      description: "The organization has lost the ability to provide a critical service to a subset of system users." },
    { key: "high",   level: 3, label: "High",
      description: "The organization is no longer able to provide some critical services to any users." }
  ],
  information: [
    { key: "none",        level: 0, label: "None",
      description: "No information was exfiltrated, changed, deleted, or otherwise compromised." },
    { key: "privacy",     level: 3, label: "Privacy breach",
      description: "Sensitive personally identifiable information (PII) was accessed or exfiltrated." },
    { key: "proprietary", level: 3, label: "Proprietary breach",
      description: "Proprietary information (e.g. intellectual property, protected infrastructure information) was accessed or exfiltrated." },
    { key: "integrity",   level: 3, label: "Integrity loss",
      description: "Sensitive or proprietary information was changed or deleted." }
  ],
  recoverability: [
    { key: "regular",         level: 0, label: "Regular",
      description: "Time to recovery is predictable with existing resources." },
    { key: "supplemented",    level: 1, label: "Supplemented",
      description: "Time to recovery is predictable with additional resources." },
    { key: "extended",        level: 2, label: "Extended",
      description: "Time to recovery is unpredictable; additional resources and outside help are needed." },
    { key: "not-recoverable", level: 3, label: "Not recoverable",
      description: "Recovery from the incident is not possible (e.g. sensitive data exfiltrated and posted publicly); launch an investigation." }
  ]
};

// Fill in any field that's missing from "target", using "defaults".
// Goes inside nested objects too (e.g. clientInfo.backups). Lists and
// existing values are never touched. Like Python's dict.setdefault(),
// applied all the way down.
App.fillDefaults = function (target, defaults) {
  function isObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }
  for (const key of Object.keys(defaults)) {
    if (target[key] === undefined) {
      target[key] = defaults[key];
    } else if (isObject(target[key]) && isObject(defaults[key])) {
      App.fillDefaults(target[key], defaults[key]);
    }
  }
  return target;
};

// Make a case loaded from disk safe to use with this version of the app:
// add any missing fields, and make sure every ID counter is above the
// highest ID in use (so a new EV-/AS-/ST-/IOC-... ID is never reused).
App.upgradeCase = function (c) {
  // Schema 3: "severity" (low / medium / high / critical) became
  // "priority" (P1 / P2 / P3). Done BEFORE fillDefaults, which would
  // otherwise give the case the default priority first.
  if (c.severity !== undefined) {
    const map = { critical: "p1", high: "p2", medium: "p3", low: "p3" };
    if (c.priority === undefined) {
      c.priority = map[c.severity] || "p2";
    }
    delete c.severity;            // like Python's: del c["severity"]
  }

  App.fillDefaults(c, App.caseDefaults());

  // [the object, its list, its counter]
  const counters = [
    [c, "evidence", "nextEvidenceNumber"],
    [c, "assets", "nextAssetNumber"],
    [c, "storyline", "nextStoryNumber"],
    [c, "iocs", "nextIocNumber"],
    [c, "tasks", "nextTaskNumber"],
    [c.summary.containment, "assumptions", "nextAssumptionNumber"],
    [c.clientInfo, "people", "nextPersonNumber"],
    [c.clientInfo, "criticalAssets", "nextCriticalNumber"]
  ];
  for (const [owner, listKey, counterKey] of counters) {
    let highest = 0;
    for (const item of owner[listKey]) {
      // "EV-004" -> 4. parseInt reads the number after the last "-".
      const n = parseInt(String(item.id).split("-").pop(), 10);
      if (n > highest) {
        highest = n;
      }
    }
    owner[counterKey] = Math.max(owner[counterKey] || 1, highest + 1);
  }

  // Fields added to list items later (lists aren't filled by fillDefaults).
  for (const t of c.tasks) {
    if (t.actionType === undefined) {
      t.actionType = "";
    }
    if (t.auto === undefined) {
      t.auto = "";
    }
  }
  // AD tier, added later to assets and critical assets.
  for (const a of c.assets.concat(c.clientInfo.criticalAssets)) {
    if (a.tier === undefined) {
      a.tier = "";
    }
  }

  // Schema 2: detection source was free text, now it's a dropdown key.
  // Old text that isn't a known key moves into "Other (specify)".
  // (Safe to run on new files too: a known key is left alone.)
  const s = c.summary;
  const known = App.DETECTION_SOURCES.some(function (d) { return d.key === s.detectionSource; });
  if (!known) {
    s.detectionSourceOther = s.detectionSource;
    s.detectionSource = "other";
  }
  return c;
};

// Mark a case as the one that's open. Returns true if found.
App.selectCase = function (id) {
  const exists = App.state.cases.some(function (c) {
    return c.id === id;
  });
  if (!exists) {               // "!" means "not", like Python's "not"
    console.warn("No case with id:", id);
    return false;
  }
  App.state.selectedCaseId = id;
  console.log("Selected case:", id);
  return true;
};

// Return the open case object, or null if no case is selected.
// Python version, for comparison:
//
//   def get_selected_case():
//       for c in state["cases"]:
//           if c["id"] == state["selected_case_id"]:
//               return c
//       return None
App.getSelectedCase = function () {
  for (const c of App.state.cases) {              // for c in cases:
    if (c.id === App.state.selectedCaseId) {      // === is JS's strict ==
      return c;
    }
  }
  return null;                                    // null is JS's None
};

// Make text safe to put inside HTML. Any text you typed (a title,
// a pasted log line) could contain "<" or ">", and the browser would
// treat it as HTML tags, or even run it as a script. Same idea as
// escaping input before building a SQL query. Python has html.escape().
// ALWAYS wrap user-entered text in this when building HTML strings.
App.escapeHtml = function (text) {
  return String(text)               // make sure it's a string first
    .replaceAll("&", "&amp;")       // & must go first
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

// Look up the label for a key in one of the lists above, e.g.
// App.labelFor(App.CASE_TYPES, "bec") -> "Business Email Compromise".
// .find() returns the first matching item, or undefined if none match.
App.labelFor = function (list, key) {
  const found = list.find(function (item) { return item.key === key; });
  return found ? found.label : key;   // "a ? b : c" is Python's "b if a else c"
};

// Shortcuts for the two lists we look up most.
App.typeLabel = function (key) {
  return App.labelFor(App.CASE_TYPES, key);
};
App.evidenceTypeLabel = function (key) {
  return App.labelFor(App.EVIDENCE_TYPES, key);
};

// Find a case by its ticket ID. Returns the case, or null.
App.findCase = function (caseId) {
  return App.state.cases.find(function (c) { return c.id === caseId; }) || null;
};

// ---------------------------------------------------------------
// Evidence helpers
// ---------------------------------------------------------------

// Add an evidence entry to a case. The ID (EV-001, EV-002, ...) is
// made automatically. Returns null if it worked, or an error message.
//
// evidenceData looks like:
//   { type: "logs", source: "Windows Security log", host: "FS01",
//     collectedAt: "2026-09-20T14:05",
//     location: { kind: "link", value: "https://..." },   // or kind "file"
//     hash: "8aed...", notes: "...",
//     rawLog: "the exact log line(s), pasted as-is",
//     affected: true }   // true = add the host/account to Assets
App.addEvidence = function (caseId, evidenceData) {
  const c = App.findCase(caseId);
  if (c === null) {
    return "No case with ID " + caseId + ".";
  }

  // Check and tidy the fields (shared with App.updateEvidence).
  const result = App.cleanEvidence(evidenceData);
  if (result.error) {
    return result.error;
  }

  // Build the ID from the counter. padStart(3, "0") adds zeros on
  // the left: 7 -> "007". Python: f"EV-{n:03d}"
  const id = "EV-" + String(c.nextEvidenceNumber).padStart(3, "0");

  // "...result.fields" copies every field into this new object,
  // like Python's {"id": id, **fields}.
  const entry = { id: id, ...result.fields };

  c.evidence.push(entry);
  c.nextEvidenceNumber = c.nextEvidenceNumber + 1;
  console.log("Evidence added to", caseId + ":", entry);

  // "Add to Assets as affected" was ticked: add/link the asset.
  if (evidenceData.affected) {
    App.linkEvidenceToAsset(caseId, id, entry.host);
  }
  return null;
};

// Change an existing evidence entry. Its ID stays the same.
// Returns null if it worked, or an error message.
App.updateEvidence = function (caseId, evidenceId, evidenceData) {
  const ev = App.findEvidence(caseId, evidenceId);
  if (ev === null) {
    return "No evidence " + evidenceId + " in case " + caseId + ".";
  }

  const result = App.cleanEvidence(evidenceData);
  if (result.error) {
    return result.error;
  }

  // Object.assign copies the new fields over the old ones, like
  // Python's dict.update(). The "id" isn't in fields, so it's kept.
  Object.assign(ev, result.fields);
  console.log("Evidence updated:", ev);

  // Redo the asset link: drop the old one, then link again if the box
  // is ticked. This also handles a changed host name.
  App.unlinkEvidence(caseId, evidenceId);
  if (evidenceData.affected) {
    App.linkEvidenceToAsset(caseId, evidenceId, ev.host);
  }
  return null;
};

// Record that a local evidence file was copied into the case folder.
// info = { path: "evidence/EV-004_x.eml", verified: true/false/null,
//          copiedAt: "2026-09-30T14:05:02" (UTC) }
// verified: true = the copy's SHA-256 matches, false = it does NOT,
// null = not checked (file too large to hash in the browser).
App.setEvidenceCopy = function (caseId, evidenceId, info) {
  const ev = App.findEvidence(caseId, evidenceId);
  if (ev !== null) {
    ev.storedCopy = info;
  }
};

// Find one evidence entry in a case. Returns it, or null.
App.findEvidence = function (caseId, evidenceId) {
  const c = App.findCase(caseId);
  if (c === null) {
    return null;
  }
  return c.evidence.find(function (ev) { return ev.id === evidenceId; }) || null;
};

// The rules for evidence fields, in one place so adding and editing
// always check the same things. Returns an object with EITHER
//   { error: "message" }            when something is wrong, or
//   { fields: { type, source, ... } }  with the cleaned-up values.
// (Like a Python function returning {"error": ...} or {"fields": ...}.)
App.cleanEvidence = function (evidenceData) {
  // Type must be one of App.EVIDENCE_TYPES, otherwise "other".
  const validTypes = App.EVIDENCE_TYPES.map(function (t) { return t.key; });
  const type = validTypes.includes(evidenceData.type) ? evidenceData.type : "other";

  // Location: either a cloud link or a local file name.
  const loc = evidenceData.location || {};
  const kind = loc.kind === "file" ? "file" : "link";
  const value = (loc.value || "").trim();

  // SAFETY: links must start with http:// or https://. A link like
  // "javascript:..." would run code when clicked. .startsWith() is
  // the same as Python's str.startswith().
  if (kind === "link" && value !== "" &&
      !value.startsWith("https://") && !value.startsWith("http://")) {
    return { error: "Links must start with https:// or http://" };
  }

  // Hashes are stored lowercase so the same hash always looks the same.
  // If one is given, it must be a SHA-256: exactly 64 characters, each
  // 0-9 or a-f. /^[0-9a-f]{64}$/ is a regular expression, the same
  // pattern you'd write with Python's re.fullmatch("[0-9a-f]{64}", hash).
  const hash = (evidenceData.hash || "").trim().toLowerCase();
  if (hash !== "" && !/^[0-9a-f]{64}$/.test(hash)) {
    return { error: "SHA-256 must be exactly 64 characters, using only 0-9 and a-f." };
  }

  // Can't mark a blank host as an affected asset.
  const host = (evidenceData.host || "").trim();
  if (evidenceData.affected && host === "") {
    return { error: "Enter a host / account to add it to Assets." };
  }

  return {
    fields: {
      type: type,
      source: (evidenceData.source || "").trim(),
      host: host,
      // Saved in UTC, always with seconds (the form converts to UTC).
      collectedAt: App.time.withSeconds(evidenceData.collectedAt || ""),
      location: { kind: kind, value: value },
      hash: hash,
      notes: (evidenceData.notes || "").trim(),
      // The exact log line(s) that matter, pasted as-is. Line breaks
      // are kept; only blank space at the very start and end is removed.
      rawLog: (evidenceData.rawLog || "").trim()
    }
  };
};

// Remove one evidence entry from a case. Returns true if removed.
App.deleteEvidence = function (caseId, evidenceId) {
  const c = App.findCase(caseId);
  if (c === null) {
    return false;
  }
  const before = c.evidence.length;
  // .filter() keeps the items that pass the test, like Python's
  //   case["evidence"] = [ev for ev in case["evidence"] if ev["id"] != evidence_id]
  c.evidence = c.evidence.filter(function (ev) {
    return ev.id !== evidenceId;         // !== means "not equal"
  });
  const removed = c.evidence.length < before;
  console.log(removed ? "Evidence removed:" : "No evidence with id:", evidenceId);

  // Take the evidence ID off any asset it was linked to. The asset
  // itself stays: the host was still affected.
  App.unlinkEvidence(caseId, evidenceId);

  // Same for storyline entries and IOCs: they stay, the link goes.
  for (const item of c.storyline.concat(c.iocs)) {     // concat = list + list
    item.evidenceIds = item.evidenceIds.filter(function (id) { return id !== evidenceId; });
  }
  return removed;
};

// ---------------------------------------------------------------
// Asset helpers (affected hosts and accounts)
// ---------------------------------------------------------------
//
// An asset looks like:
//   { id: "AS-001", name: "ACME-WS114", type: "host",
//     status: "suspected", evidenceIds: ["EV-001", "EV-003"], notes: "" }

// Guess the type from the name: "jdoe@acme.com" or "ACME\jdoe"
// look like accounts, anything else is treated as a host.
// ("\\" in JavaScript text means ONE backslash, same as in Python.)
App.guessAssetType = function (name) {
  if (name.includes("@") || name.includes("\\")) {
    return "account";
  }
  return "host";
};

// Find an asset by name, ignoring upper/lower case, so "acme-ws114"
// and "ACME-WS114" are the same asset. Returns it, or null.
// .toLowerCase() is Python's str.lower().
App.findAssetByName = function (caseId, name) {
  const c = App.findCase(caseId);
  if (c === null) {
    return null;
  }
  const wanted = name.trim().toLowerCase();
  return c.assets.find(function (a) { return a.name.toLowerCase() === wanted; }) || null;
};

// Find an asset by its ID ("AS-001"). Returns it, or null.
App.findAsset = function (caseId, assetId) {
  const c = App.findCase(caseId);
  if (c === null) {
    return null;
  }
  return c.assets.find(function (a) { return a.id === assetId; }) || null;
};

// The rules for asset fields (shared by add and update).
// Returns { error: "..." } or { fields: {...} }, like cleanEvidence.
App.cleanAsset = function (assetData) {
  const name = (assetData.name || "").trim();
  if (name === "") {
    return { error: "Name is required." };
  }
  const typeKeys = App.ASSET_TYPES.map(function (t) { return t.key; });
  const statusKeys = App.ASSET_STATUSES.map(function (s) { return s.key; });
  return {
    fields: {
      name: name,
      // No type given? Guess it from the name.
      type: typeKeys.includes(assetData.type) ? assetData.type : App.guessAssetType(name),
      status: statusKeys.includes(assetData.status) ? assetData.status : "suspected",
      notes: (assetData.notes || "").trim(),
      // AD tier set on the asset itself ("" = not set: then the tier from
      // the Client tab's critical assets list is used, see App.assetTier).
      tier: App.AD_TIERS.some(function (t) { return t.key === assetData.tier; }) ? assetData.tier : ""
    }
  };
};

// Add an asset by hand. Returns null if it worked, or an error message.
App.addAsset = function (caseId, assetData) {
  const c = App.findCase(caseId);
  if (c === null) {
    return "No case with ID " + caseId + ".";
  }
  const result = App.cleanAsset(assetData);
  if (result.error) {
    return result.error;
  }
  if (App.findAssetByName(caseId, result.fields.name) !== null) {
    return result.fields.name + " is already in Assets.";
  }

  const id = "AS-" + String(c.nextAssetNumber).padStart(3, "0");
  // Linked evidence starts empty; the Evidence tab fills it in.
  const asset = { id: id, ...result.fields, evidenceIds: [] };
  c.assets.push(asset);
  c.nextAssetNumber = c.nextAssetNumber + 1;
  console.log("Asset added to", caseId + ":", asset);
  // Every affected asset gets a "Preserve evidence" action item.
  App.addPreservationTask(caseId, asset);
  return null;
};

// Change an asset's name, type, status, or notes. Linked evidence is
// managed from the Evidence tab, so it isn't changed here.
App.updateAsset = function (caseId, assetId, assetData) {
  const asset = App.findAsset(caseId, assetId);
  if (asset === null) {
    return "No asset " + assetId + " in case " + caseId + ".";
  }
  const result = App.cleanAsset(assetData);
  if (result.error) {
    return result.error;
  }
  // Renaming onto another asset's name would make a duplicate.
  const clash = App.findAssetByName(caseId, result.fields.name);
  if (clash !== null && clash.id !== assetId) {
    return result.fields.name + " is already in Assets (" + clash.id + ").";
  }
  const wasClean = asset.status === "clean";
  Object.assign(asset, result.fields);
  console.log("Asset updated:", asset);
  // Added as "clean" and now affected after all? Then it needs one too.
  if (wasClean) {
    App.addPreservationTask(caseId, asset);
  }
  return null;
};

// Remove an asset. Evidence entries are not touched.
App.deleteAsset = function (caseId, assetId) {
  const c = App.findCase(caseId);
  if (c === null) {
    return false;
  }
  const before = c.assets.length;
  c.assets = c.assets.filter(function (a) { return a.id !== assetId; });
  console.log("Asset removed:", assetId);
  return c.assets.length < before;
};

// Called when evidence is marked "affected": find the asset with this
// name (or create it as "suspected"), then add the evidence ID to it.
App.linkEvidenceToAsset = function (caseId, evidenceId, name) {
  if (!name || name.trim() === "") {
    return;
  }
  let asset = App.findAssetByName(caseId, name);
  if (asset === null) {
    App.addAsset(caseId, { name: name, status: "suspected" });
    asset = App.findAssetByName(caseId, name);
  }
  // Only add the ID if it isn't there yet (no duplicates).
  if (!asset.evidenceIds.includes(evidenceId)) {
    asset.evidenceIds.push(evidenceId);
  }
};

// Take an evidence ID off every asset in the case.
App.unlinkEvidence = function (caseId, evidenceId) {
  const c = App.findCase(caseId);
  if (c === null) {
    return;
  }
  for (const a of c.assets) {
    a.evidenceIds = a.evidenceIds.filter(function (id) { return id !== evidenceId; });
  }
};

// The assets an evidence entry is linked to (a list, usually 0 or 1).
App.assetsLinkedTo = function (caseId, evidenceId) {
  const c = App.findCase(caseId);
  if (c === null) {
    return [];
  }
  return c.assets.filter(function (a) { return a.evidenceIds.includes(evidenceId); });
};

// <option> tags listing a case's assets, for a <datalist> pick list
// (see core/pickers.js). value = what goes in the box; label = the
// gray hint next to it. "types" (optional) limits it to those asset
// type keys, e.g. ["account", "mailbox"]; empty or missing = all.
App.assetDatalistHtml = function (caseObj, types) {
  const e = App.escapeHtml;
  return caseObj.assets
    .filter(function (a) { return !types || types.length === 0 || types.includes(a.type); })
    .map(function (a) {
      const label = App.assetTypeLabel(a.type) + " · " + App.assetStatusLabel(a.status);
      return `<option value="${e(a.name)}" label="${e(label)}"></option>`;
    })
    .join("");
};

// <option> tags listing a case's IOCs, for a data-ioc-picker pick list
// (core/pickers.js). value = the real IOC value; label = its type.
App.iocDatalistHtml = function (caseObj) {
  const e = App.escapeHtml;
  return caseObj.iocs
    .map(function (i) {
      return `<option value="${e(i.value)}" label="${e(i.id + " · " + App.iocTypeLabel(i.type))}"></option>`;
    })
    .join("");
};

// Labels for the asset lists.
App.assetTypeLabel = function (key) {
  return App.labelFor(App.ASSET_TYPES, key);
};
App.assetStatusLabel = function (key) {
  return App.labelFor(App.ASSET_STATUSES, key);
};

// ---------------------------------------------------------------
// Storyline helpers (the attacker timeline)
// ---------------------------------------------------------------
//
// A storyline entry looks like:
//   { id: "ST-001", timestamp: "2026-09-19T22:41:07",   // UTC
//     host: "ACME-FS01", what: "RDP logon as svc_backup from 203.0.113.45",
//     tactic: "TA0001", techniques: ["T1133", "T1078"],
//     confidence: "high", evidenceIds: ["EV-002"] }

// A technique ID: "T" + 4 digits, optionally "." + 3 digits.
// Examples: T1566, T1566.001. The "i" at the end ignores upper/lower case.
App.TECHNIQUE_PATTERN = /^T\d{4}(\.\d{3})?$/i;

// The rules for storyline fields (shared by add and update).
// Returns { error: "..." } or { fields: {...} }.
// "c" is the case, needed to check the linked evidence IDs exist.
App.cleanStory = function (c, storyData) {
  const what = (storyData.what || "").trim();
  if (what === "") {
    return { error: "Describe what happened." };
  }

  const tacticKeys = App.MITRE_TACTICS.map(function (t) { return t.key; });
  const confidenceKeys = App.CONFIDENCE_LEVELS.map(function (x) { return x.key; });

  // Techniques can come in as a list, or as typed text like
  // "T1566.001, t1204.002". Split text on commas, semicolons, or
  // spaces. /[\s,;]+/ is a regular expression: "one or more of
  // whitespace, comma, semicolon". Python: re.split(r"[\s,;]+", text)
  let techniques = storyData.techniques || [];
  if (typeof techniques === "string") {          // typeof = Python's type()
    techniques = techniques.split(/[\s,;]+/);
  }
  techniques = techniques
    .map(function (t) { return t.trim().toUpperCase(); })
    .filter(function (t) { return t !== ""; });   // drop empty bits

  // Any that don't look like technique IDs? Report them all at once.
  const bad = techniques.filter(function (t) { return !App.TECHNIQUE_PATTERN.test(t); });
  if (bad.length > 0) {
    return { error: "Not a technique ID: " + bad.join(", ") + ". Use the format T1566 or T1566.001." };
  }
  // Remove duplicates. A Set only keeps one of each value, like
  // Python's set(); Array.from turns it back into a list, keeping order.
  techniques = Array.from(new Set(techniques));

  // Only keep evidence IDs that exist in this case.
  const existing = c.evidence.map(function (ev) { return ev.id; });
  const evidenceIds = (storyData.evidenceIds || []).filter(function (id) {
    return existing.includes(id);
  });

  return {
    fields: {
      // Always with seconds ("...T22:41:00"), so every entry looks alike.
      timestamp: App.time.withSeconds((storyData.timestamp || "").trim()),
      host: (storyData.host || "").trim(),
      what: what,
      tactic: tacticKeys.includes(storyData.tactic) ? storyData.tactic : "none",
      techniques: techniques,
      confidence: confidenceKeys.includes(storyData.confidence) ? storyData.confidence : "medium",
      evidenceIds: evidenceIds
    }
  };
};

// Add a storyline entry. Returns null if it worked, or an error message.
App.addStory = function (caseId, storyData) {
  const c = App.findCase(caseId);
  if (c === null) {
    return "No case with ID " + caseId + ".";
  }
  const result = App.cleanStory(c, storyData);
  if (result.error) {
    return result.error;
  }
  const id = "ST-" + String(c.nextStoryNumber).padStart(3, "0");
  const entry = { id: id, ...result.fields };
  c.storyline.push(entry);
  c.nextStoryNumber = c.nextStoryNumber + 1;
  console.log("Storyline entry added to", caseId + ":", entry);
  return null;
};

// Find one storyline entry. Returns it, or null.
App.findStory = function (caseId, storyId) {
  const c = App.findCase(caseId);
  if (c === null) {
    return null;
  }
  return c.storyline.find(function (st) { return st.id === storyId; }) || null;
};

// Change a storyline entry. Its ID stays the same.
App.updateStory = function (caseId, storyId, storyData) {
  const c = App.findCase(caseId);
  const entry = App.findStory(caseId, storyId);
  if (entry === null) {
    return "No storyline entry " + storyId + " in case " + caseId + ".";
  }
  const result = App.cleanStory(c, storyData);
  if (result.error) {
    return result.error;
  }
  Object.assign(entry, result.fields);
  console.log("Storyline entry updated:", entry);
  return null;
};

// Remove a storyline entry.
App.deleteStory = function (caseId, storyId) {
  const c = App.findCase(caseId);
  if (c === null) {
    return false;
  }
  const before = c.storyline.length;
  c.storyline = c.storyline.filter(function (st) { return st.id !== storyId; });
  console.log("Storyline entry removed:", storyId);
  return c.storyline.length < before;
};

// The storyline in time order, oldest first. Entries with no time go last.
// We sort a COPY (.slice()) so the saved order isn't changed.
// Timestamps like "2026-09-19T22:41:07" sort correctly as plain text,
// because the biggest unit (year) comes first.
// The compare function returns a negative number if a goes first,
// positive if b goes first. (Python would use sorted(key=...) instead.)
App.sortedStoryline = function (c) {
  return c.storyline.slice().sort(function (a, b) {
    if (a.timestamp === "" && b.timestamp === "") { return 0; }
    if (a.timestamp === "") { return 1; }     // a has no time: a goes last
    if (b.timestamp === "") { return -1; }    // b has no time: b goes last
    return a.timestamp.localeCompare(b.timestamp);   // text comparison
  });
};

// Labels for the storyline lists.
App.tacticLabel = function (key) {
  return App.labelFor(App.MITRE_TACTICS, key);
};
App.confidenceLabel = function (key) {
  return App.labelFor(App.CONFIDENCE_LEVELS, key);
};

// ---------------------------------------------------------------
// IOC helpers (indicators of compromise)
// ---------------------------------------------------------------
//
// An IOC looks like:
//   { id: "IOC-001", type: "ipv4", value: "203.0.113.45",   // real value
//     tlp: "amber", firstSeen: "2026-09-19T22:41:07",       // UTC
//     evidenceIds: ["EV-002"], notes: "RDP source" }

// The rules for IOC fields (shared by add and update).
// "c" is the case; "ignoreId" is the IOC being edited (so it doesn't
// count as a duplicate of itself). Returns { error } or { fields }.
App.cleanIoc = function (c, iocData, ignoreId) {
  // Save the real value, even if a defanged one was pasted.
  let value = App.ioc.refang(iocData.value);
  if (value === "") {
    return { error: "Value is required." };
  }

  // Type: as chosen, or guessed from the value ("auto" or unknown).
  const typeKeys = App.IOC_TYPES.map(function (t) { return t.key; });
  const type = typeKeys.includes(iocData.type) ? iocData.type : App.ioc.guessType(value);

  // These types aren't case-sensitive: store them lowercase so the
  // same IOC always looks the same.
  if (["md5", "sha1", "sha256", "domain", "email", "certificate", "tls-fingerprint"].includes(type)) {
    value = value.toLowerCase();
  }

  const problem = App.ioc.checkValue(value, type);
  if (problem !== null) {
    return { error: problem };
  }

  // No duplicates: same type and value (ignoring upper/lower case).
  const clash = c.iocs.find(function (i) {
    return i.id !== ignoreId && i.type === type && i.value.toLowerCase() === value.toLowerCase();
  });
  if (clash) {
    return { error: "Already in IOCs as " + clash.id + "." };
  }

  const tlpKeys = App.TLP_LEVELS.map(function (t) { return t.key; });
  const existing = c.evidence.map(function (ev) { return ev.id; });

  return {
    fields: {
      type: type,
      value: value,
      tlp: tlpKeys.includes(iocData.tlp) ? iocData.tlp : "amber",
      firstSeen: App.time.withSeconds((iocData.firstSeen || "").trim()),   // UTC
      evidenceIds: (iocData.evidenceIds || []).filter(function (id) { return existing.includes(id); }),
      notes: (iocData.notes || "").trim()
    }
  };
};

// Add an IOC. Returns null if it worked, or an error message.
App.addIoc = function (caseId, iocData) {
  const c = App.findCase(caseId);
  if (c === null) {
    return "No case with ID " + caseId + ".";
  }
  const result = App.cleanIoc(c, iocData, null);
  if (result.error) {
    return result.error;
  }
  const id = "IOC-" + String(c.nextIocNumber).padStart(3, "0");
  const ioc = { id: id, ...result.fields };
  c.iocs.push(ioc);
  c.nextIocNumber = c.nextIocNumber + 1;
  console.log("IOC added to", caseId + ":", ioc);
  return null;
};

// Find one IOC. Returns it, or null.
App.findIoc = function (caseId, iocId) {
  const c = App.findCase(caseId);
  if (c === null) {
    return null;
  }
  return c.iocs.find(function (i) { return i.id === iocId; }) || null;
};

// Change an IOC. Its ID stays the same.
App.updateIoc = function (caseId, iocId, iocData) {
  const c = App.findCase(caseId);
  const ioc = App.findIoc(caseId, iocId);
  if (ioc === null) {
    return "No IOC " + iocId + " in case " + caseId + ".";
  }
  const result = App.cleanIoc(c, iocData, iocId);
  if (result.error) {
    return result.error;
  }
  Object.assign(ioc, result.fields);
  console.log("IOC updated:", ioc);
  return null;
};

// Remove an IOC.
App.deleteIoc = function (caseId, iocId) {
  const c = App.findCase(caseId);
  if (c === null) {
    return false;
  }
  const before = c.iocs.length;
  c.iocs = c.iocs.filter(function (i) { return i.id !== iocId; });
  console.log("IOC removed:", iocId);
  return c.iocs.length < before;
};

// Labels for the IOC lists.
App.iocTypeLabel = function (key) {
  return App.labelFor(App.IOC_TYPES, key);
};
App.tlpLabel = function (key) {
  return App.labelFor(App.TLP_LEVELS, key);
};

// ---------------------------------------------------------------
// Client tab helpers
// ---------------------------------------------------------------

// A fresh, empty Client tab. (The client's NAME is case.client, so
// the sidebar and header can show it; everything else is here.)
App.newClientInfo = function () {
  return {
    org: { industry: "", headcount: "", timeZone: "" },
    subscriptions: {
      edr: "", edrOther: "",
      siem: "", siemOther: "",
      rmm: "", rmmOther: "",
      firewallManaged: "", firewallVendor: "", firewallOther: "",
      irRetainer: "", binalyze: ""
    },
    people: [],             // see App.addPerson
    nextPersonNumber: 1,
    environment: {
      identity: "", email: "", network: "",
      // VPN: one true/false per App.VPN_TYPES key, plus free-text notes.
      vpn: { ssl: false, web: false, siteToSite: false, ipsec: false },
      vpnNotes: "",
      // Web link or file path to the network diagram (App.linkFor).
      topologyLink: "",
      // How to talk if email / M365 / Teams may be compromised
      // (phone bridge, Signal group, separate tenant...).
      oobChannel: "",
      cloud: "", os: "", other: ""
    },
    // Backups. "" = not set; yes/no answers use App.CLIENT_CHOICES.yesNo.
    backups: {
      responsible: "",        // "client" / "msp" / "third-party" (App.PERSON_SIDES)
      responsibleName: "",    // person or company
      product: "",
      allServers: "",         // yes / no
      allServersNotes: "",    // which servers (or which are NOT backed up)
      retention: "",
      rpo: "",                // backup interval / recovery point objective
      storage: { cloud: false, onPrem: false },
      storageNotes: "",
      immutable: ""           // yes / no
    },
    // Cyber insurance.
    insurance: { hasCyber: "", provider: "" },
    // Pasted output of the adtriage.ps1 script (Active Directory map:
    // domains, forest, sites, trusts, universal groups, Enterprise
    // Admins, foreign security principals, subnets, DHCP).
    // ranAt is UTC, like every saved time.
    adTriage: { ranOn: "", ranAt: "", ranBy: "", output: "" },
    // Important assets, in the order they should be restored /
    // recovered (#1 first). See App.addCriticalAsset.
    criticalAssets: [],
    nextCriticalNumber: 1,
    scope: { inScope: "", outOfScope: "", authorization: "" },
    devices: {
      // Where each device list CSV is on disk, pasted by the user,
      // e.g. "C:\IR-Cases\INC-2041\edr_devices.csv". Shown as links.
      paths: { edr: "", rmm: "", siem: "" },
      // Result of checking the RMM CSV's "EDR" column (App.setRmmCheck),
      // or null if not checked yet.
      rmmCheck: null,
      manualNoEdr: ""       // typed list, one device per line
    }
  };
};

// Set one Client tab field by its "path", e.g. "org.industry" or
// "subscriptions.edr". Like Python: info["org"]["industry"] = value.
// "clientName" is special: it's the case's own client field.
// Only EXISTING fields can be set, so a typo can't create junk keys.
App.setClientField = function (caseId, path, value) {
  const c = App.findCase(caseId);
  if (c === null) {
    return false;
  }
  if (path === "clientName") {
    c.client = value;
    return true;
  }
  return App.setPath(c.clientInfo, path, value);   // shared helper (see App.setPath)
};

// ---- People (IR team and contacts) ----

// Add an empty person row. Returns the new person's ID ("PE-001").
App.addPerson = function (caseId) {
  const info = App.findCase(caseId).clientInfo;
  const id = "PE-" + String(info.nextPersonNumber).padStart(3, "0");
  info.people.push({ id: id, name: "", role: "support", side: "client", company: "",
                     email: "", phone: "", primary: false });
  info.nextPersonNumber = info.nextPersonNumber + 1;
  return id;
};

// Change one field of a person, e.g. ("PE-001", "email", "a@b.com").
App.updatePerson = function (caseId, personId, key, value) {
  const person = App.findCase(caseId).clientInfo.people.find(function (p) { return p.id === personId; });
  if (!person || !(key in person) || key === "id") {
    return false;
  }
  person[key] = value;
  return true;
};

App.deletePerson = function (caseId, personId) {
  const info = App.findCase(caseId).clientInfo;
  info.people = info.people.filter(function (p) { return p.id !== personId; });
};

// ---- Critical assets (restore / recovery order) ----
// Each: { id: "CR-001", name, purpose, backup, tier }. The list's ORDER
// is the restore order: index 0 is restored first. "CR-001" is only an
// internal ID; on screen each one is shown by its POSITION: BC-01 is #1
// on the business critical list (so the label changes when you reorder).

// The on-screen label for position n (1 = first): "BC-01".
App.CRITICAL_PREFIX = "BC";       // "Business Critical"; change it here
App.criticalLabel = function (n) {
  return App.CRITICAL_PREFIX + "-" + String(n).padStart(2, "0");
};

// Is this host / account on the client's critical assets list?
// Compared like the EDR check (App.normalizeHost): no case, no domain.
// Returns { position: 1, label: "BC-01", item: {...} } or null.
App.criticalMatch = function (caseObj, name) {
  const wanted = App.normalizeHost(name || "");
  if (wanted === "") {
    return null;
  }
  const list = caseObj.clientInfo.criticalAssets;
  for (let i = 0; i < list.length; i++) {
    if (list[i].name && App.normalizeHost(list[i].name) === wanted) {
      return { position: i + 1, label: App.criticalLabel(i + 1), item: list[i] };
    }
  }
  return null;
};

// An affected asset's AD tier: its own if set, otherwise the tier given
// to it on the critical assets list. Returns a key ("t0") or "".
App.assetTier = function (caseObj, asset) {
  if (asset.tier) {
    return asset.tier;
  }
  const match = App.criticalMatch(caseObj, asset.name);
  return match && match.item.tier ? match.item.tier : "";
};

// Affected (not clean) assets that are Tier 0.
App.tier0Affected = function (caseObj) {
  return caseObj.assets.filter(function (a) {
    return a.status !== "clean" && App.assetTier(caseObj, a) === "t0";
  });
};

// The tags after an affected asset's name: [no EDR] [Tier 0] [BC-01].
// Hover a tag for details.
App.assetTagsHtml = function (caseObj, asset) {
  const e = App.escapeHtml;
  const tags = [];
  if (App.assetLacksEdr(caseObj, asset)) {
    tags.push('<span class="tag tag-warning" title="Not in the EDR device list (Client tab)">no EDR</span>');
  }
  const tierKey = App.assetTier(caseObj, asset);
  if (tierKey) {
    const tier = App.AD_TIERS.find(function (t) { return t.key === tierKey; });
    const from = asset.tier ? "" : " (from the critical assets list, Client tab)";
    tags.push(`<span class="tag tier-${e(tierKey)}" title="${e(tier.description + from)}">${e(tier.label)}</span>`);
  }
  const match = App.criticalMatch(caseObj, asset.name);
  if (match) {
    const role = match.item.purpose ? ": " + match.item.purpose : "";
    tags.push(`<span class="tag tag-critical" title="#${match.position} on the business critical / restore order list${e(role)}">${e(match.label)}</span>`);
  }
  return tags.join(" ");
};

App.addCriticalAsset = function (caseId) {
  const info = App.findCase(caseId).clientInfo;
  const id = "CR-" + String(info.nextCriticalNumber).padStart(3, "0");
  info.criticalAssets.push({ id: id, name: "", purpose: "", backup: "", tier: "" });
  info.nextCriticalNumber = info.nextCriticalNumber + 1;
  return id;
};

App.updateCriticalAsset = function (caseId, id, key, value) {
  const item = App.findCase(caseId).clientInfo.criticalAssets.find(function (a) { return a.id === id; });
  if (!item || !(key in item) || key === "id") {
    return false;
  }
  item[key] = value;
  return true;
};

App.deleteCriticalAsset = function (caseId, id) {
  const info = App.findCase(caseId).clientInfo;
  info.criticalAssets = info.criticalAssets.filter(function (a) { return a.id !== id; });
};

// Move an item up (step -1) or down (step +1) in the restore order.
// Swapping two list items works like Python's a[i], a[j] = a[j], a[i].
App.moveCriticalAsset = function (caseId, id, step) {
  const list = App.findCase(caseId).clientInfo.criticalAssets;
  const i = list.findIndex(function (a) { return a.id === id; });
  const j = i + step;
  if (i === -1 || j < 0 || j >= list.length) {
    return false;                          // already at the top / bottom
  }
  const temp = list[i];
  list[i] = list[j];
  list[j] = temp;
  return true;
};

// ---- Device lists (EDR / RMM / SIEM) and EDR coverage ----

// Reduce a device name to a form that can be compared across tools:
// lowercase, no domain ("ACME-WS114.acme.local" -> "acme-ws114"),
// no "DOMAIN\" prefix. IP addresses are kept whole.
App.normalizeHost = function (name) {
  let s = String(name || "").trim().toLowerCase();
  s = s.split("\\").pop();                         // "ACME\WS1" -> "ws1"
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) {
    return s;                                      // an IP: keep it
  }
  return s.split(".")[0];                          // drop the domain part
};

// Save the result of checking the RMM CSV. "check" is:
//   { fileName, hostColumn, edrColumn, total, noEdr: ["acme-fs01", ...] }
App.setRmmCheck = function (caseId, check) {
  App.findCase(caseId).clientInfo.devices.rmmCheck = {
    fileName: check.fileName,
    hostColumn: check.hostColumn,
    edrColumn: check.edrColumn,
    total: check.total,
    checkedAt: App.time.nowUtc(),
    noEdr: check.noEdr
  };
  console.log("RMM checked:", check.noEdr.length, "of", check.total, "devices without EDR");
};

App.clearRmmCheck = function (caseId) {
  App.findCase(caseId).clientInfo.devices.rmmCheck = null;
};

// From RMM CSV rows, the devices whose EDR column says "not installed"
// (any upper/lower case, anywhere in the cell).
App.findNoEdrInRmm = function (rows, hostCol, edrCol) {
  return rows
    .filter(function (r) { return (r[edrCol] || "").toLowerCase().includes("not installed"); })
    .map(function (r) { return (r[hostCol] || "").trim(); })
    .filter(function (name) { return name !== ""; });
};

// Devices WITHOUT EDR:
//   - devices the RMM CSV says have EDR "not installed", plus
//   - anything typed in the manual "no EDR" box.
// Returns [{ name, key, seenIn: ["RMM", "Manual"] }, ...] sorted A-Z.
App.devicesWithoutEdr = function (caseObj) {
  const d = caseObj.clientInfo.devices;
  const found = {};                                // key -> entry

  function add(name, where) {
    const key = App.normalizeHost(name);
    if (key === "") {
      return;
    }
    if (!found[key]) {
      found[key] = { name: String(name).trim(), key: key, seenIn: [] };
    }
    if (!found[key].seenIn.includes(where)) {
      found[key].seenIn.push(where);
    }
  }

  if (d.rmmCheck) {
    for (const name of d.rmmCheck.noEdr) {
      add(name, "RMM");
    }
  }
  for (const line of d.manualNoEdr.split("\n")) {
    add(line, "Manual");
  }

  return Object.values(found).sort(function (a, b) { return a.key.localeCompare(b.key); });
};

// Does this asset lack EDR? True when it's in the "without EDR" list
// (RMM check or manual). Only hosts, servers, and network devices.
App.assetLacksEdr = function (caseObj, asset) {
  if (!["host", "server", "network-device"].includes(asset.type)) {
    return false;
  }
  const key = App.normalizeHost(asset.name);
  return App.devicesWithoutEdr(caseObj).some(function (x) { return x.key === key; });
};

// ---------------------------------------------------------------
// Personal settings, remembered by the browser (localStorage)
// ---------------------------------------------------------------
//
// localStorage is a small key -> text store the browser keeps for
// this page, a bit like Python's shelve. It survives refreshes and
// restarts. It's for view preferences only, NOT case data: case data
// goes in case folders on disk (stage 6).
//
// Every read/write is wrapped in try/catch because some browser
// settings block storage; then we just carry on without saving.

App.SETTINGS_KEY = "irWorkbench.settings";

// Load saved settings into App.state (called once at startup).
App.loadSettings = function () {
  try {
    const text = localStorage.getItem(App.SETTINGS_KEY);   // null if never saved
    if (text === null) {
      return;
    }
    // JSON.parse turns text back into an object, like Python's json.loads().
    const saved = JSON.parse(text);
    if (saved.displayTimeZone && App.isValidZone(saved.displayTimeZone)) {
      App.state.displayTimeZone = saved.displayTimeZone;
    }
    console.log("Settings loaded:", saved);
  } catch (err) {
    console.warn("Could not load settings:", err);
  }
};

// Save the current settings.
App.saveSettings = function () {
  try {
    // JSON.stringify turns an object into text, like Python's json.dumps().
    localStorage.setItem(App.SETTINGS_KEY, JSON.stringify({
      displayTimeZone: App.state.displayTimeZone
    }));
  } catch (err) {
    console.warn("Could not save settings:", err);
  }
};

// Is this a time zone the browser knows? Creating a formatter with an
// unknown zone throws an error, which we catch.
App.isValidZone = function (zone) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch (err) {
    return false;
  }
};

console.log("state.js loaded");
