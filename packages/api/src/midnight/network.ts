/**
 * Per-network indexer endpoints, for the reads that need no wallet at all
 * (`listWorkers`, `getEmploymentRecord`, `listEmploymentRecords` — see the
 * "For B" table in the api README: "go through the Indexer GraphQL API,
 * need no wallet"). Values from the midnight-js skill's network table,
 * cross-referenced against docs.midnight.network's endpoint list.
 */
/** The networks, as values, so configuration can be validated against them. */
export const NETWORK_IDS = ['undeployed', 'preview', 'preprod', 'mainnet'] as const;

export type NetworkId = (typeof NETWORK_IDS)[number];

export const INDEXER_ENDPOINTS: Record<NetworkId, { http: string; ws: string }> = {
  undeployed: {
    http: 'http://localhost:8088/api/v4/graphql',
    ws: 'ws://localhost:8088/api/v4/graphql/ws',
  },
  preview: {
    http: 'https://indexer.preview.midnight.network/api/v4/graphql',
    ws: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
  },
  preprod: {
    http: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    ws: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  },
  mainnet: {
    http: 'https://indexer.mainnet.midnight.network/api/v4/graphql',
    ws: 'wss://indexer.mainnet.midnight.network/api/v4/graphql/ws',
  },
};
