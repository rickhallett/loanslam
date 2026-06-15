(function () {
  "use strict";

  // Engine-internals panel for the review mock page. Renders an abstract state
  // machine that lights up as the bot routes each turn, so a reviewer watching
  // only the widget UI can also see what the engine is doing on the inside.
  //
  // Opt-in: only mounts when the page URL carries ?devtools=true, so the clean
  // customer-site demo is never cluttered. The panel is fed by the widget's
  // content-free `turn-telemetry` postMessage (the same iframe boundary the
  // coarse session-context already crosses) — decision metadata only, never the
  // customer's words, the assistant copy, or any collected PII.

  var params = new URLSearchParams(location.search);
  var DEBUG = true;
  if (DEBUG) {
    console.log(
      "[sm-devtools] script ran; devtools param =",
      JSON.stringify(params.get("devtools")),
    );
  }
  if (params.get("devtools") !== "true") {
    if (DEBUG) {
      console.warn(
        "[sm-devtools] INACTIVE — the panel only mounts when the page URL has ?devtools=true",
      );
    }
    return;
  }

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

  // ── Static graph layout (viewBox 0 0 860 900) ────────────────────────────
  var EDGES = [
    { id: "in-ret", x1: 430, y1: 74, x2: 221, y2: 132 },
    { id: "in-sig", x1: 430, y1: 74, x2: 639, y2: 132 },
    { id: "ret-plan", x1: 221, y1: 198, x2: 430, y2: 262 },
    { id: "sig-plan", x1: 639, y1: 198, x2: 430, y2: 262 },
    { id: "plan-val", x1: 430, y1: 328, x2: 430, y2: 388 },
    { id: "val-disp", x1: 430, y1: 556, x2: 430, y2: 590 },
    { id: "disp-answer", x1: 430, y1: 656, x2: 74, y2: 724 },
    { id: "disp-clarify", x1: 430, y1: 656, x2: 214, y2: 724 },
    { id: "disp-intake", x1: 430, y1: 656, x2: 354, y2: 724 },
    { id: "disp-ticket", x1: 430, y1: 656, x2: 494, y2: 724 },
    { id: "disp-refuse", x1: 430, y1: 656, x2: 634, y2: 724 },
    { id: "disp-fallback", x1: 430, y1: 656, x2: 774, y2: 724 },
  ];

  var GUARD_W = 170;
  var GUARD_H = 44;
  var GUARDS = [
    { id: "internal", label: "internal-data", x: 60, y: 424, tone: "rose" },
    { id: "credentials", label: "credentials", x: 254, y: 424, tone: "rose" },
    { id: "account", label: "account", x: 448, y: 424, tone: "amber" },
    { id: "domain", label: "out-of-domain", x: 642, y: 424, tone: "slate" },
    { id: "vulnerability", label: "vulnerability", x: 60, y: 492, tone: "plum" },
    { id: "route", label: "route-match", x: 254, y: 492, tone: "amber" },
    { id: "grounding", label: "grounding", x: 448, y: 492, tone: "amber" },
    { id: "ui", label: "ui-consistency", x: 642, y: 492, tone: "slate" },
  ];

  var TERM_Y = 724;
  var TERM_W = 120;
  var TERM_H = 68;
  var TERMINALS = [
    { id: "answer", label: "answer", x: 14, tone: "teal" },
    { id: "clarify", label: "clarify", x: 154, tone: "slate" },
    { id: "intake", label: "intake", x: 294, tone: "amber" },
    { id: "ticket", label: "ticket", x: 434, tone: "teal" },
    { id: "refuse", label: "refuse", x: 574, tone: "rose" },
    { id: "fallback", label: "fallback", x: 714, tone: "slate" },
  ];

  var ACTION_SHORT = {
    answer: "answer",
    ask_clarifying_question: "clarify",
    request_handoff_intake: "intake",
    create_ticket: "ticket",
    escalate: "escalate",
    refuse: "refuse",
    fallback: "fallback",
  };

  // Human copy for override codes lives host-side; only the code crosses the
  // iframe boundary, never a customer-derived reason string.
  var OVERRIDE_LABELS = {
    internal_data_exposure_blocked: "blocked a request for internal data",
    forbidden_credential_request_blocked: "blocked a credential request",
    account_specific_promise_blocked: "stopped an account-specific promise",
    vulnerability_route_match: "routed to a human for vulnerability",
    safety_flag_route_to_handoff: "safety signal forced a human handoff",
    non_answer_citation_blocked: "refused to answer from a non-answer source",
    answer_grounding_missing: "answer had no grounding",
    answer_grounding_unsupported: "answer grounding was unsupported",
    answer_grounding_not_retrieved: "cited source was never retrieved",
    ui_action_mismatch: "UI primitive did not match the action",
    malformed_plan: "model plan was malformed",
    handoff_intake_complete: "intake complete, raising a ticket",
    completed_handoff_new_safety_intent: "new safety signal during handoff",
    handoff_intake_progress_preserved: "saved partial intake progress",
    handoff_intake_incomplete: "intake still incomplete",
  };

  var TONES = ["teal", "amber", "rose", "plum", "slate"];

  function shortAction(action) {
    return ACTION_SHORT[action] || String(action).replace(/_/g, " ");
  }

  function guardForCode(code) {
    if (code.indexOf("internal_data") >= 0) return "internal";
    if (code.indexOf("credential") >= 0) return "credentials";
    if (code.indexOf("account_specific_promise") >= 0) return "account";
    if (code.indexOf("vulnerability") >= 0) return "vulnerability";
    if (code.indexOf("safety_flag_route") >= 0) return "vulnerability";
    if (code.indexOf("non_answer_citation") >= 0) return "route";
    if (code.indexOf("grounding") >= 0) return "grounding";
    if (code.indexOf("ui_action_mismatch") >= 0) return "ui";
    return null;
  }

  function terminalForAction(action) {
    switch (action) {
      case "answer":
        return "answer";
      case "ask_clarifying_question":
        return "clarify";
      case "request_handoff_intake":
        return "intake";
      case "create_ticket":
      case "escalate":
        return "ticket";
      case "refuse":
        return "refuse";
      default:
        return "fallback";
    }
  }

  function servingTone(mode) {
    if (mode === "answer") return "teal";
    if (mode === "handoff_account_specific") return "amber";
    if (mode === "route_vulnerability") return "plum";
    if (mode === "excluded") return "rose";
    return "slate";
  }

  function intakeTone(mode) {
    if (mode === "route_vulnerability") return "plum";
    return "amber";
  }

  // ── SVG construction (one-time) ──────────────────────────────────────────
  function node(id, x, y, w, h, title, twoLine, extraClass) {
    var cx = x + w / 2;
    var titleY = twoLine ? y + h / 2 - 4 : y + h / 2 + 5;
    var s =
      '<g class="sm-node sm-idle ' +
      (extraClass || "") +
      '" data-node="' +
      id +
      '">';
    s +=
      '<rect class="sm-rect" x="' +
      x +
      '" y="' +
      y +
      '" rx="11" width="' +
      w +
      '" height="' +
      h +
      '"></rect>';
    s +=
      '<text class="sm-title" x="' + cx + '" y="' + titleY + '">' + title + "</text>";
    if (twoLine) {
      s +=
        '<text class="sm-sub" x="' +
        cx +
        '" y="' +
        (y + h / 2 + 15) +
        '" data-sub="' +
        id +
        '"></text>';
    }
    s += "</g>";
    return s;
  }

  function buildSvg() {
    var svg =
      '<svg class="sm-svg" viewBox="0 0 860 900" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Engine decision state machine">';

    EDGES.forEach(function (e) {
      svg +=
        '<line class="sm-edge sm-idle" data-edge="' +
        e.id +
        '" x1="' +
        e.x1 +
        '" y1="' +
        e.y1 +
        '" x2="' +
        e.x2 +
        '" y2="' +
        e.y2 +
        '"></line>';
    });
    svg +=
      '<line class="sm-edge sm-loop sm-idle" data-edge="intake-ticket" x1="414" y1="758" x2="434" y2="758"></line>';

    svg +=
      '<rect class="sm-band" x="40" y="388" rx="14" width="780" height="168"></rect>';
    svg +=
      '<text class="sm-band-label" x="60" y="411">VALIDATOR · POLICY GUARDS</text>';
    GUARDS.forEach(function (g) {
      var cx = g.x + GUARD_W / 2;
      svg +=
        '<g class="sm-guard sm-idle" data-guard="' +
        g.id +
        '" data-tone="' +
        g.tone +
        '">' +
        '<rect class="sm-chip" x="' +
        g.x +
        '" y="' +
        g.y +
        '" rx="9" width="' +
        GUARD_W +
        '" height="' +
        GUARD_H +
        '"></rect>' +
        '<text class="sm-chip-label" x="' +
        cx +
        '" y="' +
        (g.y + GUARD_H / 2 + 4) +
        '">' +
        g.label +
        "</text>" +
        "</g>";
    });

    svg += node("inbound", 330, 20, 200, 54, "inbound message", false);
    svg += node("retrieve", 96, 132, 250, 66, "retrieve · corpus", true);
    svg += node("signal", 514, 132, 250, 66, "signal · intent", true);
    svg += node("plan", 305, 262, 250, 66, "plan · model", true);
    svg += node("dispatch", 305, 590, 250, 66, "dispatch", true);

    TERMINALS.forEach(function (t) {
      var cx = t.x + TERM_W / 2;
      svg +=
        '<g class="sm-node sm-term sm-idle" data-node="' +
        t.id +
        '" data-tone="' +
        t.tone +
        '">' +
        '<rect class="sm-rect" x="' +
        t.x +
        '" y="' +
        TERM_Y +
        '" rx="11" width="' +
        TERM_W +
        '" height="' +
        TERM_H +
        '"></rect>' +
        '<text class="sm-title" x="' +
        cx +
        '" y="' +
        (TERM_Y + TERM_H / 2 + 5) +
        '">' +
        t.label +
        "</text>" +
        "</g>";
    });

    svg += "</svg>";
    return svg;
  }

  // ── Mount ────────────────────────────────────────────────────────────────
  var panel = document.createElement("section");
  panel.id = "sm-devtools";
  panel.setAttribute("aria-label", "Engine internals");
  panel.innerHTML =
    '<div class="sm-head">' +
    '<span class="sm-eyebrow">Engine internals</span>' +
    '<div class="sm-title-row"><h2>Live decision state machine</h2>' +
    '<span class="sm-turn" data-turn>idle</span></div>' +
    "</div>" +
    '<div class="sm-banner sm-banner-idle" data-banner>Waiting for the first turn…</div>' +
    '<div class="sm-meta"><span class="sm-serving tone-slate" data-serving>serving: —</span>' +
    '<span class="sm-flags" data-flags></span></div>' +
    '<div class="sm-body" data-body>' +
    buildSvg() +
    "</div>" +
    '<div class="sm-legend">' +
    '<span><i class="sm-dot" style="background:#1a8787"></i>answer / grounded</span>' +
    '<span><i class="sm-dot" style="background:#e08a2b"></i>handoff</span>' +
    '<span><i class="sm-dot" style="background:#8d6fb0"></i>vulnerability</span>' +
    '<span><i class="sm-dot" style="background:#cf5168"></i>blocked</span>' +
    '<span><i class="sm-dot" style="background:#6b8190"></i>neutral</span>' +
    "</div>";
  document.body.appendChild(panel);

  var root = panel.querySelector("[data-body]");
  var turnEl = panel.querySelector("[data-turn]");
  var bannerEl = panel.querySelector("[data-banner]");
  var servingEl = panel.querySelector("[data-serving]");
  var flagsEl = panel.querySelector("[data-flags]");

  if (DEBUG) {
    console.log(
      "[sm-devtools] panel mounted; listening for telemetry. widgetOrigin =",
      widgetOrigin,
    );
  }

  // ── Update helpers ───────────────────────────────────────────────────────
  function setTone(g, tone) {
    TONES.forEach(function (t) {
      g.classList.toggle("tone-" + t, tone === t);
    });
  }

  function setNode(id, active, tone, sub) {
    var g = root.querySelector('[data-node="' + id + '"]');
    if (!g) return;
    g.classList.toggle("sm-active", !!active);
    g.classList.toggle("sm-idle", !active);
    setTone(g, tone);
    if (sub != null) {
      var s = root.querySelector('[data-sub="' + id + '"]');
      if (s) s.textContent = sub;
    }
  }

  function setGuard(id, fired) {
    var g = root.querySelector('[data-guard="' + id + '"]');
    if (!g) return;
    g.classList.toggle("sm-fired", fired);
    g.classList.toggle("sm-idle", !fired);
    setTone(g, fired ? g.getAttribute("data-tone") : "slate");
  }

  function setEdge(id, active, tone) {
    var e = root.querySelector('[data-edge="' + id + '"]');
    if (!e) return;
    e.classList.toggle("sm-active", !!active);
    e.classList.toggle("sm-idle", !active);
    setTone(e, active ? tone : "slate");
  }

  function signalSub(signal) {
    if (signal.status !== "fulfilled") return signal.status;
    var label = signal.primaryIntent || "signal";
    if (signal.uncertainty != null) {
      label += " · u" + Number(signal.uncertainty).toFixed(1);
    }
    return label;
  }

  function renderBanner(t) {
    if (t.actionChanged) {
      var top = null;
      for (var i = 0; i < t.overrides.length; i++) {
        var o = t.overrides[i];
        if (o.fromAction && o.fromAction !== o.toAction) {
          top = o;
          break;
        }
      }
      if (!top && t.overrides.length) top = t.overrides[t.overrides.length - 1];
      var reason = top
        ? OVERRIDE_LABELS[top.code] || top.code.replace(/_/g, " ")
        : "policy override";
      bannerEl.className = "sm-banner sm-banner-changed";
      bannerEl.innerHTML =
        '<span class="sm-banner-tag">policy overrode the model</span>' +
        '<span class="sm-banner-flow">' +
        shortAction(t.proposedAction) +
        " <em>&rarr;</em> " +
        shortAction(t.finalAction) +
        "</span>" +
        '<span class="sm-banner-reason">' +
        reason +
        "</span>";
    } else {
      bannerEl.className = "sm-banner sm-banner-aligned";
      bannerEl.innerHTML =
        '<span class="sm-banner-tag">model proposal upheld</span>' +
        '<span class="sm-banner-flow">' +
        shortAction(t.finalAction) +
        "</span>";
    }
  }

  function renderServing(t) {
    servingEl.textContent = "serving: " + (t.servingMode || "—");
    setTone(servingEl, servingTone(t.servingMode));
  }

  function renderFlags(t) {
    if (!t.safetyFlags.length) {
      flagsEl.innerHTML = '<span class="sm-flag sm-flag-none">no safety flags</span>';
      return;
    }
    flagsEl.innerHTML = t.safetyFlags
      .map(function (f) {
        return '<span class="sm-flag">' + f + "</span>";
      })
      .join("");
  }

  function flash() {
    var body = root;
    body.classList.remove("sm-flash");
    void body.offsetWidth;
    body.classList.add("sm-flash");
  }

  function update(t) {
    turnEl.textContent = "turn " + t.turn;
    renderBanner(t);
    renderServing(t);
    renderFlags(t);

    var sigActive = t.signal.status !== "disabled";
    var hardBlock = false;
    var fired = {};
    t.overrides.forEach(function (o) {
      if (
        o.code.indexOf("internal_data") >= 0 ||
        o.code.indexOf("credential") >= 0
      ) {
        hardBlock = true;
      }
      var g = guardForCode(o.code);
      if (g) fired[g] = true;
    });
    if (t.finalAction === "fallback" && t.signal.primaryIntent === "other") {
      fired.domain = true;
    }
    var spineTone = t.actionChanged ? (hardBlock ? "rose" : "amber") : "teal";

    setNode("inbound", true, "slate", null);
    setNode(
      "retrieve",
      true,
      t.retrieval.count > 0 ? "teal" : "slate",
      t.retrieval.count + " hits · top " + Math.round(t.retrieval.topScore),
    );
    setNode(
      "signal",
      sigActive,
      t.signal.comparison === "mismatch" ? "amber" : sigActive ? "teal" : "slate",
      signalSub(t.signal),
    );
    setNode("plan", true, "slate", "proposes " + shortAction(t.proposedAction));
    setNode("dispatch", true, spineTone, "emits " + shortAction(t.finalAction));

    GUARDS.forEach(function (g) {
      setGuard(g.id, !!fired[g.id]);
    });

    var activeTerm = terminalForAction(t.finalAction);
    TERMINALS.forEach(function (term) {
      var on = term.id === activeTerm;
      var tone = term.id === "intake" ? intakeTone(t.servingMode) : term.tone;
      setNode(term.id, on, on ? tone : "slate", null);
    });

    setEdge("in-ret", true, "teal");
    setEdge("in-sig", sigActive, "teal");
    setEdge("ret-plan", true, "teal");
    setEdge("sig-plan", sigActive, "teal");
    setEdge("plan-val", true, spineTone);
    setEdge("val-disp", true, spineTone);
    TERMINALS.forEach(function (term) {
      var on = term.id === activeTerm;
      var tone = term.id === "intake" ? intakeTone(t.servingMode) : term.tone;
      setEdge("disp-" + term.id, on, tone);
    });
    setEdge("intake-ticket", t.finalAction === "create_ticket", "teal");

    flash();
  }

  function isTelemetry(msg) {
    return (
      msg &&
      typeof msg === "object" &&
      msg.type === "turn-telemetry" &&
      msg.retrieval &&
      msg.signal &&
      msg.intake
    );
  }

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!isTelemetry(data)) {
      if (DEBUG && data && typeof data === "object" && data.type) {
        // Surface other widget protocol messages so we can see the bridge is
        // alive even when no telemetry has arrived yet.
        console.debug("[sm-devtools] non-telemetry message:", data.type);
      }
      return;
    }
    if (DEBUG) {
      console.log(
        "[sm-devtools] telemetry from",
        event.origin,
        "| turn",
        data.turn,
        "| proposed",
        data.proposedAction,
        "-> final",
        data.finalAction,
      );
    }
    // Dev-only panel carrying content-free decision metadata. Accept the
    // structurally-valid telemetry regardless of which loopback variant
    // (127.0.0.1 vs localhost) the widget iframe is served from — an origin
    // string mismatch must not silently swallow the demo.
    if (event.origin !== widgetOrigin && DEBUG) {
      console.debug(
        "[sm-devtools] origin",
        event.origin,
        "differs from expected",
        widgetOrigin,
        "(accepting anyway)",
      );
    }
    try {
      update(data);
    } catch (err) {
      console.error("[sm-devtools] update() threw:", err);
    }
  });
})();
