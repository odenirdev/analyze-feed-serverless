import { AnalyzeFeedHandler } from "../src/handlers/analyze_feed";
import { FeedMessage } from "../src/types";

const baseMessage: FeedMessage = {
  user_id: "user_123",
  content: "ok",
  timestamp: "2025-09-10T10:00:00Z",
  reactions: 0,
  shares: 0,
  views: 1,
  hashtags: [],
};

const buildPayload = (overrides: Partial<FeedMessage>) => ({
  messages: [{ ...baseMessage, ...overrides }],
  time_window_minutes: 30,
});

const parseBody = (body: string) => JSON.parse(body);
const callHandler = async (handler: AnalyzeFeedHandler, event: any) =>
  (await handler.handler(event)) as { statusCode: number; body: string };
const callWithPayload = async (
  payload: unknown,
  handler = new AnalyzeFeedHandler()
) => callHandler(handler, { body: JSON.stringify(payload) } as any);

describe("AnalyzeFeedHandler validation", () => {
  it("returns 400 when request body is missing", async () => {
    const response = await callHandler(new AnalyzeFeedHandler(), {} as any);

    expect(response.statusCode).toBe(400);
    expect(parseBody(response.body).message).toBe("Missing request body");
  });

  it("returns 400 for invalid JSON body", async () => {
    const response = await callHandler(new AnalyzeFeedHandler(), {
      body: "{",
    } as any);

    expect(response.statusCode).toBe(400);
    expect(parseBody(response.body).message).toBe("Invalid JSON body");
  });

  it("returns 400 for invalid request payload", async () => {
    const response = await callWithPayload({
      messages: "nope",
      time_window_minutes: "30",
    });

    expect(response.statusCode).toBe(400);
    expect(parseBody(response.body).message).toBe("Invalid request payload");
  });

  it("returns 400 for invalid message object", async () => {
    const response = await callWithPayload({
      messages: [null],
      time_window_minutes: 30,
    });

    expect(response.statusCode).toBe(400);
    expect(parseBody(response.body).message).toBe("Invalid message object");
  });

  it("returns 400 for invalid user_id", async () => {
    const response = await callWithPayload(buildPayload({ user_id: "bad" }));

    expect(response.statusCode).toBe(400);
    expect(parseBody(response.body).message).toBe("Invalid user_id");
  });

  it("returns 400 for invalid content type", async () => {
    const response = await callWithPayload(
      buildPayload({ content: 123 as any })
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody(response.body).message).toBe("Invalid content");
  });

  it("returns 400 when content exceeds 280 characters", async () => {
    const response = await callWithPayload(
      buildPayload({ content: "a".repeat(281) })
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody(response.body).message).toBe("Content exceeds 280 characters");
  });

  it("returns 400 for non-string timestamp", async () => {
    const response = await callWithPayload(
      buildPayload({ timestamp: 123 as any })
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody(response.body).message).toBe("Invalid timestamp");
  });

  it("returns 400 for invalid timestamp format", async () => {
    const response = await callWithPayload(
      buildPayload({ timestamp: "2025-09-10 10:00:00" })
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody(response.body).message).toBe("Invalid timestamp");
  });

  it("returns 400 for unparseable timestamp", async () => {
    const response = await callWithPayload(
      buildPayload({ timestamp: "2025-99-99T00:00:00Z" })
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody(response.body).message).toBe("Invalid timestamp");
  });

  it("returns 400 for invalid hashtags type", async () => {
    const response = await callWithPayload(
      buildPayload({ hashtags: "nope" as any })
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody(response.body).message).toBe("Invalid hashtags");
  });

  it("returns 400 for invalid hashtag values", async () => {
    const response = await callWithPayload(
      buildPayload({ hashtags: ["#ok", "bad"] })
    );

    expect(response.statusCode).toBe(400);
    expect(parseBody(response.body).message).toBe("Invalid hashtags");
  });
});

describe("AnalyzeFeedHandler service responses", () => {
  it("returns 400 when service reports error", async () => {
    const service = {
      execute: jest.fn(() => ({
        error: true,
        message: "Service error",
        details: { code: "FAIL" },
      })),
    };
    const handler = new AnalyzeFeedHandler(service as any);
    const response = await callWithPayload(
      buildPayload({ hashtags: null as unknown as string[] }),
      handler
    );

    expect(service.execute).toHaveBeenCalled();
    expect(response.statusCode).toBe(400);
    expect(parseBody(response.body)).toEqual({
      message: "Service error",
      details: { code: "FAIL" },
    });
  });

  it("returns 200 with data on success", async () => {
    const service = {
      execute: jest.fn(() => ({
        error: false,
        data: { ok: true },
      })),
    };
    const handler = new AnalyzeFeedHandler(service as any);
    const response = await callWithPayload(buildPayload({}), handler);

    expect(service.execute).toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(parseBody(response.body)).toEqual({
      message: undefined,
      data: { ok: true },
    });
  });
});
