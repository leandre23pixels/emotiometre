const storageKey = "emotiometre-state";
const configStorageKey = "emotiometre-config";
const configApiUrl = "./api/config";
const stateApiUrl = "./api/state";
const adminSessionKey = "emotiometre-admin-session";
const ADMIN_CODE = "LSO2012";
const remotePollMs = 15000;

const defaultConfig = {
  ui: {
    heroEyebrow: "Mon emotiometre",
    heroTitle: "Un petit tableau pour rassurer maman.",
    heroCopy:
      "Je choisis mon niveau du moment, et maman peut comprendre tout de suite comment m'aider sans s'inquieter plus que besoin.",
    statusPanelLabel: "Etat actuel",
    selectorPanelLabel: "Je choisis mon niveau",
    notePanelLabel: "Mon petit mot",
    noteFieldLabel: "Je peux ajouter une phrase pour maman",
    notePlaceholder: "Exemple : j'ai juste besoin d'un calin et de dix minutes au calme.",
    summaryPanelLabel: "Message pour maman",
    helperTitle: "Comment le lire",
    helperText:
      "Plus le niveau est bas, plus tout est sous controle. Si le niveau monte, cela veut surtout dire que j'ai besoin d'aide, de calme ou d'une presence rassurante."
  },
  quickNotes: [
    "J'ai besoin d'un calin.",
    "Laisse-moi respirer cinq minutes.",
    "Tu peux venir me parler doucement."
  ],
  levels: {
    1: {
      buttonName: "Tout va bien",
      buttonDesc: "Je vais bien et tu peux etre rassuree.",
      step: "Niveau 1",
      title: "Tout va bien.",
      message: "Je me sens calme et tu peux etre rassuree.",
      support: "Un sourire ou une presence douce, c'est deja parfait.",
      summary: "Maman, tout va bien pour moi en ce moment. Tu peux etre rassuree.",
      color: "#7ec8a7",
      strongColor: "#4ea886",
      softColor: "rgba(126, 200, 167, 0.25)",
      width: "20%"
    },
    2: {
      buttonName: "Un peu sensible",
      buttonDesc: "J'ai juste besoin de douceur.",
      step: "Niveau 2",
      title: "Je suis sensible, mais ca va.",
      message: "J'ai surtout besoin de douceur, d'un peu de calme ou d'un sourire.",
      support: "Tu peux me parler tranquillement, sans paniquer.",
      summary: "Maman, je suis un peu sensible, mais ca va. J'ai surtout besoin de douceur.",
      color: "#88c8c9",
      strongColor: "#4f9c9d",
      softColor: "rgba(136, 200, 201, 0.24)",
      width: "40%"
    },
    3: {
      buttonName: "Pause necessaire",
      buttonDesc: "J'ai besoin de souffler un peu.",
      step: "Niveau 3",
      title: "J'ai besoin d'une pause.",
      message: "Je suis un peu depassee, alors j'ai besoin de souffler et de me recentrer.",
      support: "Laisse-moi quelques minutes ou accompagne-moi calmement.",
      summary: "Maman, j'ai besoin d'une petite pause pour souffler, mais je peux retrouver mon calme.",
      color: "#f0b96d",
      strongColor: "#c78d42",
      softColor: "rgba(240, 185, 109, 0.24)",
      width: "60%"
    },
    4: {
      buttonName: "Besoin de parler",
      buttonDesc: "J'aimerais qu'on discute calmement.",
      step: "Niveau 4",
      title: "J'ai besoin de parler avec toi.",
      message: "Je ne suis pas bien et j'ai besoin d'etre ecoutee avec calme et tendresse.",
      support: "Viens me voir et parle-moi doucement, sans pression.",
      summary: "Maman, j'ai besoin de parler avec toi calmement maintenant.",
      color: "#ee8e6f",
      strongColor: "#c45f42",
      softColor: "rgba(238, 142, 111, 0.22)",
      width: "80%"
    },
    5: {
      buttonName: "Besoin d'aide",
      buttonDesc: "Viens me voir maintenant, s'il te plait.",
      step: "Niveau 5",
      title: "J'ai besoin d'aide tout de suite.",
      message: "Viens me voir maintenant, reste avec moi et aide-moi a me sentir en securite.",
      support: "Ce n'est pas le moment de me laisser seule. Reste pres de moi.",
      summary: "Maman, j'ai besoin de toi tout de suite. Viens me voir maintenant, s'il te plait.",
      color: "#db6c5b",
      strongColor: "#b54d3e",
      softColor: "rgba(219, 108, 91, 0.18)",
      width: "100%"
    }
  }
};

