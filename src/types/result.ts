export type Result<T> =
  | {
      error: true;
      message: string;
      data?: undefined;
      details?: unknown;
    }
  | {
      error: false;
      message?: string;
      data: T;
      details?: undefined;
    };
