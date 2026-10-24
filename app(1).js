const DB_NAME = "gallery-walk";
const DB_VERSION = 1;
const STORE_NAME = "works";

const elements = {
  addButton: document.querySelector("#add-button"),
  emptyAddButton: document.querySelector("#empty-add-button"),
  rename: document.querySelector("#rename-button"),
  signout: document.querySelector("#signout-button"),
  secretAccess: document.querySelector("#secret-access"),
  accessDialog: document.querySelector("#access-dialog"),
  accessForm: document.querySelector("#access-form"),
  accessPassword: document.querySelector("#access-password"),
  accessError: document.querySelector("#access-error"),
  closeAccess: document.querySelector("#close-access"),
  enterArchive: document.querySelector("#enter-archive"),
  foyer: document.querySelector("#foyer"),
  archiveView: document.querySelector("#archive-view"),
  foyerButton: document.querySelector("#foyer-button"),
  emptyEyebrow: document.querySelector("#empty-eyebrow"),
  emptyTitle: document.querySelector("#empty-title"),
  roomWorld: document.querySelector("#room-world"),
  roomSignal: document.querySelector("#room-signal"),
  collectionLabel: document.querySelector(".collection-label"),
  fileInput: document.querySelector("#file-input"),
  room: document.querySelector("#room"),
  stage: document.querySelector("#podium-stage"),
  empty: document.querySelector("#empty-room"),
  caption: document.querySelector("#room-caption"),
  count: document.querySelector("#room-count"),
  currentIndex: document.querySelector("#current-index"),
  title: document.querySelector("#work-title"),
  meta: document.querySelector("#work-meta"),
  postedDate: document.querySelector("#work-date"),
  orientationHint: document.querySelector("#orientation-hint"),
  orientationDismiss: document.querySelector("#orientation-dismiss"),
  previous: document.querySelector("#previous-button"),
  next: document.querySelector("#next-button"),
  remove: document.querySelector("#remove-button"),
  searchForm: document.querySelector("#search-form"),
  searchInput: document.querySelector("#search-input"),
  searchResults: document.querySelector("#search-results"),
  eyeTrigger: document.querySelector("#eye-trigger"),
  eyePanel: document.querySelector("#eye-panel"),
  eyeClose: document.querySelector("#eye-close"),
  eyeForm: document.querySelector("#eye-form"),
  eyeBack: document.querySelector("#eye-back"),
  eyeQuery: document.querySelector("#eye-query"),
  eyeMessage: document.querySelector("#eye-message"),
  eyeResults: document.querySelector("#eye-results"),
  toast: document.querySelector("#toast"),
};

let database;
let works = [];
let current = 0;
let isCurator = false;
let secretClicks = 0;
let secretClickTimer;
let toastTimer;
let noSignalTimer;
const mediaUrls = new Map();
const worlds = [
  { id: "forest", label: "FOREST WITHOUT A SKY" },
  { id: "starfall", label: "FROST ORBIT / STARFALL" },
  { id: "snow", label: "SNOW IN THE SUNROOM" },
  { id: "fire", label: "A SMALL INDOOR SUN" },
  { id: "elsewhere", label: "ELSEWHERE, MOSTLY" },
];
const irisGreetings = [
  "Hi, I'm Iris. I keep an eye on this place. What should we find?",
  "Iris here. I watch the weird corners. What are you looking for?",
  "Oh, hello. I'm Iris, keeper of the podium signals. Need a hand?",
];
const irisFoundLines = [
  "Signal found. I knew it was hiding in here.",
  "There! The archive gave it back.",
  "Got it. This one is just ahead.",
];
const irisMissingLines = [
  "Sorry, I can't find \u201c{query}\u201d. Maybe try another name?",
  "No signal from \u201c{query}\u201d. I checked all the little corners.",
  "\u201c{query}\u201d isn't in this archive yet. Want to try another clue?",
];
const irisAdminLines = [
  "Curator signal recognized. Welcome back, archive keeper.",
  "HECZEN13 confirmed. The curator tools are awake now.",
  "Admin access granted. I'll keep watch while you arrange things.",
];

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllWorks() {
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result.sort((left, right) => left.createdAt - right.createdAt));
    request.onerror = () => reject(request.error);
  });
}

