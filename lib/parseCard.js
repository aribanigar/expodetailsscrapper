// Pure text-parsing heuristics shared by the browser app and the CLI tool.
// No LLM calls — just regex/keyword rules applied to raw OCR text.

const FIELDS = ["business", "person", "phone", "email", "website", "location", "nature"];

function parseCardText(rawTextInput) {
  const lines = rawTextInput
    .split("\n")
    .map(l => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const fullText = lines.join(" ");

  const emailMatch = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : "";

  const phoneMatch = fullText.match(/(\+?\d[\d\s().-]{7,}\d)/);
  const phone = phoneMatch ? phoneMatch[0].trim() : "";

  const websiteMatch = fullText.match(/\b((https?:\/\/)?(www\.)?[a-zA-Z0-9-]+\.(com|net|org|io|co|biz|in|us|uk|info)(\.[a-z]{2})?(\/\S*)?)\b/i);
  let website = "";
  if (websiteMatch && !websiteMatch[0].includes("@")) {
    website = websiteMatch[0];
  }

  const usedLines = new Set();
  lines.forEach((l, i) => {
    if ((email && l.includes(email)) || (website && l.includes(website)) || (phone && l.includes(phone))) {
      usedLines.add(i);
    }
  });

  const addressKeywords = /\b(street|st\.|road|rd\.|avenue|ave\.|blvd|boulevard|suite|floor|fl\.|building|block|sector|lane|drive|dr\.|city|state|zip|pin|india|usa|uk|dubai|square|plaza|nagar|colony|highway)\b/i;
  const zipMatch = /\b\d{5,6}\b/;
  let location = "";
  lines.forEach((l, i) => {
    if (usedLines.has(i)) return;
    if (addressKeywords.test(l) || zipMatch.test(l) || /,\s*[A-Za-z]+/.test(l)) {
      location = location ? location + ", " + l : l;
      usedLines.add(i);
    }
  });

  const businessSuffix = /\b(inc|llc|ltd|limited|corp|corporation|co\.?|company|group|enterprises|industries|solutions|technologies|tech|studio|studios|agency|consulting|systems)\b/i;
  let business = "";
  let businessIdx = -1;
  lines.forEach((l, i) => {
    if (usedLines.has(i) || business) return;
    if (businessSuffix.test(l)) {
      business = l;
      businessIdx = i;
    }
  });
  if (!business) {
    const upperCandidate = lines.find((l, i) => !usedLines.has(i) && l.length > 2 && l === l.toUpperCase() && /[A-Z]/.test(l));
    if (upperCandidate) {
      business = upperCandidate;
      businessIdx = lines.indexOf(upperCandidate);
    }
  }
  if (businessIdx >= 0) usedLines.add(businessIdx);

  const namePattern = /^[A-Z][a-zA-Z'.-]+(\s[A-Z][a-zA-Z'.-]+){1,2}$/;
  let person = "";
  let personIdx = -1;
  lines.forEach((l, i) => {
    if (usedLines.has(i) || person) return;
    if (namePattern.test(l) && !businessSuffix.test(l) && !addressKeywords.test(l)) {
      person = l;
      personIdx = i;
    }
  });
  if (personIdx >= 0) usedLines.add(personIdx);

  let nature = "";
  lines.forEach((l, i) => {
    if (usedLines.has(i) || nature) return;
    if (l.length > 4 && l.length < 60 && !/\d{4,}/.test(l)) {
      nature = l;
      usedLines.add(i);
    }
  });

  return { business, person, phone, email, website, location, nature };
}

// Export for Node (CLI) and attach to window for the browser app.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseCardText, FIELDS };
}
if (typeof window !== "undefined") {
  window.CardParser = { parseCardText, FIELDS };
}
