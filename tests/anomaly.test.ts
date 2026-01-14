import { AnomalyService } from "../src/services/anomaly";
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

const toIso = (base: Date, offsetMs: number) =>
  new Date(base.getTime() + offsetMs).toISOString();

describe("AnomalyService unit tests", () => {
  it("flags burst users with more than 10 messages within 5 minutes", () => {
    const service = new AnomalyService();
    const base = new Date("2025-09-10T10:00:00Z");

    const burstMessages = Array.from({ length: 11 }, (_, idx) =>
      buildMessage({
        user_id: "user_burst",
        timestamp: toIso(base, idx * 20_000),
      })
    );

    const safeMessages = Array.from({ length: 10 }, (_, idx) =>
      buildMessage({
        user_id: "user_safe",
        timestamp: toIso(base, idx * 20_000),
      })
    );

    const messages = [...burstMessages, ...safeMessages];
    const sentiments = buildSentiments(messages);

    const result = service.detect(messages, sentiments);

    expect(result.burst_users).toContain("user_burst");
    expect(result.burst_users).not.toContain("user_safe");
  });

  it("shrinks the burst window when messages fall outside 5 minutes", () => {
    const service = new AnomalyService();
    const base = new Date("2025-09-10T10:00:00Z");
    const messages = [
      buildMessage({
        user_id: "user_window",
        timestamp: toIso(base, 0),
      }),
      buildMessage({
        user_id: "user_window",
        timestamp: toIso(base, 6 * 60_000),
      }),
    ];

    const result = service.detect(messages, buildSentiments(messages));

    expect(result.burst_users).toEqual([]);
  });

  it("flags alternating users with 10+ non-neutral alternations", () => {
    const service = new AnomalyService();
    const base = new Date("2025-09-10T10:00:00Z");
    const labels: MessageSentiment["label"][] = Array.from(
      { length: 10 },
      (_, idx) => (idx % 2 === 0 ? "positive" : "negative")
    );

    const messages = labels.map((_, idx) =>
      buildMessage({
        user_id: "user_alternating",
        timestamp: toIso(base, idx * 1_000),
      })
    );

    const result = service.detect(messages, buildSentiments(messages, labels));

    expect(result.alternating_users).toEqual(["user_alternating"]);
  });

  it("does not flag alternating users when non-neutral sequence is too short", () => {
    const service = new AnomalyService();
    const base = new Date("2025-09-10T10:00:00Z");
    const labels: MessageSentiment["label"][] = [
      "positive",
      "negative",
      "neutral",
      "positive",
      "negative",
      "neutral",
      "positive",
      "negative",
      "positive",
      "negative",
    ];

    const messages = labels.map((_, idx) =>
      buildMessage({
        user_id: "user_alternating_short",
        timestamp: toIso(base, idx * 1_000),
      })
    );

    const result = service.detect(messages, buildSentiments(messages, labels));

    expect(result.alternating_users).toEqual([]);
  });

  it("does not flag alternating users when sentiments repeat", () => {
    const service = new AnomalyService();
    const base = new Date("2025-09-10T10:00:00Z");
    const labels: MessageSentiment["label"][] = Array.from(
      { length: 10 },
      () => "positive"
    );

    const messages = labels.map((_, idx) =>
      buildMessage({
        user_id: "user_repeat",
        timestamp: toIso(base, idx * 1_000),
      })
    );

    const result = service.detect(messages, buildSentiments(messages, labels));

    expect(result.alternating_users).toEqual([]);
  });

  it("detects synchronized clusters within 4 seconds and skips invalid timestamps", () => {
    const service = new AnomalyService();
    const base = new Date("2025-09-10T10:00:00Z");

    const messages: FeedMessage[] = [
      buildMessage({
        user_id: "user_a",
        timestamp: toIso(base, 0),
      }),
      buildMessage({
        user_id: "user_b",
        timestamp: toIso(base, 1_000),
      }),
      buildMessage({
        user_id: "user_c",
        timestamp: toIso(base, 3_000),
      }),
      buildMessage({
        user_id: "user_bad",
        timestamp: "invalid-date",
      }),
    ];

    const result = service.detect(messages, buildSentiments(messages));

    expect(result.synchronized_clusters).toEqual([toIso(base, 0)]);
  });

  it("defaults missing sentiment entries to neutral", () => {
    const service = new AnomalyService();
    const base = new Date("2025-09-10T10:00:00Z");

    const messages = Array.from({ length: 10 }, (_, idx) =>
      buildMessage({
        user_id: "user_missing_sentiments",
        timestamp: toIso(base, idx * 1_000),
      })
    );

    const result = service.detect(messages, []);

    expect(result.alternating_users).toEqual([]);
    expect(result.burst_users).toEqual([]);
  });
});
