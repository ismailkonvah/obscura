import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  type Commitment,
} from "@solana/web3.js";
import { Buffer as BrowserBuffer } from "buffer/";
import { DEVNET_RPC } from "@/lib/solanaRpc";

(globalThis as unknown as { Buffer?: typeof BrowserBuffer }).Buffer ??= BrowserBuffer;
const TOKEN_DECIMALS = 9;
const NFT_DECIMALS = 0;
const LAMPORTS_PER_TOKEN = 1_000_000_000;
const MINT_SIZE = 82;
const CSOL_MINT_PREFIX = "obscura.csol.mint";
const CSOL_GLOBAL_MINT_KEY = "obscura.csol.global.mint";
const CSOL_MINT_AUTHORITY_KEY = "obscura.csol.mint.authority";
const CSOL_VAULT_PREFIX = "obscura.csol.vault";
const BID_ESCROW_PREFIX = "obscura.bid.escrow";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

type SignAndSend = (transaction: Transaction) => Promise<string>;

function instructionData(data: Uint8Array) {
  return BrowserBuffer.from(data) as unknown as Buffer;
}

export type TokenMintReceipt = {
  signature: string;
  mint: string;
  tokenAccount: string;
  vault?: string;
};

export type CsolBalanceSnapshot = {
  balance: number;
  mint?: string;
  tokenAccount?: string;
};

export type SettlementTransferReceipt = TokenMintReceipt & {
  kind: "seller-proceeds" | "bid-refund" | "lot-transfer";
  recipient: string;
  amount?: number;
};

function getConnection(commitment: Commitment = "confirmed") {
  return new Connection(DEVNET_RPC, commitment);
}

function u64Le(amount: bigint) {
  const bytes = new Uint8Array(8);
  let n = amount;
  for (let i = 0; i < 8; i += 1) {
    bytes[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return bytes;
}

function initializeMintInstruction({
  mint,
  decimals,
  authority,
}: {
  mint: PublicKey;
  decimals: number;
  authority: PublicKey;
}) {
  const data = new Uint8Array(70);
  data[0] = 0; // InitializeMint
  data[1] = decimals;
  data.set(authority.toBytes(), 2);
  data[34] = 1; // freeze_authority COption::Some as little-endian u32
  data[35] = 0;
  data[36] = 0;
  data[37] = 0;
  data.set(authority.toBytes(), 38);

  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: instructionData(data),
  });
}

function mintToInstruction({
  mint,
  destination,
  authority,
  amount,
}: {
  mint: PublicKey;
  destination: PublicKey;
  authority: PublicKey;
  amount: bigint;
}) {
  const data = new Uint8Array(9);
  data[0] = 7; // MintTo
  data.set(u64Le(amount), 1);

  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: instructionData(data),
  });
}

function burnInstruction({
  mint,
  source,
  owner,
  amount,
}: {
  mint: PublicKey;
  source: PublicKey;
  owner: PublicKey;
  amount: bigint;
}) {
  const data = new Uint8Array(9);
  data[0] = 8; // Burn
  data.set(u64Le(amount), 1);

  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data: instructionData(data),
  });
}

function transferTokenInstruction({
  source,
  destination,
  owner,
  amount,
}: {
  source: PublicKey;
  destination: PublicKey;
  owner: PublicKey;
  amount: bigint;
}) {
  const data = new Uint8Array(9);
  data[0] = 3; // Transfer
  data.set(u64Le(amount), 1);

  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data: instructionData(data),
  });
}

async function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey) {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

function createAssociatedTokenAccountInstruction({
  payer,
  ata,
  owner,
  mint,
}: {
  payer: PublicKey;
  ata: PublicKey;
  owner: PublicKey;
  mint: PublicKey;
}) {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: instructionData(new Uint8Array()),
  });
}

async function ensureAtaInstruction(
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
) {
  const ata = await getAssociatedTokenAddress(mint, owner);
  const account = await connection.getAccountInfo(ata);
  return {
    ata,
    instruction: account
      ? undefined
      : createAssociatedTokenAccountInstruction({ payer, ata, owner, mint }),
  };
}

