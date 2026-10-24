const DB_NAME = "gallery-walk";
const DB_VERSION = 1;
const STORE_NAME = "works";

const elements = {
  addButton: document.querySelector("#add-button"),
  addLinkButton: document.querySelector("#add-link-button"),
  emptyAddButton: document.querySelector("#empty-add-button"),
  edit: document.querySelector("#edit-button"),
  signout: document.querySelector("#signout-button"),
  secretAccess: document.querySelector("#secret-access"),
  accessDialog: document.querySelector("#access-dialog"),
  accessForm: document.querySelector("#access-form"),
  accessPassword: document.querySelector("#access-password"),
  accessError: document.querySelector("#access-error"),
  closeAccess: document.querySelector("#close-access"),
  workDialog: document.querySelector("#work-dialog"),
  workForm: document.querySelector("#work-form"),
  workDialogTitle: document.querySelector("#work-dialog-title"),
  workFields: document.querySelector("#work-fields"),
  closeWorkDialog: document.querySelector("#close-work-dialog"),
  cancelWorkDialog: document.querySelector("#cancel-work-dialog"),
  linkDialog: document.querySelector("#link-dialog"),
  linkForm: document.querySelector("#link-form"),
  linkInput: document.querySelector("#video-link-input"),
  linkError: document.querySelector("#link-error"),
  closeLinkDialog: document.querySelector("#close-link-dialog"),
  cancelLinkDialog: document.querySelector("#cancel-link-dialog"),
  enterArchive: document.querySelector("#enter-archive"),
  foyer: document.querySelector("#foyer"),
  archiveView: document.querySelector("#archive-view"),
  foyerButton: document.querySelector("#foyer-button"),
  emptyEyebrow: document.querySelector("#empty-eyebrow"),
  emptyTitle: document.querySelector("#empty-title"),
  roomWorld: document.querySelector("#room-world"),
  description: document.querySelector("#work-description"),
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
  eyeBack: document.querySelector("#eye-back"),
  eyeMessage: document.querySelector("#eye-message"),
  toast: document.querySelector("#toast"),
};

let database;
let works = [];
let current = 0;
let isCurator = false;
let secretClicks = 0;
let secretClickTimer;
let toastTimer;
let walkTimer;
let audioVisualization = null;
const mediaUrls = new Map();
const artworkUrls = new Map();
let workEditorItems = [];
let workEditorMode = "add";
const worlds = [
  { id: "forest", label: "FOREST WITHOUT A SKY" },
  { id: "starfall", label: "FROST ORBIT / STARFALL" },
  { id: "snow", label: "SNOW IN THE SUNROOM" },
  { id: "fire", label: "A SMALL INDOOR SUN" },
  { id: "elsewhere", label: "ELSEWHERE, MOSTLY" },
];
function worldForWork(work, index) {
  return worlds.find((world) => world.id === work.backgroundId) || worlds[index % worlds.length];
}

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

function saveWorks(items) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    for (const work of items) store.put(work);
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

function getArtworkUrl(work) {
  if (!work.artwork) return "";
  if (!artworkUrls.has(work.id)) artworkUrls.set(work.id, URL.createObjectURL(work.artwork));
  return artworkUrls.get(work.id);
}

function getYouTubeVideoId(value) {
  const url = new URL(value);
  const host = url.hostname.toLocaleLowerCase().replace(/^www\./, "");
  const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/);
  const videoId = host === "youtu.be"
    ? url.pathname.split("/").filter(Boolean)[0]
    : url.searchParams.get("v") || match?.[1];
  return videoId && /^[\w-]{11}$/.test(videoId) ? videoId : "";
}

function getTikTokVideoId(value) {
  return new URL(value).pathname.match(/\/video\/(\d+)/)?.[1] || "";
}

