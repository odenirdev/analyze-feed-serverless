import { handler } from "../src/handlers/analyze_feed";

const fixedNow = new Date("2025-09-10T10:02:00Z");

const postAnalyze = async (payload: unknown) => {
  const event = {
    body: JSON.stringify(payload),
  } as any;

  // Ensure the handler returns a promise that resolves to an object with statusCode and body
  return handler(event) as Promise<{ statusCode: number; body: string }>;
};

const parseBody = (body: string | null | undefined) => {
  if (!body) return null;
  return JSON.parse(body);
};

describe("Analyze Feed Integration Tests", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it("basic case: returns expected analysis fields and trending topic", async () => {
    const payload = {
      messages: [
        {
          id: "msg_001",
          content: "Adorei o produto!",
          timestamp: "2025-09-10T10:00:00Z",
          user_id: "user_123",
          hashtags: ["#produto"],
          reactions: 10,
          shares: 2,
          views: 100,
        },
      ],
      time_window_minutes: 30,
    };

    const response = await postAnalyze(payload);
    expect(response.statusCode).toBe(200);
    const body = parseBody(response.body);
    const analysis = body.data;
    expect(Object.keys(analysis)).toEqual(
      expect.arrayContaining([
        "sentiment_distribution",
        "engagement_score",
        "trending_topics",
        "anomalies",
        "mbras_employee",
        "candidate_awareness",
        "special_pattern",
      ])
    );
    const dist = analysis.sentiment_distribution;
    expect(dist.positive).toBe(100);
    expect(
      analysis.trending_topics.some(
        (topic: { hashtag: string }) => topic.hashtag === "#produto"
      )
    ).toBe(true);
  });

  it("window error 422: unsupported time window", async () => {
    const payload = {
      messages: [
        {
          id: "msg_002",
          content: "Este e um teste muito interessante",
          timestamp: "2025-09-10T10:00:00Z",
          user_id: "user_mbras_007",
          hashtags: ["#teste"],
          reactions: 5,
          shares: 2,
          views: 100,
        },
      ],
      time_window_minutes: 123,
    };

    const response = await postAnalyze(payload);
    expect(response.statusCode).toBe(422);
    expect(parseBody(response.body)).toEqual({
      message: "Business rule violation",
      details: { code: "UNSUPPORTED_TIME_WINDOW" },
    });
  });

  it("flags especiais and meta: candidate awareness + engagement override", async () => {
    const payload = {
      messages: [
        {
          id: "msg_003",
          content: "teste técnico mbras",
          timestamp: "2025-09-10T10:00:00Z",
          user_id: "user_mbras_1007",
          hashtags: ["#teste"],
          reactions: 5,
          shares: 2,
          views: 100,
        },
      ],
      time_window_minutes: 30,
    };

    const response = await postAnalyze(payload);
    expect(response.statusCode).toBe(200);
    const analysis = parseBody(response.body).data;
    expect(analysis.mbras_employee).toBe(true);
    expect(analysis.candidate_awareness).toBe(true);
    expect(analysis.engagement_score).toBe(9.42);
    const dist = analysis.sentiment_distribution;
    expect(dist.positive).toBe(0);
    expect(dist.negative).toBe(0);
    expect(dist.neutral).toBe(100);
  });

  it("intensifier orphan neutral", async () => {
    const payload = {
      messages: [
        {
          id: "msg_004",
          content: "muito",
          timestamp: "2025-09-10T10:00:00Z",
          user_id: "user_abc",
          hashtags: [],
          reactions: 0,
          shares: 0,
          views: 1,
        },
      ],
      time_window_minutes: 30,
    };

    const response = await postAnalyze(payload);
    expect(response.statusCode).toBe(200);
    const dist = parseBody(response.body).data.sentiment_distribution;
    expect(dist.neutral).toBe(100);
  });

  it("negation flips sentiment to negative", async () => {
    const payload = {
      messages: [
        {
          id: "msg_005",
          content: "nao gostei",
          timestamp: "2025-09-10T10:00:00Z",
          user_id: "user_abc",
          hashtags: [],
          reactions: 0,
          shares: 0,
          views: 1,
        },
      ],
      time_window_minutes: 30,
    };

    const response = await postAnalyze(payload);
    expect(response.statusCode).toBe(200);
    const dist = parseBody(response.body).data.sentiment_distribution;
    expect(dist.negative).toBe(100);
  });

  it("user_id case insensitive mbras flag", async () => {
    const payload = {
      messages: [
        {
          id: "msg_006",
          content: "Adorei",
          timestamp: "2025-09-10T10:00:00Z",
          user_id: "user_MBRAS_007",
          hashtags: [],
          reactions: 0,
          shares: 0,
          views: 1,
        },
      ],
      time_window_minutes: 30,
    };

    const response = await postAnalyze(payload);
    expect(response.statusCode).toBe(200);
    const analysis = parseBody(response.body).data;
    expect(analysis.mbras_employee).toBe(true);
  });

  it("special pattern and non-mbras user", async () => {
    const content = "XXXXXXXXXX mbras YYYYYYYYYYYYYYYYYYYYYYYYY";
    expect([...content].length).toBe(42);

    const payload = {
      messages: [
        {
          id: "msg_007",
          content,
          timestamp: "2025-09-10T10:00:00Z",
          user_id: "user_especialista_999",
          hashtags: ["#review"],
          reactions: 3,
          shares: 1,
          views: 75,
        },
      ],
      time_window_minutes: 30,
    };

    const response = await postAnalyze(payload);
    expect(response.statusCode).toBe(200);
    const analysis = parseBody(response.body).data;
    expect(analysis.special_pattern).toBe(true);
    expect(analysis.mbras_employee).toBe(false);
    const dist = analysis.sentiment_distribution;
    expect(dist.neutral).toBe(100);
    expect(
      analysis.trending_topics.some(
        (topic: { hashtag: string }) => topic.hashtag === "#review"
      )
    ).toBe(true);
  });

  it("deterministic engagement score for same input", async () => {
    const payload = {
      messages: [
        {
          id: "msg_det1",
          content: "teste",
          timestamp: "2025-09-10T10:00:00Z",
          user_id: "user_deterministic_test",
          hashtags: [],
          reactions: 1,
          shares: 0,
          views: 10,
        },
      ],
      time_window_minutes: 30,
    };

    const r1 = await postAnalyze(payload);
    const r2 = await postAnalyze(payload);
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    const s1 = parseBody(r1.body).data.engagement_score;
    const s2 = parseBody(r2.body).data.engagement_score;
    expect(s1).toBe(s2);
  });

  it("sentiment and trending cross validation", async () => {
    const payload = {
      messages: [
        {
          id: "msg_cross1",
          content: "adorei muito!",
          timestamp: "2025-09-10T10:00:00Z",
          user_id: "user_cross1",
          hashtags: ["#positivo"],
          reactions: 5,
          shares: 2,
          views: 50,
        },
        {
          id: "msg_cross2",
          content: "terrivel produto",
          timestamp: "2025-09-10T10:01:00Z",
          user_id: "user_cross2",
          hashtags: ["#negativo"],
          reactions: 1,
          shares: 0,
          views: 25,
        },
      ],
      time_window_minutes: 30,
    };

    const response = await postAnalyze(payload);
    expect(response.statusCode).toBe(200);
    const trending = parseBody(response.body).data.trending_topics;
    const posIdx = trending.findIndex(
      (topic: { hashtag: string }) => topic.hashtag === "#positivo"
    );
    const negIdx = trending.findIndex(
      (topic: { hashtag: string }) => topic.hashtag === "#negativo"
    );
    expect(posIdx).toBeGreaterThanOrEqual(0);
    expect(negIdx).toBeGreaterThanOrEqual(0);
    expect(posIdx).toBeLessThan(negIdx);
  });
});
