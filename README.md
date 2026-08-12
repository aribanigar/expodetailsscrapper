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

- **Browser app** — a webapp face on it: upload a single photo or a whole batch, everything scans automatically, review/correct fields inline, build a list, export CSV/JSON. Deployable to GitHub Pages so it's reachable from any device, no install.
- **CLI tool** — batch-scan a folder of card photos from the terminal.

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

No build step, no server-side code — pure static HTML/JS.

**Use it locally:**

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

**Use it from anywhere (hosted URL):** two deploy options are set up, pick either (or both):

- **Vercel** (recommended — fastest to set up, custom domains, instant redeploys on push):
  1. Go to [vercel.com/new](https://vercel.com/new) and import this GitHub repo (`aribanigar/expodetailsscrapper`).
  2. Vercel reads `vercel.json` and deploys it as a static site — no build step, no config needed. Click **Deploy**.
  3. You get a `https://<project-name>.vercel.app` URL immediately, and every push to `main` auto-redeploys.
  
  Or via CLI: `npx vercel --prod` from the repo root.

- **GitHub Pages**: a GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) deploys this repo on every push to `main`. To turn it on: repo **Settings → Pages → Source: GitHub Actions**, then push/merge to `main`. It'll be live at `https://<your-username>.github.io/<repo-name>/`.

Either way, bookmark the resulting URL on your phone or laptop and use it at the expo booth.

**Workflow:**

1. Click the upload area (or drag files in) — select **one photo or many at once**.
2. Each photo is OCR'd automatically; a review table fills in as each finishes, with a thumbnail per row.
3. Correct any field OCR got wrong directly in the table.
4. Click **Save all to list** to add every reviewed row to your running list (or **Discard** to drop the batch).
5. Repeat for more photos, then **Export CSV** / **Export JSON** to download everything. Saved entries persist in the browser (`localStorage`) between visits.

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
