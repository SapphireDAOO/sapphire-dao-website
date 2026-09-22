import { encodeFunctionData, Hex, parseEther, parseUnits } from "viem";
import { MULTISIG_CONTRACT, PAYMENT_PROCESSOR_STORAGE } from "@/constants";
import { Address } from "viem";

export type ParamKind =
  | "address"
  | "bytes32"       // bytes32 hash, displayed truncated
  | "uint256_eth"   // ETH amount → parseEther
  | "uint256_usd"   // USD (18-decimal)
  | "uint256_sec"   // seconds
  | "uint256_min"   // minutes → *60
  | "uint256"       // raw uint256
  | "uint216"       // invoice ID
  | "uint40"        // unix timestamp (datetime picker)
  | "uint96"        // seconds (hold period, validity duration)
  | "bps";          // basis points → percentage display

export interface FunctionParam {
  name: string;
  label: string;
  kind: ParamKind;
  placeholder?: string;
}

export interface GovernableFunction {
  name: string;
  label: string;
  /** Solidity function signature, used for encoding */
  signature: string;
  /** Solidity input types in order, for encodeFunctionData */
  inputTypes: string[];
  params: FunctionParam[];
}

export interface GovernableContract {
  label: string;
  key: "simple" | "intermediated" | "storage" | "multisig";
  getAddress: (chainId: number) => Address;
  functions: GovernableFunction[];
}

export const GOVERNABLE_CONTRACTS: GovernableContract[] = [
  {
    label: "PaymentProcessorStorage",
    key: "storage",
    getAddress: (chainId) => PAYMENT_PROCESSOR_STORAGE[chainId] as Address,
    functions: [
      {
        name: "setFeeSigner",
        label: "Set Fee Signer",
        signature: "setFeeSigner(address)",
        inputTypes: ["address"],
        params: [{ name: "feeSigner", label: "Fee signer address", kind: "address", placeholder: "0x..." }],
      },
      {
        name: "setIntermediatedPlatformsOperator",
        label: "Set Intermediated Platforms Operator",
        signature: "setIntermediatedPlatformsOperator(address)",
        inputTypes: ["address"],
        params: [{ name: "operator", label: "Operator address", kind: "address", placeholder: "0x..." }],
      },
      {
        name: "setEmergencyPauser",
        label: "Set Emergency Pauser",
        signature: "setEmergencyPauser(address)",
        inputTypes: ["address"],
        params: [{ name: "emergencyPauser", label: "Emergency pauser address", kind: "address", placeholder: "0x..." }],
      },
      {
        name: "pause",
        label: "Pause",
        signature: "pause()",
        inputTypes: [],
        params: [],
      },
      {
        name: "unpause",
        label: "Unpause",
        signature: "unpause()",
        inputTypes: [],
        params: [],
      },
      {
        name: "approveEmergencyPause",
        label: "Approve Emergency Pause",
        signature: "approveEmergencyPause()",
        inputTypes: [],
        params: [],
      },
      {
        name: "transferOwnership",
        label: "Transfer Ownership",
        signature: "transferOwnership(address)",
        inputTypes: ["address"],
        params: [{ name: "newOwner", label: "New owner address", kind: "address", placeholder: "0x..." }],
      },
    ],
  },
];

/**
 * The multisig's own administration, which it can only perform on itself and
 * so only through a proposal. It is deliberately absent from
 * `GOVERNABLE_CONTRACTS` — the propose form governs the storage contract and
 * nothing else — but the calldata still has to be readable wherever these
 * proposals are listed, which is what this entry is for.
 */
export const MULTISIG_ADMIN_CONTRACT: GovernableContract = {
  label: "MultiSig",
  key: "multisig",
  getAddress: (chainId) => MULTISIG_CONTRACT[chainId] as Address,
  functions: [
    {
      name: "addSigner",
      label: "Add Signer",
      signature: "addSigner(address)",
      inputTypes: ["address"],
      params: [{ name: "signer", label: "Signer", kind: "address", placeholder: "0x..." }],
    },
    {
      name: "removeSigner",
      label: "Remove Signer",
      signature: "removeSigner(address)",
      inputTypes: ["address"],
      params: [{ name: "signer", label: "Signer", kind: "address", placeholder: "0x..." }],
    },
    {
      name: "updateThreshold",
      label: "Update Threshold",
      signature: "updateThreshold(uint256)",
      inputTypes: ["uint256"],
      params: [{ name: "newThreshold", label: "New threshold", kind: "uint256", placeholder: "2" }],
    },
    {
      name: "cancelTransaction",
      label: "Cancel Transaction",
      signature: "cancelTransaction(bytes32)",
      inputTypes: ["bytes32"],
      params: [{ name: "txHash", label: "Transaction", kind: "bytes32", placeholder: "0x..." }],
    },
  ],
};

/** Every contract whose calldata we can render, proposable or not. */
export const DECODABLE_CONTRACTS: GovernableContract[] = [
  ...GOVERNABLE_CONTRACTS,
  MULTISIG_ADMIN_CONTRACT,
];

function encodeParam(value: string, kind: ParamKind): bigint | string {
  switch (kind) {
    case "uint256_eth":
      return parseEther(value);
    case "uint256_usd":
      return parseUnits(value, 18);
    case "uint256_sec":
    case "uint256_min":
    case "uint256":
    case "uint216":
    case "uint40":
    case "uint96":
      return BigInt(value);
    case "bps":
      // User enters a percentage (e.g. 10 for 10%); contract expects basis points (* 100)
      return BigInt(Math.round(parseFloat(value) * 100));
    case "address":
    case "bytes32":
      return value;
  }
}

export function encodeGovernableCall(
  fn: GovernableFunction,
  paramValues: Record<string, string>,
): Hex {
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

  const args = fn.params.map((p) => encodeParam(paramValues[p.name] ?? "", p.kind));

  return encodeFunctionData({
    abi: minimalAbi,
    functionName: fn.name,
    args,
  });
}
