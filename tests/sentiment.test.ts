import { SentimentService } from "../src/services/sentiment";
import { FeedMessage, MetaFlags } from "../src/types";

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

const defaultMeta: MetaFlags = {
  mbras_employee: false,
  candidate_awareness: false,
  special_pattern: false,
};

describe("SentimentService unit tests", () => {
  it("exposes distribution via analyze", () => {
    const service = new SentimentService();
    const messages = [
      buildMessage({ content: "bom" }),
      buildMessage({ content: "ruim" }),
    ];

    const result = service.analyze(messages, defaultMeta);

    expect(result).toEqual({
      positive: 50,
      negative: 50,
      neutral: 0,
    });
  });

  it("marks meta messages and excludes them from distribution", () => {
    const service = new SentimentService();
    const messages = [
      buildMessage({ content: "teste técnico mbras" }),
      buildMessage({ content: "adorei o produto" }),
    ];

    const result = service.analyzeWithDetails(messages, defaultMeta);

    expect(result.message_sentiments[0].is_meta).toBe(true);
    expect(result.message_sentiments[1].is_meta).toBe(false);
    expect(result.distribution.positive).toBe(100);
    expect(result.distribution.negative).toBe(0);
    expect(result.distribution.neutral).toBe(0);
  });

  it("returns neutral distribution when all messages are meta", () => {
    const service = new SentimentService();
    const messages = [
      buildMessage({ content: "teste técnico mbras" }),
      buildMessage({ content: "teste tecnico mbras" }),
    ];

    const result = service.analyzeWithDetails(messages, defaultMeta);

    expect(result.distribution).toEqual({
      positive: 0,
      negative: 0,
      neutral: 100,
    });
  });

  it("handles intensifiers and negations", () => {
    const service = new SentimentService();
    const messages = [
      buildMessage({ content: "muito bom" }),
      buildMessage({ content: "nao gostei" }),
      buildMessage({ content: "nao muito bom" }),
    ];

    const result = service.analyzeWithDetails(messages, defaultMeta);

    expect(result.message_sentiments[0].label).toBe("positive");
    expect(result.message_sentiments[1].label).toBe("negative");
    expect(result.message_sentiments[2].label).toBe("negative");
  });

  it("normalizes diacritics for lexicon matching", () => {
    const service = new SentimentService();
    const messages = [buildMessage({ content: "ótimo" })];

    const result = service.analyzeWithDetails(messages, defaultMeta);

    expect(result.message_sentiments[0].label).toBe("positive");
  });

  it("boosts positive score for mbras users", () => {
    const service = new SentimentService();
    const messages = [
      buildMessage({ user_id: "user_regular", content: "bom ok" }),
      buildMessage({ user_id: "user_mbras_001", content: "bom ok" }),
    ];

    const result = service.analyzeWithDetails(messages, defaultMeta);

    expect(result.message_sentiments[1].score).toBeGreaterThan(
      result.message_sentiments[0].score
    );
  });

  it("treats content with no tokens as neutral", () => {
    const service = new SentimentService();
    const messages = [buildMessage({ content: "!!!" })];

    const result = service.analyzeWithDetails(messages, defaultMeta);

    expect(result.message_sentiments[0].label).toBe("neutral");
    expect(result.message_sentiments[0].score).toBe(0);
  });
});
