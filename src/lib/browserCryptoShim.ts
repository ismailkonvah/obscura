import { Buffer } from "buffer";
import { sha256 } from "@noble/hashes/sha2";

type HashChunk = string | Uint8Array | ArrayBuffer;

function toBytes(chunk: HashChunk) {
  if (typeof chunk === "string") return new TextEncoder().encode(chunk);
  if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk);
  return chunk;
}

function toUint8View(buffer: ArrayBufferView | ArrayBuffer) {
  if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

export function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes);
}

export function randomFillSync<T extends ArrayBufferView | ArrayBuffer>(
  buffer: T,
  offset = 0,
  size?: number,
): T {
  const view = toUint8View(buffer);
  const length = size ?? view.byteLength - offset;
  if (offset < 0 || length < 0 || offset + length > view.byteLength) {
    throw new RangeError("Requested randomFillSync range is out of bounds.");
  }
  crypto.getRandomValues(view.subarray(offset, offset + length));
  return buffer;
}

export function createHash(algorithm: string) {
  const chunks: Uint8Array[] = [];
  return {
    update(chunk: HashChunk) {
      chunks.push(toBytes(chunk));
      return this;
    },
    digest(encoding?: "hex" | "base64" | "base64url") {
      if (algorithm.toLowerCase() !== "sha256") {
        throw new Error(`Unsupported browser hash algorithm: ${algorithm}`);
      }
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const merged = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      const digest = sha256(merged);
      const buffer = Buffer.from(digest);
      return encoding ? buffer.toString(encoding) : buffer;
    },
  };
}

export function createCipheriv() {
  throw new Error("createCipheriv is not available in the browser.");
}

export function createDecipheriv() {
  throw new Error("createDecipheriv is not available in the browser.");
}