function getStoredCsolMint(owner: string) {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem(CSOL_GLOBAL_MINT_KEY) ??
    localStorage.getItem(`${CSOL_MINT_PREFIX}.${owner}`)
  );
}

function getStoredCsolMintInfo(owner: string) {
  if (typeof window === "undefined") return null;
  const globalMint = localStorage.getItem(CSOL_GLOBAL_MINT_KEY);
  if (globalMint) return { mint: globalMint, authority: "global" as const };
  const ownerMint = localStorage.getItem(`${CSOL_MINT_PREFIX}.${owner}`);
  if (ownerMint) return { mint: ownerMint, authority: "owner" as const };
  return null;
}

function storeCsolMint(owner: string, mint: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CSOL_GLOBAL_MINT_KEY, mint);
  localStorage.setItem(`${CSOL_MINT_PREFIX}.${owner}`, mint);
}

function clearStoredCsolMint(owner: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CSOL_GLOBAL_MINT_KEY);
  localStorage.removeItem(`${CSOL_MINT_PREFIX}.${owner}`);
}

function getOrCreateCsolMintAuthority() {
  if (typeof window === "undefined") return Keypair.generate();
  const raw = localStorage.getItem(CSOL_MINT_AUTHORITY_KEY);
  if (raw) {
    try {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
    } catch {
      localStorage.removeItem(CSOL_MINT_AUTHORITY_KEY);
    }
  }
  const next = Keypair.generate();
  localStorage.setItem(CSOL_MINT_AUTHORITY_KEY, JSON.stringify(Array.from(next.secretKey)));
  return next;
}

function getStoredVaultKeypair(owner: string) {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(`${CSOL_VAULT_PREFIX}.${owner}`);
  if (!raw) return null;
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
  } catch {
    return null;
  }
}

function getOrCreateVaultKeypair(owner: string) {
  const stored = getStoredVaultKeypair(owner);
  if (stored) return stored;
  const next = Keypair.generate();
  if (typeof window !== "undefined") {
    localStorage.setItem(
      `${CSOL_VAULT_PREFIX}.${owner}`,
      JSON.stringify(Array.from(next.secretKey)),
    );
  }
  return next;
}

function getOrCreateBidEscrowKeypair(auctionId: string) {
  if (typeof window === "undefined") return Keypair.generate();
  const key = `${BID_ESCROW_PREFIX}.${auctionId}`;
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
    } catch {
      localStorage.removeItem(key);
    }
  }
  const next = Keypair.generate();
  localStorage.setItem(key, JSON.stringify(Array.from(next.secretKey)));
  return next;
}

function readMintAuthority(accountData: Uint8Array) {
  if (accountData.length < MINT_SIZE) return null;
  const authorityOption =
    accountData[0] | (accountData[1] << 8) | (accountData[2] << 16) | (accountData[3] << 24);
  if (authorityOption === 0) return null;
  return new PublicKey(accountData.slice(4, 36)).toBase58();
}

async function resolveStoredCsolMint({
  connection,
  owner,
  ownerPk,
}: {
  connection: Connection;
  owner: string;
  ownerPk: PublicKey;
}) {
  const stored = getStoredCsolMintInfo(owner);
  if (!stored) return null;

  const mintPk = new PublicKey(stored.mint);
  const mintAccount = await connection.getAccountInfo(mintPk);
  if (!mintAccount || !mintAccount.owner.equals(TOKEN_PROGRAM_ID)) {
    clearStoredCsolMint(owner);
    return null;
  }

  const chainAuthority = readMintAuthority(mintAccount.data);
  const expectedAuthority =
    stored.authority === "global"
      ? getOrCreateCsolMintAuthority().publicKey.toBase58()
      : ownerPk.toBase58();

  if (chainAuthority !== expectedAuthority) {
    clearStoredCsolMint(owner);
    return null;
  }

  return {
    mintPk,
    authority: stored.authority,
  };
}

async function sendAndConfirm({
  connection,
  owner,
  signAndSendTransaction,
  transaction,
  partialSigners,
}: {
  connection: Connection;
  owner: PublicKey;
  signAndSendTransaction: SignAndSend;
  transaction: Transaction;
  partialSigners?: Keypair[];
}) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.feePayer = owner;
  transaction.recentBlockhash = blockhash;
  if (partialSigners?.length) transaction.partialSign(...partialSigners);
  const signature = await signAndSendTransaction(transaction);
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}

