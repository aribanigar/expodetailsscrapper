#!/usr/bin/env node
// CLI: OCR one or more business card photos and extract structured fields.
// Usage: expo-scan <photo-or-folder> [more...] [--json|--csv] [--out FILE] [--raw]

const fs = require("fs");
const path = require("path");
const { createWorker } = require("tesseract.js");
const { parseCardText, FIELDS } = require("../lib/parseCard");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"]);

function parseArgs(argv) {
  const opts = { inputs: [], format: "table", out: null, raw: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") opts.format = "json";
    else if (arg === "--csv") opts.format = "csv";
    else if (arg === "--raw") opts.raw = true;
    else if (arg === "--out") opts.out = argv[++i];
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else opts.inputs.push(arg);
  }
  return opts;
}

function printHelp() {
  console.log(`Expo Details Scrapper — CLI

Usage:
  expo-scan <photo.jpg> [more photos...]
  expo-scan <folder-of-photos> [--json|--csv] [--out results.csv] [--raw]

Options:
  --json         Print results as JSON instead of a table
  --csv          Print results as CSV instead of a table
  --out FILE     Write results to FILE (format inferred from extension, or --json/--csv)
  --raw          Also print the raw OCR text for each photo
  -h, --help     Show this help

Extracts: business name, person name, phone, email, website, location, nature of business.
No LLM — pure OCR (Tesseract) + regex/keyword heuristics.`);
}

function collectImageFiles(inputs) {
  const files = [];
  for (const input of inputs) {
    const stat = fs.statSync(input);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(input)) {
        const full = path.join(input, entry);
        if (fs.statSync(full).isFile() && IMAGE_EXT.has(path.extname(entry).toLowerCase())) {
          files.push(full);
        }
      }
    } else if (stat.isFile()) {
      files.push(input);
    }
  }
  return files;
}

function toCsv(rows) {
  const header = ["file", "business", "person", "phone", "email", "website", "location", "nature"];
  const escape = v => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(header.map(h => escape(String(row[h] || ""))).join(","));
  }
  return lines.join("\n");
}

function printTable(rows) {
  for (const row of rows) {
    console.log("\n" + row.file);
    console.log("-".repeat(row.file.length));
    for (const f of FIELDS) {
      console.log(`${f.padEnd(10)}: ${row[f] || ""}`);
    }
    if (row.raw) {
      console.log("\nraw OCR text:\n" + row.raw);
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help || opts.inputs.length === 0) {
    printHelp();
    process.exit(opts.help ? 0 : 1);
  }

  let files;
  try {
    files = collectImageFiles(opts.inputs);
  } catch (err) {
    console.error("Error reading input:", err.message);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error("No image files found in the given input(s).");
    process.exit(1);
  }

  const worker = await createWorker("eng");
  const results = [];

  try {
    for (const file of files) {
      process.stderr.write(`Scanning ${file}...\n`);
      const { data } = await worker.recognize(file);
      const text = data.text || "";
      const parsed = parseCardText(text);
      results.push({ file, ...parsed, raw: opts.raw ? text.trim() : undefined });
    }
  } finally {
    await worker.terminate();
  }

  let output;
  if (opts.format === "json" || (opts.out && opts.out.endsWith(".json"))) {
    output = JSON.stringify(results, null, 2);
  } else if (opts.format === "csv" || (opts.out && opts.out.endsWith(".csv"))) {
    output = toCsv(results);
  } else {
    printTable(results);
    output = null;
  }

  if (opts.out) {
    fs.writeFileSync(opts.out, output ?? toCsv(results));
    console.error(`\nWrote ${results.length} result(s) to ${opts.out}`);
  } else if (output) {
    console.log(output);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
