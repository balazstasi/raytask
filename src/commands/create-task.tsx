import { Form } from "@raycast/api";
import { getAccessToken, useCachedPromise } from "@raycast/utils";
import { useMemo } from "react";
import { CreateTaskForm } from "../components/CreateTaskForm";
import { useAuth } from "../hooks/useAuth";
import * as api from "../services/google-tasks/api";

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

export default function CreateTaskCommand() {
  const AuthCommand = useAuth(AuthenticatedCreateView);
  return <AuthCommand />;
}
