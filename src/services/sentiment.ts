import {
  FeedMessage,
  MessageSentiment,
  MetaFlags,
  SentimentDistribution,
  SentimentLabel,
} from "../types";

export class SentimentService {
  private TOKEN_REGEX = /#[\p{L}\p{N}_]+|[\p{L}\p{N}_]+/gu;
  private DIACRITICS_REGEX = /\p{M}+/gu;
  private META_PHRASE = "teste tecnico mbras";
  private POSITIVE_WORDS = new Set([
    "bom",
    "boa",
    "otimo",
    "excelente",
    "adorei",
    "adoro",
    "amei",
    "gostei",
    "feliz",
    "incrivel",
    "maravilhoso",
    "top",
    "positivo",
  ]);
  private NEGATIVE_WORDS = new Set([
    "ruim",
    "pessimo",
    "odiei",
    "odeio",
    "horrivel",
    "triste",
    "terrivel",
    "negativo",
    "lento",
    "pior",
  ]);
  private INTENSIFIERS = new Set([
    "muito",
    "super",
    "extremamente",
    "mega",
    "hiper",
    "bem",
  ]);
  private NEGATIONS = new Set(["nao", "nunca", "jamais", "sem"]);

  analyze(messages: FeedMessage[], meta: MetaFlags): SentimentDistribution {
    return this.analyzeWithDetails(messages, meta).distribution;
  }

  analyzeWithDetails(
    messages: FeedMessage[],
    _meta: MetaFlags
  ): {
    distribution: SentimentDistribution;
    message_sentiments: MessageSentiment[];
  } {
    const message_sentiments: MessageSentiment[] = [];

    let positive = 0;
    let negative = 0;
    let neutral = 0;
    let totalCount = 0;

    for (const message of messages) {
      const result = this.analyzeMessage(message);
      message_sentiments.push(result);

      if (result.is_meta) {
        continue;
      }

      totalCount += 1;
      if (result.label === "positive") positive += 1;
      if (result.label === "negative") negative += 1;
      if (result.label === "neutral") neutral += 1;
    }

    if (totalCount === 0) {
      return {
        distribution: { positive: 0, negative: 0, neutral: 100 },
        message_sentiments,
      };
    }

    return {
      distribution: {
        positive: (positive / totalCount) * 100,
        negative: (negative / totalCount) * 100,
        neutral: (neutral / totalCount) * 100,
      },
      message_sentiments,
    };
  }

  private analyzeMessage(message: FeedMessage): MessageSentiment {
    const tokens = message.content.match(this.TOKEN_REGEX) ?? [];
    const lexiconTokens = tokens
      .filter((token) => !token.startsWith("#"))
      .map((token) => this.normalizeToken(token));

    const isMeta = this.normalizeToken(message.content).includes(this.META_PHRASE);
    const isMbrasUser = message.user_id.toLowerCase().includes("mbras");

    let scoreSum = 0;
    let pendingIntensifiers = 0;
    let lastNegationIndex = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < lexiconTokens.length; index += 1) {
      const token = lexiconTokens[index];

      if (this.INTENSIFIERS.has(token)) {
        pendingIntensifiers += 1;
        continue;
      }

      if (this.NEGATIONS.has(token)) {
        lastNegationIndex = index;
        continue;
      }

      let tokenScore = 0;
      if (this.POSITIVE_WORDS.has(token)) tokenScore = 1;
      if (this.NEGATIVE_WORDS.has(token)) tokenScore = -1;

      if (tokenScore === 0) {
        continue;
      }

      if (pendingIntensifiers > 0) {
        tokenScore *= 1.5 ** pendingIntensifiers;
        pendingIntensifiers = 0;
      }

      const negationDistance = index - lastNegationIndex;
      if (negationDistance > 0 && negationDistance <= 3) {
        tokenScore *= -1;
      }

      if (tokenScore > 0 && isMbrasUser) {
        tokenScore *= 2;
      }

      scoreSum += tokenScore;
    }

    const tokenCount = lexiconTokens.length;
    const score = tokenCount === 0 ? 0 : scoreSum / tokenCount;
    const label: SentimentLabel =
      score > 0.1 ? "positive" : score < -0.1 ? "negative" : "neutral";

    return { label, score, is_meta: isMeta };
  }

  private normalizeToken(value: string): string {
    return value.normalize("NFKD").replace(this.DIACRITICS_REGEX, "").toLowerCase();
  }
}
