import { createHash } from "crypto";
import { EngagementService } from "../src/services/engagement";
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

const computeFollowers = (userId: string): number => {
  const hasNonAscii = /[^\x00-\x7F]/.test(userId);
  const hashInput = hasNonAscii ? userId.normalize("NFKD") : userId;
  const hashHex = createHash("sha256").update(hashInput).digest("hex");
  const hashValue = BigInt(`0x${hashHex}`);

  const codepointLength = [...userId].length;
  let followers = Number(hashValue % 10000n) + 100;

  if (codepointLength === 13) {
    followers = Number(hashValue % 9000n) + 1000;
  }

  if (userId.endsWith("_prime")) {
    followers += 113;
  }

  return followers;
};

const phi = (1 + Math.sqrt(5)) / 2;
const goldenRatioBonus = 1 + 1 / phi;

describe("EngagementService unit tests", () => {
  it("returns override when candidate awareness is active", () => {
    const service = new EngagementService();
    const meta: MetaFlags = {
      mbras_employee: false,
      candidate_awareness: true,
      special_pattern: false,
    };

    const result = service.compute([buildMessage({})], meta);

    expect(result).toBe(9.42);
  });

  it("returns zero when there are no messages", () => {
    const service = new EngagementService();
    const meta: MetaFlags = {
      mbras_employee: false,
      candidate_awareness: false,
      special_pattern: false,
    };

    const result = service.compute([], meta);

    expect(result).toBe(0);
  });

  it("applies golden ratio bonus when interactions are multiples of 7", () => {
    const service = new EngagementService();
    const meta: MetaFlags = {
      mbras_employee: false,
      candidate_awareness: false,
      special_pattern: false,
    };

    const message = buildMessage({
      user_id: "user_bonus",
      reactions: 3,
      shares: 4,
      views: 14,
    });

    const interactions = 7;
    const engagementRate = (interactions / 14) * goldenRatioBonus;
    const followers = computeFollowers(message.user_id);
    const expected = followers * 0.4 + engagementRate * 0.6;

    const result = service.compute([message], meta);

    expect(result).toBeCloseTo(expected, 10);
  });

  it("applies 007 penalty and mbras bonus for the same user", () => {
    const service = new EngagementService();
    const meta: MetaFlags = {
      mbras_employee: false,
      candidate_awareness: false,
      special_pattern: false,
    };

    const message = buildMessage({
      user_id: "user_mbras_007",
      reactions: 2,
      shares: 1,
      views: 10,
    });

    const interactions = 3;
    const engagementRate = interactions / 10;
    const followers = computeFollowers(message.user_id);
    const baseScore = followers * 0.4 + engagementRate * 0.6;
    const expected = baseScore * 0.5 + 2.0;

    const result = service.compute([message], meta);

    expect(result).toBeCloseTo(expected, 10);
  });

  it("applies followers adjustments for 13-char and _prime users", () => {
    const service = new EngagementService();
    const meta: MetaFlags = {
      mbras_employee: false,
      candidate_awareness: false,
      special_pattern: false,
    };

    const message = buildMessage({
      user_id: "abcdefg_prime",
      reactions: 0,
      shares: 0,
      views: 1,
    });

    const followers = computeFollowers(message.user_id);
    const expected = followers * 0.4;

    const result = service.compute([message], meta);

    expect(result).toBeCloseTo(expected, 10);
  });

  it("treats missing reactions/shares/views as zero", () => {
    const service = new EngagementService();
    const meta: MetaFlags = {
      mbras_employee: false,
      candidate_awareness: false,
      special_pattern: false,
    };

    const message = buildMessage({
      user_id: "user_nullish",
      reactions: undefined,
      shares: undefined,
      views: undefined,
    });

    const followers = computeFollowers(message.user_id);
    const expected = followers * 0.4;

    const result = service.compute([message], meta);

    expect(result).toBeCloseTo(expected, 10);
  });

  it("normalizes non-ascii user ids before hashing followers", () => {
    const service = new EngagementService();
    const meta: MetaFlags = {
      mbras_employee: false,
      candidate_awareness: false,
      special_pattern: false,
    };

    const message = buildMessage({
      user_id: "josé_ß",
      reactions: 0,
      shares: 0,
      views: 1,
    });

    const followers = computeFollowers(message.user_id);
    const expected = followers * 0.4;

    const result = service.compute([message], meta);

    expect(result).toBeCloseTo(expected, 10);
  });
});
