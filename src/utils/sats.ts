const SATS_PER_BTC = 100_000_000n;

function toBigIntSats(value: bigint | number | string): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Sats value must be finite");
    }

    if (!Number.isInteger(value)) {
      throw new TypeError("Sats value must be an integer");
    }

    return BigInt(value);
  }

  if (!/^-?\d+$/.test(value)) {
    throw new TypeError(`Invalid sats value: ${value}`);
  }

  return BigInt(value);
}

function formatIntegerWithSeparators(value: bigint): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function normalizeBtcString(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new TypeError("BTC value cannot be empty");
  }

  const negative = trimmed.startsWith("-");
  const normalized = negative ? trimmed.slice(1) : trimmed;

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new TypeError(`Invalid BTC value: ${value}`);
  }

  const parts = normalized.split(".");
  const wholePart = parts[0];
  const fractionPart = parts[1] ?? "";

  if (wholePart === undefined) {
    throw new TypeError(`Invalid BTC value: ${value}`);
  }

  const fraction = fractionPart.padEnd(8, "0").slice(0, 8);

  if (fractionPart.length > 8) {
    const remainder = fractionPart.slice(8);
    if (!/^0*$/.test(remainder)) {
      throw new TypeError("BTC values cannot have more than 8 decimal places");
    }
  }

  const sats = BigInt(wholePart) * SATS_PER_BTC + BigInt(fraction);
  return negative ? `-${sats}` : sats.toString();
}

export function satsToBtcString(value: bigint | number | string): string {
  const sats = toBigIntSats(value);
  const negative = sats < 0n;
  const absValue = negative ? -sats : sats;
  const whole = absValue / SATS_PER_BTC;
  const fraction = absValue % SATS_PER_BTC;
  const fractionString = fraction.toString().padStart(8, "0").replace(/0+$/, "");
  const formatted = fractionString.length > 0 ? `${whole}.${fractionString}` : whole.toString();

  return negative ? `-${formatted}` : formatted;
}

export function formatBtcAmount(value: bigint | number | string): string {
  return `${satsToBtcString(value)} BTC`;
}

export function formatSatsAmount(value: bigint | number | string): string {
  return `${formatIntegerWithSeparators(toBigIntSats(value))} sats`;
}

export function btcToSats(value: number | string): bigint {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("BTC value must be finite");
    }

    return BigInt(normalizeBtcString(value.toString()));
  }

  return BigInt(normalizeBtcString(value));
}
