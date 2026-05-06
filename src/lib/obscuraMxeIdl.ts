export const obscuraMxeIdl = {
  address: "EnPG3YjzUNpDgHp6YqiLoaeL5iNjaEHfXH9E1SYqpWEP",
  metadata: {
    name: "obscura_mxe",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Created with Arcium & Anchor",
  },
  instructions: [
    {
      name: "resolve_blind_auction",
      discriminator: [129, 227, 45, 93, 165, 97, 108, 55],
      accounts: [
        { name: "payer", writable: true, signer: true },
        {
          name: "sign_pda_account",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  65, 114, 99, 105, 117, 109, 83, 105, 103, 110, 101, 114, 65, 99, 99, 111, 117,
                  110, 116,
                ],
              },
            ],
          },
        },
        { name: "mxe_account" },
        { name: "mempool_account", writable: true },
        { name: "executing_pool", writable: true },
        { name: "computation_account", writable: true },
        { name: "comp_def_account" },
        { name: "cluster_account", writable: true },
        {
          name: "pool_account",
          writable: true,
          address: "G2sRWJvi3xoyh5k2gY49eG9L8YhAEWQPtNb1zb1GXTtC",
        },
        {
          name: "clock_account",
          writable: true,
          address: "7EbMUTLo5DjdzbN7s8BXeZwXzEwNQb1hScfRvWg8a6ot",
        },
        { name: "system_program", address: "11111111111111111111111111111111" },
        { name: "arcium_program", address: "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ" },
      ],
      args: [
        { name: "computation_offset", type: "u64" },
        { name: "ciphertext_amount_0", type: { array: ["u8", 32] } },
        { name: "ciphertext_amount_1", type: { array: ["u8", 32] } },
        { name: "ciphertext_amount_2", type: { array: ["u8", 32] } },
        { name: "ciphertext_bidder_0", type: { array: ["u8", 32] } },
        { name: "ciphertext_bidder_1", type: { array: ["u8", 32] } },
        { name: "ciphertext_bidder_2", type: { array: ["u8", 32] } },
        { name: "pubkey", type: { array: ["u8", 32] } },
        { name: "nonce", type: "u128" },
        { name: "format", type: "u8" },
      ],
    },
  ],
  events: [
    {
      name: "BlindAuctionResolvedEvent",
      discriminator: [85, 11, 123, 84, 220, 162, 26, 148],
    },
  ],
  types: [
    {
      name: "BlindAuctionResolvedEvent",
      type: {
        kind: "struct",
        fields: [
          { name: "winner_commitment", type: "u128" },
          { name: "clearing_price_lamports", type: "u64" },
          { name: "second_price_lamports", type: "u64" },
          { name: "bid_count", type: "u8" },
        ],
      },
    },
  ],
} as const;