const syncStatus = document.getElementById("sync-status");
const heroEyebrow = document.getElementById("hero-eyebrow");
const heroTitle = document.getElementById("hero-title");
const heroCopy = document.getElementById("hero-copy");
const statusPanelLabel = document.getElementById("status-panel-label");
const selectorPanelLabel = document.getElementById("selector-panel-label");
const levelAccessNote = document.getElementById("level-access-note");
const summaryPanelLabel = document.getElementById("summary-panel-label");
const helperTitle = document.getElementById("helper-title");
const helperText = document.getElementById("helper-text");
const levelGrid = document.getElementById("level-grid");
const statusStep = document.getElementById("status-step");
const statusTitle = document.getElementById("status-title");
const statusMessage = document.getElementById("status-message");
const statusSupport = document.getElementById("status-support");
const meterFill = document.getElementById("meter-fill");
const summaryText = document.getElementById("summary-text");
const timestamp = document.getElementById("timestamp");
const copyButton = document.getElementById("copy-button");
const adminToggle = document.getElementById("admin-toggle");
const adminModal = document.getElementById("admin-modal");
const adminClose = document.getElementById("admin-close");
const adminCancel = document.getElementById("admin-cancel");
const adminLockView = document.getElementById("admin-lock-view");
const adminEditorView = document.getElementById("admin-editor-view");
const adminCodeInput = document.getElementById("admin-code");
const adminFeedback = document.getElementById("admin-feedback");
const adminLogin = document.getElementById("admin-login");
const adminLockButton = document.getElementById("admin-lock-button");
const adminForm = document.getElementById("admin-form");
const adminSave = document.getElementById("admin-save");
const adminReset = document.getElementById("admin-reset");
const adminSaveFeedback = document.getElementById("admin-save-feedback");

let appConfig = loadLocalConfig();
let currentLevel = 2;
let adminUnlocked = false;
let adminSessionCode = "";
let remoteSyncEnabled = false;

function setAdminSession(isUnlocked) {
  adminUnlocked = isUnlocked;

  if (isUnlocked) {
    adminSessionCode = ADMIN_CODE;
    sessionStorage.setItem(adminSessionKey, "1");
  } else {
    adminSessionCode = "";
    sessionStorage.removeItem(adminSessionKey);
  }

  updateAdminButton();
  updateLevelAccess();
}

function restoreAdminSession() {
  if (sessionStorage.getItem(adminSessionKey) === "1") {
    setAdminSession(true);
    return;
  }

  setAdminSession(false);
}

function updateAdminButton() {
  adminToggle.textContent = adminUnlocked ? "Admin connecte" : "Admin";
  adminToggle.setAttribute("aria-pressed", String(adminUnlocked));
}

function updateLevelAccess() {
  levelAccessNote.textContent = adminUnlocked
    ? "Mode admin : selection des niveaux active"
    : "Selection reservee a l'admin";
  levelAccessNote.classList.toggle("access-note-open", adminUnlocked);

  [...document.querySelectorAll(".level-button")].forEach((button) => {
    button.setAttribute("aria-disabled", String(!adminUnlocked));
    button.classList.toggle("is-locked", !adminUnlocked);
  });
}

function isEditingAdmin() {
  return adminUnlocked && !adminModal.hidden && !adminEditorView.hidden;
}

function cloneDefaultConfig() {
  return JSON.parse(JSON.stringify(defaultConfig));
}

function buildConfig(source) {
  const nextConfig = cloneDefaultConfig();

  if (!source || typeof source !== "object") {
    return nextConfig;
  }

  if (source.ui && typeof source.ui === "object") {
    Object.keys(nextConfig.ui).forEach((key) => {
      if (typeof source.ui[key] === "string") {
        nextConfig.ui[key] = source.ui[key];
      }
    });
  }

  if (Array.isArray(source.quickNotes)) {
    nextConfig.quickNotes = source.quickNotes
      .filter((note) => typeof note === "string")
      .slice(0, 3);
  }

  Object.keys(nextConfig.levels).forEach((level) => {
    const incomingLevel = source.levels && source.levels[level];

    if (!incomingLevel || typeof incomingLevel !== "object") {
      return;
    }

    Object.keys(nextConfig.levels[level]).forEach((key) => {
      if (typeof incomingLevel[key] === "string") {
        nextConfig.levels[level][key] = incomingLevel[key];
      }
    });
  });

  return nextConfig;
}

