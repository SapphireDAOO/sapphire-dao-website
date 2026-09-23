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
  /** One line on what executing this proposal would do. */
  hint: string;
  /**
   * Anchor for this function on the contract's docs page. GitBook derives it
   * from the heading, so `#### setFeeSigner` becomes `#setfeesigner`. Omitted
   * where the function is not documented, in which case the page itself is
   * linked.
   */
  docsAnchor?: string;
}

export interface GovernableContract {
  label: string;
  key: "simple" | "intermediated" | "storage" | "multisig";
  getAddress: (chainId: number) => Address;
  /** Where this contract is written up, for the per-function docs links. */
  docsUrl: string;
  functions: GovernableFunction[];
}

const DOCS_BASE =
  "https://sapphiredao.gitbook.io/sapphiredao-docs/technical-docs/core-contracts";

/** The docs link for one proposable action. */
export const functionDocsUrl = (
  contract: GovernableContract,
  fn: GovernableFunction,
): string =>
  fn.docsAnchor ? `${contract.docsUrl}${fn.docsAnchor}` : contract.docsUrl;

export const GOVERNABLE_CONTRACTS: GovernableContract[] = [
  {
    label: "PaymentProcessorStorage",
    key: "storage",
    getAddress: (chainId) => PAYMENT_PROCESSOR_STORAGE[chainId] as Address,
    docsUrl: `${DOCS_BASE}/paymentprocessorstorage.sol`,
    functions: [
      {
        name: "setFeeSigner",
        label: "Set Fee Signer",
        signature: "setFeeSigner(address)",
        inputTypes: ["address"],
        params: [{ name: "feeSigner", label: "Fee signer address", kind: "address", placeholder: "0x..." }],
        hint:
          "Designates the address whose signature authorizes a per-invoice fee receiver. Invoices cannot be paid with an authorization from any other key.",
        docsAnchor: "#setfeesigner",
      },
      {
        name: "setIntermediatedPlatformsOperator",
        label: "Set Intermediated Platforms Operator",
        signature: "setIntermediatedPlatformsOperator(address)",
        inputTypes: ["address"],
        params: [{ name: "operator", label: "Operator address", kind: "address", placeholder: "0x..." }],
        hint:
          "Updates the wallet allowed to call the privileged functions on the intermediated processor, on behalf of intermediated platforms.",
        docsAnchor: "#setintermediatedplatformsoperator",
      },
      {
        name: "setEmergencyPauser",
        label: "Set Emergency Pauser",
        signature: "setEmergencyPauser(address)",
        inputTypes: ["address"],
        params: [{ name: "emergencyPauser", label: "Emergency pauser address", kind: "address", placeholder: "0x..." }],
        hint:
          "Assigns or revokes the address permitted to trip an emergency pause without waiting for the multisig.",
        docsAnchor: "#setemergencypauser",
      },
      {
        name: "pause",
        // Named for what it does rather than what the contract calls it: the
        // distinction that matters to a signer is that this one never lapses,
        // unlike the emergency pause the designated pauser can trip.
        label: "Emergency Unlimited Pause",
        signature: "pause()",
        inputTypes: [],
        params: [],
        hint:
          "Halts every value-moving entrypoint on both processors indefinitely. It holds until it is unpaused; there is no expiry.",
        docsAnchor: "#pause",
      },
      {
        name: "unpause",
        label: "Unpause",
        signature: "unpause()",
        inputTypes: [],
        params: [],
        hint:
          "Lifts an active pause and clears any unresolved emergency pause, returning both processors to normal operation.",
        docsAnchor: "#unpause",
      },
      {
        name: "approveEmergencyPause",
        label: "Approve Emergency Pause",
        signature: "approveEmergencyPause()",
        inputTypes: [],
        params: [],
        hint:
          "Converts a running emergency pause into an indefinite one, clearing its timer so it no longer lapses on its own.",
        docsAnchor: "#approveemergencypause",
      },
      {
        name: "transferOwnership",
        label: "Transfer Ownership",
        signature: "transferOwnership(address)",
        inputTypes: ["address"],
        params: [{ name: "newOwner", label: "New owner address", kind: "address", placeholder: "0x..." }],
        hint:
          "Hands governance of the storage contract to a new owner. Irreversible from here: only the new owner can transfer it onward.",
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
  docsUrl: `${DOCS_BASE}/multisig.sol`,
  functions: [
    {
      name: "addSigner",
      label: "Add Signer",
      signature: "addSigner(address)",
      inputTypes: ["address"],
      params: [{ name: "signer", label: "Signer", kind: "address", placeholder: "0x..." }],
      hint: "Adds an address to the signer set. Proposed like any other action, since the multisig can only administer itself.",
      docsAnchor: "#addsigner",
    },
    {
      name: "removeSigner",
      label: "Remove Signer",
      signature: "removeSigner(address)",
      inputTypes: ["address"],
      params: [{ name: "signer", label: "Signer", kind: "address", placeholder: "0x..." }],
      hint: "Removes an address from the signer set. Rejected if it would leave fewer signers than the threshold requires.",
      docsAnchor: "#removesigner",
    },
    {
      name: "updateThreshold",
      label: "Update Threshold",
      signature: "updateThreshold(uint256)",
      inputTypes: ["uint256"],
      params: [{ name: "newThreshold", label: "New threshold", kind: "uint256", placeholder: "2" }],
      hint: "Changes how many approvals a transaction needs before it can execute.",
      docsAnchor: "#updatethreshold",
    },
    {
      name: "cancelTransaction",
      label: "Cancel Transaction",
      signature: "cancelTransaction(bytes32)",
      inputTypes: ["bytes32"],
      params: [{ name: "txHash", label: "Transaction", kind: "bytes32", placeholder: "0x..." }],
      hint: "Cancels a proposed or approved transaction so it can never execute.",
      docsAnchor: "#canceltransaction",
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
