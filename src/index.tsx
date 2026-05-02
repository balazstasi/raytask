import { Action, ActionPanel, Detail, getPreferenceValues, openExtensionPreferences } from "@raycast/api";
import { getAccessToken, withAccessToken } from "@raycast/utils";
import { useMemo } from "react";
import { createGoogleOAuthService } from "./google-auth";

const setupMarkdown = `
# Connect Google Tasks

Before you can use RayTask, add your **Google OAuth Client ID** in extension preferences.

## Steps

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and select your project.
2. Enable the **Google Tasks API** if you have not already.
3. Configure the OAuth consent screen and add the scope \`https://www.googleapis.com/auth/tasks\`.
4. Create an OAuth client ID: type **iOS**, **Bundle ID** \`com.raycast\` (see the [Raycast guide](https://developers.raycast.com/utilities/oauth/getting-google-client-id)).
5. Copy the **Client ID** and paste it below via **Open Extension Preferences**.

Register the redirect URI Google expects for Raycast: \`com.raycast:/oauth?package_name=raytask\` if the console asks for it.
`.trim();

function SetupView() {
  return (
    <Detail
      markdown={setupMarkdown}
      actions={
        <ActionPanel>
          <Action title="Open Extension Preferences" onAction={() => openExtensionPreferences()} />
        </ActionPanel>
      }
    />
  );
}

function AuthenticatedView() {
  const { token } = getAccessToken();
  const preview = token.length <= 16 ? token : `${token.slice(0, 12)}…`;
  return (
    <Detail
      markdown={`# Connected to Google Tasks\n\nAccess token (preview): \`${preview}\`\n\n_API integration comes in Phase 3._`}
    />
  );
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
    return withAccessToken(oauthService)(AuthenticatedView);
  }, [oauthService]);

  if (!AuthorizedMain) {
    return <SetupView />;
  }

  return <AuthorizedMain />;
}
