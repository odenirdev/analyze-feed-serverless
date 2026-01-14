import { TrendingService } from "../src/services/trending";
import { FeedMessage, MessageSentiment } from "../src/types";

const buildMessage = (overrides: Partial<FeedMessage>): FeedMessage => ({
  user_id: "user_1",
  content: "ok",
  timestamp: "2025-09-10T10:00:00Z",
  reactions: 0,
  shares: 0,
  views: 1,
  hashtags: [],
  ...overrides,
});

const buildSentiments = (
  messages: FeedMessage[],
  labels: MessageSentiment["label"][] = []
): MessageSentiment[] =>
  messages.map((_, idx) => ({
    label: labels[idx] ?? "neutral",
    score: 0,
    is_meta: false,
  }));

describe("TrendingService unit tests", () => {
  it("aggregates weight, frequency, and average sentiment modifier", () => {
    const service = new TrendingService();
    const nowUtc = new Date("2025-09-10T10:00:00Z");
    const messages = [
      buildMessage({ hashtags: ["#tag"] }),
      buildMessage({ hashtags: ["#tag"] }),
    ];
    const sentiments = buildSentiments(messages, ["positive", "negative"]);

    const result = service.compute(messages, sentiments, nowUtc);

    expect(result).toHaveLength(1);
    expect(result[0].hashtag).toBe("#tag");
    expect(result[0].frequency).toBe(2);
    expect(result[0].sentiment_modifier).toBeCloseTo(1.0, 10);
    expect(result[0].weight).toBeCloseTo(202, 10);
  });

  it("applies length factor for long hashtags and normalizes to lowercase", () => {
    const service = new TrendingService();
    const nowUtc = new Date("2025-09-10T10:00:00Z");
    const messages = [
      buildMessage({ hashtags: ["#Short", "#SuperLongTag"] }),
    ];
    const sentiments = buildSentiments(messages);

    const result = service.compute(messages, sentiments, nowUtc);
    const shortTag = result.find((topic) => topic.hashtag === "#short");
    const longTag = result.find((topic) => topic.hashtag === "#superlongtag");

    expect(shortTag).toBeDefined();
    expect(longTag).toBeDefined();
    expect(longTag!.weight).toBeGreaterThan(shortTag!.weight);
  });

  it("ignores invalid timestamps and invalid hashtags", () => {
    const service = new TrendingService();
    const nowUtc = new Date("2025-09-10T10:00:00Z");
    const messages = [
      buildMessage({
        timestamp: "invalid-date",
        hashtags: ["#valid"],
      }),
      buildMessage({
        hashtags: ["valid", 123 as unknown as string, "#ok"],
      }),
    ];
    const sentiments = buildSentiments(messages);

    const result = service.compute(messages, sentiments, nowUtc);

    expect(result).toHaveLength(1);
    expect(result[0].hashtag).toBe("#ok");
  });

  it("uses hashtag name as final tie-breaker", () => {
    const service = new TrendingService();
    const nowUtc = new Date("2025-09-10T10:00:00Z");
    const messages = [
      buildMessage({ hashtags: ["#beta"] }),
      buildMessage({ hashtags: ["#alpha"] }),
    ];
    const sentiments = buildSentiments(messages);

    const result = service.compute(messages, sentiments, nowUtc);

    expect(result[0].hashtag).toBe("#alpha");
    expect(result[1].hashtag).toBe("#beta");
  });

  it("uses sentiment modifier when weights and frequency tie", () => {
    const service = new TrendingService();
    const nowUtc = new Date("2025-09-10T10:00:00.000Z");
    const messages = [
      buildMessage({
        hashtags: ["#alpha"],
        timestamp: new Date(nowUtc.getTime() - 20_000).toISOString(),
      }),
      buildMessage({
        hashtags: ["#beta"],
        timestamp: new Date(nowUtc.getTime() - 15_000).toISOString(),
      }),
    ];
    const sentiments = buildSentiments(messages, ["neutral", "negative"]);

    const result = service.compute(messages, sentiments, nowUtc);

    expect(result).toHaveLength(2);
    expect(result[0].hashtag).toBe("#alpha");
    expect(result[1].hashtag).toBe("#beta");
  });

  it("skips messages without hashtags", () => {
    const service = new TrendingService();
    const nowUtc = new Date("2025-09-10T10:00:00Z");
    const messages = [buildMessage({ hashtags: undefined })];
    const sentiments = buildSentiments(messages);

    const result = service.compute(messages, sentiments, nowUtc);

    expect(result).toEqual([]);
  });

  it("defaults missing sentiment entries to neutral", () => {
    const service = new TrendingService();
    const nowUtc = new Date("2025-09-10T10:00:00Z");
    const messages = [buildMessage({ hashtags: ["#neutral"] })];

    const result = service.compute(messages, [], nowUtc);

    expect(result).toHaveLength(1);
    expect(result[0].sentiment_modifier).toBe(1);
  });

  it("orders by frequency when weights tie", () => {
    const service = new TrendingService();
    const nowUtc = new Date("2025-09-10T10:00:00.000Z");
    const messages = [
      buildMessage({
        hashtags: ["#freq"],
        timestamp: new Date(nowUtc.getTime() - 60_000).toISOString(),
      }),
      buildMessage({
        hashtags: ["#freq"],
        timestamp: new Date(nowUtc.getTime() - 60_000).toISOString(),
      }),
      buildMessage({
        hashtags: ["#single"],
        timestamp: new Date(nowUtc.getTime() - 20_000).toISOString(),
      }),
    ];
    const sentiments = buildSentiments(messages);

    const result = service.compute(messages, sentiments, nowUtc);

    expect(result[0].hashtag).toBe("#freq");
    expect(result[1].hashtag).toBe("#single");
  });
});
