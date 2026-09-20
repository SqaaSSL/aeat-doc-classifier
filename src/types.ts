export interface ChoiceQuestion {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
}

export interface ChoiceAnswer {
  type: 'choice';
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface DecisionResponse {
  model: string;
  answers: Record<string, ChoiceAnswer>;
  usage: { input_tokens: number; output_tokens: number };
}

export interface Backend {
  ask(state: unknown, questions: Record<string, ChoiceQuestion>): Promise<DecisionResponse>;
}

export interface Gate {
  /** Policy thresholds, not measured Spanish accuracy. Both must pass. */
  minConfidence: number;
  minProbability: number;
}

export interface Decision {
  value: string;
  confidence: number;
  probability: number;
  alternatives: Array<{ value: string; probability: number }>;
  probabilities: Record<string, number>;
}

export interface ModelDefinition {
  id: string;
  number: string;
  title: string;
  family: string;
  description: string;
  status: 'current' | 'historical';
  validUntil?: string;
  sources: string[];
}

export interface AccountDefinition {
  code: string;
  title: string;
  description: string;
  directions: Array<'purchase' | 'sale' | 'payroll' | 'finance'>;
  plans: Array<'pgc' | 'pgc-pymes'>;
  role: 'principal' | 'reference';
  sources: string[];
}
