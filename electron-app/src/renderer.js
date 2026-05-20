const browserShell = document.querySelector(".browser-shell");
const tabsList = document.getElementById("tabsList");
const viewStack = document.getElementById("viewStack");
const addressForm = document.getElementById("addressForm");
const addressInput = document.getElementById("addressInput");
const backButton = document.getElementById("backButton");
const forwardButton = document.getElementById("forwardButton");
const reloadButton = document.getElementById("reloadButton");
const homeButton = document.getElementById("homeButton");
const newTabButton = document.getElementById("newTabButton");
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
const sharedPartition = window.itera?.partition || `itera-${crypto.randomUUID()}`;

let searchEngine = "duckduckgo";
let activeTabId = null;
let nextTabId = 1;
const tabs = new Map();
const tabDrag = {
  id: null,
  pointerId: null,
  startX: 0,
  currentX: 0,
  dragging: false
};

addressForm.addEventListener("submit", (event) => {
  event.preventDefault();
  navigate(addressInput.value);
});

backButton.addEventListener("click", () => {
  const activeView = getActiveWebview();
  if (activeView?.canGoBack()) {
    activeView.goBack();
  }
});

forwardButton.addEventListener("click", () => {
  const activeView = getActiveWebview();
  if (activeView?.canGoForward()) {
    activeView.goForward();
  }
});

reloadButton.addEventListener("click", () => {
  getActiveWebview()?.reload();
});

homeButton.addEventListener("click", openHome);
newTabButton.addEventListener("click", () => createTab(homeFileUrl, { activate: true }));
menuHomeButton.addEventListener("click", () => {
  createTab(homeFileUrl, { activate: true });
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

wireDestroyButton(destroySessionButton);
wireDestroyButton(menuDestroyButton);
searchEngineSelect.addEventListener("change", () => {
  searchEngine = searchEngineSelect.value;
});

window.itera?.onOpenUrl((url) => createTab(url, { activate: true }));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSettings();
    closeMenu();
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === "l") {
    event.preventDefault();
    addressInput.select();
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === "t") {
    event.preventDefault();
    createTab(homeFileUrl, { activate: true });
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === "w") {
    event.preventDefault();
    closeTab(activeTabId);
  }
});

document.addEventListener("pointerdown", (event) => {
  if (!productMenu.contains(event.target) && !menuButton.contains(event.target)) {
    closeMenu();
  }
});

createTab(homeFileUrl, { activate: true });

function createTab(url = homeFileUrl, options = {}) {
  const id = `tab-${nextTabId}`;
  nextTabId += 1;

  const tabButton = document.createElement("div");
  tabButton.className = "tab";
  tabButton.setAttribute("role", "tab");
  tabButton.setAttribute("aria-selected", "false");
  tabButton.tabIndex = 0;
  tabButton.dataset.tabId = id;
  tabButton.innerHTML = `
    <img src="../assets/logo.svg" alt="">
    <span>New identity</span>
    <button class="tab-close" type="button" title="Close tab" aria-label="Close tab">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>
    </button>
  `;

  const titleElement = tabButton.querySelector("span");
  const closeButton = tabButton.querySelector(".tab-close");
  tabButton.addEventListener("pointerdown", (event) => beginTabPointer(event, id));
  tabButton.addEventListener("click", (event) => {
    if (tabButton.dataset.skipClick === "true") {
      event.preventDefault();
      delete tabButton.dataset.skipClick;
      return;
    }
    activateTab(id);
  });
  tabButton.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateTab(id);
    }
  });
  closeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    closeTab(id);
  });

  const webview = document.createElement("webview");
  webview.setAttribute("allowpopups", "");
  webview.partition = sharedPartition;
  webview.src = url;
  webview.dataset.tabId = id;

  const tab = {
    id,
    title: "New identity",
    url,
    loading: true,
    tabButton,
    titleElement,
    webview
  };

  tabs.set(id, tab);
  tabsList.appendChild(tabButton);
  viewStack.appendChild(webview);
  wireWebview(tab);

  if (options.activate !== false) {
    activateTab(id);
  } else {
    renderTab(tab);
  }

  return tab;
}

