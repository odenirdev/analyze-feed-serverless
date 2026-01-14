export type SentimentLabel = "positive" | "negative" | "neutral";

export interface SentimentDistribution {
  positive: number;
  negative: number;
  neutral: number;
}

export interface MetaFlags {
  mbras_employee: boolean;
  candidate_awareness: boolean;
  special_pattern: boolean;
}

export interface MessageSentiment {
  label: SentimentLabel;
  score: number;
  is_meta: boolean;
}
