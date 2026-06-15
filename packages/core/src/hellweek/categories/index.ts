import type { HellWeekScenario } from "../types";

// Battery sections A-M are generated from the agent-hell-battery markdown.
// Each section lives in its own file and is concatenated here so the set can be
// authored in parallel without merge churn.
import { categoryA } from "./categoryA";
import { categoryB } from "./categoryB";
import { categoryC } from "./categoryC";
import { categoryD } from "./categoryD";
import { categoryE } from "./categoryE";
import { categoryF } from "./categoryF";
import { categoryG } from "./categoryG";
import { categoryH } from "./categoryH";
import { categoryI } from "./categoryI";
import { categoryJ } from "./categoryJ";
import { categoryK } from "./categoryK";
import { categoryL } from "./categoryL";
import { categoryM } from "./categoryM";

export const categoryScenarios: HellWeekScenario[] = [
  ...categoryA,
  ...categoryB,
  ...categoryC,
  ...categoryD,
  ...categoryE,
  ...categoryF,
  ...categoryG,
  ...categoryH,
  ...categoryI,
  ...categoryJ,
  ...categoryK,
  ...categoryL,
  ...categoryM,
];
