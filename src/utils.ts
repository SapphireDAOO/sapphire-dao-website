/* eslint-disable @typescript-eslint/no-explicit-any */
import * as crypto from "crypto";
import { hexToString, stringToHex } from "viem";

/**
 * Calculates the remaining time from a given "paid at" timestamp plus extra milliseconds
 * until the current time. Returns a human-readable string in the format of:
 *   "DDd HHh MMm SSs"
 * or "Time Elapsed" if the target time has already passed, or "-" if not paid.
 * @returns A formatted string of the remaining time or a fallback message.
 */
export const timeLeft = (
  paidAtTimestamp: number | string | null,
  extra: number = 0,
  expiresAt?: number
) => {
  if (!paidAtTimestamp || paidAtTimestamp === "Not Paid") {
    return "-";
  }

  const paidAtTime = Number(paidAtTimestamp) * 1000;
  const expiryTime = expiresAt ? expiresAt : paidAtTime + extra;

  const currentTime = Date.now();

  if (currentTime > expiryTime) {
    return "Time Elapsed";
  }

  const timeDiff = expiryTime - currentTime;
  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

  return `${String(days).padStart(2, "0")}d ${String(hours).padStart(
    2,
    "0"
  )}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(
    2,
    "0"
  )}s`;
};
export const formatAddress = (address: string) => {
  return `${address.slice(0, 4)}..${address.slice(-3)}`;
};

export const unixToGMT = (unixTimestamp: any) => {
  if (!unixTimestamp) return "";
  const date = new Date(unixTimestamp * 1000); // Convert Unix timestamp to milliseconds

  // Define month abbreviations
  const monthAbbr = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // Extract parts in GMT
  const day = String(date.getUTCDate()).padStart(2, "0");

  const month = monthAbbr[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  if (!month || !Number.isFinite(year)) return "";

  return `${day}-${month}-${year} ${hours}:${minutes}`;
};

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;
const NOTES_SECRET_KEY =
  process.env.NEXT_PUBLIC_NOTES_SECRET_KEY ||
  process.env.NOTES_SECRET_KEY ||
  "";

export function encryptNote(note: string, secretKey: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.createHash("sha256").update(secretKey).digest(); // Ensure 32 bytes

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(note, "utf8", "base64");
  encrypted += cipher.final("base64");

  return iv.toString("base64") + ":" + encrypted;
}

export function decryptNote(encryptedNote: string, secretKey: string): string {
  const [ivBase64, encrypted] = encryptedNote.split(":");
  if (!ivBase64 || !encrypted) {
    return encryptedNote;
  }
  const iv = Buffer.from(ivBase64, "base64");
  const key = crypto.createHash("sha256").update(secretKey).digest();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export const getNotesSecretKey = () => NOTES_SECRET_KEY;

export const decryptNoteBlob = (noteBlob?: string): string | undefined => {
  if (!noteBlob) return undefined;

  try {
    const trimmed = noteBlob.trim();
    const isHexLike =
      /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0;
    const hexValue = trimmed.startsWith("0x") || trimmed.startsWith("0X")
      ? (trimmed as `0x${string}`)
      : isHexLike
      ? (`0x${trimmed}` as `0x${string}`)
      : undefined;
    const encryptedString = hexValue ? hexToString(hexValue) : trimmed;

    if (!encryptedString) return undefined;

    if (!NOTES_SECRET_KEY) return encryptedString;

    if (!encryptedString.includes(":")) {
      return encryptedString;
    }

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
