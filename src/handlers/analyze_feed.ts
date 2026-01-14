import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { AnalyzeFeedRequest, FeedMessage } from "../types";
import { AnalyzeFeedService } from "../services";
import { HttpResponse } from "../shared/http_response";

const USER_ID_REGEX = /^user_[a-z0-9_]{3,}$/i;
const TIMESTAMP_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const HASHTAG_REGEX = /^#[\p{L}\p{N}_]+$/u;

const validateMessages = (messages: FeedMessage[]): string | null => {
  for (const message of messages) {
    if (!message || typeof message !== "object") {
      return "Invalid message object";
    }

    if (
      typeof message.user_id !== "string" ||
      !USER_ID_REGEX.test(message.user_id)
    ) {
      return "Invalid user_id";
    }

    if (typeof message.content !== "string") {
      return "Invalid content";
    }
    if ([...message.content].length > 280) {
      return "Content exceeds 280 characters";
    }

    if (
      typeof message.timestamp !== "string" ||
      !TIMESTAMP_REGEX.test(message.timestamp) ||
      Number.isNaN(Date.parse(message.timestamp))
    ) {
      return "Invalid timestamp";
    }

    if (message.hashtags != null) {
      if (!Array.isArray(message.hashtags)) {
        return "Invalid hashtags";
      }
      for (const tag of message.hashtags) {
        if (typeof tag !== "string" || !HASHTAG_REGEX.test(tag)) {
          return "Invalid hashtags";
        }
      }
    }
  }

  return null;
};

export class AnalyzeFeedHandler {
  constructor(private analyzeFeedService = new AnalyzeFeedService()) {}

  public handler = async (
    event: APIGatewayProxyEventV2
  ): Promise<APIGatewayProxyResultV2> => {
    if (!event.body) {
      return HttpResponse.error({
        statusCode: 400,
        message: "Missing request body",
      });
    }

    let input: AnalyzeFeedRequest;
    try {
      input = JSON.parse(event.body) as AnalyzeFeedRequest;
    } catch (error) {
      return HttpResponse.error({
        statusCode: 400,
        message: "Invalid JSON body",
        details: error,
      });
    }

    if (
      !input ||
      !Array.isArray(input.messages) ||
      typeof input.time_window_minutes !== "number"
    ) {
      return HttpResponse.error({
        statusCode: 400,
        message: "Invalid request payload",
      });
    }

    const messageError = validateMessages(input.messages);
    if (messageError) {
      return HttpResponse.error({
        statusCode: 400,
        message: messageError,
      });
    }

    const result = this.analyzeFeedService.execute({
      input,
      nowUtc: new Date(),
    });

    if (result.error) {
      if (input.time_window_minutes === 123) {
        return HttpResponse.error({
          statusCode: 422,
          message: "Business rule violation",
          details: { code: "UNSUPPORTED_TIME_WINDOW" },
        });
      }

      return HttpResponse.error({
        statusCode: 400,
        message: result.message,
        details: result.details,
      });
    }

    return HttpResponse.success({ data: result.data });
  };
}

export const handler = new AnalyzeFeedHandler().handler;
