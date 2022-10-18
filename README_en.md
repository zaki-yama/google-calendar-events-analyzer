# Google Calendar Events Analyzer

Slack Bot that aggregates Google Calendar's events by colors, and send the summary chart to Slack.

![](images/en/overview.png)

## Installation

### 1. Create Slack App

- Open https://api.slack.com/apps and create new Slack App
- In `Incoming Webhooks`, input the channel name you want to post the message. Then obtain Webhook URL [1]

![](images/en/slack-settings-webhook.png)

- In `OAuth & Permissions > Scopes`, add `files:write`

![](images/en/slack-settings-scope.png)

- Copy `Bot User OAuth Token` [2]

### 2. Install the Slack App in your Slack Workspace

- If it's already installed, re-install it (needed because you changed the app's scope)
- Add the Slack App to the channel

  ![](images/en/slack-add-app.png)

### 3. Create Spreadsheet

- Copy https://docs.google.com/spreadsheets/d/1uf5XqUqcsIfwMdeJYZg6rJ3psmPPnJhMKf9OouLl55c/edit
- Open `📆 Menu > Settings` in the Spreadsheet

  ![](images/en/spreadsheet-menu.png)

- Authorize it

  - You might see "Google hasn't verified this app" in the popup, click `Advanced -> Go to Google Calendar Events Analyzer (unsafe)`

  ![](images/en/google-grant-auth-1.png)
  ![](images/en/google-grant-auth-2.png)

- Open `📆 Menu > Settings` again, input [1] Webhook URL, [2] Bot User OAuth Token, [3] Slack channel name

  ![](images/en/settings.png)

- In `categories` sheet, input category names next to the color cells you want to aggregate

  ![](images/en/categories.png)

- In `Apps Script` menu, add the following 2 triggers

| Function    | What it does                                               | type of time based trigger |
| :---------- | :--------------------------------------------------------- | :------------------------- |
| `runDaily`  | Aggregate today's Google Calendar events and post to Slack | Day timer                  |
| `runWeekly` | Post the weekly summary chart to Slack                     | Week timer                 |

![](images/en/spreadsheet-open-script.png)

![](images/en/trigger-runDaily.png)

![](images/en/trigger-runWeekly.png)
