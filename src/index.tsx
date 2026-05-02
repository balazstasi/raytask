import { getPreferenceValues } from "@raycast/api";
import { useMemo } from "react";
import { withAccessToken } from "@raycast/utils";
import { createGoogleOAuthService } from "./google-auth";
import { SetupView } from "./setup-view";
import { TaskListsView } from "./views/TaskListsView";

function AuthenticatedMain() {
  return <TaskListsView />;
}

export default function Command() {
  const { googleClientId } = getPreferenceValues<Preferences>();
  const trimmed = (googleClientId ?? "").trim();

  const oauthService = useMemo(
    () => (trimmed.length > 0 ? createGoogleOAuthService(trimmed) : null),
    [trimmed],
  );

  const AuthorizedMain = useMemo(() => {
    if (!oauthService) {
      return null;
    }
    return withAccessToken(oauthService)(AuthenticatedMain);
  }, [oauthService]);

  if (!AuthorizedMain) {
    return <SetupView />;
  }

  return <AuthorizedMain />;
}
