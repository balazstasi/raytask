import { Action, ActionPanel, Detail, openExtensionPreferences } from "@raycast/api";

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

export function SetupView() {
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