function wireWebview(tab) {
  tab.webview.addEventListener("did-start-loading", () => {
    tab.loading = true;
    renderTab(tab);
    updateActiveControls();
  });

  tab.webview.addEventListener("did-stop-loading", () => {
    tab.loading = false;
    renderTab(tab);
    updateActiveControls();
  });

  tab.webview.addEventListener("did-navigate", () => updateTabLocation(tab));
  tab.webview.addEventListener("did-navigate-in-page", () => updateTabLocation(tab));
  tab.webview.addEventListener("did-finish-load", () => updateTabLocation(tab));

  tab.webview.addEventListener("page-title-updated", (event) => {
    tab.title = cleanTitle(event.title);
    renderTab(tab);
    updateWindowTitle();
  });

}

function activateTab(id) {
  if (!tabs.has(id)) {
    return;
  }

  activeTabId = id;
  for (const tab of tabs.values()) {
    const active = tab.id === activeTabId;
    tab.tabButton.classList.toggle("active", active);
    tab.tabButton.setAttribute("aria-selected", active ? "true" : "false");
    tab.webview.classList.toggle("active", active);
    renderTab(tab);
  }

  closeSettings();
  closeMenu();
  updateActiveControls();
  updateWindowTitle();
}

function beginTabPointer(event, id) {
  if (event.button !== 0 || event.target.closest(".tab-close")) {
    return;
  }

  const tab = tabs.get(id);
  if (!tab) {
    return;
  }

  activateTab(id);
  tabDrag.id = id;
  tabDrag.pointerId = event.pointerId;
  tabDrag.startX = event.clientX;
  tabDrag.currentX = event.clientX;
  tabDrag.dragging = false;

  tab.tabButton.setPointerCapture(event.pointerId);
  tab.tabButton.addEventListener("pointermove", moveTabPointer);
  tab.tabButton.addEventListener("pointerup", endTabPointer);
  tab.tabButton.addEventListener("pointercancel", endTabPointer);
}

function moveTabPointer(event) {
  if (event.pointerId !== tabDrag.pointerId || !tabDrag.id) {
    return;
  }

  const tab = tabs.get(tabDrag.id);
  if (!tab) {
    return;
  }

  tabDrag.currentX = event.clientX;
  const deltaX = event.clientX - tabDrag.startX;

  if (!tabDrag.dragging && Math.abs(deltaX) < 6) {
    return;
  }

  if (!tabDrag.dragging) {
    tabDrag.dragging = true;
    tab.tabButton.classList.add("dragging");
    tabsList.classList.add("reordering");
  }

  tab.tabButton.style.transform = `translateX(${deltaX}px)`;
  reorderDraggedTab(tab);
}

function endTabPointer(event) {
  if (event.pointerId !== tabDrag.pointerId || !tabDrag.id) {
    return;
  }

  const tab = tabs.get(tabDrag.id);
  if (tab) {
    tab.tabButton.releasePointerCapture(event.pointerId);
    tab.tabButton.removeEventListener("pointermove", moveTabPointer);
    tab.tabButton.removeEventListener("pointerup", endTabPointer);
    tab.tabButton.removeEventListener("pointercancel", endTabPointer);
    tab.tabButton.classList.remove("dragging");
    tab.tabButton.style.transform = "";

    if (tabDrag.dragging) {
      tab.tabButton.dataset.skipClick = "true";
    }
  }

  tabsList.classList.remove("reordering");
  tabDrag.id = null;
  tabDrag.pointerId = null;
  tabDrag.dragging = false;
}