function saveWork(work) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(work);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function deleteWork(id) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function getMediaUrl(work) {
  if (!mediaUrls.has(work.id)) mediaUrls.set(work.id, URL.createObjectURL(work.file));
  return mediaUrls.get(work.id);
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("toast--visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("toast--visible"), 3200);
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPostedDate(work) {
  const timestamp = Number(work.createdAt);
  if (!Number.isFinite(timestamp)) return "DATE UNKNOWN";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(timestamp);
}

function formatKind(work) {
  const type = work.file.type;
  if (type.startsWith("image/")) return "IMAGE";
  if (type.startsWith("audio/")) return "AUDIO";
  if (type.startsWith("video/")) return "FILM";
  const extension = work.name.includes(".") ? work.name.split(".").pop() : "FILE";
  return extension.toUpperCase().slice(0, 12);
}

function displayTitle(work) {
  return work.title || work.name;
}

function resizeFrameToRatio(frame, ratio) {
  if (!ratio || !frame.parentElement) return;
  frame.dataset.ratio = String(ratio);
  const inGallery = document.body.classList.contains("gallery-open");
  const shortLandscape = window.matchMedia("(orientation: landscape) and (max-height: 520px)").matches;
  const maxHeight = inGallery
    ? shortLandscape
      ? Math.min(190, Math.max(145, window.innerHeight * 0.48))
      : Math.min(600, Math.max(230, window.innerHeight * 0.58))
    : shortLandscape
      ? Math.min(155, Math.max(115, window.innerHeight * 0.35))
      : window.matchMedia("(max-width: 460px)").matches
        ? 192
        : window.matchMedia("(max-width: 760px)").matches
          ? Math.min(240, Math.max(175, window.innerWidth * 0.4))
          : Math.min(258, Math.max(165, window.innerWidth * 0.22));
  const maxWidth = frame.parentElement.getBoundingClientRect().width;
  if (!maxWidth) return;
  const width = Math.min(maxWidth, maxHeight * ratio);
  frame.style.width = `${width}px`;
  frame.style.height = `${Math.min(maxHeight, maxWidth / ratio)}px`;
}

function resizeImageFrames() {
  for (const frame of elements.stage.querySelectorAll(".podium__frame[data-ratio]")) {
    resizeFrameToRatio(frame, Number(frame.dataset.ratio));
  }
}

function createMedia(work, frame) {
  const url = getMediaUrl(work);
  const media = document.createElement("div");
  media.className = "podium__art";
  media.addEventListener("click", (event) => event.stopPropagation());

  if (work.file.type.startsWith("image/")) {
    const image = document.createElement("img");
    image.alt = work.name;
    const updateRatio = () => resizeFrameToRatio(frame, image.naturalWidth / image.naturalHeight);
    image.addEventListener("load", updateRatio, { once: true });
    image.src = url;
    if (image.complete) updateRatio();
    media.append(image);
  } else if (work.file.type.startsWith("audio/")) {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "metadata";
    audio.src = url;
    audio.setAttribute("aria-label", `Play ${work.name}`);
    media.append(audio);
    addFileArtwork(media, "♪", "SOUND RECORDING");
  } else if (work.file.type.startsWith("video/")) {
    const video = document.createElement("video");
    video.controls = true;
    video.preload = "metadata";
    video.addEventListener("loadedmetadata", () => resizeFrameToRatio(frame, video.videoWidth / video.videoHeight), { once: true });
    video.src = url;
    video.setAttribute("aria-label", work.name);
    media.append(video);
  } else if (work.file.type === "application/pdf") {
    const pdf = document.createElement("iframe");
    pdf.src = url;
    pdf.title = work.name;
    media.append(pdf);
  } else {
    addFileArtwork(media, "⌁", formatKind(work));
  }
  return media;
}

function addFileArtwork(parent, glyph, label) {
  const artwork = document.createElement("div");
  artwork.className = "file-art";
  const icon = document.createElement("span");
  icon.className = "file-art__glyph";
  icon.textContent = glyph;
  const kind = document.createElement("span");
  kind.className = "file-art__type";
  kind.textContent = label;
  artwork.append(icon, kind);
  parent.append(artwork);
}

function createPodium(work, index, position) {
  const podium = document.createElement("article");
  podium.className = `podium podium--${position}`;
  podium.setAttribute("aria-label", `${displayTitle(work)}, podium ${index + 1}`);
  if (position !== "center") {
    podium.setAttribute("role", "button");
    podium.setAttribute("tabindex", "0");
    const select = () => { current = index; render(); };
    podium.addEventListener("click", select);
    podium.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });
  }

  const halo = document.createElement("div");
  halo.className = "podium__halo";
  const frame = document.createElement("div");
  frame.className = "podium__frame";
  frame.append(createMedia(work, frame));
  const base = document.createElement("div");
  base.className = "podium__base";
  const number = document.createElement("span");
  number.className = "podium__number";
  number.textContent = String(index + 1).padStart(2, "0");
  base.append(number);
  const shadow = document.createElement("div");
  shadow.className = "podium__shadow";
  const plate = document.createElement("div");
  plate.className = "podium__plate";
  const dot = document.createElement("i");
  const name = document.createElement("span");
  name.className = "podium__plate-title";
  name.textContent = displayTitle(work);
  const details = document.createElement("span");
  details.className = "podium__plate-details";
  details.textContent = `${formatKind(work)} · ${formatSize(work.file.size)}`;
  const date = document.createElement("time");
  date.className = "podium__plate-date";
  const timestamp = new Date(Number(work.createdAt));
  date.dateTime = Number.isNaN(timestamp.getTime()) ? "" : timestamp.toISOString();
  date.textContent = `POSTED ${formatPostedDate(work)}`;
  plate.append(dot, name, details, date);
  podium.append(halo, frame, base, shadow, plate);
  return podium;
}