function parseVideoLink(value) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLocaleLowerCase().replace(/^www\./, "");
  if (["youtube.com", "youtu.be", "youtube-nocookie.com", "m.youtube.com"].includes(host)) {
    const videoId = getYouTubeVideoId(url.href);
    return videoId ? { provider: "YouTube", url: `https://www.youtube.com/watch?v=${videoId}` } : null;
  }
  if (["tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"].includes(host)) {
    const hasVideoId = Boolean(getTikTokVideoId(url.href));
    const isShortLink = host === "vm.tiktok.com" || host === "vt.tiktok.com" || /^\/t\/[\w-]+\/?$/i.test(url.pathname);
    if (!hasVideoId && !isShortLink) return null;
    url.hash = "";
    return { provider: "TikTok", url: url.href };
  }
  return null;
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
  if (work.videoUrl) return "VIDEO LINK";
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

function openWorkEditor(items, mode) {
  if (!isCurator || !items.length) return;
  workEditorItems = items;
  workEditorMode = mode;
  elements.workDialogTitle.textContent = mode === "edit" ? "Edit this work" : "Give each work a name";
  elements.workFields.replaceChildren();

  items.forEach(({ file, work, videoUrl }, index) => {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "work-fields";
    const legend = document.createElement("legend");
    legend.textContent = file.name;
    fieldset.append(legend);

    const titleLabel = document.createElement("label");
    titleLabel.textContent = "Display name";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.maxLength = 120;
    titleInput.required = true;
    titleInput.value = (work ? displayTitle(work) : file.name).slice(0, 120);
    titleInput.dataset.role = "title";
    titleInput.id = `work-title-${index}`;
    titleLabel.htmlFor = titleInput.id;

    const descriptionLabel = document.createElement("label");
    descriptionLabel.textContent = "Description";
    const descriptionInput = document.createElement("textarea");
    descriptionInput.rows = 3;
    descriptionInput.maxLength = 500;
    descriptionInput.value = work?.description || "";
    descriptionInput.dataset.role = "description";
    descriptionInput.id = `work-description-${index}`;
    descriptionLabel.htmlFor = descriptionInput.id;

    const irisLabel = document.createElement("label");
    irisLabel.textContent = "What Iris says";
    const irisInput = document.createElement("textarea");
    irisInput.rows = 3;
    irisInput.maxLength = 500;
    irisInput.value = work?.irisDialogue || "";
    irisInput.placeholder = "Write Iris's dialogue for this podium…";
    irisInput.dataset.role = "iris-dialogue";
    irisInput.id = `work-iris-dialogue-${index}`;
    irisLabel.htmlFor = irisInput.id;

    const backgroundLabel = document.createElement("label");
    backgroundLabel.textContent = "Podium background";
    const backgroundSelect = document.createElement("select");
    backgroundSelect.dataset.role = "background";
    backgroundSelect.id = `work-background-${index}`;
    backgroundLabel.htmlFor = backgroundSelect.id;
    const automaticOption = document.createElement("option");
    automaticOption.value = "";
    automaticOption.textContent = "Follow the archive route";
    backgroundSelect.append(automaticOption);
    for (const world of worlds) {
      const option = document.createElement("option");
      option.value = world.id;
      option.textContent = world.label;
      backgroundSelect.append(option);
    }
    backgroundSelect.value = work?.backgroundId || "";

    fieldset.append(titleLabel, titleInput, descriptionLabel, descriptionInput, irisLabel, irisInput, backgroundLabel, backgroundSelect);
    const isVideoLink = Boolean(videoUrl || work?.videoUrl);
    if (file.type.startsWith("audio/") || isVideoLink) {
      const artworkLabel = document.createElement("label");
      artworkLabel.textContent = isVideoLink ? "Thumbnail image (optional)" : "Cover image (optional)";
      const artworkInput = document.createElement("input");
      artworkInput.type = "file";
      artworkInput.accept = "image/*";
      artworkInput.dataset.role = "artwork";
      artworkInput.id = `work-artwork-${index}`;
      artworkLabel.htmlFor = artworkInput.id;
      fieldset.append(artworkLabel, artworkInput);
      if (work?.artwork) {
        const removeLabel = document.createElement("label");
        removeLabel.className = "work-fields__remove-artwork";
        const removeInput = document.createElement("input");
        removeInput.type = "checkbox";
        removeInput.dataset.role = "remove-artwork";
        removeLabel.append(removeInput, document.createTextNode(isVideoLink ? " Remove current thumbnail image" : " Remove current cover image"));
        fieldset.append(removeLabel);
      }
    }
    elements.workFields.append(fieldset);
  });

  elements.workDialog.showModal();
  elements.workFields.querySelector('[data-role="title"]').focus();
}

