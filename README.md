# IR Workbench

A personal incident response case workbench that runs entirely in your browser. Open `index.html` and work a case: keep client details, assess impact, plan containment, track action items, collect evidence, build the attacker timeline, gather IOCs, and list affected assets, all in one place.

No server, no install, no build step, no internet connection needed.

> **Status: work in progress.** Click **Connect cases folder** in the sidebar to save your cases to a folder on disk (autosaved). Use **Load sample data** to try it out; sample cases are never saved.

## Getting started

1. Download or clone this repository.
2. Double-click `index.html`. It opens in **Chrome** or **Edge**, which are the supported browsers.
3. Click **Connect cases folder** and pick (or create) a folder for your cases, **outside** this project, e.g. `C:\Users\you\IR-Cases`. After a browser restart, click **Reconnect**.
4. Click **+ New case** to start a case, or **Load sample data** to explore with three fictional cases.

## Features

**Cases**
- The case list in the sidebar shows each case's priority (P1, P2, P3; P1 is the most urgent) and status.
- Each case has one or more case types: ransomware, BEC, phishing, account takeover, supply chain, and more.
- A case header shows the ticket, priority, status, client, and case types on every tab, plus a red warning when devices are missing EDR.
- **Edit case** changes the title, client, priority, status, opened date, and case types (the ticket ID stays fixed). Status changes are time-stamped, and the header shows when the case was contained and closed. Closing a case with open action items asks you to confirm first.

