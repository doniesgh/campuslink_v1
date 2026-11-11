export const M = {
  aiTag: "AI",
  analyzing: "Looking for matches…",
  aiNote: "Matched by AI",
  compatTitle: "Compatible rides",
  compatSubtitle: "Other rides with a similar route and departure time.",
  sameTime: "Same departure time",
  minutesApart: (n: number) => `${n} min apart`,
  departureApart: (km: number) => `Departs ${km} km away`,
  arrivalApart: (km: number) => `Arrives ${km} km away`,
  seatsLeft: (n: number) => `${n} seat${n === 1 ? "" : "s"} left`,
  viewRide: "View ride",
};
