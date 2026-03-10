const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export async function withThrottleRetry<T>(
  fn: () => Promise<T>,
  label?: string,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const isThrottle =
        error instanceof Error &&
        (error.message.includes("Throttled") ||
          error.message.includes("429"));

      if (!isThrottle || attempt === MAX_RETRIES) {
        throw error;
      }

      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(
        `[GraphQL Throttled]${label ? ` ${label}` : ""} attempt ${attempt}/${MAX_RETRIES}, retrying in ${delay}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Unreachable");
}