function loadLocalConfig() {
  try {
    const rawConfig = localStorage.getItem(configStorageKey);
    return rawConfig ? buildConfig(JSON.parse(rawConfig)) : cloneDefaultConfig();
  } catch (error) {
    return cloneDefaultConfig();
  }
}

function saveLocalConfig(config) {
  try {
    localStorage.setItem(configStorageKey, JSON.stringify(config));
  } catch (error) {
    return;
  }
}

function buildState(source) {
  const nextState = {
    level: 2,
    note: "",
    savedAt: "Pas encore enregistre"
  };

  if (!source || typeof source !== "object") {
    return nextState;
  }

  if (appConfig.levels[String(source.level)]) {
    nextState.level = Number(source.level);
  }

  if (typeof source.note === "string") {
    nextState.note = source.note;
  }

  if (typeof source.savedAt === "string" && source.savedAt.trim()) {
    nextState.savedAt = source.savedAt;
  }

  return nextState;
}

function loadLocalState() {
  try {
    const rawState = localStorage.getItem(storageKey);
    return rawState ? buildState(JSON.parse(rawState)) : buildState();
  } catch (error) {
    return buildState();
  }
}

function saveLocalState(state) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    return;
  }
}

function getCurrentStateSnapshot() {
  return buildState({
    level: currentLevel,
    note: "",
    savedAt: timestamp.textContent
  });
}

