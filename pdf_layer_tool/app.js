import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs";

const state = {
  pdfDoc: null,
  pageNum: 1,
  scale: 1,
  renderTask: null,
  layerConfig: null,
  layerEntries: [],
  filteredLayerIds: null,
  selectedLayerIds: new Set(),
  lastSelectedIndex: -1,
  focusedLayerIndex: -1,
  layerColorById: new Map(),
  isAnalyzingColors: false,
  isExporting: false,
  drag: {
    active: false,
    x: 0,
    y: 0,
    left: 0,
    top: 0,
  },
};

const els = {
  pdfInput: document.getElementById("pdfInput"),
  fileName: document.getElementById("fileName"),
  status: document.getElementById("status"),
  emptyState: document.getElementById("emptyState"),
  viewerContainer: document.getElementById("viewerContainer"),
  canvas: document.getElementById("pdfCanvas"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
  pageInfo: document.getElementById("pageInfo"),
  zoomIn: document.getElementById("zoomIn"),
  zoomOut: document.getElementById("zoomOut"),
  zoomRange: document.getElementById("zoomRange"),
  zoomInfo: document.getElementById("zoomInfo"),
  fitPage: document.getElementById("fitPage"),
  actualSize: document.getElementById("actualSize"),
  layerFilter: document.getElementById("layerFilter"),
  layerCount: document.getElementById("layerCount"),
  layerList: document.getElementById("layerList"),
  showAllLayers: document.getElementById("showAllLayers"),
  hideAllLayers: document.getElementById("hideAllLayers"),
  toggleFiltered: document.getElementById("toggleFiltered"),
  showSelectedLayers: document.getElementById("showSelectedLayers"),
  hideSelectedLayers: document.getElementById("hideSelectedLayers"),
  estimateColors: document.getElementById("estimateColors"),
  viewMenuBtn: document.getElementById("viewMenuBtn"),
  viewMenu: document.getElementById("viewMenu"),
  exportSize: document.getElementById("exportSize"),
  exportScope: document.getElementById("exportScope"),
  exportPdf: document.getElementById("exportPdf"),
};

const ctx = els.canvas.getContext("2d", { alpha: false });
let jsPdfCtorPromise = null;

const rerenderDebounced = debounce(() => {
  renderPage(state.pageNum);
}, 90);

attachEvents();

function attachEvents() {
  els.pdfInput.addEventListener("change", onFilePicked);

  els.prevPage.addEventListener("click", () => {
    if (state.pageNum <= 1) {
      return;
    }
    state.pageNum -= 1;
    renderPage(state.pageNum);
  });

  els.nextPage.addEventListener("click", () => {
    if (!state.pdfDoc || state.pageNum >= state.pdfDoc.numPages) {
      return;
    }
    state.pageNum += 1;
    renderPage(state.pageNum);
  });

  els.zoomIn.addEventListener("click", () => updateZoom(state.scale * 1.15));
  els.zoomOut.addEventListener("click", () => updateZoom(state.scale / 1.15));

  els.zoomRange.addEventListener("input", (event) => {
    const value = Number(event.target.value) / 100;
    updateZoom(value, true);
  });

  els.fitPage.addEventListener("click", fitPageToViewport);
  els.actualSize.addEventListener("click", () => updateZoom(1));

  els.layerFilter.addEventListener("input", applyLayerFilter);

  els.showAllLayers.addEventListener("click", () => {
    batchSetLayerVisibility(true, getFilteredLayerIds());
  });

  els.hideAllLayers.addEventListener("click", () => {
    batchSetLayerVisibility(false, getFilteredLayerIds());
  });

  els.toggleFiltered.addEventListener("click", () => {
    const ids = getFilteredLayerIds();
    if (!ids.length) {
      return;
    }

    const hiddenCount = ids.filter((id) => !getLayerVisible(id)).length;
    const nextVisible = hiddenCount >= ids.length / 2;
    batchSetLayerVisibility(nextVisible, ids);
  });

  els.showSelectedLayers.addEventListener("click", () => {
    batchSetLayerVisibility(true, [...state.selectedLayerIds]);
  });

  els.hideSelectedLayers.addEventListener("click", () => {
    batchSetLayerVisibility(false, [...state.selectedLayerIds]);
  });

  els.estimateColors.addEventListener("click", estimateLayerColors);
  els.exportPdf.addEventListener("click", exportVisiblePdf);
  els.viewMenuBtn.addEventListener("click", toggleViewMenu);

  document.addEventListener("click", (event) => {
    if (!els.viewMenuBtn || !els.viewMenu) {
      return;
    }

    if (els.viewMenu.hidden) {
      return;
    }

    if (!els.viewMenu.contains(event.target) && !els.viewMenuBtn.contains(event.target)) {
      setViewMenuOpen(false);
    }
  });

  bindPanHandlers(els.viewerContainer);

  window.addEventListener("keydown", (event) => {
    if (!state.pdfDoc) {
      return;
    }

    if (event.key === "Escape") {
      setViewMenuOpen(false);
    }

    if (isTypingTarget(event.target)) {
      return;
    }

    if (handleLayerKeyboard(event)) {
      return;
    }

    if (event.key === "ArrowRight") {
      els.nextPage.click();
    } else if (event.key === "ArrowLeft") {
      els.prevPage.click();
    } else if (event.key === "+" || event.key === "=") {
      updateZoom(state.scale * 1.15);
    } else if (event.key === "-") {
      updateZoom(state.scale / 1.15);
    }
  });
}

async function onFilePicked(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  els.fileName.textContent = file.name;
  setStatus(`Reading file (${formatBytes(file.size)})...`);
  await microPause();

  try {
    const arrayBuffer = await file.arrayBuffer();
    setStatus("Parsing PDF...");
    await loadPdf(arrayBuffer);
    setStatus("PDF loaded.");
  } catch (error) {
    console.error(error);
    setStatus(`Could not load PDF: ${error.message}`);
  }
}

async function loadPdf(data) {
  cancelRendering();

  const loadingTask = pdfjsLib.getDocument({ data });
  loadingTask.onProgress = (progress) => {
    if (!progress || !progress.total) {
      return;
    }

    const pct = Math.round((progress.loaded / progress.total) * 100);
    setStatus(`Parsing PDF... ${pct}%`);
  };

  state.pdfDoc = await loadingTask.promise;
  state.pageNum = 1;

  state.layerConfig = await state.pdfDoc.getOptionalContentConfig();
  state.layerEntries = readLayerEntries(state.layerConfig);
  state.filteredLayerIds = new Set(state.layerEntries.map((entry) => entry.id));
  state.selectedLayerIds.clear();
  state.lastSelectedIndex = -1;
  state.focusedLayerIndex = state.layerEntries.length ? 0 : -1;
  state.layerColorById.clear();

  enableControls(true);
  refreshLayerList();

  if (!state.layerEntries.length) {
    setStatus("Loaded. This PDF reports no optional-content layers.");
  }

  await fitPageToViewport();
  els.viewerContainer.classList.add("loaded");
  els.emptyState.hidden = true;
}

function readLayerEntries(config) {
  const groups = config.getGroups();
  const entries = [];

  Object.keys(groups).forEach((id) => {
    const group = groups[id];
    entries.push({
      id,
      name: group.name || `Layer ${id}`,
      visible: Boolean(group.visible),
    });
  });

  // Keep labels stable for muscle memory when handling many layers.
  entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return entries;
}

function getFilteredLayerIds() {
  if (!state.filteredLayerIds) {
    return state.layerEntries.map((entry) => entry.id);
  }

  return [...state.filteredLayerIds];
}

function applyLayerFilter() {
  const raw = els.layerFilter.value || "";
  const query = normalizeForFilter(raw);

  if (!query) {
    state.filteredLayerIds = new Set(state.layerEntries.map((entry) => entry.id));
    refreshLayerList();
    return;
  }

  const ids = state.layerEntries
    .filter((entry) => normalizeForFilter(entry.name).includes(query))
    .map((entry) => entry.id);

  state.filteredLayerIds = new Set(ids);
  refreshLayerList();
}

function refreshLayerList() {
  const filtered = new Set(getFilteredLayerIds());
  const total = state.layerEntries.length;
  const shown = filtered.size;

  els.layerCount.textContent = `${shown}/${total}`;
  els.layerList.replaceChildren();

  if (!state.layerEntries.length) {
    const empty = document.createElement("p");
    empty.className = "muted small";
    empty.textContent = "No optional layers found in this PDF.";
    els.layerList.appendChild(empty);
    return;
  }

  if (shown === 0) {
    const empty = document.createElement("p");
    empty.className = "muted small";
    empty.textContent = "No layers match the current filter.";
    els.layerList.appendChild(empty);
    updateSelectedButtons();
    return;
  }

  state.layerEntries.forEach((entry, index) => {
    if (!filtered.has(entry.id)) {
      return;
    }

    const row = document.createElement("div");
    row.className = `layer-item ${getLayerVisible(entry.id) ? "" : "hidden"} ${state.selectedLayerIds.has(entry.id) ? "selected" : ""}`;
    if (index === state.focusedLayerIndex) {
      row.classList.add("focused");
    }
    row.dataset.layerId = entry.id;
    row.dataset.layerIndex = String(index);
    row.tabIndex = -1;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = getLayerVisible(entry.id);
    checkbox.addEventListener("change", (event) => {
      if (event.shiftKey) {
        event.preventDefault();
      } else {
        setLayerVisibility(entry.id, checkbox.checked);
        row.classList.toggle("hidden", !checkbox.checked);
        rerenderDebounced();
      }
    });

    const colorChip = document.createElement("span");
    colorChip.className = "layer-color";
    const color = state.layerColorById.get(entry.id);
    if (color) {
      colorChip.style.background = color;
      colorChip.title = `Estimated color: ${color}`;
    } else {
      colorChip.title = "Estimated color not yet computed";
    }

    const text = document.createElement("span");
    text.className = "layer-label";
    text.title = entry.name;
    text.textContent = entry.name;

    row.addEventListener("click", (event) => onLayerRowClick(event, entry.id, index));

    row.append(checkbox, colorChip, text);
    els.layerList.appendChild(row);
  });

  updateSelectedButtons();
  scrollFocusedLayerIntoView();
}

function onLayerRowClick(event, layerId, index) {
  if (event.target instanceof HTMLInputElement) {
    if (event.shiftKey) {
      toggleVisibilityOnSelectedRange(layerId, index, event.target.checked);
    }
    return;
  }

  if (event.shiftKey && state.lastSelectedIndex >= 0) {
    selectLayerRange(state.lastSelectedIndex, index);
  } else if (event.ctrlKey || event.metaKey) {
    toggleLayerSelection(layerId);
    state.lastSelectedIndex = index;
  } else {
    state.selectedLayerIds.clear();
    state.selectedLayerIds.add(layerId);
    state.lastSelectedIndex = index;
  }

  state.focusedLayerIndex = index;

  refreshLayerList();
}

function selectLayerRange(startIndex, endIndex) {
  const start = Math.min(startIndex, endIndex);
  const end = Math.max(startIndex, endIndex);

  for (let i = start; i <= end; i += 1) {
    state.selectedLayerIds.add(state.layerEntries[i].id);
  }
}

function toggleLayerSelection(layerId) {
  if (state.selectedLayerIds.has(layerId)) {
    state.selectedLayerIds.delete(layerId);
  } else {
    state.selectedLayerIds.add(layerId);
  }
}

function toggleVisibilityOnSelectedRange(layerId, index, checked) {
  if (state.lastSelectedIndex < 0) {
    state.lastSelectedIndex = index;
    setLayerVisibility(layerId, checked);
    refreshLayerList();
    rerenderDebounced();
    return;
  }

  const start = Math.min(state.lastSelectedIndex, index);
  const end = Math.max(state.lastSelectedIndex, index);
  const ids = [];

  for (let i = start; i <= end; i += 1) {
    const id = state.layerEntries[i].id;
    ids.push(id);
    state.selectedLayerIds.add(id);
  }

  batchSetLayerVisibility(checked, ids);
  state.lastSelectedIndex = index;
}

function setLayerVisibility(id, visible) {
  state.layerConfig.setVisibility(id, visible);
  const target = state.layerEntries.find((entry) => entry.id === id);
  if (target) {
    target.visible = visible;
  }
}

function getLayerVisible(id) {
  const target = state.layerEntries.find((entry) => entry.id === id);
  return target ? target.visible : false;
}

function batchSetLayerVisibility(visible, ids) {
  if (!ids.length) {
    return;
  }

  ids.forEach((id) => {
    setLayerVisibility(id, visible);
  });

  refreshLayerList();
  rerenderDebounced();
}

async function estimateLayerColors() {
  if (!state.pdfDoc || state.isAnalyzingColors || !state.layerEntries.length) {
    return;
  }

  state.isAnalyzingColors = true;
  els.estimateColors.disabled = true;
  setStatus("Estimating layer colors (current page)...");

  const snapshot = snapshotLayerVisibility();

  try {
    const page = await state.pdfDoc.getPage(state.pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const targetWidth = 260;
    const sampleScale = Math.max(0.12, targetWidth / baseViewport.width);
    const viewport = page.getViewport({ scale: sampleScale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const sampleCtx = canvas.getContext("2d", { willReadFrequently: true });

    if (!sampleCtx) {
      throw new Error("Unable to initialize offscreen canvas context");
    }

    const allIds = state.layerEntries.map((entry) => entry.id);

    for (let i = 0; i < allIds.length; i += 1) {
      const id = allIds[i];

      allIds.forEach((otherId) => state.layerConfig.setVisibility(otherId, false));
      state.layerConfig.setVisibility(id, true);

      sampleCtx.clearRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: sampleCtx,
        viewport,
        optionalContentConfigPromise: Promise.resolve(state.layerConfig),
      }).promise;

      const img = sampleCtx.getImageData(0, 0, canvas.width, canvas.height);
      const color = computeAverageColor(img.data);
      if (color) {
        state.layerColorById.set(id, color);
      }

      if (i % 8 === 0) {
        setStatus(`Estimating layer colors... ${i + 1}/${allIds.length}`);
        refreshLayerList();
        await microPause();
      }
    }

    restoreLayerVisibility(snapshot);
    refreshLayerList();
    rerenderDebounced();
    setStatus("Layer colors estimated for the current page.");
  } catch (error) {
    restoreLayerVisibility(snapshot);
    refreshLayerList();
    rerenderDebounced();
    setStatus(`Color estimation failed: ${error.message}`);
  } finally {
    state.isAnalyzingColors = false;
    els.estimateColors.disabled = false;
  }
}

function computeAverageColor(data) {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    const alpha = data[i + 3];

    if (alpha < 8) {
      continue;
    }

    // Skip near-white background pixels to bias toward drawn content.
    if (red > 245 && green > 245 && blue > 245) {
      continue;
    }

    r += red;
    g += green;
    b += blue;
    count += 1;
  }

  if (!count) {
    return null;
  }

  return rgbToHex(Math.round(r / count), Math.round(g / count), Math.round(b / count));
}

function rgbToHex(r, g, b) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toHex(value) {
  return value.toString(16).padStart(2, "0");
}

function snapshotLayerVisibility() {
  const visibility = new Map();
  state.layerEntries.forEach((entry) => {
    visibility.set(entry.id, getLayerVisible(entry.id));
  });
  return visibility;
}

function restoreLayerVisibility(snapshot) {
  state.layerEntries.forEach((entry) => {
    const visible = snapshot.get(entry.id);
    if (typeof visible === "boolean") {
      setLayerVisibility(entry.id, visible);
    }
  });
}

async function exportVisiblePdf() {
  if (!state.pdfDoc || state.isExporting) {
    return;
  }

  state.isExporting = true;
  els.exportPdf.disabled = true;

  try {
    const jsPDF = await getJsPdfCtor();
    const paper = parsePaperOption(els.exportSize.value);
    const scope = els.exportScope.value;
    const startPage = scope === "current" ? state.pageNum : 1;
    const endPage = scope === "current" ? state.pageNum : state.pdfDoc.numPages;
    const pdf = new jsPDF({
      orientation: paper.orientation,
      unit: "mm",
      format: [paper.widthMm, paper.heightMm],
      compress: true,
    });

    const exportDpi = 160;
    const pxPerMm = exportDpi / 25.4;
    const pagePixelWidth = Math.floor(paper.widthMm * pxPerMm);
    const pagePixelHeight = Math.floor(paper.heightMm * pxPerMm);

    let exportIndex = 0;

    for (let num = startPage; num <= endPage; num += 1) {
      const page = await state.pdfDoc.getPage(num);
      const base = page.getViewport({ scale: 1 });
      const renderScale = Math.min(pagePixelWidth / base.width, pagePixelHeight / base.height);
      const viewport = page.getViewport({ scale: renderScale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const renderCtx = canvas.getContext("2d", { alpha: false });

      if (!renderCtx) {
        throw new Error("Unable to create canvas context for export");
      }

      setStatus(`Exporting page ${num}/${endPage}...`);

      await page.render({
        canvasContext: renderCtx,
        viewport,
        optionalContentConfigPromise: Promise.resolve(state.layerConfig),
      }).promise;

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const drawWidthMm = viewport.width / pxPerMm;
      const drawHeightMm = viewport.height / pxPerMm;
      const offsetX = (paper.widthMm - drawWidthMm) / 2;
      const offsetY = (paper.heightMm - drawHeightMm) / 2;

      if (exportIndex > 0) {
        pdf.addPage([paper.widthMm, paper.heightMm], paper.orientation);
      }

      pdf.addImage(imgData, "JPEG", offsetX, offsetY, drawWidthMm, drawHeightMm, undefined, "FAST");
      exportIndex += 1;
      await microPause();
    }

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const suggestedName = `visible-layers-${stamp}.pdf`;
    await savePdfWithDialog(pdf, suggestedName);
    setStatus("Export complete.");
  } catch (error) {
    setStatus(`Export failed: ${error.message}`);
  } finally {
    state.isExporting = false;
    els.exportPdf.disabled = false;
  }
}

async function getJsPdfCtor() {
  if (!jsPdfCtorPromise) {
    jsPdfCtorPromise = (async () => {
      if (window.jspdf?.jsPDF) {
        return window.jspdf.jsPDF;
      }

      try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
      } catch {
        await loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
      }

      if (!window.jspdf?.jsPDF) {
        throw new Error("Could not load jsPDF module");
      }
      return window.jspdf.jsPDF;
    })();
  }

  return jsPdfCtorPromise;
}

function parsePaperOption(value) {
  switch (value) {
    case "a4-landscape":
      return { widthMm: 297, heightMm: 210, orientation: "landscape" };
    case "a3-portrait":
      return { widthMm: 297, heightMm: 420, orientation: "portrait" };
    case "a3-landscape":
      return { widthMm: 420, heightMm: 297, orientation: "landscape" };
    case "a4-portrait":
    default:
      return { widthMm: 210, heightMm: 297, orientation: "portrait" };
  }
}

function updateSelectedButtons() {
  const hasSelection = state.selectedLayerIds.size > 0;
  els.showSelectedLayers.disabled = !state.pdfDoc || !hasSelection;
  els.hideSelectedLayers.disabled = !state.pdfDoc || !hasSelection;
}

function toggleViewMenu() {
  setViewMenuOpen(els.viewMenu.hidden);
}

function setViewMenuOpen(open) {
  els.viewMenu.hidden = !open;
  els.viewMenuBtn.setAttribute("aria-expanded", String(open));
}

function handleLayerKeyboard(event) {
  if (!state.layerEntries.length) {
    return false;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveLayerFocus(1, event.shiftKey);
    return true;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveLayerFocus(-1, event.shiftKey);
    return true;
  }

  if (event.key === "h" || event.key === "H") {
    event.preventDefault();
    batchSetLayerVisibility(false, [...state.selectedLayerIds]);
    return true;
  }

  if (event.key === "s" || event.key === "S") {
    event.preventDefault();
    batchSetLayerVisibility(true, [...state.selectedLayerIds]);
    return true;
  }

  if (event.key === "a" || event.key === "A") {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      state.selectedLayerIds = new Set(getFilteredLayerIds());
      refreshLayerList();
      return true;
    }
  }

  if (event.key === "Escape") {
    state.selectedLayerIds.clear();
    refreshLayerList();
    return true;
  }

  return false;
}

function moveLayerFocus(step, extendSelection) {
  const maxIndex = state.layerEntries.length - 1;
  const previous = state.focusedLayerIndex < 0 ? 0 : state.focusedLayerIndex;
  const next = clamp(previous + step, 0, maxIndex);

  if (extendSelection && state.lastSelectedIndex >= 0) {
    state.selectedLayerIds.clear();
    selectLayerRange(state.lastSelectedIndex, next);
  } else {
    state.selectedLayerIds.clear();
    state.selectedLayerIds.add(state.layerEntries[next].id);
    state.lastSelectedIndex = next;
  }

  state.focusedLayerIndex = next;
  refreshLayerList();
}

function scrollFocusedLayerIntoView() {
  if (state.focusedLayerIndex < 0) {
    return;
  }

  const row = els.layerList.querySelector(`.layer-item[data-layer-index="${state.focusedLayerIndex}"]`);
  if (!row) {
    return;
  }

  row.scrollIntoView({ block: "nearest" });
}

function isTypingTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

async function savePdfWithDialog(pdf, suggestedName) {
  const blob = pdf.output("blob");

  if (typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: "PDF document",
            accept: { "application/pdf": [".pdf"] },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("Save cancelled");
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function renderPage(num) {
  if (!state.pdfDoc) {
    return;
  }

  cancelRendering();

  const page = await state.pdfDoc.getPage(num);
  const viewport = page.getViewport({ scale: state.scale });
  const outputScale = Math.min(window.devicePixelRatio || 1, 2);

  els.canvas.width = Math.floor(viewport.width * outputScale);
  els.canvas.height = Math.floor(viewport.height * outputScale);
  els.canvas.style.width = `${Math.floor(viewport.width)}px`;
  els.canvas.style.height = `${Math.floor(viewport.height)}px`;

  const transform = outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0];

  state.renderTask = page.render({
    canvasContext: ctx,
    viewport,
    transform,
    optionalContentConfigPromise: Promise.resolve(state.layerConfig),
  });

  try {
    await state.renderTask.promise;
  } catch (error) {
    if (error?.name !== "RenderingCancelledException") {
      throw error;
    }
  }

  updateUiStatus();
}

function cancelRendering() {
  if (state.renderTask) {
    state.renderTask.cancel();
    state.renderTask = null;
  }
}

async function fitPageToViewport() {
  if (!state.pdfDoc) {
    return;
  }

  const page = await state.pdfDoc.getPage(state.pageNum);
  const base = page.getViewport({ scale: 1 });
  const padding = 24;
  const usableWidth = Math.max(320, els.viewerContainer.clientWidth - padding);
  const nextScale = usableWidth / base.width;
  updateZoom(nextScale);
}

function updateZoom(nextScale, shouldRender = true) {
  if (!state.pdfDoc) {
    return;
  }

  const clamped = clamp(nextScale, 0.25, 5);
  state.scale = clamped;

  const pct = Math.round(clamped * 100);
  els.zoomRange.value = String(pct);
  els.zoomInfo.textContent = `${pct}%`;

  if (shouldRender) {
    renderPage(state.pageNum);
  }
}

function enableControls(enabled) {
  [
    els.prevPage,
    els.nextPage,
    els.zoomIn,
    els.zoomOut,
    els.zoomRange,
    els.fitPage,
    els.actualSize,
    els.layerFilter,
    els.showAllLayers,
    els.hideAllLayers,
    els.toggleFiltered,
    els.estimateColors,
    els.exportSize,
    els.exportScope,
    els.exportPdf,
  ].forEach((el) => {
    el.disabled = !enabled;
  });

  if (!enabled) {
    els.showSelectedLayers.disabled = true;
    els.hideSelectedLayers.disabled = true;
  } else {
    updateSelectedButtons();
  }
}

function updateUiStatus() {
  const totalPages = state.pdfDoc?.numPages || 0;
  els.pageInfo.textContent = `Page ${state.pageNum} / ${totalPages}`;

  els.prevPage.disabled = state.pageNum <= 1;
  els.nextPage.disabled = state.pageNum >= totalPages;
}

function setStatus(message) {
  els.status.textContent = message;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function debounce(fn, waitMs) {
  let timeoutId = null;

  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), waitMs);
  };
}

