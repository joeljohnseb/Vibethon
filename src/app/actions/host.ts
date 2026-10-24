"use server";

import { redirect } from "next/navigation";
import { act, str, type ActionState } from "@/lib/action";
import { requireUser } from "@/lib/auth/session";
import * as chargers from "@/lib/services/chargers";
import { decideBooking } from "@/lib/services/bookings";
import { recordEndReading, recordStartReading, verifyStartCode } from "@/lib/services/charging";
import { requestPayout } from "@/lib/services/earnings";
import { rupeesToPaise } from "@/lib/money";
import { DEFAULT_TZ, isIsoDate, zonedInstant, hhmmToMinutes } from "@/lib/time";
import { invalid } from "@/lib/errors";

function requirePin(fd: FormData) {
  if (str(fd, "pinSet") !== "1")
    throw invalid("Place the map pin on your charger's location", { lat: "Use “Find address on map”, your current location, or tap the map to place the pin." });
}

function chargerInput(fd: FormData) {
  return {
    title: str(fd, "title"),
    description: str(fd, "description"),
    addressLine: str(fd, "addressLine"),
    locality: str(fd, "locality"),
    city: str(fd, "city"),
    state: str(fd, "state"),
    postalCode: str(fd, "postalCode"),
    lat: str(fd, "lat"),
    lng: str(fd, "lng"),
    connectors: fd.getAll("connectors").map(String),
    powerKw: str(fd, "powerKw"),
    pricePerKwhPaise: rupeesToPaise(str(fd, "pricePerKwh") || "NaN"),
    parkingInfo: str(fd, "parkingInfo"),
    accessInstructions: str(fd, "accessInstructions"),
    safetyInfo: str(fd, "safetyInfo"),
    amenities: fd.getAll("amenities").map(String),
    bookingMode: str(fd, "bookingMode") || "approval",
    cancellationPolicy: str(fd, "cancellationPolicy") || "flexible",
    slotMinutes: str(fd, "slotMinutes") || "60",
    photoIds: fd.getAll("photoIds").map(String),
  };
}

export async function createChargerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await act(async () => {
    const u = await requireUser();
    requirePin(fd);
    id = (await chargers.createCharger(u.id, chargerInput(fd))).id;
  });
  if (!res.ok) return res;
  redirect(`/host/chargers/${id}/availability?created=1`);
}

export async function updateChargerAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    requirePin(fd);
    await chargers.updateCharger(u.id, str(fd, "chargerId"), chargerInput(fd));
    return "Listing saved. Existing bookings keep the price agreed when they were made.";
  });
}

export async function saveAvailabilityAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    let rules: unknown;
    try {
      rules = JSON.parse(str(fd, "rules") || "[]");
    } catch {
      throw invalid("Invalid schedule");
    }
    await chargers.setAvailabilityRules(u.id, str(fd, "chargerId"), rules);
    return "Weekly availability saved";
  });
}

export async function addBlockAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    const date = str(fd, "date");
    const endDate = str(fd, "endDate") || date;
    if (!isIsoDate(date) || !isIsoDate(endDate)) throw invalid("Choose a date", { date: "Required" });
    const allDay = str(fd, "allDay") === "on";
    const from = allDay ? 0 : hhmmToMinutes(str(fd, "from"));
    const to = allDay ? 1440 : hhmmToMinutes(str(fd, "to"));
    if (Number.isNaN(from) || Number.isNaN(to)) throw invalid("Enter valid times");
    await chargers.addAvailabilityBlock(u.id, str(fd, "chargerId"), zonedInstant(date, from, DEFAULT_TZ), zonedInstant(endDate, to, DEFAULT_TZ), str(fd, "reason"));
    return "Time blocked";
  });
}

export async function removeBlockAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    await chargers.removeAvailabilityBlock(u.id, str(fd, "chargerId"), str(fd, "blockId"));
    return "Block removed";
  });
}

export async function setChargerStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const status = str(fd, "status") as "active" | "paused" | "removed";
  const res = await act(async () => {
    const u = await requireUser();
    await chargers.setChargerStatus(u.id, str(fd, "chargerId"), status);
    return status === "active" ? "Your listing is live" : status === "paused" ? "Listing paused — it's hidden from search" : "Listing removed";
  });
  if (res.ok && status === "removed") redirect("/host/chargers");
  return res;
}

export async function decideBookingAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    const decision = str(fd, "decision") === "approve" ? "approve" : "reject";
    await decideBooking(u.id, str(fd, "bookingId"), decision, str(fd, "note"));
    return decision === "approve" ? "Booking approved — the slot is reserved" : "Request declined";
  });
}

export async function verifyCodeAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    await verifyStartCode(u.id, str(fd, "bookingId"), str(fd, "code"));
    return "Code verified. Now record the starting battery percentage.";
  });
}

export async function startReadingAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    await recordStartReading(u.id, str(fd, "bookingId"), str(fd, "percent") === "" ? NaN : Number(str(fd, "percent")));
    return "Charging session started";
  });
}

export async function endReadingAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    const r = await recordEndReading(u.id, str(fd, "bookingId"), str(fd, "percent") === "" ? NaN : Number(str(fd, "percent")));
    return r.zero ? "Session closed — no charge was delivered" : "Session ended. The bill has been sent to the driver.";
  });
}

export async function requestPayoutAction() {
  return act(async () => {
    const u = await requireUser();
    await requestPayout(u.id);
    return "Payout requested. You'll be notified once the transfer is confirmed.";
  });
}