function render() {
  const hasWorks = works.length > 0;
  elements.count.textContent = `${works.length} ${works.length === 1 ? "PODIUM" : "PODIUMS"}`;
  elements.empty.hidden = hasWorks;
  elements.stage.replaceChildren();
  elements.caption.hidden = !hasWorks;
  elements.remove.hidden = !hasWorks || !isCurator;
  elements.rename.hidden = !hasWorks || !isCurator;
  elements.emptyAddButton.hidden = !isCurator;
  elements.emptyEyebrow.textContent = isCurator ? "PODIUM READY FOR AN EXHIBIT" : "SIGNAL NOT FOUND";
  elements.emptyTitle.textContent = isCurator ? "Choose something for this podium." : "This podium is still dreaming.";
  elements.previous.disabled = !hasWorks || current <= 0;
  elements.next.disabled = !hasWorks || current >= works.length - 1;

  if (!hasWorks) {
    elements.room.dataset.world = "forest";
    elements.roomWorld.textContent = worlds[0].label;
    elements.roomSignal.hidden = true;
    elements.postedDate.hidden = true;
    elements.postedDate.textContent = "";
    elements.currentIndex.textContent = "— / —";
    elements.title.textContent = "A room of its own";
    elements.meta.textContent = isCurator ? "Add an exhibit to wake the room." : "Waiting for the first strange thing.";
    return;
  }

  current = Math.max(0, Math.min(current, works.length - 1));
  const work = works[current];
  const world = worlds[current % worlds.length];
  elements.room.dataset.world = world.id;
  elements.roomWorld.textContent = world.label;
  elements.currentIndex.textContent = `${String(current + 1).padStart(2, "0")} / ${String(works.length).padStart(2, "0")}`;
  elements.title.textContent = displayTitle(work);
  elements.meta.textContent = `${formatKind(work)}  ·  ${formatSize(work.file.size)}`;
  const postedAt = new Date(Number(work.createdAt));
  elements.postedDate.dateTime = Number.isNaN(postedAt.getTime()) ? "" : postedAt.toISOString();
  elements.postedDate.textContent = `POSTED ${formatPostedDate(work)}`;
  elements.postedDate.hidden = false;
  if (current > 0) elements.stage.append(createPodium(works[current - 1], current - 1, "left"));
  elements.stage.append(createPodium(work, current, "center"));
  if (current < works.length - 1) elements.stage.append(createPodium(works[current + 1], current + 1, "right"));
}

function setCurrent(index) {
  if (index < 0 || index >= works.length) return;
  clearTimeout(noSignalTimer);
  elements.roomSignal.hidden = true;
  elements.room.classList.remove("room--no-signal");
  current = index;
  render();
}

