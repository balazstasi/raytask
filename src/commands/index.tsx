import { useAuth } from "../hooks/useAuth";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { TaskListsView } from "../views/TaskListsView";

function AuthenticatedMain() {
  return (
    <ErrorBoundary>
      <TaskListsView />
    </ErrorBoundary>
  );
}

export default function Command() {
  const AuthCommand = useAuth(AuthenticatedMain);
  return <AuthCommand />;
}
