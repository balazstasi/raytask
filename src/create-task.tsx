import { Form, getPreferenceValues } from "@raycast/api";
import { getAccessToken, useCachedPromise, withAccessToken } from "@raycast/utils";
import { useMemo } from "react";
import * as api from "./api";
import { CreateTaskForm } from "./components/CreateTaskForm";
import { createGoogleOAuthService } from "./google-auth";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SetupView } from "./setup-view";

function AuthenticatedCreateView() {
  const { token } = getAccessToken();
  const { data, isLoading } = useCachedPromise(
    async (accessToken: string) => api.getTaskLists(accessToken, { maxResults: 100 }),
    [token],
    { failureToastOptions: { title: "Could not load lists" } },
  );

  const lists = useMemo(() => data?.items ?? [], [data]);

  if (isLoading) {
    return <Form navigationTitle="Create Task" isLoading />;
  }

  if (lists.length === 0) {
    return (
      <Form navigationTitle="Create Task">
        <Form.Description title="" text="No task lists found. Create one in Google Tasks first." />
      </Form>
    );
  }

  return <CreateTaskForm lists={lists} />;
}

function CreateCommandWrapper() {
  return (
    <ErrorBoundary>
      <AuthenticatedCreateView />
    </ErrorBoundary>
  );
}

export default function CreateTaskCommand() {
  const { googleClientId } = getPreferenceValues<Preferences>();
  const trimmed = (googleClientId ?? "").trim();
  const oauthService = useMemo(
    () => (trimmed.length > 0 ? createGoogleOAuthService(trimmed) : null),
    [trimmed],
  );
  const Authorized = useMemo(() => {
    if (!oauthService) return null;
    return withAccessToken(oauthService)(CreateCommandWrapper);
  }, [oauthService]);

  if (!Authorized) {
    return <SetupView />;
  }
  return <Authorized />;
}