export async function wrapSolToCsol({
  owner,
  amount,
  signAndSendTransaction,
}: {
  owner: string;
  amount: number;
  signAndSendTransaction: SignAndSend;
}): Promise<TokenMintReceipt> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a positive SOL amount to wrap.");
  }

  const connection = getConnection();
  const ownerPk = new PublicKey(owner);
  const vaultKeypair = getOrCreateVaultKeypair(owner);
  const storedMint = await resolveStoredCsolMint({ connection, owner, ownerPk });
  const mintKeypair = storedMint ? undefined : Keypair.generate();
  const mintPk = storedMint?.mintPk ?? mintKeypair!.publicKey;
  const mintAuthority =
    !storedMint || storedMint.authority === "global" ? getOrCreateCsolMintAuthority() : undefined;
  const mintAuthorityPk = mintAuthority?.publicKey ?? ownerPk;
  const transaction = new Transaction();
  const tokenAmount = BigInt(Math.round(amount * LAMPORTS_PER_TOKEN));

  transaction.add(
    SystemProgram.transfer({
      fromPubkey: ownerPk,
      toPubkey: vaultKeypair.publicKey,
      lamports: Number(tokenAmount),
    }),
  );

  if (mintKeypair) {
    const rent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: ownerPk,
        newAccountPubkey: mintPk,
        lamports: rent,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      initializeMintInstruction({
        mint: mintPk,
        decimals: TOKEN_DECIMALS,
        authority: mintAuthorityPk,
      }),
    );
  }

  const { ata, instruction } = await ensureAtaInstruction(connection, ownerPk, ownerPk, mintPk);
  if (instruction) transaction.add(instruction);
  transaction.add(
    mintToInstruction({
      mint: mintPk,
      destination: ata,
      authority: mintAuthorityPk,
      amount: tokenAmount,
    }),
  );

  const signature = await sendAndConfirm({
    connection,
    owner: ownerPk,
    signAndSendTransaction,
    transaction,
    partialSigners: [mintKeypair, mintAuthority].filter(Boolean) as Keypair[],
  });
  storeCsolMint(owner, mintPk.toBase58());

  return {
    signature,
    mint: mintPk.toBase58(),
    tokenAccount: ata.toBase58(),
    vault: vaultKeypair.publicKey.toBase58(),
  };
}

export async function unwrapCsolToSol({
  owner,
  amount,
  signAndSendTransaction,
}: {
  owner: string;
  amount: number;
  signAndSendTransaction: SignAndSend;
}): Promise<TokenMintReceipt> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a positive cSOL amount to withdraw.");
  }

  const connection = getConnection();
  const ownerPk = new PublicKey(owner);
  const mint = getStoredCsolMint(owner);
  const vaultKeypair = getStoredVaultKeypair(owner);
  if (!mint || !vaultKeypair) {
    throw new Error("Wrap SOL into cSOL once before withdrawing.");
  }

  const mintPk = new PublicKey(mint);
  const ata = await getAssociatedTokenAddress(mintPk, ownerPk);
  const tokenAmount = BigInt(Math.round(amount * LAMPORTS_PER_TOKEN));
  const vaultLamports = await connection.getBalance(vaultKeypair.publicKey);
  if (vaultLamports < Number(tokenAmount)) {
    throw new Error("Demo vault does not have enough SOL for that withdrawal.");
  }

  const transaction = new Transaction().add(
    burnInstruction({ mint: mintPk, source: ata, owner: ownerPk, amount: tokenAmount }),
    SystemProgram.transfer({
      fromPubkey: vaultKeypair.publicKey,
      toPubkey: ownerPk,
      lamports: Number(tokenAmount),
    }),
  );

  const signature = await sendAndConfirm({
    connection,
    owner: ownerPk,
    signAndSendTransaction,
    transaction,
    partialSigners: [vaultKeypair],
  });

  return {
    signature,
    mint: mintPk.toBase58(),
    tokenAccount: ata.toBase58(),
    vault: vaultKeypair.publicKey.toBase58(),
  };
}

export const mintDevnetCsol = wrapSolToCsol;

