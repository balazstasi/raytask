import { ErrorBoundary } from "../components/ErrorBoundary";
import { EditTaskPicker } from "../views/EditTaskPicker";
import { useAuth } from "../hooks/useAuth";

function AuthenticatedEditView() {
  return (
    <ErrorBoundary>
      <EditTaskPicker />
    </ErrorBoundary>
  );
}

export default function EditTaskCommand() {
  const AuthCommand = useAuth(AuthenticatedEditView);
  return <AuthCommand />;
}
