// time.js - time zone conversion helpers, shared by any tab.
//
// The rule: timestamps are SAVED in UTC, as text like
// "2026-09-19T22:41:07". They're only converted for display, or
// when you enter a time that's in another zone.
//
// The browser has a built-in time zone database (Intl), so this
// works offline. It's similar to Python's zoneinfo module.

App.time = {};

// Every time zone the browser knows, e.g. "Asia/Manila",
// "America/New_York". Python: zoneinfo.available_timezones()
App.time.allZones = function () {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch (err) {
    // Very old browsers: fall back to a short list.
    return ["America/New_York", "America/Chicago", "America/Denver",
            "America/Los_Angeles", "Europe/London", "Europe/Berlin",
            "Asia/Manila", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];
  }
};

// This computer's own time zone, e.g. "Asia/Manila".
App.time.localZone = function () {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

// <option> tags for a zone dropdown: UTC first, then "My local
// time", then every zone A-Z. "selected" is the value to pre-select.
App.time.zoneOptionsHtml = function (selected) {
  const e = App.escapeHtml;
  const local = App.time.localZone();
  const options = [
    { value: "UTC", label: "UTC" },
    { value: local, label: "My local time (" + local + ")" }
  ];
  for (const zone of App.time.allZones()) {
    if (zone !== "UTC" && zone !== local) {
      options.push({ value: zone, label: zone });
    }
  }
  return options
    .map(function (o) {
      const sel = o.value === selected ? " selected" : "";
      return `<option value="${e(o.value)}"${sel}>${e(o.label)}</option>`;
    })
    .join("");
};

// Make sure a "YYYY-MM-DDTHH:MM" time has seconds: add ":00".
// (Date/time inputs leave the seconds off when they're zero.)
App.time.withSeconds = function (text) {
  return text.length === 16 ? text + ":00" : text;
};

// The wall-clock parts (year, month, ...) of a moment in a zone.
// Intl.DateTimeFormat with a timeZone does the conversion; we then
// read the pieces back out. "en-CA" gives numbers, "h23" = 24-hour.
App.time.partsIn = function (date, zone) {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
  const parts = {};
  for (const p of format.formatToParts(date)) {
    parts[p.type] = p.value;       // e.g. parts["hour"] = "22"
  }
  return parts;
};

// How many minutes a zone is ahead of UTC at a given moment.
// Asia/Manila -> 480 (UTC+8). New York -> -240 or -300 (summer time).
App.time.offsetMinutes = function (date, zone) {
  const p = App.time.partsIn(date, zone);
  // Treat that zone's wall-clock time as if it were UTC, and compare.
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Math.round is Python's round(); ignore leftover milliseconds.
  return Math.round((wallAsUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
};

// 480 -> "UTC+08:00", -300 -> "UTC-05:00", 0 -> "UTC".
App.time.offsetLabel = function (minutes) {
  if (minutes === 0) {
    return "UTC";
  }
  const sign = minutes > 0 ? "+" : "-";
  const abs = Math.abs(minutes);                 // Python's abs()
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return "UTC" + sign + hh + ":" + mm;
};

// A JavaScript Date -> our saved UTC text, "2026-09-19T22:41:07".
App.time.toUtcText = function (date) {
  return date.toISOString().slice(0, 19);
};

// Saved UTC text -> a Date. The "Z" at the end means "this is UTC".
App.time.fromUtcText = function (utcText) {
  return new Date(App.time.withSeconds(utcText) + "Z");
};

// Show a saved UTC time in another zone.
// Returns { date: "2026-09-20", clock: "06:41:07", zoneLabel: "UTC+08:00" }
App.time.display = function (utcText, zone) {
  const date = App.time.fromUtcText(utcText);
  if (isNaN(date.getTime())) {                   // not a real time
    return { date: "", clock: utcText, zoneLabel: "" };
  }
  const p = App.time.partsIn(date, zone);
  return {
    date: p.year + "-" + p.month + "-" + p.day,
    clock: p.hour + ":" + p.minute + ":" + p.second,
    zoneLabel: App.time.offsetLabel(App.time.offsetMinutes(date, zone))
  };
};

// A wall-clock time in a zone -> saved UTC text.
// e.g. ("2026-09-19T18:41:07", "America/New_York") -> "2026-09-19T22:41:07"
// The zone's offset depends on the date (summer time), so we guess,
// check the offset at the guess, and correct once more if needed.
App.time.zoneToUtc = function (wallText, zone) {
  const guess = Date.parse(App.time.withSeconds(wallText) + "Z");
  if (isNaN(guess)) {
    return "";
  }
  const off1 = App.time.offsetMinutes(new Date(guess), zone);
  let utcMs = guess - off1 * 60000;
  const off2 = App.time.offsetMinutes(new Date(utcMs), zone);
  if (off2 !== off1) {
    utcMs = guess - off2 * 60000;
  }
  return App.time.toUtcText(new Date(utcMs));
};

// ---------------------------------------------------------------
// The ONE time zone setting (sidebar). Every time you type or see is
// in App.state.displayTimeZone; everything saved is UTC.
// ---------------------------------------------------------------

// Saved UTC text -> the same moment as wall-clock text in a zone, in
// the format date/time inputs use: "2026-09-20T06:41:07".
App.time.toZoneWall = function (utcText, zone) {
  if (!utcText) {
    return "";
  }
  const date = App.time.fromUtcText(utcText);
  if (isNaN(date.getTime())) {
    return "";
  }
  const p = App.time.partsIn(date, zone);
  return p.year + "-" + p.month + "-" + p.day + "T" + p.hour + ":" + p.minute + ":" + p.second;
};

// A time typed in the sidebar's zone -> saved UTC text.
App.time.fromDisplay = function (wallText) {
  return App.time.toUtc(wallText, App.state.displayTimeZone);
};

// Saved UTC text -> text for a date/time input, in the sidebar's zone.
App.time.toDisplay = function (utcText) {
  return App.time.toZoneWall(utcText, App.state.displayTimeZone);
};

// The sidebar zone as a short label, e.g. "UTC" or
// "Asia/Manila, UTC+08:00" (the offset as of right now).
App.time.zoneName = function () {
  const zone = App.state.displayTimeZone;
  if (zone === "UTC") {
    return "UTC";
  }
  return zone + ", " + App.time.offsetLabel(App.time.offsetMinutes(new Date(), zone));
};

// Fill every element marked data-zone-hint with "(Asia/Manila, UTC+08:00)",
// so form labels say which zone you're typing in. Forms call this when
// they open. querySelectorAll("[data-zone-hint]") finds them all.
App.time.fillZoneHints = function () {
  for (const el of document.querySelectorAll("[data-zone-hint]")) {
    el.textContent = "(" + App.time.zoneName() + ")";
  }
};

// What a form saves: the entered time converted from its zone to UTC.
// Empty stays empty. Used by the Evidence and Storyline forms.
App.time.toUtc = function (wallText, zone) {
  if (!wallText) {
    return "";
  }
  if (zone === "UTC") {
    return App.time.withSeconds(wallText);
  }
  return App.time.zoneToUtc(wallText, zone);
};

// The current moment as UTC text, e.g. "2026-09-27T07:03:12".
App.time.nowUtc = function () {
  return App.time.toUtcText(new Date());
};

// Text for a form's "Saved as ..." line.
App.time.previewText = function (utcText) {
  return utcText === "" ? "No time entered." : "Saved as " + utcText.replace("T", " ") + " UTC";
};

// Read a timestamp pasted from a log. Returns one of:
//   { utc: "2026-09-19T22:41:07", kind: "..." }   it included a zone, so
//                                                  we know the exact moment
//   { wall: "2026-09-19T22:41:07" }                no zone given
//   null                                           couldn't read it
App.time.parseAny = function (text) {
  const t = (text || "").trim();

  // Unix epoch in seconds (10 digits, maybe with decimals).
  if (/^\d{10}(\.\d+)?$/.test(t)) {
    return { utc: App.time.toUtcText(new Date(Number(t) * 1000)), kind: "Unix epoch (seconds)" };
  }
  // Unix epoch in milliseconds (13 digits).
  if (/^\d{13}$/.test(t)) {
    return { utc: App.time.toUtcText(new Date(Number(t))), kind: "Unix epoch (milliseconds)" };
  }
  // Windows FILETIME: 100-nanosecond steps since 1601-01-01 (18 digits).
  // The number is too big for normal JavaScript numbers, so we use
  // BigInt (the "n" suffix), which works like Python's unlimited ints.
  if (/^\d{18}$/.test(t)) {
    const ms = Number(BigInt(t) / 10000n) - 11644473600000;   // 1601 -> 1970
    return { utc: App.time.toUtcText(new Date(ms)), kind: "Windows FILETIME" };
  }

  // Date and time, maybe with fractions of a second and a zone:
  //   2026-09-19T22:41:07Z   2026-09-19 22:41:07.123 +08:00   ... UTC
  // The ( ) groups capture the pieces, like Python's re.match().groups().
  const m = t.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?\s*(Z|UTC|GMT|[+-]\d{2}:?\d{2})?$/i);
  if (m === null) {
    return null;
  }
  const wall = App.time.withSeconds(m[1] + "T" + m[2]);
  let zone = m[3];
  if (!zone) {
    return { wall: wall };                       // no zone: caller picks one
  }
  zone = zone.toUpperCase();
  if (zone === "Z" || zone === "UTC" || zone === "GMT") {
    return { utc: wall, kind: "UTC" };
  }
  // "+0800" -> "+08:00", so the browser can read it.
  if (!zone.includes(":")) {
    zone = zone.slice(0, 3) + ":" + zone.slice(3);
  }
  const date = new Date(wall + zone);
  if (isNaN(date.getTime())) {
    return null;
  }
  return { utc: App.time.toUtcText(date), kind: "offset " + zone };
};
