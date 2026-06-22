const STORAGE_KEY = "xiaomi-workout-tracker-v1";

const PARTS = [
  { id: "arms", label: "手臂", hint: "二头、三头", color: "#2f68c8", soft: "#edf3ff" },
  { id: "chest", label: "胸", hint: "卧推、夹胸", color: "#d85b4a", soft: "#fff0ed" },
  { id: "shoulders", label: "肩膀", hint: "推举、侧平举", color: "#7867c9", soft: "#f3efff" },
  { id: "legs", label: "腿", hint: "深蹲、硬拉", color: "#b7791f", soft: "#fff5df" },
  { id: "abs", label: "腹部", hint: "卷腹、核心", color: "#14855d", soft: "#e8f7ef" },
  { id: "back", label: "背", hint: "划船、引体", color: "#0f7a8a", soft: "#e7f8fb" },
];

const state = {
  records: loadRecords(),
  selectedDate: toDateKey(new Date()),
  selectedParts: new Set(),
  saveTimer: 0,
};

const elements = {
  todayLine: document.querySelector("#todayLine"),
  dateInput: document.querySelector("#dateInput"),
  prevDayButton: document.querySelector("#prevDayButton"),
  nextDayButton: document.querySelector("#nextDayButton"),
  trainedToggle: document.querySelector("#trainedToggle"),
  partGrid: document.querySelector("#partGrid"),
  noteInput: document.querySelector("#noteInput"),
  saveButton: document.querySelector("#saveButton"),
  clearButton: document.querySelector("#clearButton"),
  saveStatus: document.querySelector("#saveStatus"),
  streakCount: document.querySelector("#streakCount"),
  weekCount: document.querySelector("#weekCount"),
  monthCount: document.querySelector("#monthCount"),
  topPart: document.querySelector("#topPart"),
  calendarStrip: document.querySelector("#calendarStrip"),
  historyList: document.querySelector("#historyList"),
  exportButton: document.querySelector("#exportButton"),
};

init();

function init() {
  renderPartButtons();
  bindEvents();
  loadDate(state.selectedDate);
  registerServiceWorker();
}

function bindEvents() {
  elements.dateInput.addEventListener("change", () => {
    if (elements.dateInput.value) {
      loadDate(elements.dateInput.value);
    }
  });

  elements.prevDayButton.addEventListener("click", () => {
    loadDate(shiftDate(state.selectedDate, -1));
  });

  elements.nextDayButton.addEventListener("click", () => {
    loadDate(shiftDate(state.selectedDate, 1));
  });

  elements.trainedToggle.addEventListener("change", () => {
    saveCurrentRecord();
  });

  elements.noteInput.addEventListener("input", () => {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(() => saveCurrentRecord("已自动保存"), 320);
  });

  elements.saveButton.addEventListener("click", () => {
    saveCurrentRecord("已保存");
  });

  elements.clearButton.addEventListener("click", () => {
    clearCurrentRecord();
  });

  elements.exportButton.addEventListener("click", () => {
    exportRecords();
  });
}

function renderPartButtons() {
  elements.partGrid.innerHTML = "";

  PARTS.forEach((part) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "part-button";
    button.dataset.part = part.id;
    button.style.setProperty("--part-color", part.color);
    button.style.setProperty("--part-soft", part.soft);
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `
      <span class="check-mark" aria-hidden="true">
        <svg class="icon"><use href="#icon-check"></use></svg>
      </span>
      <strong>${part.label}</strong>
      <span>${part.hint}</span>
    `;
    button.addEventListener("click", () => togglePart(part.id));
    elements.partGrid.appendChild(button);
  });
}

function togglePart(partId) {
  if (state.selectedParts.has(partId)) {
    state.selectedParts.delete(partId);
  } else {
    state.selectedParts.add(partId);
    elements.trainedToggle.checked = true;
  }

  syncPartButtons();
  saveCurrentRecord();
}

function loadDate(dateKey) {
  state.selectedDate = dateKey;
  const record = getRecord(dateKey);

  elements.dateInput.value = dateKey;
  elements.trainedToggle.checked = record.trained;
  elements.noteInput.value = record.note || "";
  state.selectedParts = new Set(record.parts || []);

  elements.todayLine.textContent = getDateHeadline(dateKey);
  elements.saveStatus.textContent = record.updatedAt ? `上次保存：${formatTime(record.updatedAt)}` : "";

  syncPartButtons();
  renderStats();
  renderCalendar();
  renderHistory();
}

