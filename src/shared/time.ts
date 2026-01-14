import { FeedMessage } from "../types";

export class Time {
  static applyWindow(
    messages: FeedMessage[],
    timeWindowMinutes: number,
    nowUtc: Date
  ): FeedMessage[] {
    const nowMs = nowUtc.getTime();
    const lowerBoundMs = nowMs - timeWindowMinutes * 60_000;

    return messages.filter((m) => {
      const ts = Date.parse(m.timestamp);
      if (Number.isNaN(ts)) return false;

      if (ts > nowMs + 5_000) return false;

      return ts >= lowerBoundMs;
    });
  }
}