function setSyncStatus(message, mode = "local") {
  const isOnline = mode === "online";

  syncStatus.hidden = !isOnline;
  syncStatus.textContent = isOnline ? message : "";
  syncStatus.classList.toggle("sync-status-online", isOnline);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderStaticTexts() {
  heroEyebrow.textContent = appConfig.ui.heroEyebrow;
  heroTitle.textContent = appConfig.ui.heroTitle;
  heroCopy.textContent = appConfig.ui.heroCopy;
  statusPanelLabel.textContent = appConfig.ui.statusPanelLabel;
  selectorPanelLabel.textContent = appConfig.ui.selectorPanelLabel;
  summaryPanelLabel.textContent = appConfig.ui.summaryPanelLabel;
  helperTitle.textContent = appConfig.ui.helperTitle;
  helperText.textContent = appConfig.ui.helperText;
}

function renderLevelButtons() {
  levelGrid.innerHTML = Object.entries(appConfig.levels)
    .map(
      ([level, config]) => `
        <button class="level-button" data-level="${escapeHtml(level)}" type="button">
          <span class="level-number">${escapeHtml(level)}</span>
          <span class="level-name">${escapeHtml(config.buttonName)}</span>
          <span class="level-desc">${escapeHtml(config.buttonDesc)}</span>
        </button>
      `
    )
    .join("");

  updateLevelAccess();
}

function getCurrentSummary(level) {
  const config = appConfig.levels[String(level)] || appConfig.levels["2"];
  return config.summary;
}

function updateSummaryText() {
  summaryText.textContent = getCurrentSummary(currentLevel);
}

function renderLevel(level) {
  const selectedLevel = appConfig.levels[String(level)] ? Number(level) : 2;
  const config = appConfig.levels[String(selectedLevel)];

  currentLevel = selectedLevel;
  statusStep.textContent = config.step;
  statusTitle.textContent = config.title;
  statusMessage.textContent = config.message;
  statusSupport.textContent = config.support;
  updateSummaryText();
  meterFill.style.width = config.width;
  meterFill.style.background = `linear-gradient(90deg, rgba(255, 255, 255, 0.52), ${config.color})`;
  document.documentElement.style.setProperty("--accent", config.color);
  document.documentElement.style.setProperty("--accent-strong", config.strongColor);
  document.documentElement.style.setProperty("--accent-soft", config.softColor);

  [...document.querySelectorAll(".level-button")].forEach((button) => {
    const isActive = Number(button.dataset.level) === selectedLevel;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function applyConfig(nextConfig) {
  appConfig = buildConfig(nextConfig);
  saveLocalConfig(appConfig);
  renderStaticTexts();
  renderLevelButtons();
  renderLevel(currentLevel);

  if (adminUnlocked && !adminEditorView.hidden) {
    renderAdminForm();
  }
}

function applySharedState(nextState) {
  const safeState = buildState(nextState);

  currentLevel = safeState.level;
  timestamp.textContent = safeState.savedAt;
  saveLocalState(safeState);
  renderLevel(currentLevel);
}

function formatTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

async function saveState() {
  const savedAt = formatTimestamp();
  const state = buildState({
    level: currentLevel,
    note: "",
    savedAt
  });

  saveLocalState(state);
  timestamp.textContent = savedAt;
  updateSummaryText();

  try {
    await saveStateToServer(state);
    remoteSyncEnabled = true;
    setSyncStatus("Sauvegarde commune active", "online");
  } catch (error) {
    remoteSyncEnabled = false;
    setSyncStatus("", "local");
  }
}

function restoreState() {
  applySharedState(loadLocalState());
}

function fallbackCopy(text) {
  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "absolute";
  helper.style.left = "-9999px";
  document.body.appendChild(helper);
  helper.select();

  const hasCopied = document.execCommand("copy");
  document.body.removeChild(helper);

  if (!hasCopied) {
    throw new Error("copy failed");
  }
}

async function copySummary() {
  const text = getCurrentSummary(currentLevel);

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopy(text);
    }

    copyButton.textContent = "Message copie";
  } catch (error) {
    copyButton.textContent = "Copie impossible";
  }

  window.setTimeout(() => {
    copyButton.textContent = "Copier le message";
  }, 1800);
}

function createAdminField(label, value, metadata, options = {}) {
  const attributes = Object.entries(metadata)
    .map(([key, currentValue]) => {
      const attributeName = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      return `data-${attributeName}="${escapeHtml(currentValue)}"`;
    })
    .join(" ");

  const wrapperClass = options.full ? "admin-field admin-field-full" : "admin-field";

  if (options.multiline) {
    return `
      <div class="${wrapperClass}">
        <label>${escapeHtml(label)}</label>
        <textarea rows="${options.rows || 4}" ${attributes}>${escapeHtml(value)}</textarea>
      </div>
    `;
  }

  return `
    <div class="${wrapperClass}">
      <label>${escapeHtml(label)}</label>
      <input type="text" value="${escapeHtml(value)}" ${attributes}>
    </div>
  `;
}

function renderAdminForm() {
  adminForm.innerHTML = `
    <section class="admin-section">
      <h3>Textes generaux</h3>
      <p>Tu peux personnaliser les titres, explications et aides visibles sur la page.</p>
      <div class="admin-grid">
        ${createAdminField("Petit titre", appConfig.ui.heroEyebrow, { configType: "ui", configKey: "heroEyebrow" })}
        ${createAdminField("Titre principal", appConfig.ui.heroTitle, { configType: "ui", configKey: "heroTitle" }, { full: true })}
        ${createAdminField("Texte d'introduction", appConfig.ui.heroCopy, { configType: "ui", configKey: "heroCopy" }, { multiline: true, rows: 4, full: true })}
        ${createAdminField("Label Etat actuel", appConfig.ui.statusPanelLabel, { configType: "ui", configKey: "statusPanelLabel" })}
        ${createAdminField("Label Choix du niveau", appConfig.ui.selectorPanelLabel, { configType: "ui", configKey: "selectorPanelLabel" })}
        ${createAdminField("Label Message pour maman", appConfig.ui.summaryPanelLabel, { configType: "ui", configKey: "summaryPanelLabel" })}
        ${createAdminField("Titre du bloc d'aide", appConfig.ui.helperTitle, { configType: "ui", configKey: "helperTitle" })}
        ${createAdminField("Texte d'aide", appConfig.ui.helperText, { configType: "ui", configKey: "helperText" }, { multiline: true, rows: 4, full: true })}
      </div>
    </section>

    ${Object.entries(appConfig.levels)
      .map(
        ([level, config]) => `
          <section class="admin-section">
            <h3>Niveau ${escapeHtml(level)}</h3>
            <p>Tu peux changer le texte du bouton, le message affiche et la phrase pour maman.</p>
            <div class="admin-grid">
              ${createAdminField("Nom du bouton", config.buttonName, { configType: "level", level, configKey: "buttonName" })}
              ${createAdminField("Description du bouton", config.buttonDesc, { configType: "level", level, configKey: "buttonDesc" }, { multiline: true, rows: 3 })}
              ${createAdminField("Nom du niveau", config.step, { configType: "level", level, configKey: "step" })}
              ${createAdminField("Titre affiche", config.title, { configType: "level", level, configKey: "title" })}
              ${createAdminField("Message principal", config.message, { configType: "level", level, configKey: "message" }, { multiline: true, rows: 4, full: true })}
              ${createAdminField("Comment aider", config.support, { configType: "level", level, configKey: "support" }, { multiline: true, rows: 4, full: true })}
              ${createAdminField("Message pour maman", config.summary, { configType: "level", level, configKey: "summary" }, { multiline: true, rows: 4, full: true })}
            </div>
          </section>
        `
      )
      .join("")}
  `;
}

function openAdminModal() {
  adminModal.hidden = false;
  document.body.classList.add("admin-open");

  if (adminUnlocked) {
    adminLockView.hidden = true;
    adminEditorView.hidden = false;
    adminSaveFeedback.textContent = "";
    renderAdminForm();
    return;
  }

  adminLockView.hidden = false;
  adminEditorView.hidden = true;
  adminFeedback.textContent = "";
  adminCodeInput.value = "";
  adminCodeInput.focus();
}

function closeAdminModal() {
  adminModal.hidden = true;
  document.body.classList.remove("admin-open");
}

function unlockAdmin() {
  if (adminCodeInput.value.trim().toUpperCase() !== ADMIN_CODE) {
    adminFeedback.textContent = "Code incorrect.";
    return;
  }

  setAdminSession(true);
  adminLockView.hidden = true;
  adminEditorView.hidden = false;
  adminFeedback.textContent = "";
  adminSaveFeedback.textContent = "";
  renderAdminForm();
}

function lockAdmin() {
  setAdminSession(false);
  adminLockView.hidden = false;
  adminEditorView.hidden = true;
  adminFeedback.textContent = "";
  adminCodeInput.value = "";
  adminCodeInput.focus();
}

function buildAdminConfigFromForm() {
  const nextConfig = cloneDefaultConfig();
  const quickNotes = ["", "", ""];

  adminForm.querySelectorAll("input, textarea").forEach((field) => {
    const configType = field.dataset.configType;
    const rawValue = field.value.trim();

    if (configType === "ui") {
      const key = field.dataset.configKey;
      nextConfig.ui[key] = rawValue || defaultConfig.ui[key];
    }

    if (configType === "quick-note") {
      const noteIndex = Number(field.dataset.noteIndex);
      quickNotes[noteIndex] = rawValue;
    }

    if (configType === "level") {
      const level = field.dataset.level;
      const key = field.dataset.configKey;
      nextConfig.levels[level][key] = rawValue || defaultConfig.levels[level][key];
    }
  });

  nextConfig.quickNotes = quickNotes;
  return nextConfig;
}

async function fetchRemoteConfig() {
  const response = await fetch(configApiUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("remote unavailable");
  }

  return response.json();
}

async function fetchRemoteState() {
  const response = await fetch(stateApiUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("remote state unavailable");
  }

  return response.json();
}

async function syncConfigFromServer() {
  try {
    const payload = await fetchRemoteConfig();

    remoteSyncEnabled = true;
    setSyncStatus("Sauvegarde commune active", "online");

    if (!payload || !payload.config) {
      return true;
    }

    const nextConfig = buildConfig(payload.config);
    const hasChanged = JSON.stringify(nextConfig) !== JSON.stringify(appConfig);

    if (hasChanged) {
      applyConfig(nextConfig);
    }

    return true;
  } catch (error) {
    remoteSyncEnabled = false;
    setSyncStatus("", "local");
    return false;
  }
}

async function syncStateFromServer() {
  try {
    const payload = await fetchRemoteState();

    remoteSyncEnabled = true;
    setSyncStatus("Sauvegarde commune active", "online");

    if (!payload || !payload.state) {
      return true;
    }

    const nextState = buildState(payload.state);
    const hasChanged =
      JSON.stringify(nextState) !== JSON.stringify(getCurrentStateSnapshot());

    if (hasChanged) {
      applySharedState(nextState);
    }

    return true;
  } catch (error) {
    remoteSyncEnabled = false;
    setSyncStatus("", "local");
    return false;
  }
}

async function saveConfigToServer(nextConfig) {
  if (!adminUnlocked || !adminSessionCode) {
    throw new Error("admin required");
  }

  const response = await fetch(configApiUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-admin-code": adminSessionCode
    },
    body: JSON.stringify({ config: nextConfig })
  });

  if (!response.ok) {
    throw new Error("save failed");
  }
}

