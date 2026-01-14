import { Time } from "../src/shared/time";
import { FeedMessage } from "../src/types";

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

describe("Time.applyWindow unit tests", () => {
  it("filters messages inside the time window", () => {
    const nowUtc = new Date("2025-09-10T10:00:00Z");
    const messages = [
      buildMessage({ timestamp: "2025-09-10T09:20:00Z", user_id: "old" }),
      buildMessage({ timestamp: "2025-09-10T09:45:00Z", user_id: "in" }),
      buildMessage({ timestamp: "2025-09-10T10:00:00Z", user_id: "now" }),
    ];

    const result = Time.applyWindow(messages, 30, nowUtc);

    expect(result.map((m) => m.user_id)).toEqual(["in", "now"]);
  });

  it("excludes messages beyond 5 seconds in the future", () => {
    const nowUtc = new Date("2025-09-10T10:00:00Z");
    const messages = [
      buildMessage({ timestamp: "2025-09-10T10:00:04Z", user_id: "ok" }),
      buildMessage({ timestamp: "2025-09-10T10:00:06Z", user_id: "future" }),
    ];

    const result = Time.applyWindow(messages, 30, nowUtc);

    expect(result.map((m) => m.user_id)).toEqual(["ok"]);
  });

  it("drops messages with invalid timestamps", () => {
    const nowUtc = new Date("2025-09-10T10:00:00Z");
    const messages = [
      buildMessage({ timestamp: "invalid-date", user_id: "bad" }),
      buildMessage({ timestamp: "2025-09-10T09:50:00Z", user_id: "good" }),
    ];

    const result = Time.applyWindow(messages, 30, nowUtc);

    expect(result.map((m) => m.user_id)).toEqual(["good"]);
  });
});
