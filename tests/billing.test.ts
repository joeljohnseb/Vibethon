import { describe, expect, it } from "vitest";
import { BillingError, calculateBill, estimateEnergyWh, validateReadings } from "@/lib/billing";

describe("battery energy estimate", () => {
  it("matches the spec example: 60 kWh, 30% → 70% = 24 kWh, ₹12/kWh = ₹288", () => {
    expect(estimateEnergyWh(60, 30, 70)).toBe(24000);
    const bill = calculateBill({ batteryKwh: 60, startPercent: 30, endPercent: 70, pricePerKwhPaise: 1200 });
    expect(bill.billableWh).toBe(24000);
    expect(bill.energyChargePaise).toBe(28800);
    expect(bill.totalPaise).toBe(28800);
    expect(bill.platformFeePaise).toBe(0);
    expect(bill.taxPaise).toBe(0);
    expect(bill.giverEarningsPaise).toBe(28800);
    expect(bill.lines).toHaveLength(1);
  });

  it("handles fractional capacities and rounds to whole Wh / paise", () => {
    expect(estimateEnergyWh(40.5, 20, 80)).toBe(24300);
    const bill = calculateBill({ batteryKwh: 30.2, startPercent: 33, endPercent: 34, pricePerKwhPaise: 1599 });
    expect(bill.billableWh).toBe(302);
    expect(bill.energyChargePaise).toBe(Math.round((302 * 1599) / 1000));
  });

  it("rejects invalid readings", () => {
    expect(() => validateReadings(50, 40)).toThrow(BillingError);
    expect(() => validateReadings(-1, 40)).toThrow(BillingError);
    expect(() => validateReadings(10, 101)).toThrow(BillingError);
    expect(() => validateReadings(10.5, 20)).toThrow(BillingError);
    expect(() => estimateEnergyWh(0, 10, 20)).toThrow(BillingError);
  });

  it("allows equal start and end → ₹0 bill with no fees", () => {
    const bill = calculateBill({ batteryKwh: 60, startPercent: 50, endPercent: 50, pricePerKwhPaise: 1200, platformFeeFixedPaise: 500, taxBps: 1800 });
    expect(bill.totalPaise).toBe(0);
    expect(bill.platformFeePaise).toBe(0);
  });
});

describe("configured fees and taxes", () => {
  it("adds each configured charge as its own line and the total is the sum", () => {
    const bill = calculateBill({
      batteryKwh: 60, startPercent: 30, endPercent: 70, pricePerKwhPaise: 1200,
      platformFeeBps: 500, platformFeeFixedPaise: 1000, taxBps: 1800,
    });
    expect(bill.energyChargePaise).toBe(28800);
    expect(bill.platformFeePaise).toBe(1440 + 1000);
    expect(bill.taxPaise).toBe(Math.round(((28800 + 2440) * 1800) / 10000));
    expect(bill.totalPaise).toBe(bill.energyChargePaise + bill.platformFeePaise + bill.taxPaise);
    expect(bill.lines.map((l) => l.code)).toEqual(["energy", "platform_fee", "tax"]);
    expect(bill.lines.reduce((a, l) => a + l.amountPaise, 0)).toBe(bill.totalPaise);
    expect(bill.giverEarningsPaise).toBe(28800);
  });

  it("adds a disclosed minimum-payment adjustment below ₹1", () => {
    const bill = calculateBill({ batteryKwh: 10, startPercent: 10, endPercent: 11, pricePerKwhPaise: 500 });
    expect(bill.energyChargePaise).toBe(50);
    expect(bill.adjustmentPaise).toBe(50);
    expect(bill.totalPaise).toBe(100);
    expect(bill.lines.find((l) => l.code === "minimum")).toBeTruthy();
  });

  it("supports metered energy without changing the rest of the bill", () => {
    const bill = calculateBill({ batteryKwh: 60, startPercent: 30, endPercent: 70, pricePerKwhPaise: 1200, method: "meter", meterWh: 26500 });
    expect(bill.billableWh).toBe(26500);
    expect(bill.energyChargePaise).toBe(31800);
  });
});
