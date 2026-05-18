const webview = document.getElementById("browserView");
const addressForm = document.getElementById("addressForm");
const addressInput = document.getElementById("addressInput");
const backButton = document.getElementById("backButton");
const forwardButton = document.getElementById("forwardButton");
const reloadButton = document.getElementById("reloadButton");

const homeUrl = window.itera?.homeUrl || "about:blank";

webview.partition = window.itera?.partition || `itera-${crypto.randomUUID()}`;
webview.src = homeUrl;

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

webview.addEventListener("did-navigate", updateLocation);
webview.addEventListener("did-navigate-in-page", updateLocation);
webview.addEventListener("did-finish-load", updateLocation);
webview.addEventListener("page-title-updated", (event) => {
  document.title = event.title ? `${event.title} - Itera` : "Itera";
});

webview.addEventListener("new-window", (event) => {
  if (event.url) {
    navigate(event.url);
  }
});

window.itera?.onOpenUrl((url) => navigate(url));

function navigate(rawValue) {
  const target = normalizeAddress(rawValue);
  if (target) {
    webview.src = target;
  }
}

function normalizeAddress(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return homeUrl;
  }

  if (/^(https?|file|about):/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.includes(".") && !trimmed.includes(" ")) {
    return `https://${trimmed}`;
  }

  return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
}

function updateLocation() {
  const currentUrl = webview.getURL();
  addressInput.value = currentUrl === homeUrl ? "" : currentUrl;
  backButton.disabled = !webview.canGoBack();
  forwardButton.disabled = !webview.canGoForward();
}
