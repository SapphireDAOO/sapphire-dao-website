import { gcm } from "@noble/ciphers/aes";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { randomBytes } from "@noble/hashes/utils";
import { secp256k1 } from "@noble/curves/secp256k1";
import { bytesToHex, hexToBytes, type Hex } from "viem";

// Sealing a note to one or more note public keys.

const ENVELOPE_VERSION = 1;
const EPHEMERAL_KEY_BYTES = 33; // compressed secp256k1 point
const NONCE_BYTES = 12;
const CONTENT_KEY_BYTES = 32;
const GCM_TAG_BYTES = 16;
const WRAPPED_KEY_BYTES = NONCE_BYTES + CONTENT_KEY_BYTES + GCM_TAG_BYTES;

const WRAP_INFO = "sapphire-dao/notes/wrap";

/**
 * ECDH against a note public key, stretched into an AES key.
 *
 * The x-coordinate of the shared point is the only part used, per SEC-1: the
 * y-coordinate carries no extra entropy and including it would make the two
 * sides disagree over point encoding.
 */
const wrapKey = (privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array => {
  const shared = secp256k1.getSharedSecret(privateKey, publicKey, true);
  return hkdf(sha256, shared.slice(1), undefined, WRAP_INFO, 32);
};

/** The contract stores 64-byte keys; the curve wants the 0x04 prefix back. */
const toCurvePoint = (publicKey: Hex): Uint8Array => {
  const bytes = hexToBytes(publicKey);
  if (bytes.length === 65) return bytes;
  if (bytes.length !== 64) {
    throw new Error(`Unexpected note public key length: ${bytes.length}`);
  }
  const point = new Uint8Array(65);
  point[0] = 0x04;
  point.set(bytes, 1);
  return point;
};

/**
 * Encrypts `content` so that every key in `readers` can open it. Returns the
 * hex payload to hand to the notes API, which stores it without inspection.
 */
export const sealNote = (content: string, readers: Hex[]): Hex => {
  if (readers.length === 0) {
    throw new Error("A note needs at least one reader");
  }

  const contentKey = randomBytes(CONTENT_KEY_BYTES);
  const contentNonce = randomBytes(NONCE_BYTES);
  const body = gcm(contentKey, contentNonce).encrypt(
    new TextEncoder().encode(content),
  );

  // One ephemeral key serves every reader: each ECDH is against a different
  // reader key, so the wrapping keys still differ.
  const ephemeralPrivate = secp256k1.utils.randomPrivateKey();
  const ephemeralPublic = secp256k1.getPublicKey(ephemeralPrivate, true);

  const envelope = new Uint8Array(
    2 +
      EPHEMERAL_KEY_BYTES +
      readers.length * WRAPPED_KEY_BYTES +
      NONCE_BYTES +
      body.length,
  );

  let offset = 0;
  envelope[offset++] = ENVELOPE_VERSION;
  envelope[offset++] = readers.length;
  envelope.set(ephemeralPublic, offset);
  offset += EPHEMERAL_KEY_BYTES;

  for (const reader of readers) {
    const nonce = randomBytes(NONCE_BYTES);
    const wrapped = gcm(
      wrapKey(ephemeralPrivate, toCurvePoint(reader)),
      nonce,
    ).encrypt(contentKey);

    envelope.set(nonce, offset);
    offset += NONCE_BYTES;
    envelope.set(wrapped, offset);
    offset += wrapped.length;
  }

  envelope.set(contentNonce, offset);
  offset += NONCE_BYTES;
  envelope.set(body, offset);

  return bytesToHex(envelope);
};

export const openNote = (
  payload: Hex,
  privateKey: Uint8Array,
): string | null => {
  try {
    const envelope = hexToBytes(payload);
    if (envelope.length < 2 + EPHEMERAL_KEY_BYTES) return null;
    if (envelope[0] !== ENVELOPE_VERSION) return null;

    const readerCount = envelope[1];
    if (readerCount === 0) return null;

    let offset = 2;
    const ephemeralPublic = envelope.slice(
      offset,
      offset + EPHEMERAL_KEY_BYTES,
    );
    offset += EPHEMERAL_KEY_BYTES;

    const wrappedEnd = offset + readerCount * WRAPPED_KEY_BYTES;
    if (envelope.length < wrappedEnd + NONCE_BYTES) return null;

    const unwrapKey = wrapKey(privateKey, ephemeralPublic);

    let contentKey: Uint8Array | null = null;
    for (let i = 0; i < readerCount; i++) {
      const slot = offset + i * WRAPPED_KEY_BYTES;
      const nonce = envelope.slice(slot, slot + NONCE_BYTES);
      const wrapped = envelope.slice(
        slot + NONCE_BYTES,
        slot + WRAPPED_KEY_BYTES,
      );
      try {
        contentKey = gcm(unwrapKey, nonce).decrypt(wrapped);
        break;
      } catch {
        // Not this reader's slot; the tag check is what tells us so.
      }
    }
    if (!contentKey) return null;

    const contentNonce = envelope.slice(wrappedEnd, wrappedEnd + NONCE_BYTES);
    const body = envelope.slice(wrappedEnd + NONCE_BYTES);

    return new TextDecoder().decode(
      gcm(contentKey, contentNonce).decrypt(body),
    );
  } catch {
    return null;
  }
};
