# IR Workbench

A personal incident response case workbench that runs entirely in your browser. Open `index.html` and work a case: track evidence, build the attacker timeline, collect IOCs, list affected assets, and keep client details in one place.

No server, no install, no build step, no internet connection needed.

> **Status: work in progress.** Everything is kept in memory for now, so **refreshing the page clears your cases**. Saving cases to folders on disk is planned (see [Roadmap](#roadmap)). Use **Load sample data** to try it out.

## Getting started

1. Download or clone this repository.
2. Double-click `index.html`. It opens in **Chrome** or **Edge**, which are the supported browsers.
3. Click **Load sample data** in the sidebar to load three fictional cases, or click **+ New case** to start your own.

## Features

**Cases**
- The case list in the sidebar shows severity and status.
- Each case has one or more case types: ransomware, BEC, phishing, account takeover, supply chain, and more.
- A case header shows the ticket, severity, status, client, and case types on every tab.

**Evidence**
- Evidence entries are numbered automatically (EV-001, ...). Each has a type, source, host/account, collected time, notes, and a raw log excerpt.
- An entry's location is either a cloud storage link or a local file. For local files, the SHA-256 hash is calculated in the browser; the file is never uploaded or copied.
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
- Assets are added automatically from evidence when you tick "affected". The host fields in the Evidence and Storyline forms can pick from this list.

**Client**
- Organization details, subscriptions (EDR, SIEM, RMM, managed firewall, IR retainer), the incident response team and contacts, environment, and scope.
- Links to the client's device list CSVs on disk.
- **Devices without EDR** are found from the RMM export's `EDR` column and highlighted on every tab.

**Time zones**
- One time zone setting in the sidebar applies to the whole app. Every time you see or enter uses that zone.
- Everything is stored in UTC.

## Privacy and case data

- **The app is fully offline.** It loads nothing from the internet and sends nothing anywhere. The only exception is links you choose to click, such as MITRE technique pages or your own cloud evidence links.
- **Case data does not belong in this repository.** Cases are meant to live in a separate folder you choose (for example `IR-Cases/`). The `.gitignore` also blocks case folders, exports, and common evidence file types, in case one ends up in the project folder.
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
  time.js         time zone conversion (UTC <-> any zone), timestamp parsing
  ioc.js          IOC type detection, defang / refang, extraction from logs
  export.js       CSV read/write, downloads, clipboard, file links
  pickers.js      reusable asset pick list for host fields
  sample.js       fictional sample data
tabs/
  client.js  summary.js  storyline.js  tasks.js
  evidence.js  iocs.js  assets.js  post.js
samples/          fictional device list CSVs for testing imports
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
- [ ] Tasks tab
- [ ] Summary and Reports tab (pre-call briefs, reports)
- [ ] Post-incident tab (lessons learned across cases)
- [ ] Save and load case folders on disk (File System Access API)
- [ ] Polish
