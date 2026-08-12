const STORAGE_KEY = "expoScrapperEntries";
const { parseCardText, FIELDS: fields } = window.CardParser;

const fileInput = document.getElementById("fileInput");
const folderInput = document.getElementById("folderInput");
const folderBtn = document.getElementById("folderBtn");
const dropZone = document.getElementById("dropZone");
const statusPanel = document.getElementById("statusPanel");
const progressFill = document.getElementById("progressFill");
const statusText = document.getElementById("statusText");

const resultsPanel = document.getElementById("resultsPanel");
const reviewBody = document.getElementById("reviewBody");
const reviewCount = document.getElementById("reviewCount");
const saveAllBtn = document.getElementById("saveAllBtn");
const discardReviewBtn = document.getElementById("discardReviewBtn");

const entriesBody = document.getElementById("entriesBody");
const entryCount = document.getElementById("entryCount");
const emptyHint = document.getElementById("emptyHint");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const clearAllBtn = document.getElementById("clearAllBtn");

let reviewItems = []; // { id, file, thumbUrl, status, values: {business, person, ...} }
let nextId = 1;

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", async e => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const files = await filesFromDataTransfer(e.dataTransfer);
  if (files.length) handleFiles(files);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files.length) handleFiles([...fileInput.files].filter(f => f.type.startsWith("image/")));
  fileInput.value = "";
});
folderBtn.addEventListener("click", e => {
  e.stopPropagation();
  folderInput.click();
});
folderInput.addEventListener("change", () => {
  if (folderInput.files.length) handleFiles([...folderInput.files].filter(f => f.type.startsWith("image/")));
  folderInput.value = "";
});

// Drag-and-drop of a folder only yields its files via the async Directory
// Entries API — a plain e.dataTransfer.files read would silently drop them.
async function filesFromDataTransfer(dataTransfer) {
  const items = dataTransfer.items;
  if (!items || !items.length || typeof items[0].webkitGetAsEntry !== "function") {
    return [...dataTransfer.files].filter(f => f.type.startsWith("image/"));
  }
  const entries = [...items].map(item => item.webkitGetAsEntry()).filter(Boolean);
  const files = [];
  await Promise.all(entries.map(entry => collectEntryFiles(entry, files)));
  return files.filter(f => f.type.startsWith("image/"));
}

function collectEntryFiles(entry, files) {
  return new Promise(resolve => {
    if (entry.isFile) {
      entry.file(file => { files.push(file); resolve(); }, resolve);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const readAll = () => {
        reader.readEntries(async batch => {
          if (!batch.length) return resolve();
          await Promise.all(batch.map(e => collectEntryFiles(e, files)));
          readAll(); // readEntries may not return all entries in one call
        }, resolve);
      };
      readAll();
    } else {
      resolve();
    }
  });
}

function handleFiles(files) {
  const items = files.map(file => ({
    id: nextId++,
    file,
    thumbUrl: URL.createObjectURL(file),
    status: "pending",
    values: Object.fromEntries(fields.map(f => [f, ""]))
  }));
  reviewItems = reviewItems.concat(items);
  resultsPanel.hidden = false;
  renderReviewTable();
  runQueue(items);
}

async function runQueue(items) {
  statusPanel.hidden = false;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    item.status = "scanning";
    renderReviewTable();
    statusText.textContent = `Scanning photo ${i + 1} of ${items.length}: ${item.file.name}`;
    progressFill.style.width = Math.round((i / items.length) * 100) + "%";
    try {
      const result = await Tesseract.recognize(item.file, "eng", {
        logger: m => {
          if (m.status && typeof m.progress === "number") {
            const overall = (i + m.progress) / items.length;
            progressFill.style.width = Math.round(overall * 100) + "%";
          }
        }
      });
      const text = result.data.text || "";
      item.values = parseCardText(text);
      item.rawText = text.trim();
      item.status = "done";
    } catch (err) {
      item.status = "error";
      item.error = err.message;
    }
    renderReviewTable();
  }
  progressFill.style.width = "100%";
  statusText.textContent = `Done — scanned ${items.length} photo(s).`;
  setTimeout(() => { statusPanel.hidden = true; }, 1200);
}

function renderReviewTable() {
  reviewCount.textContent = reviewItems.length;
  reviewBody.innerHTML = "";

  reviewItems.forEach(item => {
    const tr = document.createElement("tr");

    const thumbTd = document.createElement("td");
    thumbTd.className = "thumb-cell";
    const img = document.createElement("img");
    img.src = item.thumbUrl;
    img.alt = item.file.name;
    img.className = "thumb";
    thumbTd.appendChild(img);
    if (item.status === "scanning") {
      const spinner = document.createElement("div");
      spinner.className = "mini-status";
      spinner.textContent = "Scanning…";
      thumbTd.appendChild(spinner);
    } else if (item.status === "error") {
      const err = document.createElement("div");
      err.className = "mini-status error";
      err.textContent = "Failed";
      thumbTd.appendChild(err);
    }
    tr.appendChild(thumbTd);

    fields.forEach(f => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "text";
      input.value = item.values[f] || "";
      input.disabled = item.status === "scanning";
      input.addEventListener("input", () => { item.values[f] = input.value; });
      td.appendChild(input);
      tr.appendChild(td);
    });

    const delTd = document.createElement("td");
    delTd.textContent = "✕";
    delTd.className = "row-delete";
    delTd.title = "Remove from review";
    delTd.addEventListener("click", () => {
      reviewItems = reviewItems.filter(i => i.id !== item.id);
      if (reviewItems.length === 0) resultsPanel.hidden = true;
      renderReviewTable();
    });
    tr.appendChild(delTd);

    reviewBody.appendChild(tr);
  });
}

saveAllBtn.addEventListener("click", () => {
  const entries = loadEntries();
  reviewItems.forEach(item => {
    if (item.status === "error") return;
    if (Object.values(item.values).some(Boolean)) entries.push({ ...item.values });
  });
  saveEntries(entries);
  reviewItems = [];
  resultsPanel.hidden = true;
  renderReviewTable();
  renderEntries();
});

discardReviewBtn.addEventListener("click", () => {
  reviewItems = [];
  resultsPanel.hidden = true;
  renderReviewTable();
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
