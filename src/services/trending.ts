import {
  FeedMessage,
  MessageSentiment,
  SentimentLabel,
  TrendingTopic,
} from "../types";

export class TrendingService {
  private LONG_HASHTAG_THRESHOLD = 8;
  private LOG_BASE = Math.log10(this.LONG_HASHTAG_THRESHOLD);

  compute(
    messages: FeedMessage[],
    messageSentiments: MessageSentiment[],
    nowUtc: Date
  ): TrendingTopic[] {
    const byHashtag = new Map<
      string,
      { weight: number; frequency: number; sentimentSum: number }
    >();

    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      const sentiment = messageSentiments[index];
      const hashtags = message.hashtags ?? [];

      if (!hashtags.length) continue;

      const ts = Date.parse(message.timestamp);
      if (Number.isNaN(ts)) continue;

      const minutesSince = Math.max((nowUtc.getTime() - ts) / 60_000, 0.01);
      const temporalWeight = 1 + 1 / minutesSince;
      const sentimentModifier = this.sentimentModifierFor(
        sentiment?.label ?? "neutral"
      );

      for (const rawTag of hashtags) {
        if (typeof rawTag !== "string" || !rawTag.startsWith("#")) continue;

        const normalized = rawTag.toLowerCase();
        const tagText = normalized.slice(1);
        const lengthFactor =
          tagText.length > this.LONG_HASHTAG_THRESHOLD
            ? Math.log10(tagText.length) / this.LOG_BASE
            : 1;

        const weight = temporalWeight * sentimentModifier * lengthFactor;
        const entry = byHashtag.get(normalized) ?? {
          weight: 0,
          frequency: 0,
          sentimentSum: 0,
        };
        entry.weight += weight;
        entry.frequency += 1;
        entry.sentimentSum += sentimentModifier;
        byHashtag.set(normalized, entry);
      }
    }

    return [...byHashtag.entries()]
      .map(([hashtag, data]) => ({
        hashtag,
        weight: data.weight,
        frequency: data.frequency,
        sentiment_modifier: data.sentimentSum / data.frequency,
      }))
      .sort((a, b) => {
        if (b.weight !== a.weight) return b.weight - a.weight;
        if (b.frequency !== a.frequency) return b.frequency - a.frequency;
        if (b.sentiment_modifier !== a.sentiment_modifier) {
          return b.sentiment_modifier - a.sentiment_modifier;
        }
        return a.hashtag.localeCompare(b.hashtag);
      })
      .slice(0, 5);
  }

  private sentimentModifierFor(label: SentimentLabel): number {
    if (label === "positive") return 1.2;
    if (label === "negative") return 0.8;
    return 1.0;
  }
}
