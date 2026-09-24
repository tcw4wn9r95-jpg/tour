// Query-string routes, so the GitHub Pages build (plain static files) can
// open any tour stored on the phone.
export const tourHref = (tourId: string, tab?: "today") =>
  `/tour?id=${encodeURIComponent(tourId)}${tab === "today" ? "&tab=today" : ""}`;

export const stopHref = (tourId: string, stopId: string) =>
  `/tour/stop?id=${encodeURIComponent(tourId)}&stop=${encodeURIComponent(stopId)}`;
