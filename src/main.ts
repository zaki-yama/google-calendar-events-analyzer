function run() {
  const events = fetchEvents();
  const durationInHoursByColor = aggregateDurationsByColor(events);

  writeToSpeadSheet(durationInHoursByColor);
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

function writeToSpeadSheet(durationInHoursByColor: Map<string, number>) {
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
