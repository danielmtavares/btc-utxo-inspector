import { parseBitcoinMainnetAddress } from "../utils/address.js";
import type {
  BitcoinAddressType,
  BitcoinNetwork,
  BitcoinScriptType,
  ExplorerSource,
  PaginatedCollection,
  Utxo,
} from "../api/types.js";
import {
  createAmountSummary,
  getPagination,
  resolveClient,
} from "./shared.js";
import type {
  AmountSummary,
  CommandClientDependencies,
} from "./shared.js";

export interface AddressCommandUtxo {
  txid: string;
  vout: number;
  outpoint: string;
  amount: AmountSummary;
  confirmationStatus: "confirmed" | "unconfirmed";
  confirmed: boolean;
  blockHeight: number | null;
  scriptType: BitcoinScriptType;
}

export interface AddressCommandResult {
  address: string;
  network: BitcoinNetwork;
  addressType: BitcoinAddressType;
  totalReceived: AmountSummary;
  totalSpent: AmountSummary;
  balance: AmountSummary;
  utxos: PaginatedCollection<AddressCommandUtxo>;
}

export interface AddressCommandInput {
  address: string;
  source?: ExplorerSource;
  apiUrl?: string;
  page?: number;
  limit?: number;
}

function mapUtxoCollection(
  utxos: PaginatedCollection<Utxo>,
): PaginatedCollection<AddressCommandUtxo> {
  return {
    items: utxos.items.map(utxo => ({
      txid: utxo.txid,
      vout: utxo.vout,
      outpoint: `${utxo.txid}:${String(utxo.vout)}`,
      amount: createAmountSummary(utxo.valueSats),
      confirmationStatus: utxo.status.confirmed ? "confirmed" : "unconfirmed",
      confirmed: utxo.status.confirmed,
      blockHeight: utxo.status.blockHeight,
      scriptType: utxo.scriptPubKeyType,
    })),
    pagination: utxos.pagination,
  };
}

export async function inspectAddressCommand(
  input: AddressCommandInput,
  dependencies: CommandClientDependencies = {},
): Promise<AddressCommandResult> {
  const parsedAddress = parseBitcoinMainnetAddress(input.address);
  const client = resolveClient(input, dependencies);
  const summary = await client.getAddressSummary({
    address: parsedAddress.address,
    addressType: parsedAddress.type,
    pagination: getPagination(input),
  });

  return {
    address: summary.address,
    network: summary.network,
    addressType: summary.addressType,
    totalReceived: createAmountSummary(summary.totalReceivedSats),
    totalSpent: createAmountSummary(summary.totalSpentSats),
    balance: createAmountSummary(summary.balanceSats),
    utxos: mapUtxoCollection(summary.utxos),
  };
}
