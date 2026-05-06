import { Effect } from "effect";
import { GoogleTasksClient } from "../../src/services/google-tasks/client";

export function runGoogleEffect<T, E>(effect: Effect.Effect<T, E, GoogleTasksClient>, accessToken = "test-token"): Promise<T> {
  return Effect.runPromise(Effect.provideService(effect, GoogleTasksClient, { accessToken }));
}
