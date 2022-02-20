function run() {
  const events = fetchEvents();
  const durationInHoursByColor = aggregateDurationsByColor(events);

  writeToSpeadSheet(durationInHoursByColor);
}

type EventColor = GoogleAppsScript.Calendar.EventColor;

function fetchEvents() {
  const today = new Date();
  const events = CalendarApp.getEventsForDay(today);
  return events;
}

function aggregateDurationsByColor(
  events: GoogleAppsScript.Calendar.CalendarEvent[]
) {
  const durationInHoursByColor = new Map<string, number>();
  events.forEach((event) => {
    const color = event.getColor();
    const durationInHours =
      ((event.getEndTime().getTime() - event.getStartTime().getTime()) / 60) *
      60 *
      1000;
    const totalDurationInHours =
      durationInHours + (durationInHoursByColor.get(color) || 0);
    durationInHoursByColor.set(color, totalDurationInHours);
  });
  console.log(durationInHoursByColor);

  return durationInHoursByColor;
}

function writeToSpeadSheet(durationInHoursByColor: Map<string, number>) {}
