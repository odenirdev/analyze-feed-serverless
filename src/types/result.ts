export type Result<T> =
  | {
      error: true;
      message: string;
      data?: undefined;
      details?: any;
    }
  | {
      error: false;
      message?: string;
      data: T;
      details?: undefined;
    };
