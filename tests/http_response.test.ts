import { HttpResponse } from "../src/shared/http_response";

const parseBody = (body: string) => JSON.parse(body);

describe("HttpResponse", () => {
  it("uses default error values when not provided", () => {
    const response = HttpResponse.error({});

    expect(response.statusCode).toBe(500);
    expect(parseBody(response.body)).toEqual({
      message: "An error occurred",
      details: undefined,
    });
  });

  it("returns custom error values when provided", () => {
    const response = HttpResponse.error({
      statusCode: 418,
      message: "Teapot",
      details: { code: "TEAPOT" },
    });

    expect(response.statusCode).toBe(418);
    expect(parseBody(response.body)).toEqual({
      message: "Teapot",
      details: { code: "TEAPOT" },
    });
  });

  it("uses default success status code when not provided", () => {
    const response = HttpResponse.success({});

    expect(response.statusCode).toBe(200);
    expect(parseBody(response.body)).toEqual({
      message: undefined,
      data: undefined,
    });
  });

  it("returns custom success values when provided", () => {
    const response = HttpResponse.success({
      statusCode: 201,
      message: "Created",
      data: { id: "abc" },
    });

    expect(response.statusCode).toBe(201);
    expect(parseBody(response.body)).toEqual({
      message: "Created",
      data: { id: "abc" },
    });
  });
});
