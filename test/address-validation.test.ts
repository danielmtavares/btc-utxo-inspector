import { describe, expect, it } from "vitest";

import { isBitcoinMainnetAddress, parseBitcoinMainnetAddress } from "../src/utils/address.js";
import { InvalidAddressError } from "../src/utils/errors.js";

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function polymod(values: number[]): number {
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let checksum = 1;

  for (const value of values) {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;

    for (let bit = 0; bit < generators.length; bit += 1) {
      if ((top >>> bit) & 1) {
        const generator = generators[bit];

        if (generator !== undefined) {
          checksum ^= generator;
        }
      }
    }
  }

  return checksum;
}

function hrpExpand(hrp: string): number[] {
  const output: number[] = [];

  for (const character of hrp) {
    output.push(character.charCodeAt(0) >> 5);
  }

  output.push(0);

  for (const character of hrp) {
    output.push(character.charCodeAt(0) & 31);
  }

  return output;
}

function convertBits(data: Uint8Array, fromBits: number, toBits: number): number[] {
  let accumulator = 0;
  let bits = 0;
  const output: number[] = [];
  const maxValue = (1 << toBits) - 1;

  for (const value of data) {
    accumulator = (accumulator << fromBits) | value;
    bits += fromBits;

    while (bits >= toBits) {
      bits -= toBits;
      output.push((accumulator >> bits) & maxValue);
    }
  }

  if (bits > 0) {
    output.push((accumulator << (toBits - bits)) & maxValue);
  }

  return output;
}

function encodeSegwitAddress(hrp: string, version: number, program: Uint8Array): string {
  const checksumConstant = version === 0 ? 1 : 0x2bc830a3;
  const converted = convertBits(program, 8, 5);
  const data = [version, ...converted];
  const values = [...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0];
  const polymodResult = polymod(values) ^ checksumConstant;
  const checksum = Array.from(
    { length: 6 },
    (_unused, index) => (polymodResult >> (5 * (5 - index))) & 31,
  );
  const combined = [...data, ...checksum];

  return `${hrp}1${combined.map(value => BECH32_CHARSET[value]).join("")}`;
}

function createTaprootAddress(): string {
  return encodeSegwitAddress(
    "bc",
    1,
    Uint8Array.from({ length: 32 }, (_, index) => index),
  );
}

describe("bitcoin address validation", () => {
  it("accepts supported mainnet base58 and segwit addresses", () => {
    const p2pkh = "1BoatSLRHtKNngkdXEeobR76b53LETtpyT";
    const p2sh = "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy";
    const p2wpkh = encodeSegwitAddress(
      "bc",
      0,
      Uint8Array.from({ length: 20 }, (_, index) => index),
    );
    const p2wsh = encodeSegwitAddress(
      "bc",
      0,
      Uint8Array.from({ length: 32 }, (_, index) => index),
    );
    const p2tr = createTaprootAddress();

    expect(parseBitcoinMainnetAddress(p2pkh)).toEqual({
      address: p2pkh,
      network: "mainnet",
      type: "p2pkh",
    });
    expect(parseBitcoinMainnetAddress(p2sh)).toEqual({
      address: p2sh,
      network: "mainnet",
      type: "p2sh",
    });
    expect(parseBitcoinMainnetAddress(p2wpkh)).toEqual({
      address: p2wpkh,
      network: "mainnet",
      type: "p2wpkh",
    });
    expect(parseBitcoinMainnetAddress(p2wsh)).toEqual({
      address: p2wsh,
      network: "mainnet",
      type: "p2wsh",
    });
    expect(parseBitcoinMainnetAddress(p2tr)).toEqual({
      address: p2tr,
      network: "mainnet",
      type: "p2tr",
    });
  });

  it("rejects invalid or unsupported addresses", () => {
    expect(isBitcoinMainnetAddress("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kg3g4ty")).toBe(false);
    expect(() => parseBitcoinMainnetAddress("not-an-address")).toThrow(InvalidAddressError);
    expect(() => parseBitcoinMainnetAddress("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kg3g4ty")).toThrow(
      InvalidAddressError,
    );
  });
});
