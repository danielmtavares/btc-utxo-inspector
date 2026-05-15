import { createBlockstreamClient, DEFAULT_BLOCKSTREAM_API_URL } from "./blockstream.js";
import type { ExplorerClient, ExplorerSource } from "./types.js";
import type { BlockstreamClientOptions } from "./blockstream.js";

export interface ExplorerClientOptions extends BlockstreamClientOptions {
  source?: ExplorerSource;
}

export function createExplorerClient(options: ExplorerClientOptions = {}): ExplorerClient {
  const source = options.source ?? "blockstream";

  switch (source) {
    case "blockstream":
      return createBlockstreamClient(options);
  }
}

export { DEFAULT_BLOCKSTREAM_API_URL };
