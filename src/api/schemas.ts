import { z } from "zod";

export const BlockstreamAddressStatsSchema = z
  .object({
    funded_txo_count: z.number().int().nonnegative(),
    funded_txo_sum: z.number().int().nonnegative(),
    spent_txo_count: z.number().int().nonnegative(),
    spent_txo_sum: z.number().int().nonnegative(),
    tx_count: z.number().int().nonnegative(),
  })
  .strict();

export const BlockstreamAddressSchema = z
  .object({
    address: z.string(),
    chain_stats: BlockstreamAddressStatsSchema,
    mempool_stats: BlockstreamAddressStatsSchema,
  })
  .strict();

export const BlockstreamUtxoStatusSchema = z
  .object({
    confirmed: z.boolean(),
    block_height: z.number().int().nonnegative().optional(),
    block_hash: z.string().optional(),
    block_time: z.number().int().positive().optional(),
  })
  .strict();

export const BlockstreamUtxoSchema = z
  .object({
    txid: z.string(),
    vout: z.number().int().nonnegative(),
    status: BlockstreamUtxoStatusSchema,
    value: z.number().int().nonnegative(),
  })
  .strict();

export const BlockstreamScriptPubKeySchema = z
  .object({
    asm: z.string(),
    hex: z.string(),
    type: z.string(),
    address: z.string().optional(),
  })
  .strict();

export const BlockstreamTxPrevoutSchema = z
  .object({
    scriptpubkey: z.string(),
    scriptpubkey_asm: z.string(),
    scriptpubkey_type: z.string(),
    scriptpubkey_address: z.string().optional(),
    value: z.number().int().nonnegative(),
  })
  .strict();

export const BlockstreamTxVinSchema = z
  .object({
    txid: z.string().nullable().optional(),
    vout: z.number().int().nonnegative().nullable().optional(),
    prevout: BlockstreamTxPrevoutSchema.nullable().optional(),
    scriptsig: z.string().optional(),
    scriptsig_asm: z.string().optional(),
    witness: z.array(z.string()).optional(),
    is_coinbase: z.boolean().optional(),
    sequence: z.number().int().nonnegative(),
    coinbase: z.string().optional(),
  })
  .strict();

export const BlockstreamTxVoutSchema = z
  .object({
    scriptpubkey: z.string(),
    scriptpubkey_asm: z.string(),
    scriptpubkey_type: z.string(),
    scriptpubkey_address: z.string().optional(),
    value: z.number().int().nonnegative(),
  })
  .strict();

export const BlockstreamTxStatusSchema = z
  .object({
    confirmed: z.boolean(),
    block_height: z.number().int().nonnegative().optional(),
    block_hash: z.string().optional(),
    block_time: z.number().int().positive().optional(),
  })
  .strict();

export const BlockstreamTxSchema = z
  .object({
    txid: z.string(),
    version: z.number().int(),
    locktime: z.number().int().nonnegative(),
    vin: z.array(BlockstreamTxVinSchema),
    vout: z.array(BlockstreamTxVoutSchema),
    size: z.number().int().positive().optional(),
    weight: z.number().int().positive().optional(),
    fee: z.number().int().nonnegative().optional(),
    status: BlockstreamTxStatusSchema,
  })
  .strict();

export type BlockstreamAddressStats = z.infer<typeof BlockstreamAddressStatsSchema>;
export type BlockstreamAddressResponse = z.infer<typeof BlockstreamAddressSchema>;
export type BlockstreamUtxo = z.infer<typeof BlockstreamUtxoSchema>;
export type BlockstreamTx = z.infer<typeof BlockstreamTxSchema>;

