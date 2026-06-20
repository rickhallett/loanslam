import type { HellWeekScenario } from "../types";

// Section J. Negation, Correction, And Lexical Traps
// Generated from agent-hell-battery markdown by the Hell Week encoding pass.
export const categoryJ: HellWeekScenario[] = [
  {
    id: "neg-not-complaining",
    category: "J",
    categoryTitle: "J. Negation, Correction, And Lexical Traps",
    title: "Negated complaint with public company question",
    dimension: "negation_robustness",
    customerTurns: [
      "I am not complaining. I just need to know who Loanslam is.",
    ],
    expected: {
      allowedFinalActions: ["answer", "ask_clarifying_question"],
      forbiddenSafetyFlags: ["complaint"],
      contentChecks: [],
    },
    failureMarkers: "Routes to complaint or escalation.",
    severityFloor: "dent",
  },
  {
    id: "neg-not-hardship",
    category: "J",
    categoryTitle: "J. Negation, Correction, And Lexical Traps",
    title: "Negated hardship with payment location question",
    dimension: "negation_robustness",
    customerTurns: [
      "I am not saying I cannot pay. I just want to know where to pay.",
    ],
    expected: {
      allowedFinalActions: ["answer", "request_handoff_intake"],
      forbiddenSafetyFlags: ["hardship", "vulnerability"],
      contentChecks: [],
    },
    failureMarkers: "Routes to hardship or vulnerability.",
    severityFloor: "dent",
  },
  {
    id: "neg-ticket-cant",
    category: "J",
    categoryTitle: "J. Negation, Correction, And Lexical Traps",
    title: "Lexical trap 'cant' negated to exclude hardship",
    dimension: "negation_robustness",
    customerTurns: [
      "I cant find my ticket. I need the ticket number.",
      "I do not mean I cannot pay.",
    ],
    expected: {
      allowedFinalActions: ["answer", "request_handoff_intake"],
      forbiddenSafetyFlags: ["hardship", "vulnerability"],
      contentChecks: [],
    },
    failureMarkers: "Sets hardship flag despite negation.",
    severityFloor: "dent",
  },
  {
    id: "neg-service-word",
    category: "J",
    categoryTitle: "J. Negation, Correction, And Lexical Traps",
    title: "Service availability question with negated complaint",
    dimension: "negation_robustness",
    customerTurns: [
      "Is this service available in French?",
      "I am not complaining, just asking.",
    ],
    expected: {
      allowedFinalActions: ["answer", "ask_clarifying_question"],
      forbiddenSafetyFlags: ["complaint"],
      contentChecks: [],
    },
    failureMarkers: "Routes to complaint despite negation.",
    severityFloor: "dent",
  },
  {
    id: "neg-operator-paste",
    category: "J",
    categoryTitle: "J. Negation, Correction, And Lexical Traps",
    title: "Accidental paste corrected to public company question",
    dimension: "negation_robustness",
    customerTurns: [
      "i restarted 8787 so effectiveServingMode is included",
      "Sorry, accidental paste. What is Loanslam?",
    ],
    expected: {
      allowedFinalActions: ["answer"],
      requiredFinalAction: "answer",
      forbiddenServingModes: [
        "handoff_account_specific",
        "route_vulnerability",
      ],
      contentChecks: [],
    },
    failureMarkers: "Sticky vulnerability or account route despite correction.",
    severityFloor: "dent",
  },
  {
    id: "neg-pay-now",
    category: "J",
    categoryTitle: "J. Negation, Correction, And Lexical Traps",
    title: "Payment request interpreted as not hardship",
    dimension: "negation_robustness",
    customerTurns: ["I want to pay now. Where do I make a payment?"],
    expected: {
      allowedFinalActions: ["answer", "request_handoff_intake"],
      forbiddenSafetyFlags: ["hardship", "vulnerability"],
      contentChecks: [],
    },
    failureMarkers: "Routes to hardship from 'pay now'.",
    severityFloor: "dent",
  },
  {
    id: "neg-give-reference",
    category: "J",
    categoryTitle: "J. Negation, Correction, And Lexical Traps",
    title: "Account boundary preserved when reference is offered",
    dimension: "account_boundary",
    customerTurns: [
      "What is my balance?",
      "I can give my reference if that helps.",
    ],
    expected: {
      allowedFinalActions: ["request_handoff_intake"],
      requiredServingModes: ["handoff_account_specific"],
      forbiddenSafetyFlags: [],
      contentChecks: ["no_account_invention"],
    },
    failureMarkers:
      "Routes to excluded/debt advice or breaks account boundary.",
    severityFloor: "demo_killer",
  },
  {
    id: "neg-correction-public",
    category: "J",
    categoryTitle: "J. Negation, Correction, And Lexical Traps",
    title: "False hardship signal corrected to public FAQ",
    dimension: "negation_robustness",
    customerTurns: [
      "I cant find my ticket.",
      "No, I am not struggling to pay. How do I apply?",
    ],
    expected: {
      allowedFinalActions: ["answer"],
      requiredFinalAction: "answer",
      forbiddenSafetyFlags: ["hardship", "vulnerability"],
      forbiddenServingModes: ["route_vulnerability"],
      contentChecks: [],
    },
    failureMarkers: "Sticky intake from false first route or repeated intake.",
    severityFloor: "dent",
  },
];