async function saveStateToServer(nextState) {
  const response = await fetch(stateApiUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ state: nextState })
  });

  if (!response.ok) {
    throw new Error("state save failed");
  }
}

async function deleteRemoteConfig() {
  if (!adminUnlocked || !adminSessionCode) {
    throw new Error("admin required");
  }

  const response = await fetch(configApiUrl, {
    method: "DELETE",
    headers: {
      "x-admin-code": adminSessionCode
    }
  });

  if (!response.ok) {
    throw new Error("delete failed");
  }
}

async function saveAdminConfig() {
  if (!adminUnlocked) {
    adminSaveFeedback.textContent = "Seul un admin peut modifier les boutons et les textes.";
    return;
  }

  const nextConfig = buildAdminConfigFromForm();

  applyConfig(nextConfig);

  try {
    await saveConfigToServer(nextConfig);
    remoteSyncEnabled = true;
    setSyncStatus("Sauvegarde commune active", "online");
    adminSaveFeedback.textContent = "Modifications enregistrees sur tous les appareils.";
  } catch (error) {
    remoteSyncEnabled = false;
    setSyncStatus("", "local");
    adminSaveFeedback.textContent =
      "Serveur indisponible : les modifications ne sont pas partagees pour le moment.";
  }
}

async function resetAdminConfig() {
  if (!adminUnlocked) {
    adminSaveFeedback.textContent = "Seul un admin peut remettre les textes d'origine.";
    return;
  }

  const confirmed = window.confirm("Remettre tous les textes d'origine ?");

  if (!confirmed) {
    return;
  }

  const nextConfig = cloneDefaultConfig();
  applyConfig(nextConfig);

  try {
    await deleteRemoteConfig();
    remoteSyncEnabled = true;
    setSyncStatus("Sauvegarde commune active", "online");
    adminSaveFeedback.textContent = "Les textes d'origine ont ete remis sur tous les appareils.";
  } catch (error) {
    remoteSyncEnabled = false;
    setSyncStatus("", "local");
    adminSaveFeedback.textContent =
      "Serveur indisponible : la remise a zero n'est pas partagee pour le moment.";
  }
}

levelGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".level-button");

  if (!button) {
    return;
  }

  if (!adminUnlocked) {
    openAdminModal();
    return;
  }

  renderLevel(Number(button.dataset.level));
  saveState();
});
copyButton.addEventListener("click", copySummary);
adminToggle.addEventListener("click", openAdminModal);
adminClose.addEventListener("click", closeAdminModal);
adminCancel.addEventListener("click", closeAdminModal);
adminLogin.addEventListener("click", unlockAdmin);
adminLockButton.addEventListener("click", lockAdmin);
adminSave.addEventListener("click", saveAdminConfig);
adminReset.addEventListener("click", resetAdminConfig);

adminCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    unlockAdmin();
  }
});

adminModal.addEventListener("click", (event) => {
  if (event.target === adminModal) {
    closeAdminModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !adminModal.hidden) {
    closeAdminModal();
  }
});

async function syncEverythingFromServer() {
  await Promise.all([syncConfigFromServer(), syncStateFromServer()]);
}

window.addEventListener("focus", () => {
  if (!isEditingAdmin()) {
    syncEverythingFromServer();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !isEditingAdmin()) {
    syncEverythingFromServer();
  }
});

window.setInterval(() => {
  if (document.visibilityState === "visible" && !isEditingAdmin()) {
    syncEverythingFromServer();
  }
}, remotePollMs);

setSyncStatus("", "local");
restoreAdminSession();
renderStaticTexts();
renderLevelButtons();
restoreState();
syncEverythingFromServer();
