import { AnomalyFlags, FeedMessage, MessageSentiment } from "../types";

export class AnomalyService {
  detect(messages: FeedMessage[], messageSentiments: MessageSentiment[]): AnomalyFlags {
    const burstUsers: string[] = [];
    const alternatingUsers: string[] = [];
    const synchronizedClusters: string[] = [];

    const byUser = new Map<
      string,
      { timestamps: number[]; sentiments: MessageSentiment["label"][] }
    >();

    messages.forEach((message, index) => {
      const ts = Date.parse(message.timestamp);
      if (Number.isNaN(ts)) return;
      const entry = byUser.get(message.user_id) ?? {
        timestamps: [],
        sentiments: [],
      };
      entry.timestamps.push(ts);
      entry.sentiments.push(messageSentiments[index]?.label ?? "neutral");
      byUser.set(message.user_id, entry);
    });

    for (const [userId, data] of byUser.entries()) {
      const paired = data.timestamps
        .map((ts, idx) => ({ ts, label: data.sentiments[idx] }))
        .sort((a, b) => a.ts - b.ts);

      const timestamps = paired.map((p) => p.ts);
      let start = 0;
      for (let end = 0; end < timestamps.length; end += 1) {
        while (timestamps[end] - timestamps[start] > 5 * 60_000) {
          start += 1;
        }
        if (end - start + 1 > 10) {
          burstUsers.push(userId);
          break;
        }
      }

      const sentimentSequence = paired
        .map((p) => p.label)
        .filter((label) => label !== "neutral");

      if (sentimentSequence.length >= 10) {
        let run = 1;
        let maxRun = 1;
        for (let i = 1; i < sentimentSequence.length; i += 1) {
          if (sentimentSequence[i] !== sentimentSequence[i - 1]) {
            run += 1;
          } else {
            run = 1;
          }
          if (run > maxRun) maxRun = run;
        }
        if (maxRun >= 10) {
          alternatingUsers.push(userId);
        }
      }
    }

    const syncCandidates = messages
      .map((message) => ({
        ts: Date.parse(message.timestamp),
        raw: message.timestamp,
      }))
      .filter((entry) => !Number.isNaN(entry.ts))
      .sort((a, b) => a.ts - b.ts);

    const clusterSet = new Set<string>();
    let start = 0;
    for (let end = 0; end < syncCandidates.length; end += 1) {
      while (syncCandidates[end].ts - syncCandidates[start].ts > 4_000) {
        start += 1;
      }
      if (end - start + 1 >= 3) {
        clusterSet.add(syncCandidates[start].raw);
      }
    }

    synchronizedClusters.push(...clusterSet.values());

    return {
      burst_users: burstUsers,
      alternating_users: alternatingUsers,
      synchronized_clusters: synchronizedClusters,
    };
  }
}