function reorderDraggedTab(tab) {
  const draggedCenter = tabDrag.currentX;
  const siblings = Array.from(tabsList.querySelectorAll(".tab:not(.dragging)"));
  const nextSibling = siblings.find((item) => draggedCenter < item.getBoundingClientRect().left + item.offsetWidth / 2);

  if (nextSibling) {
    tabsList.insertBefore(tab.tabButton, nextSibling);
  } else {
    tabsList.appendChild(tab.tabButton);
  }

  syncTabOrderFromDom();
}

function syncTabOrderFromDom() {
  const orderedIds = Array.from(tabsList.querySelectorAll(".tab"))
    .map((item) => item.dataset.tabId)
    .filter((id) => tabs.has(id));
  const orderedTabs = orderedIds.map((id) => [id, tabs.get(id)]);

  tabs.clear();
  for (const [id, tab] of orderedTabs) {
    tabs.set(id, tab);
  }
}

function closeTab(id) {
  const tab = tabs.get(id);
  if (!tab) {
    return;
  }

  const orderedTabs = Array.from(tabs.keys());
  const closedIndex = orderedTabs.indexOf(id);
  tab.webview.remove();
  tab.tabButton.remove();
  tabs.delete(id);

  if (tabs.size === 0) {
    createTab(homeFileUrl, { activate: true });
    return;
  }

  if (activeTabId === id) {
    const nextActiveId = orderedTabs[closedIndex + 1] || orderedTabs[closedIndex - 1] || Array.from(tabs.keys())[0];
    activateTab(nextActiveId);
    return;
  }

  updateActiveControls();
}

function navigate(rawValue) {
  const activeView = getActiveWebview();
  const target = normalizeAddress(rawValue);
  if (activeView && target) {
    activeView.src = target;
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

function updateTabLocation(tab) {
  const currentUrl = tab.webview.getURL();
  tab.url = currentUrl;
  if (currentUrl === homeFileUrl) {
    tab.title = "New identity";
  }
  renderTab(tab);
  updateActiveControls();
}

function updateActiveControls() {
  const activeTab = getActiveTab();
  const activeView = activeTab?.webview;
  const currentUrl = activeView?.getURL() || activeTab?.url || homeFileUrl;

  addressInput.value = currentUrl === homeFileUrl ? "" : currentUrl;
  backButton.disabled = !activeView?.canGoBack();
  forwardButton.disabled = !activeView?.canGoForward();
  reloadButton.disabled = !activeView;
}

function renderTab(tab) {
  tab.tabButton.classList.toggle("loading", tab.loading);
  tab.titleElement.textContent = tab.title || "New identity";
  tab.tabButton.title = tab.title || "New identity";
}

function updateWindowTitle() {
  const title = getActiveTab()?.title || "Itera";
  document.title = title && title !== "New identity" ? `${title} - Itera` : "Itera";
}

function openHome() {
  navigate(homeFileUrl);
}

function getActiveTab() {
  return activeTabId ? tabs.get(activeTabId) : null;
}

function getActiveWebview() {
  return getActiveTab()?.webview || null;
}

function cleanTitle(title) {
  const trimmed = String(title || "").trim();
  return trimmed || "New identity";
}

function openSettings() {
  browserShell.classList.add("settings-open");
  settingsPanel.classList.add("open");
  settingsPanel.setAttribute("aria-hidden", "false");
}

function closeSettings() {
  browserShell.classList.remove("settings-open");
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

function wireDestroyButton(button) {
  button.addEventListener("pointerup", destroySession);
  button.addEventListener("click", destroySession);
}

async function destroySession(event) {
  event?.preventDefault();
  event?.stopPropagation();

  destroySessionButton.disabled = true;
  menuDestroyButton.disabled = true;
  destroySessionButton.textContent = "Destroying...";
  menuDestroyButton.textContent = "Destroying...";

  if (window.itera?.destroySession) {
    await window.itera.destroySession();
    return;
  }

  window.close();
}