function microPause() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** power);
  return `${value.toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
}

function normalizeForFilter(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-lib-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
      } else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Could not load script: ${src}`)), { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.libSrc = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Could not load script: ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

function bindPanHandlers(container) {
  container.addEventListener("pointerdown", (event) => {
    if (!state.pdfDoc) {
      return;
    }

    state.drag.active = true;
    state.drag.x = event.clientX;
    state.drag.y = event.clientY;
    state.drag.left = container.scrollLeft;
    state.drag.top = container.scrollTop;
    container.style.cursor = "grabbing";
    container.setPointerCapture(event.pointerId);
  });

  container.addEventListener("pointermove", (event) => {
    if (!state.drag.active) {
      return;
    }

    const dx = event.clientX - state.drag.x;
    const dy = event.clientY - state.drag.y;
    container.scrollLeft = state.drag.left - dx;
    container.scrollTop = state.drag.top - dy;
  });

  const stopDrag = () => {
    state.drag.active = false;
    container.style.cursor = "grab";
  };

  container.addEventListener("pointerup", stopDrag);
  container.addEventListener("pointercancel", stopDrag);
  container.addEventListener("pointerleave", () => {
    if (state.drag.active) {
      container.style.cursor = "grabbing";
    }
  });

  container.style.cursor = "grab";
}