async function saveWorkEditor(event) {
  event.preventDefault();
  if (!isCurator || !workEditorItems.length) return;
  const updatedWorks = workEditorItems.map(({ file, work, videoUrl, videoProvider }, index) => {
    const fieldset = elements.workFields.children[index];
    const updated = work ? { ...work } : {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      file,
      createdAt: Date.now() + Math.random(),
    };
    updated.title = fieldset.querySelector('[data-role="title"]').value.trim().slice(0, 120);
    updated.description = fieldset.querySelector('[data-role="description"]').value.trim().slice(0, 500);
    const irisDialogue = fieldset.querySelector('[data-role="iris-dialogue"]').value.trim().slice(0, 500);
    if (irisDialogue) updated.irisDialogue = irisDialogue;
    else delete updated.irisDialogue;
    const backgroundId = fieldset.querySelector('[data-role="background"]').value;
    if (backgroundId) updated.backgroundId = backgroundId;
    else delete updated.backgroundId;
    if (videoUrl) {
      updated.videoUrl = videoUrl;
      updated.videoProvider = videoProvider;
    }
    const artworkInput = fieldset.querySelector('[data-role="artwork"]');
    const artworkFile = artworkInput?.files[0];
    if (artworkFile) updated.artwork = artworkFile;
    else if (fieldset.querySelector('[data-role="remove-artwork"]')?.checked) delete updated.artwork;
    return updated;
  });

  try {
    await saveWorks(updatedWorks);
    if (workEditorMode === "edit") {
      const oldArtworkUrl = artworkUrls.get(updatedWorks[0].id);
      if (oldArtworkUrl) URL.revokeObjectURL(oldArtworkUrl);
      artworkUrls.delete(updatedWorks[0].id);
      works[current] = updatedWorks[0];
    } else {
      if (!works.length) current = 0;
      else current = works.length;
      works.push(...updatedWorks);
    }
    elements.workDialog.close();
    workEditorItems = [];
    render();
    showToast(workEditorMode === "edit" ? "Work details updated." : `${updatedWorks.length} ${updatedWorks.length === 1 ? "work" : "works"} added to your room.`);
  } catch (error) {
    console.error("Could not save the work details.", error);
    showToast("These details could not be saved. Check browser storage and try again.");
  }
}

function resizeFrameToRatio(frame, ratio, naturalWidth, naturalHeight) {
  if (!ratio || !frame.parentElement) return;
  frame.dataset.ratio = String(ratio);
  if (naturalWidth && naturalHeight) {
    frame.dataset.naturalWidth = String(naturalWidth);
    frame.dataset.naturalHeight = String(naturalHeight);
  }
  const inGallery = document.body.classList.contains("gallery-open");
  const shortLandscape = window.matchMedia("(orientation: landscape) and (max-height: 520px)").matches;
  const maxFrameHeight = inGallery
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
  const maxWidth = frame.parentElement.offsetWidth;
  if (!maxWidth) return;
  const framePadding = 20;
  const maxContentWidth = Math.max(1, maxWidth - framePadding);
  const maxContentHeight = Math.max(1, maxFrameHeight - framePadding);
  const imageWidth = naturalWidth || ratio;
  const imageHeight = naturalHeight || 1;
  const scale = naturalWidth && naturalHeight
    ? Math.min(1, maxContentWidth / imageWidth, maxContentHeight / imageHeight)
    : Math.min(maxContentWidth / imageWidth, maxContentHeight / imageHeight);
  const width = Math.round(imageWidth * scale) + framePadding;
  const height = Math.round(imageHeight * scale) + framePadding;
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
}

