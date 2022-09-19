type ColorId = string;
type Category = string;
export type CategoryMap = Map<ColorId, Category>;

export type CalendarEvent = {
  title: string;
  colorId: ColorId;
  category: Category | undefined;
  startTime: GoogleAppsScript.Base.Date;
  endTime: GoogleAppsScript.Base.Date;
};

export type Settings = {
  slackWebhookUrl: string;
  slackBotToken: string;
  slackChannelName: string;
};
