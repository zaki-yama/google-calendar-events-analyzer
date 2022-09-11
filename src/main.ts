function run() {
  const targetDate = new Date();
  const googleEvents = fetchGoogleEvents(targetDate);

  const config = getConfig();
  const events = convertGoogleEvents(googleEvents, config);
  const durationInHoursByCategory = aggregateDurationsByCategory(events);

  writeEventsToSpreadSheet(events);

  postSummaryToSlack(targetDate);
  postToSlack(events, durationInHoursByCategory);
}

type EventColor = GoogleAppsScript.Calendar.EventColor;

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

type Event = {
  title: string;
  colorId: ColorId;
  category: Category | undefined;
  startTime: GoogleAppsScript.Base.Date;
  endTime: GoogleAppsScript.Base.Date;
};

function convertGoogleEvents(
  googleEvents: GoogleAppsScript.Calendar.CalendarEvent[],
  config: Config
): Event[] {
  return googleEvents.map((googleEvent) => {
    const colorId = googleEvent.getColor() || "default";
    return {
      title: googleEvent.getTitle(),
      colorId: colorId,
      category: config.get(colorId),
      startTime: googleEvent.getStartTime(),
      endTime: googleEvent.getEndTime(),
    };
  });
}

function aggregateDurationsByCategory(events: Event[]): Map<Category, number> {
  const durationInHoursByCategory = new Map<Category, number>();
  events.forEach((event) => {
    if (!event.category) {
      console.log(`[skip] ${event.title} (color: ${event.colorId}`);
      return;
    }
    const durationInHours =
      (event.endTime.getTime() - event.startTime.getTime()) / (60 * 60 * 1000);
    console.log(`[${event.category}] ${event.title}: ${durationInHours}`);

    const totalDurationInHours =
      durationInHours + (durationInHoursByCategory.get(event.category) || 0);
    console.log("totalDuration", totalDurationInHours);

    durationInHoursByCategory.set(event.category, totalDurationInHours);
  });
  return durationInHoursByCategory;
}

function writeEventsToSpreadSheet(events: Event[]) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("raw data");
  if (!sheet) {
    throw new Error("data sheet not found");
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

function writeToSpreadSheet(durationInHoursByCategory: Map<Category, number>) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("data");
  if (!sheet) {
    throw new Error("data sheet not found");
  }
  const range = sheet.getDataRange();
  console.log(range.getNumRows(), range.getNumColumns());
  const row = sheet.getRange(
    range.getNumRows() + 1,
    1,
    1,
    range.getNumColumns()
  );
  const categories: Category[] = sheet
    .getRange(1, 1, 1, range.getNumColumns())
    .getValues()[0];
  const values = categories.map((category) =>
    durationInHoursByCategory.get(category)
  );
  // @ts-ignore
  values[0] = new Date();
  console.log("values", values);
  row.setValues([values]);
}

type CalendarEvent = {
  title: string;
  startTime: number;
  endTime: number;
  duration: number;
  color: string;
};

function createConfigSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("config") || ss.insertSheet("config");

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

type Category = string;
type ColorId = string;
type Config = Map<ColorId, Category>;

function getConfig(): Config {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("config");

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

const SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/xxxx";

function postToSlack(
  events: Event[],
  durationInHoursByCategory: Map<Category, number>
) {
  const eventsText = events
    .map((event) => {
      return `${toHHmmString(event.startTime)}〜${toHHmmString(
        event.endTime
      )}: ${event.title}`;
    })
    .join("\n");
  const message = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "今日の作業",
          emoji: true,
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
  UrlFetchApp.fetch(SLACK_WEBHOOK_URL, options);
}

function toHHmmString(date) {
  const hh = `${date.getHours()}`.padStart(2, "0");
  const mm = `${date.getMinutes()}`.padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Post the summary (duration by category) to Slack
 */
function postSummaryToSlack(targetDate: Date) {
  const summary = getSummary(targetDate);
  const message = Object.keys(summary)
    .flatMap((category) =>
      summary[category] ? `${category}: ${toHHmmString(summary[category])}` : []
    )
    .join("\n");
  console.log(message);

  // TODO: Post to Slack
}

function getSummary(targetDate: Date) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("summary");

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

function updateChartRange(targetDate: Date): void {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("summary");
  const dateCol = sheet.getRange(1, 1, sheet.getLastRow(), 1);

  const chart = sheet.getCharts()[0];
  const targetRowIndex = dateCol
    .getValues()
    .findIndex(
      (data) =>
        targetDate.getFullYear() === data[0].getFullYear?.() &&
        targetDate.getMonth() === data[0].getMonth?.() &&
        targetDate.getDate() === data[0].getDate?.()
    );
  console.log(targetRowIndex);

  sheet.updateChart(
    chart
      .modify()
      // FIXME: the number of columns can be changed, so I should avoid using `A` and `F` notation
      .addRange(sheet.getRange(`A${targetRowIndex + 1}:F${targetRowIndex + 6}`))
      .build()
  );
}

function postChartToSlack() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("summary");
  const chart = sheet.getCharts()[0];

  const options = {
    method: "post",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
    },
    payload: {
      title: "Summary",
      channels: SLACK_CHANNEL_NAME,
      file: chart.getAs("image/png"),
      fileType: "png",
    },
  } as const;
  UrlFetchApp.fetch(SLACK_FILE_UPLOAD_URL, options);
}
