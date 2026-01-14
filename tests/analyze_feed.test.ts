import { AnalyzeFeedService } from "../src/services/analyze_feed";
import {
  AnalyzeFeedRequest,
  FeedMessage,
  MessageSentiment,
  MetaFlags,
  SentimentDistribution,
  TrendingTopic,
} from "../src/types";

const fixedNow = new Date("2025-09-10T10:00:00Z");

const buildMessage = (overrides: Partial<FeedMessage>): FeedMessage => ({
  user_id: "user_1",
  content: "ok",
  timestamp: "2025-09-10T09:50:00Z",
  reactions: 0,
  shares: 0,
  views: 1,
  hashtags: [],
  ...overrides,
});

const buildSentiments = (messages: FeedMessage[]): MessageSentiment[] =>
  messages.map(() => ({ label: "neutral", score: 0, is_meta: false }));

describe("AnalyzeFeedService unit tests", () => {
  it("returns error for invalid time window and skips service calls", () => {
    const sentimentService = { analyzeWithDetails: jest.fn() };
    const engagementService = { compute: jest.fn() };
    const trendingService = { compute: jest.fn() };
    const anomalyService = { detect: jest.fn() };

    const service = new AnalyzeFeedService(
      sentimentService as any,
      engagementService as any,
      trendingService as any,
      anomalyService as any
    );

    const input = {
      messages: [],
      time_window_minutes: null,
    } as unknown as AnalyzeFeedRequest;

    const result = service.execute({ input, nowUtc: fixedNow });

    expect(result).toEqual({ error: true, message: "Invalid time window" });
    expect(sentimentService.analyzeWithDetails).not.toHaveBeenCalled();
    expect(trendingService.compute).not.toHaveBeenCalled();
    expect(anomalyService.detect).not.toHaveBeenCalled();
    expect(engagementService.compute).not.toHaveBeenCalled();
  });

  it("returns simulated error for unsupported time window", () => {
    const service = new AnalyzeFeedService(
      { analyzeWithDetails: jest.fn() } as any,
      { compute: jest.fn() } as any,
      { compute: jest.fn() } as any,
      { detect: jest.fn() } as any
    );

    const input: AnalyzeFeedRequest = {
      messages: [],
      time_window_minutes: 123,
    };

    const result = service.execute({ input, nowUtc: fixedNow });

    expect(result).toEqual({
      error: true,
      message: "Simulated error for testing purposes",
    });
  });

  it("filters messages by time window and uses filtered meta flags", () => {
    const sentimentService = {
      analyzeWithDetails: jest.fn((messages: FeedMessage[], meta: MetaFlags) => ({
        distribution: { positive: 0, negative: 0, neutral: 100 },
        message_sentiments: buildSentiments(messages),
      })),
    };
    const engagementService = { compute: jest.fn(() => 1.23) };
    const trendingService = { compute: jest.fn(() => []) };
    const anomalyService = {
      detect: jest.fn(() => ({
        burst_users: [],
        alternating_users: [],
        synchronized_clusters: [],
      })),
    };

    const service = new AnalyzeFeedService(
      sentimentService as any,
      engagementService as any,
      trendingService as any,
      anomalyService as any
    );

    const input: AnalyzeFeedRequest = {
      messages: [
        buildMessage({
          user_id: "user_out_of_window_mbras",
          content: "teste técnico mbras",
          timestamp: "2025-09-10T09:20:00Z",
        }),
        buildMessage({
          user_id: "user_in_window",
          content: "mensagem comum",
          timestamp: "2025-09-10T09:55:00Z",
        }),
      ],
      time_window_minutes: 30,
    };

    const result = service.execute({ input, nowUtc: fixedNow });

    expect(result.error).toBe(false);
    expect(sentimentService.analyzeWithDetails).toHaveBeenCalledTimes(1);
    const [filteredMessages, metaFlags] =
      sentimentService.analyzeWithDetails.mock.calls[0];
    expect(filteredMessages).toHaveLength(1);
    expect(filteredMessages[0].user_id).toBe("user_in_window");
    expect(metaFlags).toEqual({
      mbras_employee: false,
      candidate_awareness: false,
      special_pattern: false,
    });
    expect(trendingService.compute).toHaveBeenCalledWith(
      filteredMessages,
      buildSentiments(filteredMessages),
      fixedNow
    );
    expect(anomalyService.detect).toHaveBeenCalledWith(
      filteredMessages,
      buildSentiments(filteredMessages)
    );
    expect(engagementService.compute).toHaveBeenCalledWith(
      filteredMessages,
      metaFlags
    );
  });

  it("returns aggregated response with meta flags and service outputs", () => {
    const distribution: SentimentDistribution = {
      positive: 10,
      negative: 20,
      neutral: 70,
    };
    const trending: TrendingTopic[] = [
      { hashtag: "#tag", weight: 1, frequency: 1, sentiment_modifier: 1 },
    ];
    const anomalies = {
      burst_users: ["user_a"],
      alternating_users: [],
      synchronized_clusters: ["2025-09-10T09:59:00Z"],
    };

    const sentimentService = {
      analyzeWithDetails: jest.fn((messages: FeedMessage[]) => ({
        distribution,
        message_sentiments: buildSentiments(messages),
      })),
    };
    const engagementService = { compute: jest.fn(() => 42) };
    const trendingService = { compute: jest.fn(() => trending) };
    const anomalyService = { detect: jest.fn(() => anomalies) };

    const service = new AnalyzeFeedService(
      sentimentService as any,
      engagementService as any,
      trendingService as any,
      anomalyService as any
    );

    const specialContent = "XXXXXXXXXX mbras YYYYYYYYYYYYYYYYYYYYYYYYY";
    expect([...specialContent].length).toBe(42);

    const input: AnalyzeFeedRequest = {
      messages: [
        buildMessage({ user_id: "user_mbras_001" }),
        buildMessage({ content: "teste técnico mbras" }),
        buildMessage({ content: specialContent }),
      ],
      time_window_minutes: 30,
    };

    const result = service.execute({ input, nowUtc: fixedNow });

    expect(result).toEqual({
      error: false,
      data: {
        sentiment_distribution: distribution,
        trending_topics: trending,
        anomalies,
        engagement_score: 42,
        mbras_employee: true,
        candidate_awareness: true,
        special_pattern: true,
      },
    });
  });
});
