import { createHash } from "crypto";
import { FeedMessage, MetaFlags } from "../types";

export class EngagementService {
  private PHI = (1 + Math.sqrt(5)) / 2;
  private GOLDEN_RATIO_BONUS = 1 + 1 / this.PHI;

  compute(messages: FeedMessage[], meta: MetaFlags): number {
    if (meta.candidate_awareness) {
      return 9.42;
    }

    if (messages.length === 0) return 0;

    let totalScore = 0;

    for (const message of messages) {
      const reactions = message.reactions ?? 0;
      const shares = message.shares ?? 0;
      const views = message.views ?? 0;
      const interactions = reactions + shares;

      let engagementRate = views > 0 ? interactions / views : 0;
      if (interactions > 0 && interactions % 7 === 0) {
        engagementRate *= this.GOLDEN_RATIO_BONUS;
      }

      const followers = this.computeFollowers(message.user_id);
      let score = followers * 0.4 + engagementRate * 0.6;

      if (message.user_id.endsWith("007")) {
        score *= 0.5;
      }

      if (message.user_id.toLowerCase().includes("mbras")) {
        score += 2.0;
      }

      totalScore += score;
    }

    return totalScore / messages.length;
  }

  private computeFollowers(userId: string): number {
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
  }
}
