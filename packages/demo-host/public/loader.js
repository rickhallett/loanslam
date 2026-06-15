(function () {
  "use strict";

  // Vanilla embed loader. This is the shape a real CMS plugin would inject on
  // the customer's site: a floating launcher plus a sandboxed iframe panel that
  // hosts the widget. The host page and widget only exchange protocol-level
  // postMessages — never message content.

  var config = window.loanslamChatConfig || {};
  var widgetUrl = config.widgetUrl || "http://127.0.0.1:5174";

  var widgetOrigin;
  try {
    widgetOrigin = new URL(widgetUrl).origin;
  } catch (error) {
    widgetOrigin = widgetUrl;
  }

  var isOpen = false;
  var launcher;
  var panel;
  var iframe;

  var CHAT_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:26px;height:26px;fill:#fff"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
  var CLOSE_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:26px;height:26px;fill:#fff"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

  function injectStyles() {
    var style = document.createElement("style");
    style.textContent =
      "#ls-launcher{position:fixed;bottom:24px;right:24px;width:60px;height:60px;" +
      "border-radius:50%;background:#4f46e5;border:none;cursor:pointer;" +
      "box-shadow:0 8px 24px rgba(79,70,229,.4);z-index:9999;display:none;" +
      "align-items:center;justify-content:center;transition:transform .18s;}" +
      "#ls-launcher:hover{transform:scale(1.08);}" +
      "#ls-launcher:focus-visible{outline:3px solid #f43f5e;outline-offset:3px;}" +
      "#ls-panel{position:fixed;bottom:96px;right:24px;width:400px;max-width:calc(100vw - 32px);" +
      "height:620px;max-height:calc(100vh - 128px);border-radius:18px;overflow:hidden;" +
      "box-shadow:0 16px 50px rgba(15,23,42,.28);z-index:9998;display:none;}" +
      "#ls-panel iframe{width:100%;height:100%;border:none;display:block;}";
    document.head.appendChild(style);
  }

  function createLauncher() {
    launcher = document.createElement("button");
    launcher.id = "ls-launcher";
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Open the LoanSlam assistant");
    launcher.setAttribute("aria-expanded", "false");
    launcher.innerHTML = CHAT_ICON;
    launcher.addEventListener("click", togglePanel);
    document.body.appendChild(launcher);
  }

  function createPanel() {
    panel = document.createElement("div");
    panel.id = "ls-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "LoanSlam assistant");

    iframe = document.createElement("iframe");
    iframe.src = widgetUrl;
    iframe.title = "LoanSlam assistant";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");

    panel.appendChild(iframe);
    document.body.appendChild(panel);
  }

  function postToWidget(message) {
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(message, widgetOrigin);
    }
  }

  function openPanel() {
    isOpen = true;
    panel.style.display = "block";
    launcher.setAttribute("aria-label", "Close the LoanSlam assistant");
    launcher.setAttribute("aria-expanded", "true");
    launcher.innerHTML = CLOSE_ICON;
    postToWidget({ type: "open" });
  }

  function closePanel() {
    isOpen = false;
    panel.style.display = "none";
    launcher.setAttribute("aria-label", "Open the LoanSlam assistant");
    launcher.setAttribute("aria-expanded", "false");
    launcher.innerHTML = CHAT_ICON;
    postToWidget({ type: "close" });
  }

  function togglePanel() {
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function scrollToContacts() {
    var section = document.getElementById("ls-contact-section");
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function revealContext(context) {
    var valid = ["vulnerability", "handoff", "general"];
    if (valid.indexOf(context) === -1) {
      return;
    }
    var section = document.getElementById("ls-contact-section");
    if (section) {
      section.setAttribute("data-revealed", context);
    }
  }

  function onMessage(event) {
    if (event.origin !== widgetOrigin) {
      return;
    }
    var message = event.data;
    if (!message || typeof message.type !== "string") {
      return;
    }

    if (message.type === "ready") {
      launcher.style.display = "flex";
      openPanel();
    } else if (message.type === "close-requested") {
      closePanel();
    } else if (message.type === "skip-to-contacts") {
      closePanel();
      scrollToContacts();
    } else if (
      message.type === "session-context" &&
      typeof message.context === "string"
    ) {
      revealContext(message.context);
    }
  }

  function init() {
    injectStyles();
    createLauncher();
    createPanel();
    window.addEventListener("message", onMessage);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