export async function getDevnetCsolBalance(owner: string): Promise<CsolBalanceSnapshot> {
  const connection = getConnection();
  const ownerPk = new PublicKey(owner);
  const storedMint = await resolveStoredCsolMint({ connection, owner, ownerPk });
  if (!storedMint) return { balance: 0 };
  const mintPk = storedMint.mintPk;
  const ata = await getAssociatedTokenAddress(mintPk, ownerPk);
  const account = await connection.getAccountInfo(ata);
  if (!account) {
    return { balance: 0, mint: mintPk.toBase58(), tokenAccount: ata.toBase58() };
  }

  const tokenBalance = await connection.getTokenAccountBalance(ata);
  return {
    balance: tokenBalance.value.uiAmount ?? 0,
    mint: mintPk.toBase58(),
    tokenAccount: ata.toBase58(),
  };
}

export async function escrowCsolForBid({
  owner,
  auctionId,
  amount,
  signAndSendTransaction,
}: {
  owner: string;
  auctionId: string;
  amount: number;
  signAndSendTransaction: SignAndSend;
}): Promise<TokenMintReceipt> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a positive cSOL bid amount.");
  }

  const mint = getStoredCsolMint(owner);
  if (!mint) {
    throw new Error("Wrap devnet SOL into cSOL before bidding.");
  }

  const connection = getConnection();
  const ownerPk = new PublicKey(owner);
  const mintPk = new PublicKey(mint);
  const bidderAta = await getAssociatedTokenAddress(mintPk, ownerPk);
  const bidderAccount = await connection.getAccountInfo(bidderAta);
  if (!bidderAccount) {
    throw new Error("No cSOL token account found for this wallet.");
  }

  const tokenAmount = BigInt(Math.round(amount * LAMPORTS_PER_TOKEN));
  const balance = await connection.getTokenAccountBalance(bidderAta);
  const rawBalance = BigInt(balance.value.amount);
  if (rawBalance < tokenAmount) {
    throw new Error("Not enough on-chain cSOL for that private bid.");
  }

  const escrow = getOrCreateBidEscrowKeypair(auctionId);
  const { ata: escrowAta, instruction } = await ensureAtaInstruction(
    connection,
    ownerPk,
    escrow.publicKey,
    mintPk,
  );
  const transaction = new Transaction();
  if (instruction) transaction.add(instruction);
  transaction.add(
    transferTokenInstruction({
      source: bidderAta,
      destination: escrowAta,
      owner: ownerPk,
      amount: tokenAmount,
    }),
  );

  const signature = await sendAndConfirm({
    connection,
    owner: ownerPk,
    signAndSendTransaction,
    transaction,
  });

  return {
    signature,
    mint: mintPk.toBase58(),
    tokenAccount: escrowAta.toBase58(),
    vault: escrow.publicKey.toBase58(),
  };
}