function syncPartButtons() {
  document.querySelectorAll(".part-button").forEach((button) => {
    const isSelected = state.selectedParts.has(button.dataset.part);
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

function saveCurrentRecord(message = "已保存到本机") {
  const note = elements.noteInput.value.trim();
  const parts = PARTS.map((part) => part.id).filter((partId) => state.selectedParts.has(partId));
  const trained = elements.trainedToggle.checked || parts.length > 0;

  elements.trainedToggle.checked = trained;

  const record = {
    date: state.selectedDate,
    trained,
    parts,
    note,
    updatedAt: new Date().toISOString(),
  };

  if (!trained && parts.length === 0 && note === "") {
    delete state.records[state.selectedDate];
  } else {
    state.records[state.selectedDate] = record;
  }

  persistRecords();
  elements.saveStatus.textContent = `${message} · ${formatTime(record.updatedAt)}`;
  renderStats();
  renderCalendar();
  renderHistory();
}

function clearCurrentRecord() {
  delete state.records[state.selectedDate];
  persistRecords();
  loadDate(state.selectedDate);
  elements.saveStatus.textContent = "当天记录已清空";
}

function renderStats() {
  const today = toDateKey(new Date());
  const currentMonth = today.slice(0, 7);
  let streak = 0;
  let dayCursor = today;

  while (getRecord(dayCursor).trained) {
    streak += 1;
    dayCursor = shiftDate(dayCursor, -1);
  }

  const lastSevenCount = rangeBack(today, 7).filter((dateKey) => getRecord(dateKey).trained).length;
  const monthCount = Object.values(state.records).filter(
    (record) => record.trained && record.date.startsWith(currentMonth),
  ).length;
  const topPart = getTopPart(rangeBack(today, 30));

  elements.streakCount.textContent = `${streak} 天`;
  elements.weekCount.textContent = `${lastSevenCount} 天`;
  elements.monthCount.textContent = `${monthCount} 天`;
  elements.topPart.textContent = topPart;
}

function getTopPart(dateKeys) {
  const counts = new Map(PARTS.map((part) => [part.id, 0]));

  dateKeys.forEach((dateKey) => {
    getRecord(dateKey).parts.forEach((partId) => {
      counts.set(partId, (counts.get(partId) || 0) + 1);
    });
  });

  const [partId, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!count) {
    return "暂无";
  }

  return PARTS.find((part) => part.id === partId)?.label || "暂无";
}

function renderCalendar() {
  const today = toDateKey(new Date());
  const days = rangeBack(today, 21).reverse();
  elements.calendarStrip.innerHTML = "";

  days.forEach((dateKey) => {
    const record = getRecord(dateKey);
    const button = document.createElement("button");
    const date = parseDateKey(dateKey);
    button.type = "button";
    button.className = "day-dot";
    button.classList.toggle("is-trained", record.trained);
    button.classList.toggle("is-current", dateKey === state.selectedDate);
    button.setAttribute("aria-label", `${formatMonthDay(dateKey)} ${record.trained ? "已训练" : "未训练"}`);
    button.innerHTML = `<strong>${date.getDate()}</strong><span>${weekdayLabel(date)}</span>`;
    button.addEventListener("click", () => loadDate(dateKey));
    elements.calendarStrip.appendChild(button);
  });
}

function renderHistory() {
  const today = toDateKey(new Date());
  const days = rangeBack(today, 14);
  elements.historyList.innerHTML = "";

  days.forEach((dateKey) => {
    const record = getRecord(dateKey);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    button.classList.toggle("is-active", dateKey === state.selectedDate);
    button.addEventListener("click", () => loadDate(dateKey));

    const summary = record.trained ? "已训练" : "未训练";
    const partChips = record.parts
      .map((partId) => PARTS.find((part) => part.id === partId)?.label)
      .filter(Boolean)
      .map((label) => `<span class="mini-chip">${label}</span>`)
      .join("");
    const noteText = record.note ? `<span class="mini-chip">${escapeHtml(record.note)}</span>` : "";

    button.innerHTML = `
      <span class="history-date">${formatHistoryDate(dateKey)}</span>
      <span class="history-summary">
        ${summary}
        <span class="history-parts">${partChips || noteText || '<span class="mini-chip">无部位</span>'}</span>
      </span>
    `;
    elements.historyList.appendChild(button);
  });
}

function exportRecords() {
  const payload = {
    app: "练了吗",
    exportedAt: new Date().toISOString(),
    records: Object.values(state.records).sort((a, b) => a.date.localeCompare(b.date)),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `workout-records-${toDateKey(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  elements.saveStatus.textContent = "已导出 JSON 备份";
}

function getRecord(dateKey) {
  return state.records[dateKey] || {
    date: dateKey,
    trained: false,
    parts: [],
    note: "",
    updatedAt: "",
  };
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function persistRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shiftDate(dateKey, offset) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
}

function rangeBack(startDateKey, count) {
  return Array.from({ length: count }, (_, index) => shiftDate(startDateKey, -index));
}

function getDateHeadline(dateKey) {
  const today = toDateKey(new Date());
  if (dateKey === today) {
    return "今天的训练记录";
  }
  if (dateKey === shiftDate(today, -1)) {
    return "昨天的训练记录";
  }
  if (dateKey === shiftDate(today, 1)) {
    return "明天的训练计划";
  }
  return `${formatMonthDay(dateKey)} 的记录`;
}

function formatMonthDay(dateKey) {
  const date = parseDateKey(dateKey);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatHistoryDate(dateKey) {
  const today = toDateKey(new Date());
  if (dateKey === today) {
    return "今天";
  }
  if (dateKey === shiftDate(today, -1)) {
    return "昨天";
  }
  return formatMonthDay(dateKey);
}

function weekdayLabel(date) {
  return ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
}

function formatTime(isoString) {
  if (!isoString) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return replacements[char];
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") {
    return;
  }

  navigator.serviceWorker.register("./sw.js").catch(() => {
    elements.saveStatus.textContent = "离线缓存暂不可用，记录仍会保存到本机";
  });
}