function renderSearchResults(query) {
  elements.searchResults.replaceChildren();
  if (!query.trim()) {
    elements.searchResults.hidden = true;
    return;
  }
  const normalized = query.trim().toLocaleLowerCase();
  const numberMatch = normalized.match(/\b(?:podium|stand|number|no\.?)\s*#?\s*(\d+)\b/i) || normalized.match(/^#?\s*(\d+)$/);
  const matches = works.map((work, index) => ({ work, index }))
    .filter(({ work, index }) => numberMatch
      ? index === Number(numberMatch[1]) - 1
      : displayTitle(work).toLocaleLowerCase().includes(normalized) || work.name.toLocaleLowerCase().includes(normalized) || formatKind(work).toLocaleLowerCase().includes(normalized));
  if (!matches.length) {
    const message = document.createElement("p");
    message.className = "search-empty";
    message.textContent = "No works found in this room.";
    elements.searchResults.append(message);
  } else {
    for (const { work, index } of matches.slice(0, 8)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-result";
      button.setAttribute("role", "option");
      const name = document.createElement("span");
      name.className = "search-result__name";
      name.textContent = displayTitle(work);
      const type = document.createElement("span");
      type.className = "search-result__type";
      type.textContent = `PODIUM ${String(index + 1).padStart(2, "0")} · ${formatKind(work)}`;
      button.append(name, type);
      button.addEventListener("click", () => {
        setCurrent(index);
        elements.searchInput.value = "";
        elements.searchResults.hidden = true;
        elements.searchInput.blur();
      });
      elements.searchResults.append(button);
    }
  }
  elements.searchResults.hidden = false;
}

function searchFromIris(query) {
  const cleanedQuery = query.trim();
  elements.eyeResults.replaceChildren();
  const normalized = cleanedQuery.toLocaleLowerCase();
  const returnCommand = /\b(?:send|take|bring|go)\s+(?:me|us)\s+(?:back|home|to\s+(?:the\s+)?(?:foyer|entrance))\b|\bback\s+to\s+(?:the\s+)?(?:foyer|entrance)\b|^(?:home|foyer|entrance)$/i.test(normalized);
  if (returnCommand) {
    elements.eyeMessage.textContent = "Back to the foyer we go. Keep your eyes open out there.";
    returnToFoyer();
    return;
  }
  if (/\bheczen13\b/i.test(cleanedQuery)) {
    elements.eyeQuery.value = "";
    setCuratorMode(true);
    elements.eyePanel.hidden = false;
    elements.eyeTrigger.setAttribute("aria-expanded", "true");
    elements.eyeMessage.textContent = irisAdminLines[Math.floor(Math.random() * irisAdminLines.length)];
    return;
  }
  if (!cleanedQuery) {
    elements.eyeMessage.textContent = "Give me a podium number, title, or file type.";
    return;
  }
  if (!works.length) {
    elements.eyeMessage.textContent = "No signal yet. There aren't any podiums in the archive.";
    showNoSignal();
    return;
  }

  const numberMatch = normalized.match(/\b(?:podium|stand|number|no\.?)\s*#?\s*(\d+)\b/i) || normalized.match(/^#?\s*(\d+)$/);
  let searchLabel = cleanedQuery;
  let matches;
  if (numberMatch) {
    const index = Number(numberMatch[1]) - 1;
    matches = works[index] ? [{ work: works[index], index }] : [];
  } else {
    const terms = normalized
      .replace(/^(?:(?:hey|okay|hi)\s+)?(?:iris[:,]?\s+)?/i, "")
      .replace(/^(?:(?:i|we)\s+(?:wanna|want\s+to)\s+)?(?:please\s+)?(?:can\s+you|could\s+you|would\s+you)?\s*(?:please\s+)?(?:find|look\s+for|search\s+for|take\s+me\s+to|show\s+me)\s+(?:me\s+)?/i, "")
      .replace(/^(?:the|a|an)\s+/i, "")
      .replace(/[?!.,]+$/g, "")
      .replace(/\bpaintings?\b/g, "image")
      .replace(/\bmovies?\b/g, "film")
      .trim();
    searchLabel = terms || cleanedQuery;
    if (!terms) {
      elements.eyeMessage.textContent = "What should I look for? A title, file type, or podium number works.";
      return;
    }
    matches = works.map((work, index) => ({ work, index }))
      .filter(({ work, index }) => [displayTitle(work), work.name, formatKind(work), worlds[index % worlds.length].label]
        .some((value) => value.toLocaleLowerCase().includes(terms)));
  }

  if (!matches.length) {
    showNoSignal();
    elements.eyeMessage.textContent = irisMissingLines[Math.floor(Math.random() * irisMissingLines.length)].replace("{query}", searchLabel);
    return;
  }

  elements.roomSignal.hidden = true;
  elements.room.classList.remove("room--no-signal");
  elements.eyeMessage.textContent = matches.length === 1
    ? irisFoundLines[Math.floor(Math.random() * irisFoundLines.length)]
    : `I found ${matches.length} possibilities. Which one did you mean?`;
  for (const { work, index } of matches.slice(0, 6)) {
    const result = document.createElement("button");
    result.type = "button";
    result.className = "eye-guide__result";
    const number = document.createElement("span");
    number.textContent = `PODIUM ${String(index + 1).padStart(2, "0")}`;
    const title = document.createElement("span");
    title.textContent = displayTitle(work);
    const kind = document.createElement("span");
    kind.textContent = formatKind(work);
    result.append(number, title, kind);
    result.addEventListener("click", () => {
      setCurrent(index);
      elements.eyePanel.hidden = true;
      elements.eyeTrigger.setAttribute("aria-expanded", "false");
      elements.eyeTrigger.focus();
    });
    elements.eyeResults.append(result);
  }
}

function showNoSignal() {
  clearTimeout(noSignalTimer);
  elements.roomSignal.hidden = false;
  elements.room.classList.remove("room--no-signal");
  void elements.room.offsetWidth;
  elements.room.classList.add("room--no-signal");
  noSignalTimer = setTimeout(() => {
    elements.roomSignal.hidden = true;
    elements.room.classList.remove("room--no-signal");
  }, 1200);
}

async function addFiles(fileList) {
  if (!isCurator) return;
  const files = Array.from(fileList);
  if (!files.length) return;
  try {
    const newWorks = files.map((file) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      title: file.name,
      file,
      createdAt: Date.now() + Math.random(),
    }));
    for (const work of newWorks) await saveWork(work);
    works.push(...newWorks);
    if (works.length === newWorks.length) current = 0;
    render();
    showToast(`${files.length} ${files.length === 1 ? "work" : "works"} added to your room.`);
  } catch (error) {
    console.error("Could not store the selected files.", error);
    showToast("These files could not be stored. Try smaller files or check browser storage.");
  }
}

