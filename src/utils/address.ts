import { createHash } from "node:crypto";

import type { BitcoinAddressType, BitcoinNetwork } from "../api/types.js";
import { InvalidAddressError } from "./errors.js";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map(Array.from(BASE58_ALPHABET, (character, index) => [character, index]));
const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BECH32_INDEX = new Map(Array.from(BECH32_CHARSET, (character, index) => [character, index]));
const BECH32M_CONSTANT = 0x2bc830a3;

function hash256(bytes: Uint8Array): Uint8Array {
  const first = createHash("sha256").update(bytes).digest();
  return createHash("sha256").update(first).digest();
}

function decodeBase58(address: string): Uint8Array {
  let value = 0n;

  for (const character of address) {
    const digit = BASE58_INDEX.get(character);

    if (digit === undefined) {
      throw new Error("Invalid base58 character");
    }

    value = value * 58n + BigInt(digit);
  }

  const bytes: number[] = [];

  while (value > 0n) {
    bytes.unshift(Number(value & 0xffn));
    value >>= 8n;
  }

  for (const character of address) {
    if (character !== "1") {
      break;
    }

    bytes.unshift(0);
  }

  return Uint8Array.from(bytes);
}

function verifyBase58Check(address: string): Uint8Array {
  const decoded = decodeBase58(address);

  if (decoded.length < 5) {
    throw new Error("Base58 payload too short");
  }

  const payload = decoded.slice(0, -4);
  const checksum = decoded.slice(-4);
  const expected = hash256(payload).slice(0, 4);

  if (checksum.some((byte, index) => byte !== expected[index])) {
    throw new Error("Invalid base58 checksum");
  }

  return payload;
}

function hrpExpand(hrp: string): number[] {
  const expanded: number[] = [];

  for (const character of hrp) {
    expanded.push(character.charCodeAt(0) >> 5);
  }

  expanded.push(0);

  for (const character of hrp) {
    expanded.push(character.charCodeAt(0) & 31);
  }

  return expanded;
}

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

function verifyBech32Checksum(hrp: string, data: number[]): "bech32" | "bech32m" | null {
  const checksum = polymod([...hrpExpand(hrp), ...data]);

  if (checksum === 1) {
    return "bech32";
  }

  if (checksum === BECH32M_CONSTANT) {
    return "bech32m";
  }

  return null;
}

function convertBits(
  data: number[],
  fromBits: number,
  toBits: number,
  pad: boolean,
): number[] | null {
  let accumulator = 0;
  let bits = 0;
  const output: number[] = [];
  const maxValue = (1 << toBits) - 1;

  for (const value of data) {
    if (value < 0 || value >> fromBits !== 0) {
      return null;
    }

    accumulator = (accumulator << fromBits) | value;
    bits += fromBits;

    while (bits >= toBits) {
      bits -= toBits;
      output.push((accumulator >> bits) & maxValue);
    }
  }

  if (pad) {
    if (bits > 0) {
      output.push((accumulator << (toBits - bits)) & maxValue);
    }
  } else if (bits >= fromBits || ((accumulator << (toBits - bits)) & maxValue) !== 0) {
    return null;
  }

  return output;
}

function decodeSegwitAddress(address: string): {
  type: BitcoinAddressType;
  network: BitcoinNetwork;
} {
  if (address !== address.toLowerCase() && address !== address.toUpperCase()) {
    throw new Error("Bech32 strings cannot mix case");
  }

  const normalized = address.toLowerCase();
  const separator = normalized.lastIndexOf("1");

  if (separator < 1 || separator + 7 > normalized.length || normalized.length > 90) {
    throw new Error("Invalid bech32 separator");
  }

  const hrp = normalized.slice(0, separator);
  const dataCharacters = normalized.slice(separator + 1);
  const data = Array.from(dataCharacters, character => {
    const digit = BECH32_INDEX.get(character);

    if (digit === undefined) {
      throw new Error("Invalid bech32 character");
    }

    return digit;
  });
  const checksumType = verifyBech32Checksum(hrp, data);

  if (hrp !== "bc") {
    throw new Error("Unsupported bech32 network");
  }

  if (checksumType === null) {
    throw new Error("Invalid bech32 checksum");
  }

  const payload = data.slice(0, -6);
  const witnessVersion = payload[0];

  if (witnessVersion === undefined) {
    throw new Error("Missing witness version");
  }

  const program = convertBits(payload.slice(1), 5, 8, false);

  if (program === null || witnessVersion > 16) {
    throw new Error("Invalid bech32 witness program");
  }

  if (witnessVersion === 0) {
    if (checksumType !== "bech32") {
      throw new Error("Witness version 0 must use bech32 checksum");
    }

    if (program.length === 20) {
      return { type: "p2wpkh", network: "mainnet" };
    }

    if (program.length === 32) {
      return { type: "p2wsh", network: "mainnet" };
    }

    throw new Error("Unsupported witness program length");
  }

  if (witnessVersion === 1) {
    if (checksumType !== "bech32m") {
      throw new Error("Witness version 1 must use bech32m checksum");
    }

    if (program.length === 32) {
      return { type: "p2tr", network: "mainnet" };
    }

    throw new Error("Taproot witness programs must be 32 bytes");
  }

  throw new Error("Unsupported witness version");
}

export function parseBitcoinMainnetAddress(address: string): {
  address: string;
  network: BitcoinNetwork;
  type: BitcoinAddressType;
} {
  const trimmed = address.trim();

  if (trimmed.length === 0) {
    throw new InvalidAddressError(address);
  }

  if (trimmed.toLowerCase().startsWith("bc1")) {
    try {
      const parsed = decodeSegwitAddress(trimmed);
      return {
        address: trimmed,
        network: parsed.network,
        type: parsed.type,
      };
    } catch {
      throw new InvalidAddressError(trimmed);
    }
  }

  if (trimmed.startsWith("1") || trimmed.startsWith("3")) {
    try {
      const payload = verifyBase58Check(trimmed);
      const version = payload[0];

      if (version === 0x00) {
        return {
          address: trimmed,
          network: "mainnet",
          type: "p2pkh",
        };
      }

      if (version === 0x05) {
        return {
          address: trimmed,
          network: "mainnet",
          type: "p2sh",
        };
      }
    } catch {
      throw new InvalidAddressError(trimmed);
    }
  }

  throw new InvalidAddressError(trimmed);
}

export function isBitcoinMainnetAddress(address: string): boolean {
  try {
    parseBitcoinMainnetAddress(address);
    return true;
  } catch {
    return false;
  }
}
