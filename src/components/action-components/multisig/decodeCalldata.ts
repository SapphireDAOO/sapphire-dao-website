import { decodeFunctionData, formatEther, Hex } from "viem";
import { GOVERNABLE_CONTRACTS } from "./governableFunctions";

export interface DecodedCall {
  contractLabel: string;
  functionLabel: string;
  params: { label: string; value: string }[];
}

function truncateHex(hex: string, prefixLen = 8, suffixLen = 6): string {
  if (hex.length <= prefixLen + suffixLen + 3) return hex;
  return `${hex.slice(0, prefixLen)}...${hex.slice(-suffixLen)}`;
}

function formatParamValue(value: unknown, kind: string): string {
  if (typeof value === "bigint") {
    if (kind === "uint256_eth") return `${formatEther(value)} ETH`;
    if (kind === "uint256_usd") return `$${formatEther(value)} USD`;
    if (kind === "uint256_sec" || kind === "uint96") {
      const secs = Number(value);
      if (secs >= 3600) return `${(secs / 3600).toFixed(2)} hours`;
      if (secs >= 60) return `${(secs / 60).toFixed(2)} minutes`;
      return `${secs} seconds`;
    }
    if (kind === "uint40") {
      return new Date(Number(value) * 1000).toLocaleString();
    }
    if (kind === "bps") return `${(Number(value) / 100).toFixed(2)}%`;
    return value.toString();
  }
  // Addresses and bytes32 hashes: truncate so they fit the card row
  if (kind === "address" || kind === "bytes32") {
    return truncateHex(String(value));
  }
  return String(value);
}

export function decodeMultiSigCalldata(data: string): DecodedCall | null {
  if (!data || data === "0x" || data.length < 10) return null;
  const hex = data as Hex;

  for (const contract of GOVERNABLE_CONTRACTS) {
    for (const fn of contract.functions) {
      const minimalAbi = [
        {
          name: fn.name,
          type: "function" as const,
          inputs: fn.inputTypes.map((type, i) => ({
            name: fn.params[i].name,
            type,
            internalType: type,
          })),
          outputs: [] as [],
          stateMutability: "nonpayable" as const,
        },
      ];

      try {
        const decoded = decodeFunctionData({ abi: minimalAbi, data: hex });
        if (decoded.functionName !== fn.name) continue;

        const args = decoded.args ?? [];
        const params = fn.params.map((p, i) => ({
          label: p.label,
          value: formatParamValue(args[i], p.kind),
        }));

        return {
          contractLabel: contract.label,
          functionLabel: fn.label,
          params,
        };
      } catch {
        // selector didn't match, try next
      }
    }
  }

  return null;
}

/** Returns the raw lowercase target txHash if `data` encodes `cancelTransaction(bytes32)`, else null. */
export function decodeCancelTargetHash(data: string): string | null {
  if (!data || data.length < 10) return null;
  const minimalAbi = [
    {
      name: "cancelTransaction",
      type: "function" as const,
      inputs: [{ name: "_txHash", type: "bytes32", internalType: "bytes32" }],
      outputs: [] as [],
      stateMutability: "nonpayable" as const,
    },
  ];
  try {
    const decoded = decodeFunctionData({ abi: minimalAbi, data: data as Hex });
    if (decoded.functionName === "cancelTransaction" && decoded.args?.[0]) {
      return (decoded.args[0] as string).toLowerCase();
    }
  } catch {
    // selector didn't match
  }
  return null;
}

export function formatAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatTimestamp(ts: string | undefined): string {
  if (!ts) return "—";
  return new Date(Number(ts) * 1000).toLocaleString();
}
