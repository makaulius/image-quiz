/* global fetch */

const THEME_TITLES_LT = {
  "american-muscle": "Amerikietiški automobiliai",
  architektura: "Architektūra",
  kedai: "Kedai",
  "lietuvos-grybai": "Lietuvos grybai",
  "lietuvos-herbai": "Lietuvos herbai",
  "lietuvos-zuvys": "Lietuvos žuvys",
  orkestras: "Orkestras",
  "sunu-veisles": "Šunų veislės",
};

const collator = new Intl.Collator("lt", { sensitivity: "base" });

function getThemeTitle(themeId) {
  return THEME_TITLES_LT[themeId] ?? themeId;
}

function fileBaseName(filename) {
  return filename.replace(/\.[^/.]+$/, "");
}

function themeImageUrl(themeId, filename) {
  // Keep slashes but encode spaces/diacritics.
  return encodeURI(`assets/themes/${themeId}/${filename}`);
}

function scrollToContentTopOffset(offsetPx = 100) {
  const contentEl = document.querySelector(".content");
  if (!contentEl) return;

  const y = contentEl.getBoundingClientRect().top + window.scrollY - offsetPx;
  window.scrollTo(0, Math.max(0, y));
}

async function loadThemeManifest() {
  const candidates = ["./assets/themes/manifest.json", "/api/learn/themes"];
  let lastError = null;

  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`${url} -> ${res.status}`);
      }

      const data = await res.json();
      if (!data || typeof data !== "object" || !data.themes || typeof data.themes !== "object") {
        throw new Error(`Invalid manifest shape from ${url}`);
      }

      return data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("Nepavyko užkrauti temų");
}

function setLoading(galleryEl, themeTitleEl, message) {
  themeTitleEl.textContent = "";
  galleryEl.textContent = message;
}

function clearGallery(galleryEl, themeTitleEl) {
  themeTitleEl.textContent = "";
  galleryEl.replaceChildren();
}

function renderThemeSelect({ themeIds, selectEl }) {
  selectEl.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Pasirinkite temą";
  placeholder.disabled = true;
  placeholder.selected = true;
  selectEl.appendChild(placeholder);

  for (const themeId of themeIds) {
    const opt = document.createElement("option");
    opt.value = themeId;
    opt.textContent = getThemeTitle(themeId);
    selectEl.appendChild(opt);
  }
}

function renderGallery({ themeId, files, galleryEl, themeTitleEl }) {
  themeTitleEl.textContent = getThemeTitle(themeId);
  galleryEl.replaceChildren();

  const items = (Array.isArray(files) ? [...files] : [])
    .filter((f) => typeof f === "string" && f.length > 0)
    .map((filename) => ({ filename, name: fileBaseName(filename) }));

  items.sort((a, b) => collator.compare(a.name, b.name));

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Šioje temoje nerasta paveikslėlių.";
    galleryEl.appendChild(empty);
    return;
  }

  for (const item of items) {
    const figure = document.createElement("figure");
    figure.className = "card";

    const img = document.createElement("img");
    img.loading = "lazy";
    img.alt = item.name;
    img.src = themeImageUrl(themeId, item.filename);

    const caption = document.createElement("figcaption");
    caption.textContent = item.name;

    figure.appendChild(img);
    figure.appendChild(caption);
    galleryEl.appendChild(figure);
  }
}

async function initLearnPage() {
  const selectEl = document.getElementById("themeSelect");
  const themeTitleEl = document.getElementById("themeTitle");
  const galleryEl = document.getElementById("gallery");

  if (!selectEl || !themeTitleEl || !galleryEl) return;

  // Start with no selection and show nothing.
  clearGallery(galleryEl, themeTitleEl);

  try {
    const manifest = await loadThemeManifest();
    const themes = manifest.themes;

    const themeIds = Object.keys(themes).sort((a, b) =>
      collator.compare(getThemeTitle(a), getThemeTitle(b)),
    );

    if (themeIds.length === 0) {
      // Keep empty page if nothing is available.
      return;
    }

    renderThemeSelect({ themeIds, selectEl });

    selectEl.addEventListener("change", () => {
      const themeId = selectEl.value;
      if (!themeId) {
        clearGallery(galleryEl, themeTitleEl);
        return;
      }
      renderGallery({ themeId, files: themes[themeId], galleryEl, themeTitleEl });
      scrollToContentTopOffset(80);
    });
  } catch (err) {
    // Keep empty UI on failure.
    // Keep details in console for debugging.
    console.error(err);
  }
}

initLearnPage();
