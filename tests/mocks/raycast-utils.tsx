import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { vi } from "vitest";

type CachedPromiseOptions = {
  execute?: boolean;
  failureToastOptions?: {
    title: string;
  };
};

const accessTokenState = {
  token: "test-token",
};

export const withAccessTokenMock = vi.fn((service: unknown) => {
  return <TProps,>(Component: React.ComponentType<TProps>) => {
    function Wrapped(props: TProps) {
      return <Component {...props} />;
    }

    Wrapped.displayName = `WithAccessToken(${Component.displayName ?? Component.name ?? "Component"})`;
    return Wrapped;
  };
});

export class OAuthService {
  constructor(public readonly options: Record<string, unknown>) {}
}

export function setAccessToken(token: string): void {
  accessTokenState.token = token;
}

export function resetRaycastUtilsMocks(): void {
  accessTokenState.token = "test-token";
  withAccessTokenMock.mockClear();
}

export function getAccessToken() {
  return { token: accessTokenState.token };
}

export function useCachedPromise<TResult, TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<TResult>,
  args: TArgs,
  options?: CachedPromiseOptions,
) {
  const execute = options?.execute ?? true;
  const [data, setData] = useState<TResult | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(execute);

  const run = useCallback(async () => {
    if (!execute) {
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    try {
      const result = await fn(...args);
      setData(result);
      setError(undefined);
      return result;
    } catch (caughtError) {
      setError(caughtError);
      throw caughtError;
    } finally {
      setIsLoading(false);
    }
  }, [execute, fn, ...args]);

  useEffect(() => {
    if (!execute) {
      setIsLoading(false);
      return;
    }
    void run().catch(() => undefined);
  }, [execute, run]);

  return useMemo(
    () => ({
      data,
      error,
      isLoading,
      revalidate: run,
    }),
    [data, error, isLoading, run],
  );
}

export const withAccessToken = withAccessTokenMock;

export const raycastUtilsMock = {
  OAuthService,
  getAccessToken,
  useCachedPromise,
  withAccessToken,
};
