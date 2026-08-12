# Expo Details Scrapper

Extracts from a photo of a business card:

- Business name
- Person name
- Phone number
- Email address
- Website
- Location
- Nature of business

OCR is done with [Tesseract.js](https://github.com/naptha/tesseract.js); fields are then pulled out with regex/keyword heuristics — **no LLM, no API key, no server dependency**. Ships two ways to use it:

- **CLI tool** — batch-scan a folder of card photos from the terminal.
- **Browser app** — drag in one photo at a time, review/correct fields, build a list, export CSV/JSON.

Both share the same extraction logic (`lib/parseCard.js`).

## CLI

```bash
npm install
node bin/scan.js path/to/card.jpg
```

Scan a whole folder at once:

```bash
node bin/scan.js path/to/photos/ --csv --out results.csv
```

Options:

| Flag | Effect |
|---|---|
| `--json` | Print results as JSON |
| `--csv` | Print results as CSV |
| `--out FILE` | Write results to a file instead of stdout (format inferred from `.json`/`.csv`, or from `--json`/`--csv`) |
| `--raw` | Also include the raw OCR text for each photo |
| `-h`, `--help` | Show usage |

You can also install it as a global command:

```bash
npm link
expo-scan photos/ --json
```

## Browser app

No build step — just open `index.html` (or serve the folder):

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. Upload/drag a card photo, correct any OCR mistakes in the form, click **Add to list**, repeat for more cards, then **Export CSV** / **Export JSON**. Entries persist in the browser (`localStorage`) between scans.

## How extraction works

The OCR text is split into lines and parsed with heuristics (`lib/parseCard.js`):

- **Email** — regex match for `user@domain.tld`.
- **Phone** — regex match for digit sequences with common separators.
- **Website** — regex match for domain-like strings (excluding the email match).
- **Location** — lines containing address keywords (street, suite, city, zip, etc.) or a ZIP-like number.
- **Business name** — a line containing a company suffix (Inc, LLC, Ltd, Co, Group, etc.), falling back to an all-caps line.
- **Person name** — a line matching a "First Last" name pattern that isn't the business or address line.
- **Nature of business** — the first remaining short line (often a tagline under the company name).

These are best-effort guesses — always review extracted fields before relying on them.
