const STORAGE_KEY = "expoScrapperEntries";

const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const uploadPanel = document.getElementById("uploadPanel");
const previewWrap = document.getElementById("previewWrap");
const previewImg = document.getElementById("previewImg");
const rescanBtn = document.getElementById("rescanBtn");
const statusPanel = document.getElementById("statusPanel");
const progressFill = document.getElementById("progressFill");
const statusText = document.getElementById("statusText");
const resultsPanel = document.getElementById("resultsPanel");
const rawText = document.getElementById("rawText");
const saveEntryBtn = document.getElementById("saveEntryBtn");
const entriesBody = document.getElementById("entriesBody");
const entryCount = document.getElementById("entryCount");
const emptyHint = document.getElementById("emptyHint");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const clearAllBtn = document.getElementById("clearAllBtn");

const { parseCardText, FIELDS: fields } = window.CardParser;
const fieldInputs = Object.fromEntries(fields.map(f => [f, document.getElementById("f_" + f)]));

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});
rescanBtn.addEventListener("click", () => {
  fileInput.value = "";
  previewWrap.hidden = true;
  dropZone.hidden = false;
  resultsPanel.hidden = true;
  statusPanel.hidden = true;
});

function handleFile(file) {
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  dropZone.hidden = true;
  previewWrap.hidden = false;
  resultsPanel.hidden = true;
  runOcr(file);
}

async function runOcr(file) {
  statusPanel.hidden = false;
  progressFill.style.width = "0%";
  statusText.textContent = "Loading OCR engine…";

  try {
    const result = await Tesseract.recognize(file, "eng", {
      logger: m => {
        if (m.status && typeof m.progress === "number") {
          progressFill.style.width = Math.round(m.progress * 100) + "%";
          statusText.textContent = m.status.replace(/\b\w/g, c => c.toUpperCase()) + "…";
        }
      }
    });
    const text = result.data.text || "";
    rawText.textContent = text.trim() || "(no text detected)";
    const parsed = parseCardText(text);
    fields.forEach(f => { fieldInputs[f].value = parsed[f] || ""; });
    statusPanel.hidden = true;
    resultsPanel.hidden = false;
  } catch (err) {
    statusText.textContent = "OCR failed: " + err.message;
  }
}

saveEntryBtn.addEventListener("click", () => {
  const entry = Object.fromEntries(fields.map(f => [f, fieldInputs[f].value.trim()]));
  if (!Object.values(entry).some(Boolean)) return;
  const entries = loadEntries();
  entries.push(entry);
  saveEntries(entries);
  renderEntries();
});

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function renderEntries() {
  const entries = loadEntries();
  entryCount.textContent = entries.length;
  entriesBody.innerHTML = "";
  emptyHint.hidden = entries.length > 0;
  exportCsvBtn.disabled = exportJsonBtn.disabled = clearAllBtn.disabled = entries.length === 0;

  entries.forEach((entry, idx) => {
    const tr = document.createElement("tr");
    fields.forEach(f => {
      const td = document.createElement("td");
      td.textContent = entry[f] || "";
      td.title = entry[f] || "";
      tr.appendChild(td);
    });
    const delTd = document.createElement("td");
    delTd.textContent = "✕";
    delTd.className = "row-delete";
    delTd.title = "Remove entry";
    delTd.addEventListener("click", () => {
      const current = loadEntries();
      current.splice(idx, 1);
      saveEntries(current);
      renderEntries();
    });
    tr.appendChild(delTd);
    entriesBody.appendChild(tr);
  });
}

function toCsv(entries) {
  const header = ["Business Name", "Person Name", "Phone", "Email", "Website", "Location", "Nature of Business"];
  const rows = entries.map(e => fields.map(f => csvEscape(e[f] || "")));
  return [header.join(","), ...rows.map(r => r.join(","))].join("\n");
}

function csvEscape(value) {
  if (/[",\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

exportCsvBtn.addEventListener("click", () => {
  const entries = loadEntries();
  downloadFile("expo-scanned-cards.csv", toCsv(entries), "text/csv");
});

exportJsonBtn.addEventListener("click", () => {
  const entries = loadEntries();
  downloadFile("expo-scanned-cards.json", JSON.stringify(entries, null, 2), "application/json");
});

clearAllBtn.addEventListener("click", () => {
  if (confirm("Remove all saved entries? This cannot be undone.")) {
    saveEntries([]);
    renderEntries();
  }
});

renderEntries();
