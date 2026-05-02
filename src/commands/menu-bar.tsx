import { MenuBarExtra, openExtensionPreferences } from "@raycast/api";
import { useAuth } from "../hooks/useAuth";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { MenuBarView } from "../views/MenuBarView";

function MenuBarWrapper() {
  return (
    <ErrorBoundary>
      <MenuBarView />
    </ErrorBoundary>
  );
}

function MenuBarFallback() {
  return (
    <MenuBarExtra icon="icon.png" tooltip="RayTask">
      <MenuBarExtra.Item title="Set OAuth Client ID…" onAction={() => openExtensionPreferences()} />
    </MenuBarExtra>
  );
}

export default function MenuBarCommand() {
  const AuthCommand = useAuth(MenuBarWrapper, MenuBarFallback);
  return <AuthCommand />;
}
