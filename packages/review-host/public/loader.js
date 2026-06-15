(function () {
  "use strict";

  // Ported from the original mal-ai-chat mock loader. This is the shape a real
  // CMS/WordPress plugin would inject on the customer's site: a floating
  // launcher plus a sandboxed iframe panel hosting the widget. The host page and
  // widget exchange only protocol-level postMessages — never message content.
  // The only change from the original is the default widget URL (the review
  // widget serves the WidgetApp at its root, on port 5175).

  var widgetUrl =
    window.malChatConfig && window.malChatConfig.widgetUrl
      ? window.malChatConfig.widgetUrl
      : "http://127.0.0.1:5175";

  var widgetOrigin;
  try {
    widgetOrigin = new URL(widgetUrl).origin;
  } catch (e) {
    widgetOrigin = widgetUrl;
  }

  var isOpen = false;
  var storedContext = null;
  var demoStateEl = null;
  var launcher, panel, iframe, frost;

  var CHAT_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:26px;height:26px;fill:white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
  var CLOSE_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:26px;height:26px;fill:white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

  function injectStyles() {
    var s = document.createElement("style");
    s.textContent =
      "#mal-launcher{" +
      "position:fixed;bottom:24px;right:24px;" +
      "width:60px;height:60px;border-radius:50%;" +
      "background:#1a8787;border:none;cursor:pointer;" +
      "box-shadow:0 4px 20px rgba(0,0,0,.28);" +
      "z-index:9999;display:none;" +
      "align-items:center;justify-content:center;" +
      "transition:transform .18s,opacity .18s;" +
      "}" +
      "#mal-launcher:hover{transform:scale(1.08);}" +
      "#mal-launcher:focus-visible{outline:3px solid #f0a040;outline-offset:3px;}" +
      "#mal-panel{" +
      "position:fixed;bottom:96px;right:24px;" +
      "width:500px;height:700px;" +
      "max-width:calc(100vw - 32px);max-height:calc(100vh - 120px);" +
      "border-radius:16px;overflow:hidden;" +
      "box-shadow:0 8px 40px rgba(0,0,0,.22);" +
      "z-index:9998;display:none;" +
      "transition:opacity .15s;" +
      "}" +
      "#mal-panel iframe{width:100%;height:100%;border:none;display:block;}" +
      // Mild frost over everything except the widget panel and launcher (both
      // sit above this). Pulls the eye onto the chat and away from the phone
      // numbers; clicking it closes the panel.
      "#mal-frost{" +
      "position:fixed;inset:0;z-index:9997;" +
      "background:rgba(244,247,246,.35);" +
      "backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);" +
      "opacity:0;pointer-events:none;" +
      "transition:opacity .18s ease;" +
      "}" +
      "#mal-frost.is-visible{opacity:1;pointer-events:auto;}";
    document.head.appendChild(s);
  }

  function createLauncher() {
    launcher = document.createElement("button");
    launcher.id = "mal-launcher";
    launcher.setAttribute("aria-label", "Open LoanSlam chat");
    launcher.setAttribute("aria-expanded", "false");
    launcher.innerHTML = CHAT_ICON;
    launcher.addEventListener("click", togglePanel);
    document.body.appendChild(launcher);
  }

  function createPanel() {
    panel = document.createElement("div");
    panel.id = "mal-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "LoanSlam Chat Widget");

    iframe = document.createElement("iframe");
    iframe.src = widgetUrl;
    iframe.title = "LoanSlam Chat Widget";
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms",
    );

    panel.appendChild(iframe);
    document.body.appendChild(panel);
  }

  function openPanel() {
    isOpen = true;
    panel.style.display = "flex";
    if (frost) frost.classList.add("is-visible");
    // Highlights belong to the closed state: clear any reveal while the widget
    // is open so the eye stays on the conversation, not the phone numbers.
    var openSection = document.getElementById("contact-section");
    if (openSection) openSection.removeAttribute("data-revealed");
    updateDemoState();
    launcher.setAttribute("aria-label", "Close LoanSlam chat");
    launcher.setAttribute("aria-expanded", "true");
    launcher.innerHTML = CLOSE_ICON;
    iframe.contentWindow.postMessage({ type: "open" }, widgetOrigin);
  }

  function closePanel() {
    isOpen = false;
    panel.style.display = "none";
    if (frost) frost.classList.remove("is-visible");
    launcher.setAttribute("aria-label", "Open LoanSlam chat");
    launcher.setAttribute("aria-expanded", "false");
    launcher.innerHTML = CHAT_ICON;
    iframe.contentWindow.postMessage({ type: "close" }, widgetOrigin);
    // Re-apply on close and scroll so the promoted contact block is in view.
    if (storedContext !== null) {
      applyContext(storedContext);
      var contactSection = document.getElementById("contact-section");
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  function togglePanel() {
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function applyContext(context) {
    var section = document.getElementById("contact-section");
    if (section) section.setAttribute("data-revealed", context);
    updateDemoState();
  }

  function resetContext() {
    storedContext = null;
    var section = document.getElementById("contact-section");
    if (section) section.removeAttribute("data-revealed");
    updateDemoState();
  }

  function updateDemoState() {
    if (!demoStateEl) return;
    var section = document.getElementById("contact-section");
    var ctx = section ? section.getAttribute("data-revealed") : null;
    demoStateEl.textContent = "State: " + (ctx || "idle");
  }

  function onMessage(event) {
    if (event.origin !== widgetOrigin) return;
    var msg = event.data;
    if (!msg || typeof msg.type !== "string") return;

    // When this page is itself embedded (dev lab), the lab may post example
    // prompts; forward them down into the widget iframe and stop there.
    if (window.parent !== window && event.source === window.parent) {
      if (msg.type === "example") {
        if (!isOpen) openPanel();
        iframe.contentWindow.postMessage(msg, widgetOrigin);
      }
      return;
    }

    if (msg.type === "ready") {
      launcher.style.display = "flex";
      openPanel();
    } else if (msg.type === "close-requested") {
      closePanel();
    } else if (msg.type === "skip-to-contacts") {
      closePanel();
      var target = document.getElementById("contact-section");
      if (target) target.scrollIntoView({ behavior: "smooth" });
    } else if (
      msg.type === "session-context" &&
      typeof msg.context === "string"
    ) {
      var VALID_CONTEXTS = ["vulnerability", "handoff", "general"];
      if (VALID_CONTEXTS.indexOf(msg.context) !== -1) {
        storedContext = msg.context;
        // Only reveal the matching contact block when the widget is closed;
        // while it's open the page stays frosted and un-highlighted. The stored
        // context is applied on close.
        if (!isOpen) {
          applyContext(msg.context);
        }
      }
    }

    // Relay widget signals one level up when embedded so a dev lab's trace and
    // console stay live through the real embed path. Payloads carry only
    // protocol types and correlation ids — no message content.
    if (window.parent !== window) {
      window.parent.postMessage(msg, "*");
    }
  }

  function createDemoControls() {
    var params = new URLSearchParams(location.search);
    if (params.get("demo") !== "true") return;

    var ctrl = document.createElement("div");
    ctrl.id = "mal-demo-controls";

    var title = document.createElement("p");
    title.textContent = "Demo controls";
    ctrl.appendChild(title);

    var stateEl = document.createElement("div");
    stateEl.className = "demo-state";
    stateEl.textContent = "State: idle";
    ctrl.appendChild(stateEl);

    function makeButton(label, onClick) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.addEventListener("click", onClick);
      ctrl.appendChild(btn);
      return btn;
    }

    makeButton("Simulate: vulnerable", function () {
      storedContext = "vulnerability";
      applyContext("vulnerability");
    });
    makeButton("Simulate: handoff", function () {
      storedContext = "handoff";
      applyContext("handoff");
    });
    makeButton("Simulate: general", function () {
      storedContext = "general";
      applyContext("general");
    });
    makeButton("Reset", function () {
      resetContext();
    });

    document.body.appendChild(ctrl);
    demoStateEl = stateEl;
  }

  function createFrost() {
    frost = document.createElement("div");
    frost.id = "mal-frost";
    frost.addEventListener("click", closePanel);
    document.body.appendChild(frost);
  }

  function init() {
    injectStyles();
    createFrost();
    createLauncher();
    createPanel();
    window.addEventListener("message", onMessage);
    createDemoControls();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
