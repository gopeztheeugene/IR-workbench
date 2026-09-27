// ioc.js - text helpers for IOCs (indicators of compromise):
// guessing an IOC's type, and defanging / refanging values.
//
// "Defanged" means changed so it can't be clicked or run by accident:
//   203.0.113.45           -> 203[.]0[.]113[.]45
//   https://evil.example/x -> hxxps://evil[.]example/x
// The app always SAVES the real ("refanged") value and only defangs
// it for display.

App.ioc = {};

// Undo common defanging, so a value pasted from a report is saved as
// the real thing: "evil[.]com" -> "evil.com", "hxxps" -> "https".
// The /.../g patterns replace every match (g = global), like Python's
// re.sub(). \[ and \] mean literal square brackets.
App.ioc.refang = function (text) {
  return (text || "")
    .trim()
    .replace(/\[\.\]|\(\.\)|\{\.\}|\[dot\]/gi, ".")
    .replace(/\[:\]/g, ":")
    .replace(/\[:\/\/\]/g, "://")
    .replace(/\[@\]|\[at\]/gi, "@")
    .replace(/^hxxp/i, "http")
    .replace(/^fxp/i, "ftp");
};

// Show a real value in defanged form, depending on its type.
App.ioc.defang = function (value, type) {
  if (type === "ipv4" || type === "domain") {
    return value.replaceAll(".", "[.]");
  }
  if (type === "ipv6") {
    return value.replaceAll(":", "[:]");
  }
  if (type === "url") {
    // "https://..." -> "hxxps://...", then every dot -> [.]
    return value.replace(/^http/i, "hxxp").replace(/^ftp/i, "fxp").replaceAll(".", "[.]");
  }
  if (type === "email") {
    return value.replace("@", "[@]").replaceAll(".", "[.]");
  }
  return value;                   // hashes, paths, etc. can't be clicked
};

// File extensions that make "invoice.exe" a FILE, not a domain.
// (Some of these are also real top-level domains, like .zip.)
App.ioc.FILE_EXTENSIONS = ["exe", "dll", "sys", "ps1", "psm1", "bat", "cmd", "vbs", "js",
  "jse", "hta", "scr", "lnk", "msi", "iso", "img", "zip", "rar", "7z", "doc", "docm",
  "docx", "xls", "xlsm", "xlsx", "pdf", "one", "jar", "py", "sh", "elf", "bin", "dat", "tmp",
  "php", "asp", "aspx", "jsp", "html", "htm", "evtx", "log", "csv", "txt", "json", "xml",
  "raw", "dmp", "eml", "msg", "pcap", "pcapng", "cfg", "conf", "ini", "yml", "yaml"];

// Guess an IOC type from a (refanged) value. Returns a key from
// App.IOC_TYPES. It's only a guess: the user can change it.
App.ioc.guessType = function (value) {
  const v = value.trim();
  const lower = v.toLowerCase();

  if (/^(https?|ftp):\/\//i.test(v)) { return "url"; }
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) { return "ipv4"; }
  // IPv6: only hex digits and colons, at least two colons.
  if (/^[0-9a-f:]+$/i.test(v) && v.split(":").length > 2) { return "ipv6"; }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { return "email"; }
  if (/^[0-9a-f]{32}$/i.test(v)) { return "md5"; }
  if (/^[0-9a-f]{40}$/i.test(v)) { return "sha1"; }
  if (/^[0-9a-f]{64}$/i.test(v)) { return "sha256"; }
  if (/^(HKLM|HKCU|HKCR|HKU|HKCC|HKEY_)/i.test(v)) { return "registry"; }
  if (/^mozilla\//i.test(v)) { return "user-agent"; }
  // Windows paths (C:\..., \\server\...) or Unix paths (/tmp/...).
  if (/^[a-z]:\\/i.test(v) || v.startsWith("\\\\") || v.startsWith("/")) { return "filename"; }

  // Something like "name.ext": a file if the ending is a known file
  // extension, otherwise a domain. .pop() takes the last item,
  // like Python's list.pop().
  if (/^([a-z0-9-]+\.)+[a-z0-9]{2,}$/i.test(v)) {
    const ending = lower.split(".").pop();
    return App.ioc.FILE_EXTENSIONS.includes(ending) ? "filename" : "domain";
  }
  // Has a space and starts like a program: probably a command line.
  if (v.includes(" ") && /\.(exe|ps1|bat|cmd)\b|^(powershell|cmd|rundll32|regsvr32|mshta|wmic)\b/i.test(v)) {
    return "command";
  }
  return "other";
};

// Check a value against its type. Returns an error message, or null.
// Only types with a strict format are checked.
App.ioc.checkValue = function (value, type) {
  const lengths = { md5: 32, sha1: 40, sha256: 64 };
  const names = { md5: "MD5", sha1: "SHA-1", sha256: "SHA-256" };
  if (lengths[type]) {
    const pattern = new RegExp("^[0-9a-f]{" + lengths[type] + "}$", "i");
    if (!pattern.test(value)) {
      return "A " + names[type] + " hash is exactly " + lengths[type] +
             " characters of 0-9 and a-f.";
    }
  }
  if (type === "ipv4") {
    const parts = value.split(".");
    // .every() asks "is this true for ALL items?", like Python's all().
    const ok = parts.length === 4 && parts.every(function (p) {
      return /^\d{1,3}$/.test(p) && Number(p) <= 255;
    });
    if (!ok) {
      return "Not a valid IPv4 address (four numbers 0-255 separated by dots).";
    }
  }
  return null;
};

// ---------------------------------------------------------------
// Extracting IOCs from raw log text
// ---------------------------------------------------------------

// Like refang, but for a whole block of text: "hxxp" is fixed
// everywhere, not just at the start.
App.ioc.refangText = function (text) {
  return (text || "")
    .replace(/\[\.\]|\(\.\)|\{\.\}|\[dot\]/gi, ".")
    .replace(/\[:\]/g, ":")
    .replace(/\[:\/\/\]/g, "://")
    .replace(/\[@\]|\[at\]/gi, "@")
    .replace(/hxxp/gi, "http")
    .replace(/\bfxp:/gi, "ftp:");
};

// Is this an internal (private / loopback / link-local) IPv4 address?
// Those are rarely IOCs, so the extractor leaves them unticked.
App.ioc.isPrivateIp = function (ip) {
  const p = ip.split(".").map(Number);          // "10.1.2.3" -> [10, 1, 2, 3]
  return p[0] === 10 ||
         p[0] === 127 ||
         (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
         (p[0] === 192 && p[1] === 168) ||
         (p[0] === 169 && p[1] === 254);
};

// Find the first timestamp on a line of log text, e.g.
// "2026-09-19 22:41:07" or "2026-09-23T07:12:44Z". Returns it as UTC
// text, or "" if there's none. Times without a zone are read as being
// in "logZone" (chosen in the extractor pop-up).
App.ioc.lineTimeUtc = function (line, logZone) {
  const m = line.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:\s*(?:Z|UTC|GMT|[+-]\d{2}:?\d{2})\b)?/i);
  if (m === null) {
    return "";
  }
  const parsed = App.time.parseAny(m[0]);
  if (parsed === null) {
    return "";
  }
  if (parsed.utc) {
    return parsed.utc;
  }
  return App.time.toUtc(parsed.wall, logZone);
};

