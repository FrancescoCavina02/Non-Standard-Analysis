export interface ExplanationDraft {
  slug: string;
  sourceHash: string;
  summary: string;
  intuition: string;
  reasoningSteps: string[];
  animation: 'sequence' | 'partition' | 'chain' | 'quotient' | 'reasoning';
  animationCaption: string;
  caution: string;
  generatedBy: string;
}