function resizeImageFrames() {
  for (const frame of elements.stage.querySelectorAll(".podium__frame[data-ratio]")) {
    resizeFrameToRatio(
      frame,
      Number(frame.dataset.ratio),
      Number(frame.dataset.naturalWidth) || undefined,
      Number(frame.dataset.naturalHeight) || undefined,
    );
  }
}

function resetAudioRoomMotion() {
  elements.room.classList.remove("room--audio-playing");
  for (let index = 1; index <= 4; index += 1) {
    elements.room.style.removeProperty(`--audio-space-orb-y-${index}`);
  }
  for (const property of ["--audio-pulse", "--audio-iris-bop", "--audio-iris-tilt"]) {
    elements.room.style.removeProperty(property);
  }
}

function clearAudioVisualization() {
  cancelAnimationFrame(audioVisualization?.frame);
  audioVisualization = null;
  resetAudioRoomMotion();
}

function stopAudioVisualization(pauseAudio = false) {
  const activeVisualization = audioVisualization;
  if (!activeVisualization) {
    clearAudioVisualization();
    return;
  }
  if (pauseAudio) activeVisualization.audio.pause();
  clearAudioVisualization();
  activeVisualization.context.close().catch((error) => {
    console.error("Could not close the audio visualizer.", error);
  });
}

async function startAudioVisualization(audio) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try {
    if (!audioVisualization || audioVisualization.audio !== audio) {
      stopAudioVisualization(true);
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.18;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -18;
      const source = context.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(context.destination);
      audioVisualization = {
        audio,
        context,
        analyser,
        source,
        bins: new Uint8Array(analyser.frequencyBinCount),
        frame: 0,
        previousBass: 0,
        pulse: 0,
        previousTime: 0,
      };
    }

    const visualization = audioVisualization;
    await visualization.context.resume();
    if (audioVisualization !== visualization || audio.paused) return;
    elements.room.classList.add("room--audio-playing");

    const animate = (time) => {
      if (audioVisualization !== visualization || audio.paused) return;
      visualization.analyser.getByteFrequencyData(visualization.bins);
      let bass = 0;
      const bassBins = Math.min(12, visualization.bins.length);
      for (let index = 0; index < bassBins; index += 1) bass += visualization.bins[index];
      bass /= bassBins * 255;

      const elapsed = visualization.previousTime ? Math.min(50, time - visualization.previousTime) : 16;
      const risingBeat = bass > 0.055 && bass > visualization.previousBass * 1.12;
      if (risingBeat) visualization.pulse = Math.min(1, visualization.pulse + 0.9 + bass * 0.65);
      visualization.pulse *= Math.exp(-elapsed / 230);
      visualization.previousBass = bass;
      visualization.previousTime = time;

      const pulse = Math.min(1, visualization.pulse);
      const frequencyRange = visualization.bins.length - 1;
      for (let index = 0; index < 4; index += 1) {
        const startBin = Math.max(1, Math.floor(1 + (index / 4) ** 2 * frequencyRange));
        const endBin = Math.max(startBin + 1, Math.floor(1 + ((index + 1) / 4) ** 2 * frequencyRange));
        let bandPeak = 0;
        for (let bin = startBin; bin < Math.min(endBin, visualization.bins.length); bin += 1) {
          bandPeak = Math.max(bandPeak, visualization.bins[bin]);
        }
        const level = Math.max(0, Math.min(1, (bandPeak / 255 - 0.015) * 1.9));
        const beatPop = Math.max(level, pulse * (0.65 + (index % 2) * 0.2));
        elements.room.style.setProperty(`--audio-space-orb-y-${index + 1}`, `${(-beatPop * 58).toFixed(1)}px`);
      }
      const circleBeat = Math.min(0.9, pulse * 0.72 + bass * 0.7);
      elements.room.style.setProperty("--audio-pulse", circleBeat.toFixed(3));
      elements.room.style.setProperty("--audio-iris-bop", (pulse * 3 + bass * 2).toFixed(2));
      elements.room.style.setProperty("--audio-iris-tilt", `${(pulse * (risingBeat ? 15 : -9)).toFixed(1)}deg`);
      visualization.frame = requestAnimationFrame(animate);
    };

    cancelAnimationFrame(visualization.frame);
    visualization.frame = requestAnimationFrame(animate);
  } catch (error) {
    stopAudioVisualization();
    console.error("Beat-reactive room visuals could not start.", error);
    showToast("Beat-reactive visuals are unavailable in this browser. Audio will still play.");
  }
}

