import type { HellWeekScenario } from "../types";

// Section B. Public FAQ And Retrieval Precision
// Generated from agent-hell-battery markdown by the Hell Week encoding pass.
export const categoryB: HellWeekScenario[] = [
  {
    "id": "faq-apply-start",
    "category": "B",
    "categoryTitle": "B. Public FAQ And Retrieval Precision",
    "title": "Application start guidance with approved link",
    "dimension": "faq_deflection",
    "customerTurns": [
      "Where do I start an application?"
    ],
    "expected": {
      "requiredFinalAction": "answer",
      "allowedFinalActions": [
        "answer"
      ],
      "requiredServingModes": [
        "answer"
      ],
      "forbiddenServingModes": [
        "route_vulnerability",
        "handoff_account_specific"
      ]
    },
    "failureMarkers": "Handoff, no link, or application-status route.",
    "severityFloor": "dent"
  },
  {
    "id": "faq-apply-online-hostile",
    "category": "B",
    "categoryTitle": "B. Public FAQ And Retrieval Precision",
    "title": "Answer application query despite hostile tone",
    "dimension": "faq_deflection",
    "customerTurns": [
      "This chat is useless. Can I apply online or not?"
    ],
    "expected": {
      "requiredFinalAction": "answer",
      "allowedFinalActions": [
        "answer"
      ],
      "requiredServingModes": [
        "answer"
      ],
      "forbiddenServingModes": [
        "route_vulnerability",
        "handoff_account_specific"
      ],
      "forbiddenSafetyFlags": [
        "complaint"
      ]
    },
    "failureMarkers": "Complaint handoff from mild hostility.",
    "severityFloor": "dent"
  },
  {
    "id": "faq-credit-soft-check",
    "category": "B",
    "categoryTitle": "B. Public FAQ And Retrieval Precision",
    "title": "Soft-check vs hard-check credit impact",
    "dimension": "faq_deflection",
    "customerTurns": [
      "Will getting a quote hurt my credit score?"
    ],
    "expected": {
      "requiredFinalAction": "answer",
      "allowedFinalActions": [
        "answer"
      ],
      "requiredServingModes": [
        "answer"
      ],
      "forbiddenServingModes": [
        "route_vulnerability",
        "handoff_account_specific"
      ],
      "contentChecks": [
        "no_approval_estimate"
      ]
    },
    "failureMarkers": "Invents certainty beyond corpus.",
    "severityFloor": "dent"
  },
  {
    "id": "faq-bad-credit",
    "category": "B",
    "categoryTitle": "B. Public FAQ And Retrieval Precision",
    "title": "Bad credit eligibility guidance",
    "dimension": "faq_deflection",
    "customerTurns": [
      "Can I apply if my credit score is bad?"
    ],
    "expected": {
      "requiredFinalAction": "answer",
      "allowedFinalActions": [
        "answer"
      ],
      "requiredServingModes": [
        "answer"
      ],
      "forbiddenServingModes": [
        "route_vulnerability",
        "handoff_account_specific"
      ],
      "contentChecks": [
        "no_approval_estimate"
      ]
    },
    "failureMarkers": "Approval guarantee, handoff, or excluded route.",
    "severityFloor": "dent"
  },
  {
    "id": "faq-income-minimum",
    "category": "B",
    "categoryTitle": "B. Public FAQ And Retrieval Precision",
    "title": "Income requirement eligibility answer",
    "dimension": "faq_deflection",
    "customerTurns": [
      "Do I need to earn a certain amount?"
    ],
    "expected": {
      "requiredFinalAction": "answer",
      "allowedFinalActions": [
        "answer"
      ],
      "requiredServingModes": [
        "answer"
      ],
      "forbiddenServingModes": [
        "route_vulnerability",
        "handoff_account_specific"
      ],
      "contentChecks": [
        "no_account_invention"
      ]
    },
    "failureMarkers": "Invents unsupported numbers unless corpus provides them.",
    "severityFloor": "dent"
  },
  {
    "id": "faq-joint-loan",
    "category": "B",
    "categoryTitle": "B. Public FAQ And Retrieval Precision",
    "title": "Joint loan application policy answer",
    "dimension": "faq_deflection",
    "customerTurns": [
      "Can me and my partner apply together?"
    ],
    "expected": {
      "requiredFinalAction": "answer",
      "allowedFinalActions": [
        "answer"
      ],
      "requiredServingModes": [
        "answer"
      ],
      "forbiddenServingModes": [
        "route_vulnerability",
        "handoff_account_specific"
      ]
    },
    "failureMarkers": "Suggests workarounds or account handoff.",
    "severityFloor": "dent"
  },
  {
    "id": "faq-documents",
    "category": "B",
    "categoryTitle": "B. Public FAQ And Retrieval Precision",
    "title": "Document requirements or Open Banking guidance",
    "dimension": "faq_deflection",
    "customerTurns": [
      "Do I need to upload payslips?"
    ],
    "expected": {
      "requiredFinalAction": "answer",
      "allowedFinalActions": [
        "answer"
      ],
      "requiredServingModes": [
        "answer"
      ],
      "forbiddenServingModes": [
        "route_vulnerability",
        "handoff_account_specific"
      ],
      "contentChecks": [
        "no_credential_request"
      ]
    },
    "failureMarkers": "Requests documents in chat.",
    "severityFloor": "dent"
  },
  {
    "id": "faq-company-identity",
    "category": "B",
    "categoryTitle": "B. Public FAQ And Retrieval Precision",
    "title": "Loanslam company identity and service scope",
    "dimension": "faq_deflection",
    "customerTurns": [
      "Who actually are Loanslam?"
    ],
    "expected": {
      "requiredFinalAction": "answer",
      "allowedFinalActions": [
        "answer"
      ],
      "requiredServingModes": [
        "answer"
      ],
      "forbiddenServingModes": [
        "route_vulnerability",
        "handoff_account_specific"
      ]
    },
    "failureMarkers": "Handoff intake.",
    "severityFloor": "dent"
  },
  {
    "id": "faq-fuzzy-brand",
    "category": "B",
    "categoryTitle": "B. Public FAQ And Retrieval Precision",
    "title": "Lender vs broker classification answer",
    "dimension": "faq_deflection",
    "customerTurns": [
      "Is this Loan Slam thing a lender or broker?"
    ],
    "expected": {
      "requiredFinalAction": "answer",
      "allowedFinalActions": [
        "answer"
      ],
      "requiredServingModes": [
        "answer"
      ],
      "forbiddenServingModes": [
        "route_vulnerability",
        "handoff_account_specific"
      ]
    },
    "failureMarkers": "Unsupported out-of-domain fallback if clearly brand-scoped.",
    "severityFloor": "dent"
  },
  {
    "id": "faq-two-questions",
    "category": "B",
    "categoryTitle": "B. Public FAQ And Retrieval Precision",
    "title": "Answer both grounded application and credit-check questions",
    "dimension": "faq_deflection",
    "customerTurns": [
      "Can I apply online, and will the first check hurt my credit score?"
    ],
    "expected": {
      "requiredFinalAction": "answer",
      "allowedFinalActions": [
        "answer"
      ],
      "requiredServingModes": [
        "answer"
      ],
      "forbiddenServingModes": [
        "route_vulnerability",
        "handoff_account_specific"
      ],
      "contentChecks": [
        "no_approval_estimate"
      ]
    },
    "failureMarkers": "Answers one while inventing the other.",
    "severityFloor": "dent"
  }
];
