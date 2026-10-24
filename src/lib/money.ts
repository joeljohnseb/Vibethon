const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
const inrShort = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

/** Format integer paise as rupees, e.g. 28800 → "₹288.00". */
export function formatPaise(paise: number, opts: { short?: boolean } = {}) {
  return (opts.short ? inrShort : inr).format(paise / 100);
}

export function rupeesToPaise(rupees: number | string): number {
  const n = typeof rupees === "string" ? Number(rupees) : rupees;
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

export function formatKwh(wh: number) {
  return `${(wh / 1000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} kWh`;
}