export async function settleDevnetAuctionEscrow({
  settler,
  auctionId,
  seller,
  lotMint,
  winner,
  sellerProceeds,
  refunds,
  signAndSendTransaction,
}: {
  settler: string;
  auctionId: string;
  seller: string;
  lotMint?: string;
  winner?: string;
  sellerProceeds?: { amount: number; escrow: TokenMintReceipt };
  refunds: { bidder: string; amount: number; escrow: TokenMintReceipt }[];
  signAndSendTransaction: SignAndSend;
}): Promise<SettlementTransferReceipt[]> {
  const connection = getConnection();
  const settlerPk = new PublicKey(settler);
  const sellerPk = new PublicKey(seller);
  const transaction = new Transaction();
  const escrowKeypair = getOrCreateBidEscrowKeypair(auctionId);
  const receipts: SettlementTransferReceipt[] = [];

  if (sellerProceeds && sellerProceeds.amount > 0) {
    const mintPk = new PublicKey(sellerProceeds.escrow.mint);
    const source = new PublicKey(sellerProceeds.escrow.tokenAccount);
    const { ata: sellerAta, instruction } = await ensureAtaInstruction(
      connection,
      settlerPk,
      sellerPk,
      mintPk,
    );
    if (instruction) transaction.add(instruction);
    transaction.add(
      transferTokenInstruction({
        source,
        destination: sellerAta,
        owner: escrowKeypair.publicKey,
        amount: BigInt(Math.round(sellerProceeds.amount * LAMPORTS_PER_TOKEN)),
      }),
    );
    receipts.push({
      kind: "seller-proceeds",
      recipient: seller,
      amount: sellerProceeds.amount,
      signature: "",
      mint: mintPk.toBase58(),
      tokenAccount: sellerAta.toBase58(),
      vault: escrowKeypair.publicKey.toBase58(),
    });
  }

  for (const refund of refunds) {
    if (refund.amount <= 0) continue;
    const mintPk = new PublicKey(refund.escrow.mint);
    const source = new PublicKey(refund.escrow.tokenAccount);
    const bidderPk = new PublicKey(refund.bidder);
    const { ata: bidderAta, instruction } = await ensureAtaInstruction(
      connection,
      settlerPk,
      bidderPk,
      mintPk,
    );
    if (instruction) transaction.add(instruction);
    transaction.add(
      transferTokenInstruction({
        source,
        destination: bidderAta,
        owner: escrowKeypair.publicKey,
        amount: BigInt(Math.round(refund.amount * LAMPORTS_PER_TOKEN)),
      }),
    );
    receipts.push({
      kind: "bid-refund",
      recipient: refund.bidder,
      amount: refund.amount,
      signature: "",
      mint: mintPk.toBase58(),
      tokenAccount: bidderAta.toBase58(),
      vault: escrowKeypair.publicKey.toBase58(),
    });
  }

  if (lotMint && winner) {
    const lotMintPk = new PublicKey(lotMint);
    const winnerPk = new PublicKey(winner);
    const sellerLotAta = await getAssociatedTokenAddress(lotMintPk, sellerPk);
    const sellerLotAccount = await connection.getAccountInfo(sellerLotAta);
    if (!sellerLotAccount) {
      throw new Error("Creator no longer holds the auction lot token.");
    }
    const { ata: winnerLotAta, instruction } = await ensureAtaInstruction(
      connection,
      settlerPk,
      winnerPk,
      lotMintPk,
    );
    if (instruction) transaction.add(instruction);
    transaction.add(
      transferTokenInstruction({
        source: sellerLotAta,
        destination: winnerLotAta,
        owner: sellerPk,
        amount: 1n,
      }),
    );
    receipts.push({
      kind: "lot-transfer",
      recipient: winner,
      amount: 1,
      signature: "",
      mint: lotMintPk.toBase58(),
      tokenAccount: winnerLotAta.toBase58(),
    });
  }

  if (transaction.instructions.length === 0) return [];

  const signature = await sendAndConfirm({
    connection,
    owner: settlerPk,
    signAndSendTransaction,
    transaction,
    partialSigners: [escrowKeypair],
  });

  return receipts.map((receipt) => ({ ...receipt, signature }));
}

export async function mintDevnetDemoLot({
  owner,
  signAndSendTransaction,
}: {
  owner: string;
  signAndSendTransaction: SignAndSend;
}): Promise<TokenMintReceipt> {
  const connection = getConnection();
  const ownerPk = new PublicKey(owner);
  const mintKeypair = Keypair.generate();
  const rent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  const { ata, instruction } = await ensureAtaInstruction(
    connection,
    ownerPk,
    ownerPk,
    mintKeypair.publicKey,
  );
  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: ownerPk,
      newAccountPubkey: mintKeypair.publicKey,
      lamports: rent,
      space: MINT_SIZE,
      programId: TOKEN_PROGRAM_ID,
    }),
    initializeMintInstruction({
      mint: mintKeypair.publicKey,
      decimals: NFT_DECIMALS,
      authority: ownerPk,
    }),
  );

  if (instruction) transaction.add(instruction);
  transaction.add(
    mintToInstruction({
      mint: mintKeypair.publicKey,
      destination: ata,
      authority: ownerPk,
      amount: 1n,
    }),
  );

  const signature = await sendAndConfirm({
    connection,
    owner: ownerPk,
    signAndSendTransaction,
    transaction,
    partialSigners: [mintKeypair],
  });

  return {
    signature,
    mint: mintKeypair.publicKey.toBase58(),
    tokenAccount: ata.toBase58(),
  };
}