function pauseAudioVisualization(audio) {
  if (audioVisualization?.audio !== audio) return;
  cancelAnimationFrame(audioVisualization.frame);
  audioVisualization.frame = 0;
  resetAudioRoomMotion();
}

function createMedia(work, frame) {
  const url = work.videoUrl ? "" : getMediaUrl(work);
  const media = document.createElement("div");
  media.className = "podium__art";
  media.addEventListener("click", (event) => event.stopPropagation());

  if (work.videoUrl) {
    const videoLink = document.createElement("a");
    videoLink.className = "video-link-card";
    videoLink.href = work.videoUrl;
    videoLink.target = "_blank";
    videoLink.rel = "noopener noreferrer";
    videoLink.referrerPolicy = "no-referrer";
    videoLink.setAttribute("aria-label", `Open ${displayTitle(work)} on ${work.videoProvider} in a new tab`);
    const thumbnail = document.createElement("img");
    thumbnail.className = "video-link-card__thumbnail";
    thumbnail.alt = "";
    const resizeThumbnailFrame = () => {
      if (thumbnail.naturalWidth && thumbnail.naturalHeight) {
        resizeFrameToRatio(frame, thumbnail.naturalWidth / thumbnail.naturalHeight, thumbnail.naturalWidth, thumbnail.naturalHeight);
      }
    };
    thumbnail.addEventListener("load", resizeThumbnailFrame, { once: true });
    if (work.artwork) {
      thumbnail.src = getArtworkUrl(work);
    } else if (work.videoProvider === "YouTube" && getYouTubeVideoId(work.videoUrl)) {
      thumbnail.src = `https://i.ytimg.com/vi/${getYouTubeVideoId(work.videoUrl)}/hqdefault.jpg`;
      thumbnail.addEventListener("error", () => thumbnail.remove(), { once: true });
    }
    if (thumbnail.complete) resizeThumbnailFrame();
    const playIcon = document.createElement("span");
    playIcon.className = "video-link-card__play";
    playIcon.setAttribute("aria-hidden", "true");
    playIcon.textContent = "▶";
    const buttonText = document.createElement("span");
    buttonText.className = "video-link-card__label";
    buttonText.textContent = `Open ${work.videoProvider} video`;
    videoLink.append(thumbnail, playIcon, buttonText);
    media.append(videoLink);
  } else if (work.file.type.startsWith("image/")) {
    const image = document.createElement("img");
    image.alt = displayTitle(work);
    const updateRatio = () => resizeFrameToRatio(frame, image.naturalWidth / image.naturalHeight, image.naturalWidth, image.naturalHeight);
    image.addEventListener("load", updateRatio, { once: true });
    image.src = url;
    if (image.complete) updateRatio();
    media.append(image);
  } else if (work.file.type.startsWith("audio/")) {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "metadata";
    audio.src = url;
    audio.setAttribute("aria-label", `Play ${displayTitle(work)}`);
    audio.addEventListener("play", () => startAudioVisualization(audio));
    audio.addEventListener("pause", () => pauseAudioVisualization(audio));
    audio.addEventListener("ended", () => pauseAudioVisualization(audio));
    media.append(audio);
    addFileArtwork(media, "♪", "SOUND RECORDING", work, frame);
  } else if (work.file.type.startsWith("video/")) {
    const video = document.createElement("video");
    video.controls = true;
    video.preload = "metadata";
    video.addEventListener("loadedmetadata", () => resizeFrameToRatio(frame, video.videoWidth / video.videoHeight), { once: true });
    video.src = url;
    video.setAttribute("aria-label", displayTitle(work));
    media.append(video);
  } else if (work.file.type === "application/pdf") {
    const pdf = document.createElement("iframe");
    pdf.src = url;
    pdf.title = displayTitle(work);
    media.append(pdf);
  } else {
    addFileArtwork(media, "⌁", formatKind(work));
  }
  return media;
}