async function removeCurrent() {
  if (!isCurator) return;
  const work = works[current];
  if (!work) return;
  try {
    await deleteWork(work.id);
    const url = mediaUrls.get(work.id);
    if (url) URL.revokeObjectURL(url);
    mediaUrls.delete(work.id);
    works.splice(current, 1);
    current = Math.min(current, works.length - 1);
    render();
    showToast("Work removed from your room.");
  } catch (error) {
    console.error("Could not remove the selected work.", error);
    showToast("This work could not be removed.");
  }
}

async function renameCurrent() {
  if (!isCurator) return;
  const work = works[current];
  if (!work) return;
  const title = window.prompt("Name this podium", displayTitle(work));
  if (title === null) return;
  const cleanedTitle = title.trim();
  if (!cleanedTitle) {
    showToast("Podium names cannot be empty.");
    return;
  }
  try {
    work.title = cleanedTitle.slice(0, 120);
    await saveWork(work);
    render();
    showToast("Podium name updated.");
  } catch (error) {
    console.error("Could not rename the selected podium.", error);
    showToast("This podium could not be renamed.");
  }
}

function enterArchive() {
  elements.foyer.hidden = true;
  elements.archiveView.hidden = false;
  document.body.classList.add("gallery-open");
  requestAnimationFrame(resizeImageFrames);
}

function returnToFoyer() {
  elements.archiveView.hidden = true;
  elements.foyer.hidden = false;
  document.body.classList.remove("gallery-open");
  elements.eyePanel.hidden = true;
  elements.eyeTrigger.setAttribute("aria-expanded", "false");
  elements.eyeMessage.textContent = irisGreetings[0];
}

function setCuratorMode(enabled) {
  isCurator = enabled;
  elements.addButton.hidden = !enabled;
  elements.signout.hidden = !enabled;
  elements.collectionLabel.classList.toggle("collection-label--curator", enabled);
  render();
}

function moveFromKeyboard(event) {
  const target = event.target;
  const typing = target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "AUDIO", "VIDEO"].includes(target.tagName));
  if (typing || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === "/") {
    event.preventDefault();
    elements.searchInput.focus();
  }
  if (event.key === "ArrowLeft" && works.length) {
    if (!elements.archiveView.hidden) {
      event.preventDefault();
      setCurrent(Math.max(0, current - 1));
    }
  }
  if (event.key === "ArrowRight" && works.length) {
    if (!elements.archiveView.hidden) {
      event.preventDefault();
      setCurrent(Math.min(works.length - 1, current + 1));
    }
  }
}

