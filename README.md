# Expo Details Scrapper

Upload a photo of a business card (or take one on your phone) and this tool extracts:

- Business name
- Person name
- Phone number
- Email address
- Website
- Location
- Nature of business

It runs entirely in the browser — OCR is done client-side with [Tesseract.js](https://github.com/naptha/tesseract.js), no server or API key required. Extracted fields are editable before saving, since OCR isn't perfect. Saved entries persist in the browser (`localStorage`) so you can scan multiple cards at an expo and export them all at once as CSV or JSON.

## Usage

Just open `index.html` in a browser (or serve the folder with any static file server), e.g.:

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

1. Upload or drag in a business card photo.
2. Wait for OCR to run — extracted fields appear in an editable form.
3. Correct any fields OCR got wrong.
4. Click **Add to list** to save the entry.
5. Repeat for more cards, then use **Export CSV** / **Export JSON** to download everything.

## How extraction works

The OCR text is split into lines and parsed with heuristics:

- **Email** — regex match for `user@domain.tld`.
- **Phone** — regex match for digit sequences with common separators.
- **Website** — regex match for domain-like strings (excluding the email match).
- **Location** — lines containing address keywords (street, suite, city, zip, etc.).
- **Business name** — a line containing a company suffix (Inc, LLC, Ltd, Co, Group, etc.), falling back to an all-caps line.
- **Person name** — a line matching a "First Last" name pattern that isn't the business or address line.
- **Nature of business** — the first remaining short line (often a tagline under the company name).

These are best-effort guesses — always review the extracted fields before saving.
