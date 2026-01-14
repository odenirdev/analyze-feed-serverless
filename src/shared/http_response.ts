export class HttpResponse {
  static error(params: {
    statusCode?: number;
    message?: string;
    details?: unknown;
  }) {
    const {
      statusCode = 500,
      message = "An error occurred",
      details = undefined,
    } = params;

    return {
      statusCode,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,lang",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
      },
      body: JSON.stringify({
        message,
        details,
      }),
    };
  }

  static success(params: {
    statusCode?: number;
    message?: string;
    data?: unknown;
  }) {
    return {
      statusCode: params.statusCode || 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,lang",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
      },
      body: JSON.stringify({
        message: params.message,
        data: params.data,
      }),
    };
  }
}
