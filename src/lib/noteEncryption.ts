import * as crypto from "crypto";
import { hexToString, stringToHex } from "viem";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;
const NOTES_SECRET_KEY =
  process.env.NEXT_PUBLIC_NOTES_SECRET_KEY ||
  process.env.NOTES_SECRET_KEY ||
  "";

export const getNotesSecretKey = (): string => NOTES_SECRET_KEY;

export function encryptNote(note: string, secretKey: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.createHash("sha256").update(secretKey).digest();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(note, "utf8", "base64");
  encrypted += cipher.final("base64");
  return iv.toString("base64") + ":" + encrypted;
}

export function decryptNote(encryptedNote: string, secretKey: string): string {
  const [ivBase64, encrypted] = encryptedNote.split(":");
  if (!ivBase64 || !encrypted) return encryptedNote;
  const iv = Buffer.from(ivBase64, "base64");
  const key = crypto.createHash("sha256").update(secretKey).digest();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export const decryptNoteBlob = (noteBlob?: string): string | undefined => {
  if (!noteBlob) return undefined;
  try {
    const trimmed = noteBlob.trim();
    const isHexLike =
      /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0;
    const hexValue =
      trimmed.startsWith("0x") || trimmed.startsWith("0X")
        ? (trimmed as `0x${string}`)
        : isHexLike
        ? (`0x${trimmed}` as `0x${string}`)
        : undefined;
    const encryptedString = hexValue ? hexToString(hexValue) : trimmed;
    if (!encryptedString) return undefined;
    if (!NOTES_SECRET_KEY) return encryptedString;
    if (!encryptedString.includes(":")) return encryptedString;
    return decryptNote(encryptedString, NOTES_SECRET_KEY);
  } catch (error) {
    console.error("Failed to decrypt note blob", error);
    return undefined;
  }
};

export const toEncryptedNoteHex = (note?: string): `0x${string}` => {
  if (!note?.trim()) return "0x";
  const trimmed = note.trim();
  try {
    const payload = NOTES_SECRET_KEY
      ? encryptNote(trimmed, NOTES_SECRET_KEY)
      : trimmed;
    return stringToHex(payload);
  } catch (error) {
    console.error("Failed to encrypt note", error);
    return stringToHex(trimmed);
  }
};