elements.addButton.addEventListener("click", () => elements.fileInput.click());
elements.emptyAddButton.addEventListener("click", () => elements.fileInput.click());
elements.fileInput.addEventListener("change", async () => {
  await addFiles(elements.fileInput.files);
  elements.fileInput.value = "";
});
elements.previous.addEventListener("click", () => setCurrent(current - 1));
elements.next.addEventListener("click", () => setCurrent(current + 1));
elements.remove.addEventListener("click", removeCurrent);
elements.rename.addEventListener("click", renameCurrent);
elements.signout.addEventListener("click", () => setCuratorMode(false));
elements.enterArchive.addEventListener("click", enterArchive);
elements.foyerButton.addEventListener("click", returnToFoyer);
elements.secretAccess.addEventListener("click", () => {
  secretClicks += 1;
  clearTimeout(secretClickTimer);
  if (secretClicks >= 5) {
    secretClicks = 0;
    elements.accessError.textContent = "";
    elements.accessPassword.value = "";
    elements.accessDialog.showModal();
    elements.accessPassword.focus();
  } else {
    secretClickTimer = setTimeout(() => { secretClicks = 0; }, 1800);
  }
});
elements.closeAccess.addEventListener("click", () => elements.accessDialog.close());
elements.orientationDismiss.addEventListener("click", () => elements.orientationHint.classList.add("orientation-hint--dismissed"));
elements.accessForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (["eggfloat", "heczen13"].includes(elements.accessPassword.value.trim().toLocaleLowerCase())) {
    elements.accessDialog.close();
    setCuratorMode(true);
    showToast("Curator access enabled for this visit.");
  } else {
    elements.accessError.textContent = "That key did not open the archive.";
    elements.accessPassword.select();
  }
});
elements.searchInput.addEventListener("input", (event) => renderSearchResults(event.currentTarget.value));
elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const firstMatch = Array.from(elements.searchResults.querySelectorAll(".search-result"))[0];
  if (firstMatch) firstMatch.click();
});
elements.eyeTrigger.addEventListener("click", () => {
  const willOpen = elements.eyePanel.hidden;
  elements.eyePanel.hidden = !willOpen;
  elements.eyeTrigger.setAttribute("aria-expanded", String(willOpen));
  if (willOpen) {
    elements.eyeMessage.textContent = irisGreetings[Math.floor(Math.random() * irisGreetings.length)];
    elements.eyeQuery.focus();
  }
});
elements.eyeTrigger.addEventListener("pointermove", (event) => {
  const iris = elements.eyeTrigger.querySelector(".eye-guide__iris");
  const bounds = elements.eyeTrigger.getBoundingClientRect();
  const gazeX = Math.max(-6, Math.min(6, (event.clientX - (bounds.left + bounds.width / 2)) / 4));
  const gazeY = Math.max(-4, Math.min(4, (event.clientY - (bounds.top + bounds.height / 2)) / 4));
  iris.style.setProperty("--gaze-x", `${gazeX}px`);
  iris.style.setProperty("--gaze-y", `${gazeY}px`);
});
elements.eyeTrigger.addEventListener("pointerleave", () => {
  const iris = elements.eyeTrigger.querySelector(".eye-guide__iris");
  iris.style.removeProperty("--gaze-x");
  iris.style.removeProperty("--gaze-y");
});
elements.eyeClose.addEventListener("click", () => {
  elements.eyePanel.hidden = true;
  elements.eyeTrigger.setAttribute("aria-expanded", "false");
  elements.eyeTrigger.focus();
});
elements.eyeBack.addEventListener("click", returnToFoyer);
elements.eyeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  searchFromIris(elements.eyeQuery.value);
});
document.addEventListener("keydown", moveFromKeyboard);
window.addEventListener("resize", resizeImageFrames);
document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-wrap")) elements.searchResults.hidden = true;
});
window.addEventListener("beforeunload", () => {
  for (const url of mediaUrls.values()) URL.revokeObjectURL(url);
});

(async function start() {
  try {
    database = await openDatabase();
    works = await getAllWorks();
    render();
  } catch (error) {
    console.error("Gallery storage is unavailable.", error);
    render();
    showToast("Your browser could not open local storage for this collection.");
  }
})();
