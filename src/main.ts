function run() {
  const events = fetchEvents();

  const durationInHoursByColor = aggregateDurationsByColor(events);

  writeToSpreadSheet(durationInHoursByColor);
}

type EventColor = GoogleAppsScript.Calendar.EventColor;

function fetchEvents() {
  const today = new Date();
  const events = CalendarApp.getEventsForDay(today);
  // TODO: filter events so that:
  // - include only accepted events
  // - ignore allday events
  return events;
}

function aggregateDurationsByColor(
  events: GoogleAppsScript.Calendar.CalendarEvent[]
) {
  const durationInHoursByColor = new Map<string, number>();
  events.forEach((event) => {
    const color = event.getColor() || "default";
    console.log(`----${event.getTitle()} (${event.getColor()}`);
    const durationInHours =
      (event.getEndTime().getTime() - event.getStartTime().getTime()) /
      (60 * 60 * 1000);
    console.log("duration", durationInHours);
    const totalDurationInHours =
      durationInHours + (durationInHoursByColor.get(color) || 0);
    console.log("totalDuration", totalDurationInHours);
    durationInHoursByColor.set(color, totalDurationInHours);
  });
  console.log(durationInHoursByColor.values);

  return durationInHoursByColor;
}

function writeToSpreadSheet(durationInHoursByColor: Map<string, number>) {
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
  const headers = sheet.getRange(1, 1, 1, range.getNumColumns()).getValues()[0];
  const values = headers.map((header) => {
    return durationInHoursByColor.get(eventTypes[header]);
  });
  // @ts-ignore
  values[0] = new Date();
  console.log("values", values);
  row.setValues([values]);
}

const eventTypes = {
  その他: "default",
  CRE: "7",
  定例: "8",
};

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
