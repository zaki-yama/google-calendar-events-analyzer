import type { CategoryMap, CalendarEvent, Settings } from "./types";

// Needed to post the chart to slack
const SLACK_FILE_UPLOAD_URL = "https://slack.com/api/files.upload";

// ref. https://sakidesign.com/gapi-calendar/
const EVENT_COLORS = [
  "#7986CB", // ラベンダー Lavender
  "#33B679", // セージ Sage
  "#8E24AA", // グレープ Grape
  "#E67C73", // フラミンゴ Flamingo
  "#F6BF26", // バナナ Banana
  "#F4511E", // ミカン Tangerine
  "#039BE5", // ピーコック Peacock
  "#616161", // グラファイト Graphite
  "#3F51B5", // ブルーベリー Blueberry
  "#0B8043", // バジル Basil
  "#D50000", // トマト Tomato
];
const EVENTS_SHEET_NAME = "events";
const SUMMARY_SHEET_NAME = "sheet";
const CATEGORIES_SHEET_NAME = "categories";

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("📆 Menu").addItem("Settings", "openSettings").addToUi();
}

function openSettings() {
  const template = HtmlService.createTemplateFromFile("Settings");
  template.settings = getSettings();
  const html = template.evaluate().setWidth(500).setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, "Settings");
}

function saveSettings(form: HTMLFormElement) {
  const userProperties = PropertiesService.getUserProperties();
  userProperties.setProperties({
    slackWebhookUrl: form.slackWebhookUrl,
    slackBotToken: form.slackBotToken,
    slackChannelName: form.slackChannelName,
  });
}

function getSettings(): Settings {
  const userProperties = PropertiesService.getUserProperties();
  return userProperties.getProperties() as Settings;
}

/**
 * main function. Trigger this daily.
 */
function runDaily() {
  const targetDate = new Date();
  const googleEvents = fetchGoogleEvents(targetDate);
  if (googleEvents.length === 0) {
    console.log(`Date [${targetDate}] has no events.`);
    return;
  }

  const categories = getCategories();
  const events = convertGoogleEvents(googleEvents, categories);
  writeEventsToSpreadSheet(events);

  postSummaryToSlack(targetDate, events);
}

function fetchGoogleEvents(
  targetDate: Date
): GoogleAppsScript.Calendar.CalendarEvent[] {
  const events = CalendarApp.getEventsForDay(targetDate);

  // filter events so that:
  // - include only accepted events
  // - exclude allday events
  return events.filter(
    (event) =>
      !event.isAllDayEvent() &&
      (event.getMyStatus() === CalendarApp.GuestStatus.OWNER ||
        event.getMyStatus() === CalendarApp.GuestStatus.YES)
  );
}

function convertGoogleEvents(
  googleEvents: GoogleAppsScript.Calendar.CalendarEvent[],
  categories: CategoryMap
): CalendarEvent[] {
  return googleEvents.map((googleEvent) => {
    const colorId = googleEvent.getColor() || "default";
    return {
      title: googleEvent.getTitle(),
      colorId: colorId,
      category: categories.get(colorId),
      startTime: googleEvent.getStartTime(),
      endTime: googleEvent.getEndTime(),
    };
  });
}

function writeEventsToSpreadSheet(events: CalendarEvent[]) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(EVENTS_SHEET_NAME);
  if (!sheet) {
    throw new Error(`sheet [${EVENTS_SHEET_NAME}] not found`);
  }

  const lastRow = sheet.getLastRow();
  const range = sheet.getRange(lastRow + 1, 1, events.length, 6);

  const values = events.map((event, index) => [
    new Date(new Date(event.startTime.getTime()).setHours(0, 0, 0)),
    event.category,
    event.title,
    toHHmmString(event.startTime),
    toHHmmString(event.endTime),
    `=E${lastRow + index + 1}-D${lastRow + index + 1}`,
  ]);
  range.setValues(values);
}

function createCategoriesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet =
    ss.getSheetByName(CATEGORIES_SHEET_NAME) ||
    ss.insertSheet(CATEGORIES_SHEET_NAME);

  const headerCells = sheet.getRange(1, 1, 1, 2);
  headerCells.setValues([["Color", "Category"]]);

  const dataCells = sheet.getRange(2, 1, EVENT_COLORS.length + 1, 2);
  dataCells.setBackgrounds([
    ...EVENT_COLORS.map((eventColor) => [eventColor, null]),
    ["white", null],
  ]);
  dataCells.setValues([
    ...EVENT_COLORS.map((_, idx) => [idx + 1, null]),
    ["default", null],
  ]);
}

function getCategories(): CategoryMap {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CATEGORIES_SHEET_NAME);

  const cells = sheet?.getRange(
    2,
    1,
    sheet.getLastRow(),
    sheet.getLastColumn()
  );
  const res = new Map<string, string>();
  cells?.getValues().forEach((row) => {
    row[1] && res.set(row[0].toString(), row[1]);
  });
  console.log(res);
  return res;
}

function toHHmmString(date) {
  const hh = `${date.getHours()}`.padStart(2, "0");
  const mm = `${date.getMinutes()}`.padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Post the summary (duration by category) to Slack
 */
function postSummaryToSlack(targetDate: Date, events: CalendarEvent[]) {
  const summary = getSummary(targetDate);
  const summaryText = Object.keys(summary)
    .flatMap((category) =>
      summary[category] ? `${category}: ${toHHmmString(summary[category])}` : []
    )
    .join("\n");
  console.log(summaryText);

  const eventsText = events
    .filter((event) => event.category)
    .map((event) => {
      return `${toHHmmString(event.startTime)}〜${toHHmmString(
        event.endTime
      )}: [${event.category}] ${event.title}`;
    })
    .join("\n");

  const message = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:muscle: *今日の作業*\n${summaryText}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `\`\`\`${eventsText}\`\`\``,
        },
      },
    ],
  };
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(message),
  } as const;
  UrlFetchApp.fetch(getSettings().slackWebhookUrl, options);
}

function getSummary(targetDate: Date) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SUMMARY_SHEET_NAME);

  const dateCol = sheet.getRange(1, 1, sheet.getLastRow(), 1);
  const targetRowIndex = dateCol
    .getValues()
    .findIndex(
      (data) =>
        targetDate.getFullYear() === data[0].getFullYear?.() &&
        targetDate.getMonth() === data[0].getMonth?.() &&
        targetDate.getDate() === data[0].getDate?.()
    );

  const values = sheet.getDataRange().getValues();
  const headers = values[1];
  const targetValues = values[targetRowIndex];
  const summary = Object.fromEntries(
    // Drop first element (it's "Date" column)
    headers.map((header, i) => [header, targetValues[i]]).slice(1)
  );
  console.log(summary);
  return summary;
}

function updateChartRange(): void {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
  const chart = sheet.getCharts()[0];
  sheet.updateChart(
    chart
      .modify()
      .clearRanges()
      // FIXME: the number of columns can be changed, so I should avoid using `A` and `F` notation
      .addRange(sheet.getRange("A2:F2")) // Always include headers
      .addRange(
        sheet.getRange(`A${sheet.getLastRow() + 1}:F${sheet.getLastRow() + 5}`)
      )
      .build()
  );
}

function postChartToSlack() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
  const chart = sheet.getCharts()[0];

  const options = {
    method: "post",
    headers: {
      Authorization: `Bearer ${getSettings().slackBotToken}`,
    },
    payload: {
      title: "Summary",
      channels: getSettings().slackChannelName,
      file: chart.getAs("image/png"),
      fileType: "png",
    },
  } as const;
  UrlFetchApp.fetch(SLACK_FILE_UPLOAD_URL, options);
}
