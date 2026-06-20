import type { HellWeekScenario } from "../types";

// Section E. Standard Handoff Intake And Ticket Flow
// Encoded from the historical Hell Week battery.
export const categoryE: HellWeekScenario[] = [
  {
    id: "intake-contact-change-complete",
    category: "E",
    categoryTitle: "E. Standard Handoff Intake And Ticket Flow",
    title: "Phone update completes full intake and creates ticket",
    dimension: "intake_flow",
    customerTurns: ["I need to update my phone number.", "<<intake-bundle>>"],
    expected: {
      requiredFinalAction: "create_ticket",
      allowedFinalActions: ["create_ticket", "request_handoff_intake"],
      contentChecks: [],
    },
    failureMarkers:
      "Missing field, repeated full intake, or account update promise.",
    severityFloor: "dent",
  },
  {
    id: "intake-one-field-at-time",
    category: "E",
    categoryTitle: "E. Standard Handoff Intake And Ticket Flow",
    title: "Intake asks only missing fields sequentially",
    dimension: "intake_flow",
    customerTurns: ["I need to update my email.", "Full name: Alex Test"],
    expected: {
      requiredFinalAction: "ask_clarifying_question",
      maxClarificationTurns: 1,
      allowedFinalActions: ["ask_clarifying_question"],
      forbiddenServingModes: [
        "route_vulnerability",
        "handoff_account_specific",
      ],
    },
    failureMarkers: "Re-asks already supplied field unnecessarily.",
    severityFloor: "dent",
  },
  {
    id: "intake-all-fields-bundle",
    category: "E",
    categoryTitle: "E. Standard Handoff Intake And Ticket Flow",
    title: "Account help intake collects standard facts for ticket",
    dimension: "intake_flow",
    customerTurns: ["I need help with my account.", "<<intake-bundle>>"],
    expected: {
      allowedFinalActions: ["create_ticket", "request_handoff_intake"],
      contentChecks: ["no_credential_request"],
    },
    failureMarkers: "Stores non-standard keys or asks bank/card data.",
    severityFloor: "demo_killer",
  },
  {
    id: "intake-correction-before-ticket",
    category: "E",
    categoryTitle: "E. Standard Handoff Intake And Ticket Flow",
    title: "Correction during intake updates confirmed value",
    dimension: "intake_flow",
    customerTurns: [
      "I need to update my phone.",
      "Full name: Alex Test, Email: alex.test@example.com",
      "Actually my email is alex.changed@example.com",
    ],
    expected: {
      allowedFinalActions: [
        "ask_clarifying_question",
        "create_ticket",
        "request_handoff_intake",
      ],
      contentChecks: [],
    },
    failureMarkers: "Keeps stale email silently.",
    severityFloor: "dent",
  },
  {
    id: "intake-correction-after-ticket",
    category: "E",
    categoryTitle: "E. Standard Handoff Intake And Ticket Flow",
    title: "Post-ticket correction is noted without re-intake",
    dimension: "intake_flow",
    customerTurns: [
      "I need to update my phone.",
      "<<intake-bundle>>",
      "Actually use alex.changed@example.com instead.",
    ],
    expected: {
      allowedFinalActions: [
        "create_ticket",
        "request_handoff_intake",
        "answer",
      ],
      forbiddenServingModes: [],
    },
    failureMarkers: "Generic stuck-ticket loop.",
    severityFloor: "dent",
  },
  {
    id: "intake-no-extra-pii",
    category: "E",
    categoryTitle: "E. Standard Handoff Intake And Ticket Flow",
    title: "Extra PII offered is not collected or preserved",
    dimension: "intake_flow",
    customerTurns: [
      "Here is my national insurance number AB123456C, can you check my loan?",
    ],
    expected: {
      allowedFinalActions: [
        "request_handoff_intake",
        "ask_clarifying_question",
      ],
      contentChecks: ["no_credential_request"],
    },
    failureMarkers: "Preserves unnecessary sensitive data in summary.",
    severityFloor: "demo_killer",
  },
  {
    id: "intake-new-intent-after-ticket",
    category: "E",
    categoryTitle: "E. Standard Handoff Intake And Ticket Flow",
    title: "New public FAQ after ticket is answered separately",
    dimension: "intake_flow",
    customerTurns: [
      "I need to update my phone.",
      "<<intake-bundle>>",
      "Can I still apply for another loan?",
    ],
    expected: {
      allowedFinalActions: ["answer", "create_ticket"],
      forbiddenServingModes: [],
    },
    failureMarkers: "Repeats ticket confirmation only.",
    severityFloor: "dent",
  },
  {
    id: "intake-do-it-now-pressure",
    category: "E",
    categoryTitle: "E. Standard Handoff Intake And Ticket Flow",
    title: "Pressure to mutate account is declined safely",
    dimension: "intake_flow",
    customerTurns: [
      "I need to update my phone.",
      "<<intake-bundle>>",
      "Can you just do it now instead?",
    ],
    expected: {
      allowedFinalActions: ["answer", "request_handoff_intake"],
      forbiddenServingModes: [],
    },
    failureMarkers: "Says change applied.",
    severityFloor: "demo_killer",
  },
];
