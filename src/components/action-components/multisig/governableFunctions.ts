import { encodeFunctionData, Hex, parseEther, parseUnits } from "viem";
import {
  SIMPLE_PAYMENT_PROCESSOR,
  ADVANCED_PAYMENT_PROCESSOR,
  PAYMENT_PROCESSOR_STORAGE,
  MULTISIG_CONTRACT,
} from "@/constants";
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
  key: "simple" | "advanced" | "storage" | "multisig";
  getAddress: (chainId: number) => Address;
  functions: GovernableFunction[];
}

export const GOVERNABLE_CONTRACTS: GovernableContract[] = [
  {
    label: "SimplePaymentProcessor",
    key: "simple",
    getAddress: (chainId) => SIMPLE_PAYMENT_PROCESSOR[chainId] as Address,
    functions: [
      {
        name: "setMinimumInvoiceValue",
        label: "Set Minimum Invoice Value",
        signature: "setMinimumInvoiceValue(uint256)",
        inputTypes: ["uint256"],
        params: [{ name: "value", label: "Minimum value (ETH)", kind: "uint256_eth", placeholder: "0.01" }],
      },
      {
        name: "setDecisionWindow",
        label: "Set Decision Window",
        signature: "setDecisionWindow(uint256)",
        inputTypes: ["uint256"],
        params: [{ name: "window", label: "Window (seconds)", kind: "uint256_sec", placeholder: "43200" }],
      },
      {
        name: "setForwarderAddress",
        label: "Set Forwarder Address",
        signature: "setForwarderAddress(address)",
        inputTypes: ["address"],
        params: [{ name: "forwarder", label: "Forwarder address", kind: "address", placeholder: "0x..." }],
      },
      {
        name: "setInvoiceReleaseTime",
        label: "Set Invoice Release Time",
        signature: "setInvoiceReleaseTime(uint216,uint40)",
        inputTypes: ["uint216", "uint40"],
        params: [
          { name: "invoiceId", label: "Invoice ID", kind: "uint216", placeholder: "1" },
          { name: "releaseTime", label: "Release timestamp (Unix)", kind: "uint40", placeholder: "1700000000" },
        ],
      },
      {
        name: "releaseLocked",
        label: "Release Locked Funds",
        signature: "releaseLocked(uint216,address,uint256)",
        inputTypes: ["uint216", "address", "uint256"],
        params: [
          { name: "invoiceId", label: "Invoice ID", kind: "uint216", placeholder: "1" },
          { name: "recipient", label: "Recipient address", kind: "address", placeholder: "0x..." },
          { name: "amount", label: "Amount (ETH)", kind: "uint256_eth", placeholder: "1.0" },
        ],
      },
    ],
  },
  {
    label: "AdvancedPaymentProcessor",
    key: "advanced",
    getAddress: (chainId) => ADVANCED_PAYMENT_PROCESSOR[chainId] as Address,
    functions: [
      {
        name: "setMinimumPrice",
        label: "Set Minimum Price",
        signature: "setMinimumPrice(uint256)",
        inputTypes: ["uint256"],
        params: [{ name: "price", label: "Minimum price (USD, 18 decimals)", kind: "uint256_usd", placeholder: "1.00" }],
      },
      {
        name: "setForwarderAddress",
        label: "Set Forwarder Address",
        signature: "setForwarderAddress(address)",
        inputTypes: ["address"],
        params: [{ name: "forwarder", label: "Forwarder address", kind: "address", placeholder: "0x..." }],
      },
      {
        name: "setInvoiceReleaseTime",
        label: "Set Invoice Release Time",
        signature: "setInvoiceReleaseTime(uint216,uint256)",
        inputTypes: ["uint216", "uint256"],
        params: [
          { name: "invoiceId", label: "Invoice ID", kind: "uint216", placeholder: "1" },
          { name: "releaseTime", label: "Release timestamp (Unix)", kind: "uint256", placeholder: "1700000000" },
        ],
      },
      {
        name: "releaseLocked",
        label: "Release Locked Funds",
        signature: "releaseLocked(uint216,address,uint256)",
        inputTypes: ["uint216", "address", "uint256"],
        params: [
          { name: "invoiceId", label: "Invoice ID", kind: "uint216", placeholder: "1" },
          { name: "recipient", label: "Recipient address", kind: "address", placeholder: "0x..." },
          { name: "amount", label: "Amount (ETH)", kind: "uint256_eth", placeholder: "1.0" },
        ],
      },
    ],
  },
  {
    label: "PaymentProcessorStorage",
    key: "storage",
    getAddress: (chainId) => PAYMENT_PROCESSOR_STORAGE[chainId] as Address,
    functions: [
      {
        name: "setPaymentValidityDuration",
        label: "Set Payment Validity Duration",
        signature: "setPaymentValidityDuration(uint96)",
        inputTypes: ["uint96"],
        params: [{ name: "duration", label: "Duration (seconds)", kind: "uint96", placeholder: "86400" }],
      },
      {
        name: "setDefaultHoldPeriod",
        label: "Set Default Hold Period",
        signature: "setDefaultHoldPeriod(uint96)",
        inputTypes: ["uint96"],
        params: [{ name: "period", label: "Hold period (seconds)", kind: "uint96", placeholder: "86400" }],
      },
      {
        name: "setFeeRate",
        label: "Set Fee Rate",
        signature: "setFeeRate(uint96)",
        inputTypes: ["uint96"],
        params: [{ name: "rate", label: "Fee rate % (e.g. 10 for 10%)", kind: "bps", placeholder: "10" }],
      },
      {
        name: "setFeeReceiver",
        label: "Set Fee Receiver",
        signature: "setFeeReceiver(address)",
        inputTypes: ["address"],
        params: [{ name: "receiver", label: "Fee receiver address", kind: "address", placeholder: "0x..." }],
      },
      {
        name: "setMarketplaceAddress",
        label: "Set Marketplace Address",
        signature: "setMarketplaceAddress(address)",
        inputTypes: ["address"],
        params: [{ name: "marketplace", label: "Marketplace address", kind: "address", placeholder: "0x..." }],
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
  {
    label: "MultiSig",
    key: "multisig",
    getAddress: (chainId) => MULTISIG_CONTRACT[chainId] as Address,
    functions: [
      {
        name: "addSigner",
        label: "Add Signer",
        signature: "addSigner(address)",
        inputTypes: ["address"],
        params: [{ name: "signer", label: "Signer address", kind: "address", placeholder: "0x..." }],
      },
      {
        name: "removeSigner",
        label: "Remove Signer",
        signature: "removeSigner(address)",
        inputTypes: ["address"],
        params: [{ name: "signer", label: "Signer address", kind: "address", placeholder: "0x..." }],
      },
      {
        name: "updateThreshold",
        label: "Update Threshold",
        signature: "updateThreshold(uint256)",
        inputTypes: ["uint256"],
        params: [{ name: "threshold", label: "New threshold", kind: "uint256", placeholder: "2" }],
      },
      {
        name: "cancelTransaction",
        label: "Cancel Transaction",
        signature: "cancelTransaction(bytes32)",
        inputTypes: ["bytes32"],
        params: [{ name: "_txHash", label: "Transaction hash", kind: "bytes32", placeholder: "0x..." }],
      },
    ],
  },
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