function addFileArtwork(parent, glyph, label, work = null, frame = null) {
  const artwork = document.createElement("div");
  artwork.className = "file-art";
  const hasArtwork = Boolean(work?.artwork);
  if (hasArtwork) {
    const image = document.createElement("img");
    image.className = "file-art__image";
    image.alt = "";
    const resizeArtworkFrame = () => {
      if (frame && image.naturalWidth && image.naturalHeight) {
        resizeFrameToRatio(frame, image.naturalWidth / image.naturalHeight, image.naturalWidth, image.naturalHeight);
      }
    };
    image.addEventListener("load", resizeArtworkFrame, { once: true });
    image.src = getArtworkUrl(work);
    if (image.complete) resizeArtworkFrame();
    artwork.append(image);
  }
  if (!hasArtwork) {
    const icon = document.createElement("span");
    icon.className = "file-art__glyph";
    icon.textContent = glyph;
    const kind = document.createElement("span");
    kind.className = "file-art__type";
    kind.textContent = label;
    artwork.append(icon, kind);
  }
  parent.append(artwork);
}

function createPodium(work, index, position) {
  const podium = document.createElement("article");
  podium.className = `podium podium--${position}`;
  podium.setAttribute("aria-label", `${displayTitle(work)}, podium ${index + 1}`);
  if (position !== "center") {
    podium.setAttribute("role", "button");
    podium.setAttribute("tabindex", "0");
    const select = () => setCurrent(index);
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
  const description = document.createElement("span");
  description.className = "podium__plate-description";
  description.textContent = work.description || "";
  description.hidden = !work.description;
  const details = document.createElement("span");
  details.className = "podium__plate-details";
  details.textContent = `${formatKind(work)} · ${formatSize(work.file.size)}`;
  const date = document.createElement("time");
  date.className = "podium__plate-date";
  const timestamp = new Date(Number(work.createdAt));
  date.dateTime = Number.isNaN(timestamp.getTime()) ? "" : timestamp.toISOString();
  date.textContent = `POSTED ${formatPostedDate(work)}`;
  plate.append(dot, name, description, details, date);
  podium.append(halo, frame, base, shadow, plate);
  return podium;
}

function render() {
  stopAudioVisualization(true);
  const hasWorks = works.length > 0;
  elements.count.textContent = `${works.length} ${works.length === 1 ? "PODIUM" : "PODIUMS"}`;
  elements.empty.hidden = hasWorks;
  elements.stage.replaceChildren();
  elements.caption.hidden = !hasWorks;
  elements.remove.hidden = !hasWorks || !isCurator;
  elements.edit.hidden = !hasWorks || !isCurator;
  elements.emptyAddButton.hidden = !isCurator;
  elements.emptyEyebrow.textContent = isCurator ? "PODIUM READY FOR AN EXHIBIT" : "SIGNAL NOT FOUND";
  elements.emptyTitle.textContent = isCurator ? "Choose something for this podium." : "This podium is still dreaming.";
  elements.previous.disabled = !hasWorks || current <= 0;
  elements.next.disabled = !hasWorks || current >= works.length - 1;

  if (!hasWorks) {
    elements.room.dataset.world = "forest";
    delete elements.room.dataset.previousWorld;
    delete elements.room.dataset.nextWorld;
    delete elements.room.dataset.lastWorld;
    elements.roomWorld.textContent = worlds[0].label;
    elements.roomSignal.hidden = true;
    elements.postedDate.hidden = true;
    elements.postedDate.textContent = "";
    elements.currentIndex.textContent = "— / —";
    elements.title.textContent = "A room of its own";
    elements.meta.textContent = isCurator ? "Add an exhibit to wake the room." : "Waiting for the first strange thing.";
    elements.description.textContent = "";
    elements.description.hidden = true;
    return;
  }

  current = Math.max(0, Math.min(current, works.length - 1));
  const work = works[current];
  const world = worldForWork(work, current);
  elements.room.dataset.world = world.id;
  const previousWorld = current > 0 ? worldForWork(works[current - 1], current - 1).id : "";
  const nextWorld = current < works.length - 1 ? worldForWork(works[current + 1], current + 1).id : "";
  if (previousWorld) elements.room.dataset.previousWorld = previousWorld;
  else delete elements.room.dataset.previousWorld;
  if (nextWorld) elements.room.dataset.nextWorld = nextWorld;
  else delete elements.room.dataset.nextWorld;
  elements.roomWorld.textContent = world.label;
  if (!elements.eyePanel.hidden) describeCurrentPodium();
  elements.currentIndex.textContent = `${String(current + 1).padStart(2, "0")} / ${String(works.length).padStart(2, "0")}`;
  elements.title.textContent = displayTitle(work);
  elements.meta.textContent = `${formatKind(work)}  ·  ${formatSize(work.file.size)}`;
  elements.description.textContent = work.description || "";
  elements.description.hidden = !work.description;
  const postedAt = new Date(Number(work.createdAt));
  elements.postedDate.dateTime = Number.isNaN(postedAt.getTime()) ? "" : postedAt.toISOString();
  elements.postedDate.textContent = `POSTED ${formatPostedDate(work)}`;
  elements.postedDate.hidden = false;
  if (current > 0) elements.stage.append(createPodium(works[current - 1], current - 1, "left"));
  elements.stage.append(createPodium(work, current, "center"));
  if (current < works.length - 1) elements.stage.append(createPodium(works[current + 1], current + 1, "right"));
}

function setCurrent(index) {
  if (index < 0 || index >= works.length || index === current) return;
  const walkDirection = index > current ? "next" : "previous";
  const previousWorld = worldForWork(works[current], current).id;
  const nextWorld = worldForWork(works[index], index).id;
  clearTimeout(walkTimer);
  elements.roomSignal.hidden = true;
  elements.room.classList.remove("room--no-signal");
  elements.room.classList.remove("room--walk-next", "room--walk-previous");
  current = index;
  render();
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    void elements.room.offsetWidth;
    elements.room.classList.add(`room--walk-${walkDirection}`);
    walkTimer = setTimeout(() => elements.room.classList.remove("room--walk-next", "room--walk-previous"), 650);
    if (previousWorld !== nextWorld) {
      elements.room.dataset.lastWorld = previousWorld;
      elements.room.classList.remove("room--scene-change");
      void elements.room.offsetWidth;
      elements.room.classList.add("room--scene-change");
    }
    elements.room.classList.remove("room--time-slip");
    void elements.room.offsetWidth;
    elements.room.classList.add("room--time-slip");
  }
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
      : displayTitle(work).toLocaleLowerCase().includes(normalized) || work.name.toLocaleLowerCase().includes(normalized) || (work.description || "").toLocaleLowerCase().includes(normalized) || formatKind(work).toLocaleLowerCase().includes(normalized));
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

