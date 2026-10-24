/**
 * Authoritative billing maths. Pure functions — no I/O — so the same code is
 * used by the server when finalising a session and by tests.
 *
 * MVP method: billable energy is *estimated* from the vehicle's battery capacity
 * and the change in state of charge, recorded manually by the homeowner:
 *
 *   energy (kWh) = capacity (kWh) × (end% − start%) / 100
 *
 * Energy drawn from the wall is typically higher because of charging losses;
 * that is disclosed to both parties. When meter integration exists, pass
 * `method: "meter"` with `meterWh` and the rest of the bill is unchanged.
 */
import type { InvoiceLine } from "./db/schema";

export class BillingError extends Error {}

export const MIN_GATEWAY_PAISE = 100; // payment gateways require at least ₹1

export type BillInput = {
  batteryKwh: number;
  startPercent: number;
  endPercent: number;
  pricePerKwhPaise: number;
  platformFeeBps?: number;
  platformFeeFixedPaise?: number;
  taxBps?: number;
  method?: "battery_estimate" | "meter";
  meterWh?: number;
};

export type Bill = {
  method: "battery_estimate" | "meter";
  billableWh: number;
  energyChargePaise: number;
  platformFeePaise: number;
  taxPaise: number;
  adjustmentPaise: number;
  totalPaise: number;
  giverEarningsPaise: number;
  lines: InvoiceLine[];
};

export function validatePercent(p: unknown, label = "Battery percentage"): number {
  if (typeof p !== "number" || !Number.isInteger(p) || p < 0 || p > 100) {
    throw new BillingError(`${label} must be a whole number between 0 and 100`);
  }
  return p;
}

export function validateReadings(startPercent: number, endPercent: number) {
  validatePercent(startPercent, "Starting battery percentage");
  validatePercent(endPercent, "Ending battery percentage");
  if (endPercent < startPercent) {
    throw new BillingError("Ending battery percentage cannot be lower than the starting percentage");
  }
}

/** Estimated battery energy gained, in watt-hours (integer). */
export function estimateEnergyWh(batteryKwh: number, startPercent: number, endPercent: number): number {
  if (!(batteryKwh > 0) || batteryKwh > 300) throw new BillingError("Battery capacity must be between 0 and 300 kWh");
  validateReadings(startPercent, endPercent);
  const batteryWh = Math.round(batteryKwh * 1000);
  return Math.round((batteryWh * (endPercent - startPercent)) / 100);
}

const pct = (amount: number, bps: number) => Math.round((amount * bps) / 10000);

export function calculateBill(input: BillInput): Bill {
  const method = input.method ?? "battery_estimate";
  const {
    batteryKwh,
    startPercent,
    endPercent,
    pricePerKwhPaise,
    platformFeeBps = 0,
    platformFeeFixedPaise = 0,
    taxBps = 0,
  } = input;

  if (!Number.isInteger(pricePerKwhPaise) || pricePerKwhPaise <= 0) throw new BillingError("Invalid price per kWh");
  for (const [k, v] of Object.entries({ platformFeeBps, platformFeeFixedPaise, taxBps })) {
    if (!Number.isInteger(v) || v < 0) throw new BillingError(`Invalid ${k}`);
  }

  let billableWh: number;
  if (method === "meter") {
    if (!Number.isInteger(input.meterWh) || (input.meterWh as number) < 0) throw new BillingError("Invalid meter reading");
    validateReadings(startPercent, endPercent);
    billableWh = input.meterWh as number;
  } else {
    billableWh = estimateEnergyWh(batteryKwh, startPercent, endPercent);
  }

  const energyChargePaise = Math.round((billableWh * pricePerKwhPaise) / 1000);
  // Fees only apply when something was actually delivered.
  const platformFeePaise = energyChargePaise > 0 ? pct(energyChargePaise, platformFeeBps) + platformFeeFixedPaise : 0;
  const taxPaise = pct(energyChargePaise + platformFeePaise, taxBps);
  const subtotal = energyChargePaise + platformFeePaise + taxPaise;
  const adjustmentPaise = subtotal > 0 && subtotal < MIN_GATEWAY_PAISE ? MIN_GATEWAY_PAISE - subtotal : 0;
  const totalPaise = subtotal + adjustmentPaise;

  const kwh = (billableWh / 1000).toFixed(3).replace(/\.?0+$/, "");
  const lines: InvoiceLine[] = [
    {
      code: "energy",
      label: method === "meter" ? "Metered energy" : "Estimated battery energy",
      amountPaise: energyChargePaise,
      detail:
        method === "meter"
          ? `${kwh} kWh × ₹${(pricePerKwhPaise / 100).toFixed(2)}/kWh`
          : `${batteryKwh} kWh × (${endPercent}% − ${startPercent}%) = ${kwh} kWh × ₹${(pricePerKwhPaise / 100).toFixed(2)}/kWh`,
    },
  ];
  if (platformFeePaise > 0) lines.push({ code: "platform_fee", label: "Platform fee", amountPaise: platformFeePaise });
  if (taxPaise > 0) lines.push({ code: "tax", label: `Tax (${(taxBps / 100).toFixed(2)}%)`, amountPaise: taxPaise });
  if (adjustmentPaise > 0)
    lines.push({
      code: "minimum",
      label: "Minimum payment adjustment",
      amountPaise: adjustmentPaise,
      detail: "Payment gateways require a minimum of ₹1",
    });

  return {
    method,
    billableWh,
    energyChargePaise,
    platformFeePaise,
    taxPaise,
    adjustmentPaise,
    totalPaise,
    giverEarningsPaise: energyChargePaise,
    lines,
  };
}
