const webview = document.getElementById("browserView");
const addressForm = document.getElementById("addressForm");
const addressInput = document.getElementById("addressInput");
const backButton = document.getElementById("backButton");
const forwardButton = document.getElementById("forwardButton");
const reloadButton = document.getElementById("reloadButton");
const homeButton = document.getElementById("homeButton");
const newTabButton = document.getElementById("newTabButton");
const tabTitle = document.getElementById("tabTitle");
const settingsButton = document.getElementById("settingsButton");
const closeSettingsButton = document.getElementById("closeSettingsButton");
const settingsPanel = document.getElementById("settingsPanel");
const menuButton = document.getElementById("menuButton");
const productMenu = document.getElementById("productMenu");
const menuHomeButton = document.getElementById("menuHomeButton");
const menuSettingsButton = document.getElementById("menuSettingsButton");
const menuDestroyButton = document.getElementById("menuDestroyButton");
const destroySessionButton = document.getElementById("destroySessionButton");
const searchEngineSelect = document.getElementById("searchEngineSelect");

const fallbackHomeUrl = new URL("home.html", window.location.href).href;
const homeUrl = window.itera?.homeUrl || fallbackHomeUrl;
const homeFileUrl = homeUrl.startsWith("file:") ? homeUrl : `file:///${homeUrl.replace(/\\/g, "/")}`;
let searchEngine = "duckduckgo";

webview.partition = window.itera?.partition || `itera-${crypto.randomUUID()}`;
webview.src = homeFileUrl;

addressForm.addEventListener("submit", (event) => {
  event.preventDefault();
  navigate(addressInput.value);
});

backButton.addEventListener("click", () => {
  if (webview.canGoBack()) {
    webview.goBack();
  }
});

forwardButton.addEventListener("click", () => {
  if (webview.canGoForward()) {
    webview.goForward();
  }
});

reloadButton.addEventListener("click", () => {
  webview.reload();
});

homeButton.addEventListener("click", openHome);
newTabButton.addEventListener("click", openHome);
menuHomeButton.addEventListener("click", () => {
  openHome();
  closeMenu();
});

settingsButton.addEventListener("click", () => {
  closeMenu();
  openSettings();
});

closeSettingsButton.addEventListener("click", closeSettings);
menuButton.addEventListener("click", toggleMenu);
menuSettingsButton.addEventListener("click", () => {
  closeMenu();
  openSettings();
});

destroySessionButton.addEventListener("click", destroySession);
menuDestroyButton.addEventListener("click", destroySession);
searchEngineSelect.addEventListener("change", () => {
  searchEngine = searchEngineSelect.value;
});

webview.addEventListener("did-navigate", updateLocation);
webview.addEventListener("did-navigate-in-page", updateLocation);
webview.addEventListener("did-finish-load", updateLocation);
webview.addEventListener("page-title-updated", (event) => {
  document.title = event.title ? `${event.title} - Itera` : "Itera";
  tabTitle.textContent = event.title || "New identity";
});

webview.addEventListener("new-window", (event) => {
  if (event.url) {
    navigate(event.url);
  }
});

window.itera?.onOpenUrl((url) => navigate(url));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSettings();
    closeMenu();
  }
});

document.addEventListener("pointerdown", (event) => {
  if (!productMenu.contains(event.target) && !menuButton.contains(event.target)) {
    closeMenu();
  }
});

function navigate(rawValue) {
  const target = normalizeAddress(rawValue);
  if (target) {
    webview.src = target;
  }
}

function normalizeAddress(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return homeFileUrl;
  }

  if (/^(https?|file|about):/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.includes(".") && !trimmed.includes(" ")) {
    return `https://${trimmed}`;
  }

  const query = encodeURIComponent(trimmed);
  if (searchEngine === "startpage") {
    return `https://www.startpage.com/sp/search?query=${query}`;
  }
  if (searchEngine === "brave") {
    return `https://search.brave.com/search?q=${query}`;
  }
  return `https://duckduckgo.com/?q=${query}`;
}

function updateLocation() {
  const currentUrl = webview.getURL();
  addressInput.value = currentUrl === homeFileUrl ? "" : currentUrl;
  backButton.disabled = !webview.canGoBack();
  forwardButton.disabled = !webview.canGoForward();
  if (currentUrl === homeFileUrl) {
    tabTitle.textContent = "New identity";
  }
}

function openHome() {
  webview.src = homeFileUrl;
}

function openSettings() {
  settingsPanel.classList.add("open");
  settingsPanel.setAttribute("aria-hidden", "false");
}

function closeSettings() {
  settingsPanel.classList.remove("open");
  settingsPanel.setAttribute("aria-hidden", "true");
}

function toggleMenu() {
  productMenu.classList.toggle("open");
  productMenu.setAttribute("aria-hidden", productMenu.classList.contains("open") ? "false" : "true");
}

function closeMenu() {
  productMenu.classList.remove("open");
  productMenu.setAttribute("aria-hidden", "true");
}

function destroySession() {
  window.itera?.closeWindow();
}