function addFiles(fileList) {
  if (!isCurator) return;
  const files = Array.from(fileList);
  if (!files.length) return;
  openWorkEditor(files.map((file) => ({ file })), "add");
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
    const artworkUrl = artworkUrls.get(work.id);
    if (artworkUrl) URL.revokeObjectURL(artworkUrl);
    artworkUrls.delete(work.id);
    works.splice(current, 1);
    current = Math.min(current, works.length - 1);
    render();
    showToast("Work removed from your room.");
  } catch (error) {
    console.error("Could not remove the selected work.", error);
    showToast("This work could not be removed.");
  }
}

function editCurrent() {
  if (!isCurator) return;
  const work = works[current];
  if (!work) return;
  openWorkEditor([{ file: work.file, work }], "edit");
}

function addVideoLink(event) {
  event.preventDefault();
  const videoLink = parseVideoLink(elements.linkInput.value);
  if (!videoLink) {
    elements.linkError.textContent = "Paste a secure YouTube or TikTok video link.";
    elements.linkInput.focus();
    return;
  }
  elements.linkDialog.close();
  elements.linkInput.value = "";
  elements.linkError.textContent = "";
  const file = new File([], `${videoLink.provider} video link`, { type: "video/x-external" });
  openWorkEditor([{ file, videoUrl: videoLink.url, videoProvider: videoLink.provider }], "add");
}