// Pull possible IOCs out of a block of text (a raw log).
// Returns a list of { type, value, timeUtc, line }.
// Each pattern is a regular expression with "g" (find ALL matches).
// .matchAll() gives every match, like Python's re.finditer().
App.ioc.extract = function (rawText, logZone) {
  const results = [];
  const lines = App.ioc.refangText(rawText).split("\n");

  for (const line of lines) {
    const found = [];                 // { type, value } on this line
    const timeUtc = App.ioc.lineTimeUtc(line, logZone);

    // URLs: from the scheme up to a space or quote/bracket.
    for (const m of line.matchAll(/\b(?:https?|ftp):\/\/[^\s"'<>\]\)}]+/gi)) {
      // Drop punctuation stuck to the end, like "...evil.com/a)." -> ".../a"
      found.push({ type: "url", value: m[0].replace(/[.,;:!?]+$/, "") });
    }

    // Email addresses.
    for (const m of line.matchAll(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi)) {
      found.push({ type: "email", value: m[0] });
    }

    // IPv4 addresses (checked so 999.1.1.1 doesn't count).
    for (const m of line.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)) {
      if (App.ioc.checkValue(m[0], "ipv4") === null) {
        found.push({ type: "ipv4", value: m[0] });
      }
    }

    // Hashes. \b (word boundary) means a 64-character hash won't also
    // be counted as a 32- or 40-character one.
    for (const m of line.matchAll(/\b[a-f0-9]{64}\b/gi)) { found.push({ type: "sha256", value: m[0] }); }
    for (const m of line.matchAll(/\b[a-f0-9]{40}\b/gi)) { found.push({ type: "sha1", value: m[0] }); }
    for (const m of line.matchAll(/\b[a-f0-9]{32}\b/gi)) { found.push({ type: "md5", value: m[0] }); }

    // Domains: "name.name.tld". Skipped when the ending is a file
    // extension (view.php, Security.evtx) or when it's just the host
    // part of a URL or email we already found on this line.
    for (const m of line.matchAll(/\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}\b/gi)) {
      const domain = m[0];
      const ending = domain.toLowerCase().split(".").pop();
      if (App.ioc.FILE_EXTENSIONS.includes(ending)) {
        continue;                     // "continue" = skip to the next match, like Python
      }
      const partOfOther = found.some(function (f) {
        return (f.type === "url" || f.type === "email") &&
               f.value.toLowerCase().includes(domain.toLowerCase());
      });
      if (!partOfOther) {
        found.push({ type: "domain", value: domain });
      }
    }

    for (const f of found) {
      // .slice(0, 300): keep the line short for the hover tooltip.
      results.push({ type: f.type, value: f.value, timeUtc: timeUtc, line: line.trim().slice(0, 300) });
    }
  }
  return results;
};
