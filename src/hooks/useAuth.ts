import { getPreferenceValues } from "@raycast/api";
import { useMemo } from "react";
import { withAccessToken } from "@raycast/utils";
import { createGoogleOAuthService } from "../services/google-tasks/auth";
import { SetupView } from "../components/SetupView";

export function useAuth(Component: React.ComponentType<any>, Fallback: React.ComponentType<any> = SetupView) {
  const { googleClientId } = getPreferenceValues<Preferences>();
  const trimmed = (googleClientId ?? "").trim();

  const oauthService = useMemo(
    () => (trimmed.length > 0 ? createGoogleOAuthService(trimmed) : null),
    [trimmed],
  );

  const Authorized = useMemo(() => {
    if (!oauthService) return null;
    return withAccessToken(oauthService)(Component);
  }, [oauthService, Component]);

  return Authorized ?? Fallback;
}