function enterArchive() {
  elements.foyer.hidden = true;
  elements.archiveView.hidden = false;
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    elements.archiveView.classList.add("archive-view--entering");
    elements.archiveView.addEventListener("animationend", () => elements.archiveView.classList.remove("archive-view--entering"), { once: true });
  }
  document.body.classList.add("gallery-open");
  requestAnimationFrame(resizeImageFrames);
}

function returnToFoyer() {
  elements.archiveView.hidden = true;
  elements.foyer.hidden = false;
  document.body.classList.remove("gallery-open");
  elements.eyePanel.hidden = true;
  elements.eyeTrigger.setAttribute("aria-expanded", "false");
  elements.eyeMessage.textContent = "I can tell you about the podium you're standing by.";
}

function describeCurrentPodium() {
  const work = works[current];
  if (!work) {
    elements.eyeMessage.textContent = "There's no exhibit on this podium yet. It is waiting for someone to give it a story.";
    return;
  }
  const world = worldForWork(work, current);
  elements.eyeMessage.textContent = work.irisDialogue || (work.description
    ? `${displayTitle(work)}: ${work.description} It rests in ${world.label.toLocaleLowerCase()}.`
    : `${displayTitle(work)} is a ${formatKind(work).toLocaleLowerCase()} exhibit in ${world.label.toLocaleLowerCase()}. Its story is still waiting to be written.`);
}

function setCuratorMode(enabled) {
  isCurator = enabled;
  elements.addButton.hidden = !enabled;
  elements.addLinkButton.hidden = !enabled;
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
elements.addLinkButton.addEventListener("click", () => {
  if (!isCurator) return;
  elements.linkError.textContent = "";
  elements.linkDialog.showModal();
  elements.linkInput.focus();
});
elements.emptyAddButton.addEventListener("click", () => elements.fileInput.click());
elements.fileInput.addEventListener("change", async () => {
  await addFiles(elements.fileInput.files);
  elements.fileInput.value = "";
});
elements.previous.addEventListener("click", () => setCurrent(current - 1));
elements.next.addEventListener("click", () => setCurrent(current + 1));
elements.room.addEventListener("animationend", (event) => {
  if (event.animationName === "time-slip-streaks") elements.room.classList.remove("room--time-slip");
  if (event.animationName === "scene-echo-fade") {
    elements.room.classList.remove("room--scene-change");
    delete elements.room.dataset.lastWorld;
  }
});
elements.remove.addEventListener("click", removeCurrent);
elements.edit.addEventListener("click", editCurrent);
elements.workForm.addEventListener("submit", saveWorkEditor);
elements.closeWorkDialog.addEventListener("click", () => elements.workDialog.close());
elements.cancelWorkDialog.addEventListener("click", () => elements.workDialog.close());
elements.linkForm.addEventListener("submit", addVideoLink);
elements.closeLinkDialog.addEventListener("click", () => elements.linkDialog.close());
elements.cancelLinkDialog.addEventListener("click", () => elements.linkDialog.close());
elements.workDialog.addEventListener("close", () => {
  workEditorItems = [];
  elements.workFields.replaceChildren();
});
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
  if (willOpen) describeCurrentPodium();
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
document.addEventListener("keydown", moveFromKeyboard);
window.addEventListener("resize", resizeImageFrames);
document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-wrap")) elements.searchResults.hidden = true;
});
window.addEventListener("beforeunload", () => {
  for (const url of mediaUrls.values()) URL.revokeObjectURL(url);
  for (const url of artworkUrls.values()) URL.revokeObjectURL(url);
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
