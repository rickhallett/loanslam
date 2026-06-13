import type {
  ClassifierAction,
  ClassifierResult,
  GroundingCitation,
  RetrievalResult,
  VulnerabilityResult,
} from '@loanslam/contracts';

import type { ConversationState } from '@loanslam/contracts';

export type AllowedClassifierAction = ClassifierAction;

export interface VulnerabilityInput {
  conversationRef: string;
  requestRef: string;
  message: string;
  state: ConversationState;
}

export interface ClassifierInput {
  conversationRef: string;
  requestRef: string;
  message: string;
  state: ConversationState;
  retrieval: RetrievalResult;
  allowedActions: AllowedClassifierAction[];
}

export interface GenerateAnswerInput {
  conversationRef: string;
  requestRef: string;
  message: string;
  retrieval: RetrievalResult;
  citations: GroundingCitation[];
}

export interface GeneratedAnswer {
  text: string;
  reasonCode: string;
}

export interface ModelProvider {
  classifyVulnerability(input: VulnerabilityInput): Promise<VulnerabilityResult>;
  classifyAction(input: ClassifierInput): Promise<ClassifierResult>;
  generateAnswer(input: GenerateAnswerInput): Promise<GeneratedAnswer>;
}