**Client**
- Organization details, and one line per subscription: EDR, SIEM, RMM, managed firewall, IR retainer (with a warning if the client isn't in the Binalyze console yet).
- The incident response team and contacts, each marked Client Owned, Thrive, or 3rd Party.
- Cyber insurance, and a backups section: who's responsible, product, coverage, retention, RPO, storage location, and immutability (red tags for gaps).
- Environment, one line per item: identity, email, network, VPN types, a clickable network topology link, the **out-of-band channel** to use if email may be compromised, cloud, and OS mix.
- **Critical assets in restore order** (#1 first), for planning recovery.
- **Active Directory triage** and **logging & evidence check**: paste script output, and download or copy the built-in PowerShell scripts (as a script or a base64 one-liner).
- Links to the client's device list CSVs on disk. **Devices without EDR** are found from the RMM export's `EDR` column and highlighted on every tab.

**Summary and Reports**
- **Incident summary:** detected at, detection source (SentinelOne, Defender, Sentinel, FortiEDR, FortiSIEM, Elastic, SaaS Alerts, threat hunt, or other), overview, and facts pulled from the other tabs.
- **Impact assessment** using the NIST SP 800-61 categories: functional impact, information impact, and recoverability effort, each with the NIST definitions, a justification, and comments drawn from the case.
- **Containment strategy:**
  - Assumptions, with suggestions from the case (e.g. assume credential theft across the domain when there's a foothold and EDR gaps).
  - Containment actions picked from a catalog (disable accounts, isolate host, revoke sessions, block lateral movement, firewall deny, and more), each with a "Before you do this" hint.
  - A containment window: everything is contained at once, and actions without their own due time use it.
- Hover reminders (the circled **?**) next to the section titles.

**Action Items**
- One list per case for containment, recovery, and general follow-ups, with priority (Critical, High, Medium, Low), owner, due time, status, approval (who, when, how), and done time.
- Containment actions are shared with the containment strategy: edit one in either place and both update.
- Rules: containment actions need a recorded approval before they're marked Approved; blocked and not-needed items need a reason; closed items are kept for the record.
- **Evidence preservation:** every affected asset automatically gets a "Preserve evidence" item, with notes on what to collect for that asset type. A banner warns while they're still open and containment is planned.
- Filters by status, action type, owner, and host. **Copy shown items** copies exactly what's on screen; **Copy client action items** makes a numbered list for an email; export everything to CSV.

**Evidence**
- Evidence entries are numbered automatically (EV-001, ...). Each has a type, source, host/account, collected time, notes, and a raw log excerpt.
- An entry's location is either a cloud storage link or a local file. Local files get a SHA-256 hash in the browser and can be copied into the case folder (the copy is re-checked against the hash).
- You can export a case's evidence to CSV. Values that Excel would treat as formulas are neutralized, to protect against CSV injection.

**Storyline**
- The attacker timeline is shown as a vertical, day-grouped view, similar to DFIR-IRIS.
- Each entry has a MITRE ATT&CK tactic, technique IDs (linked to attack.mitre.org), and a confidence level.
- **→ Storyline** on an evidence entry starts a timeline entry that's already filled in from that evidence.
- You can paste timestamps as ISO 8601, Unix epoch (seconds or milliseconds), or Windows FILETIME, and they're converted automatically.

**IOCs**
- Supported types: IPs, domains, URLs, email addresses, file hashes, file paths, registry keys, command lines, user agents, certificates, JA3/JA4, mutexes, and crypto wallets.
- Each IOC has a TLP 2.0 marking.
- Values are shown **defanged** (`203[.]0[.]113[.]45`, `hxxps://`). **Copy** gives you the real value.
- **Extract from raw logs** scans the evidence raw logs for IOCs and shows them as a checklist to review before adding.
- You can export IOCs to CSV with both the real and defanged values.

**Assets**
- Lists the affected hosts and accounts, each with a status: suspected → confirmed → contained → remediated → clean.
- Assets are added automatically from evidence when you tick "affected". Host fields across the app can pick from this list.

**Saving**
- Each case is a folder: `case.json` (all its data), `.history/` (last 20 older versions), `evidence/` (local evidence files), `exports/` (CSV exports).
- Autosaves every couple of seconds; the sidebar shows "✓ Saved" or a red warning when changes aren't being saved.
- Older case files are upgraded automatically when they're opened.

**Time zones**
- One time zone setting in the sidebar applies to the whole app. Every time you see or enter uses that zone.
- Everything is stored in UTC.

## Privacy and case data

- **The app is fully offline.** It loads nothing from the internet and sends nothing anywhere. The only exception is links you choose to click, such as MITRE technique pages or your own cloud evidence links.
- **Case data does not belong in this repository.** Cases live in a separate folder you choose (for example `IR-Cases/`). The app refuses a folder that looks like this project, and the `.gitignore` also blocks case folders, exports, and common evidence file types.
- **The sample data is fictional.** It uses reserved example domains (`example.com`) and documentation IP ranges (`203.0.113.0/24`, `198.51.100.0/24`).
- **Only personal view settings** (the display time zone) are remembered by the browser, using `localStorage`.

## Project structure

```
index.html        page layout and pop-up forms
style.css         dark theme; colors are CSS variables in :root
core/
  state.js        shared data (App.state) and the rules for changing it
  app.js          startup, tab switching, case header
  sidebar.js      case list, "New case" form, time zone setting
  storage.js      saving: cases folder, autosave, .history, evidence copies, exports
  time.js         time zone conversion (UTC <-> any zone), timestamp parsing
  ioc.js          IOC type detection, defang / refang, extraction from logs
  export.js       CSV read/write, downloads, clipboard, file links
  pickers.js      reusable pick lists for host / account and IOC fields
  taskform.js     the add / edit action item pop-up, shared by Action Items
                  and the containment strategy
  scripts.js      built-in PowerShell scripts, base64 (generated; see tools/)
  sample.js       fictional sample data
tabs/
  client.js  summary.js  storyline.js  tasks.js
  evidence.js  iocs.js  assets.js  post.js
samples/          fictional device list CSVs for testing imports
tools/
  update-scripts.ps1   refreshes core/scripts.js from the .ps1 scripts
Invoke-TriageCheck.ps1 logging & evidence check script (built into the Client tab)
```

**How it's built:**
- Plain HTML, CSS, and vanilla JavaScript. There are no frameworks, dependencies, or build step.
- It has to work when opened straight from disk (`file://`), so it doesn't use ES modules. Scripts load in order with `<script>` tags and share one global object, `App`.
- Tabs never call each other. Each tab reads and writes the shared case data through helpers in `core/state.js`, then the page redraws from that data.

## Roadmap

- [x] Case list, new case form, case header
- [x] Evidence tab
- [x] Storyline tab with promote-from-evidence
- [x] IOCs tab with extractor
- [x] Assets tab
- [x] Client tab
- [x] Save and load case folders on disk (File System Access API)
- [x] Action Items tab
- [x] Summary and Reports: incident summary, impact assessment, containment strategy
- [x] Edit case details (status, priority, title, types), with time-stamped status changes
- [ ] Recovery strategy (driven by the critical assets restore order)
- [ ] Pre-call briefs and client report
- [ ] Post-incident tab (lessons learned across cases)
- [ ] Polish
