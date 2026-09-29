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
    displayTimeZone: "UTC"
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

App.SEVERITIES = ["low", "medium", "high", "critical"];
App.STATUSES = ["open", "contained", "closed"];

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

  // Build the case object with defaults for anything left out.
  const newCase = {
    id: id,
    title: (caseData.title || "").trim(),
    client: (caseData.client || "").trim(),
    types: types,                               // list of type keys
    severity: caseData.severity || "medium",
    status: caseData.status || "open",
    opened: caseData.opened || App.todayString(),

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
    clientInfo: App.newClientInfo()
  };

  App.state.cases.push(newCase);   // like Python's list.append()
  console.log("Case added:", newCase);
  return null;
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
      notes: (assetData.notes || "").trim()
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
  Object.assign(asset, result.fields);
  console.log("Asset updated:", asset);
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
  const keys = path.split(".");                  // "org.industry" -> ["org", "industry"]
  let obj = c.clientInfo;
  for (let i = 0; i < keys.length - 1; i++) {    // walk down to the parent object
    obj = obj[keys[i]];
    if (typeof obj !== "object" || obj === null) {
      return false;
    }
  }
  const last = keys[keys.length - 1];
  if (!(last in obj)) {                          // "in" = Python's "key in dict"
    console.warn("Unknown client field:", path);
    return false;
  }
  obj[last] = value;
  return true;
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
// Each: { id: "CR-001", name, purpose, backup }. The list's ORDER is
// the restore order: index 0 is restored first.

App.addCriticalAsset = function (caseId) {
  const info = App.findCase(caseId).clientInfo;
  const id = "CR-" + String(info.nextCriticalNumber).padStart(3, "0");
  info.criticalAssets.push({ id: id, name: "", purpose: "", backup: "" });
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
