import { ARCIUM_ADDR, getArciumProgramId } from "@arcium-hq/client";

console.log("Obscura Arcium status");
console.log(`SDK package: @arcium-hq/client`);
console.log(`Arcium program ID: ${getArciumProgramId().toBase58()}`);
console.log(`Arcium IDL address: ${ARCIUM_ADDR}`);
console.log(`MXE program ID: ${process.env.VITE_ARCIUM_MXE_PROGRAM_ID ?? "not-deployed-yet"}`);
