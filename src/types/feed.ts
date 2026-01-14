import { AnomalyFlags } from "./anomaly";
import { SentimentDistribution } from "./sentiment";
import { TrendingTopic } from "./trending";

export interface FeedMessage {
  user_id: string;
  content: string;
  timestamp: string; // RFC3339 com 'Z'
  reactions?: number;
  shares?: number;
  views?: number;
  hashtags?: string[];
}

export interface AnalyzeFeedRequest {
  messages: FeedMessage[];
  time_window_minutes: number;
}

export interface AnalyzeFeedResponse {
  sentiment_distribution: SentimentDistribution;
  trending_topics: TrendingTopic[];
  anomalies: AnomalyFlags;
  engagement_score: number;
  mbras_employee: boolean;
  candidate_awareness: boolean;
  special_pattern: boolean;
}
