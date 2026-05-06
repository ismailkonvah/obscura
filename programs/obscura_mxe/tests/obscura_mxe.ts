import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  getArciumAccountBaseSeed,
  getArciumProgram,
  getArciumProgramId,
  getCompDefAccOffset,
  getLookupTableAddress,
  getMXEAccAddress,
  uploadCircuit,
} from "@arcium-hq/client";
import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";

import { ObscuraMxe } from "../target/types/obscura_mxe";

describe("ObscuraMxe", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.ObscuraMxe as Program<ObscuraMxe>;
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const arciumProgram = getArciumProgram(provider);

  it("initializes the blind auction computation definition", async () => {
    const owner = readKpJson(`${os.homedir()}/.config/solana/id.json`);
    const signature = await initResolveBlindAuctionCompDef(program, owner);

    console.log("Blind auction computation definition initialized", signature);
    expect(signature).to.be.a("string");
  });

  async function initResolveBlindAuctionCompDef(
    activeProgram: Program<ObscuraMxe>,
    owner: anchor.web3.Keypair,
  ): Promise<string> {
    const baseSeedCompDefAcc = getArciumAccountBaseSeed("ComputationDefinitionAccount");
    const offset = getCompDefAccOffset("resolve_blind_auction");
    const compDefPda = PublicKey.findProgramAddressSync(
      [baseSeedCompDefAcc, activeProgram.programId.toBuffer(), offset],
      getArciumProgramId(),
    )[0];

    const mxeAccount = getMXEAccAddress(activeProgram.programId);
    const mxeAcc = await arciumProgram.account.mxeAccount.fetch(mxeAccount);
    const lutAddress = getLookupTableAddress(activeProgram.programId, mxeAcc.lutOffsetSlot);

    const signature = await activeProgram.methods
      .initResolveBlindAuctionCompDef()
      .accounts({
        compDefAccount: compDefPda,
        payer: owner.publicKey,
        mxeAccount,
        addressLookupTable: lutAddress,
      })
      .signers([owner])
      .rpc({
        commitment: "confirmed",
      });

    const rawCircuit = fs.readFileSync("build/resolve_blind_auction.arcis");
    await uploadCircuit(
      provider,
      "resolve_blind_auction",
      activeProgram.programId,
      rawCircuit,
      true,
      500,
      {
        skipPreflight: true,
        preflightCommitment: "confirmed",
        commitment: "confirmed",
      },
    );

    return signature;
  }
});

function readKpJson(path: string): anchor.web3.Keypair {
  const file = fs.readFileSync(path);
  return anchor.web3.Keypair.fromSecretKey(new Uint8Array(JSON.parse(file.toString())));
}
