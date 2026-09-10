import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { secp256k1 } from "@noble/curves/secp256k1";
import { bytesToHex, hexToBytes, type Address, type Hex } from "viem";

/** Domain separation, so this signature can never be replayed as another. */
const KEY_INFO = "sapphire-dao/notes/keypair";
const KEY_SALT = "sapphire-dao/notes/v1";

export type NoteKeyPair = {
  privateKey: Uint8Array;
  /** 64 bytes, uncompressed and without the 0x04 prefix, as the contract stores it. */
  publicKey: Hex;
};

export const noteKeyMessage = (address: Address, version: number): string =>
  [
    "Sapphire DAO: unlock note encryption",
    `Address: ${address.toLowerCase()}`,
    `Version: ${version}`,
    "",
    "Signing this derives the keys used to encrypt and decrypt your invoice",
    "notes. It grants no spending permission and costs nothing.",
  ].join("\n");

export const deriveNoteKeys = (signature: Hex): NoteKeyPair => {
  const ikm = hexToBytes(signature);

  for (let counter = 0; counter < 256; counter++) {
    const candidate = hkdf(sha256, ikm, KEY_SALT, `${KEY_INFO}/${counter}`, 32);

    if (secp256k1.utils.isValidPrivateKey(candidate)) {
      // Uncompressed is 65 bytes with a 0x04 prefix; the contract stores the
      // 64-byte coordinate pair, and derives an address from exactly that.
      const uncompressed = secp256k1.getPublicKey(candidate, false);
      return {
        privateKey: candidate,
        publicKey: bytesToHex(uncompressed.slice(1)),
      };
    }
  }

  // 256 consecutive invalid scalars is not reachable in practice; failing here
  // beats returning a key that was silently reduced into range.
  throw new Error("Could not derive a note key from this signature");
};

/** True when a registered key matches the one this signature derives. */
export const matchesDerivedKey = (registered: Hex, derived: Hex): boolean =>
  registered.toLowerCase() === derived.toLowerCase();
