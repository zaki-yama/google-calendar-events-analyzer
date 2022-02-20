export function fetchEvents() {
  const today = new Date();
  const events = CalendarApp.getEventsForDay(today);
  return events;

  events.forEach((event) => {
    console.log(event.getTitle());
    console.log(event.getColor());
    console.log(event.getStartTime());
    console.log(event.getEndTime());

    // duration (in milliseconds)
    console.log(event.getEndTime().getTime() - event.getStartTime().getTime());

    // TODO: aggregate by color
  });
}
