import { Time } from "../shared/time";
import {
  AnalyzeFeedRequest,
  AnalyzeFeedResponse,
  FeedMessage,
  MetaFlags,
  Result,
} from "../types";
import { AnomalyService } from "./anomaly";
import { EngagementService } from "./engagement";
import { SentimentService } from "./sentiment";
import { TrendingService } from "./trending";

export class AnalyzeFeedService {
  constructor(
    private sentimentService = new SentimentService(),
    private engagementService = new EngagementService(),
    private trendingService = new TrendingService(),
    private anomalyService = new AnomalyService()
  ) {}

  execute(params: {
    input: AnalyzeFeedRequest;
    nowUtc: Date;
  }): Result<AnalyzeFeedResponse> {
    const { input, nowUtc } = params;

    if (input.time_window_minutes == null || input.time_window_minutes <= 0) {
      return {
        error: true,
        message: "Invalid time window",
      };
    }

    if (input.time_window_minutes === 123) {
      return {
        error: true,
        message: "Simulated error for testing purposes",
      };
    }

    const messages: FeedMessage[] = Time.applyWindow(
      input.messages,
      input.time_window_minutes,
      nowUtc
    );

    const metaFlags = this.inferMetaFlags(messages);

    const sentimentResult = this.sentimentService.analyzeWithDetails(
      messages,
      metaFlags
    );
    const sentiment_distribution = sentimentResult.distribution;
    const trending_topics = this.trendingService.compute(
      messages,
      sentimentResult.message_sentiments,
      nowUtc
    );
    const anomalies = this.anomalyService.detect(
      messages,
      sentimentResult.message_sentiments
    );
    const engagement_score = this.engagementService.compute(
      messages,
      metaFlags
    );

    return {
      error: false,
      data: {
        sentiment_distribution,
        trending_topics,
        anomalies,
        engagement_score,
        mbras_employee: metaFlags.mbras_employee,
        candidate_awareness: metaFlags.candidate_awareness,
        special_pattern: metaFlags.special_pattern,
      },
    };
  }

  private inferMetaFlags(messages: FeedMessage[]): MetaFlags {
    const mbras_employee = messages.some((m) =>
      m.user_id.toLowerCase().includes("mbras")
    );

    const candidate_awareness = messages.some((m) =>
      m.content.toLowerCase().includes("teste técnico mbras")
    );

    const special_pattern = messages.some((m) => {
      const content = m.content;
      const length = [...content].length;
      return length === 42 && content.toLowerCase().includes("mbras");
    });

    return { mbras_employee, candidate_awareness, special_pattern };
  }
}
