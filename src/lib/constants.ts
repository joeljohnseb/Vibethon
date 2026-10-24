export const CONNECTORS = [
  { id: "type2", label: "Type 2 (AC)", kind: "AC" },
  { id: "ccs2", label: "CCS2 (DC)", kind: "DC" },
  { id: "chademo", label: "CHAdeMO (DC)", kind: "DC" },
  { id: "bharat_ac001", label: "Bharat AC-001", kind: "AC" },
  { id: "bharat_dc001", label: "Bharat DC-001", kind: "DC" },
  { id: "socket_15a", label: "15A 3-pin socket", kind: "AC" },
] as const;

export type ConnectorId = (typeof CONNECTORS)[number]["id"];
export const CONNECTOR_IDS = CONNECTORS.map((c) => c.id) as [ConnectorId, ...ConnectorId[]];
export const connectorLabel = (id: string) => CONNECTORS.find((c) => c.id === id)?.label ?? id;

export const CANCELLATION_POLICIES = {
  flexible: { label: "Flexible", freeUntilHours: 1, summary: "Free cancellation up to 1 hour before the slot starts." },
  moderate: { label: "Moderate", freeUntilHours: 6, summary: "Free cancellation up to 6 hours before the slot starts." },
  strict: { label: "Strict", freeUntilHours: 24, summary: "Free cancellation up to 24 hours before the slot starts." },
} as const;

/** Would cancelling a confirmed booking now count as a late cancellation for the driver? */
export function isLateCancellation(startAt: Date, policy: keyof typeof CANCELLATION_POLICIES, now = new Date()) {
  return startAt.getTime() - now.getTime() < CANCELLATION_POLICIES[policy].freeUntilHours * 3600_000;
}

export const AMENITIES = ["Covered parking", "CCTV", "Restroom access", "Wi-Fi", "Waiting area", "Gated entry", "Well lit at night"];

/** Popular Indian city centres for manual location selection (no geocoder needed). */
export const CITY_PRESETS = [
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { name: "Mumbai", lat: 19.076, lng: 72.8777 },
  { name: "Delhi", lat: 28.6139, lng: 77.209 },
  { name: "Pune", lat: 18.5204, lng: 73.8567 },
  { name: "Hyderabad", lat: 17.385, lng: 78.4867 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707 },
  { name: "Kochi", lat: 9.9312, lng: 76.2673 },
  { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
];

export const MAX_BOOKING_SLOTS = 8;
export const CODE_TTL_MINUTES = 10;
export const CODE_MAX_ATTEMPTS = 5;
export const CODE_WINDOW_BEFORE_MIN = 30; // code can be shown from 30 min before start
export const CODE_WINDOW_AFTER_MIN = 30; // …until 30 min after the booking end
export const BOOKING_HORIZON_DAYS = 30;
