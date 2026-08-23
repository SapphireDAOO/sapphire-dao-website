import { randomBytes } from "crypto";
import {
  computeStealthKey,
  generateStealthAddress,
  VALID_SCHEME_ID,
} from "@scopelift/stealth-address-sdk";
import {
  contracts,
  createExecution,
  ExecutionMode,
  getSmartAccountsEnvironment,
  ROOT_AUTHORITY,
  signDelegation,
} from "@metamask/smart-accounts-kit";
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  http,
  keccak256,
  maxUint256,
  zeroAddress,
  type Address,
  type Chain,
  type Hex,
  type PrivateKeyAccount,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, hardhat } from "viem/chains";
import {
  INTERMEDIATED_PAYMENT_PROCESSOR,
  SIMPLE_PAYMENT_PROCESSOR,
  SWEEPER_CONTRACT,
  WETH_CONTRACT,
} from "@/constants";

const PK_LENGTH = 66;

export type ProcessorKind = "simple" | "intermediated";

const normalizePrivateKey = (value: string): Hex =>
  (value.startsWith("0x") ? value : `0x${value}`) as Hex;

const requirePrivateKey = (name: string): Hex => {
  const raw = process.env[name];
  if (!raw) throw new Error(`Missing ${name}`);
  const key = normalizePrivateKey(raw);
  if (key.length !== PK_LENGTH) throw new Error(`Invalid ${name}`);
  return key;
};

// Server-only: set BASE_SEPOLIA_RPC_URL (no NEXT_PUBLIC_ prefix) so a keyed
// RPC endpoint never gets inlined into the client bundle.
const getRpcUrl = (chainId: number) =>
  chainId === hardhat.id
    ? "http://127.0.0.1:8545"
    : process.env.BASE_SEPOLIA_RPC_URL ||
      "https://base-sepolia-rpc.publicnode.com";

const getChain = (chainId: number): Chain =>
  chainId === hardhat.id ? hardhat : baseSepolia;

const getClients = (chainId: number) => {
  const chain = getChain(chainId);
  const transport = http(getRpcUrl(chainId));
  const relayerAccount = privateKeyToAccount(requirePrivateKey("SPONSOR"));

  return {
    relayerAccount,
    publicClient: createPublicClient({ chain, transport }),
    walletClient: createWalletClient({ account: relayerAccount, chain, transport }),
  };
};

export const getProcessorAddress = (
  processor: ProcessorKind,
  chainId: number,
): Address | undefined =>
  processor === "simple"
    ? SIMPLE_PAYMENT_PROCESSOR[chainId]
    : INTERMEDIATED_PAYMENT_PROCESSOR[chainId];

/**
 * Derives a fresh, one-time EIP-5564 stealth address from the meta stealth
 * address in the environment. The stealth private key is never persisted, so
 * control of the funds relies on the max approval granted in
 * `delegateAndApprove` before the address is handed out.
 */
export const generateStealthFeeReceiver = (): {
  stealthAccount: PrivateKeyAccount;
  stealthPrivateKey: Hex;
} => {
  const spendingPrivateKey = requirePrivateKey("SPENDING");
  const viewingPrivateKey = requirePrivateKey("VIEWING");
  const stealthMetaAddressURI = process.env.META_STEALTH_ADDRESS;
  if (!stealthMetaAddressURI) throw new Error("Missing META_STEALTH_ADDRESS");

  const { stealthAddress, ephemeralPublicKey } = generateStealthAddress({
    stealthMetaAddressURI,
  });

  const stealthPrivateKey = computeStealthKey({
    ephemeralPublicKey,
    spendingPrivateKey,
    viewingPrivateKey,
    schemeId: VALID_SCHEME_ID.SCHEME_ID_1,
  });

  const stealthAccount = privateKeyToAccount(stealthPrivateKey);

  if (stealthAccount.address.toLowerCase() !== stealthAddress.toLowerCase()) {
    throw new Error(
      "Computed stealth key does not control the derived stealth address",
    );
  }

  return { stealthAccount, stealthPrivateKey };
};

/**
 * Signs the FeeAuthorizationLib digest with the relayer key, which is the
 * fee signer registered on PaymentProcessorStorage. The digest binds the
 * fee receiver to one invoice on one processor on one chain.
 */
export const signFeeAuthorization = async (
  processorAddress: Address,
  chainId: number,
  invoiceId: bigint,
  feeReceiver: Address,
): Promise<Hex> => {
  const relayerAccount = privateKeyToAccount(requirePrivateKey("SPONSOR"));
  const digest = keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "uint256" },
        { type: "uint216" },
        { type: "address" },
      ],
      [processorAddress, BigInt(chainId), invoiceId, feeReceiver],
    ),
  );
  return relayerAccount.signMessage({ message: { raw: digest } });
};

/**
 * Resolves the token the stealth account must approve: the payment token
 * itself, or the chain's wrapped native token when the payment is in native
 * currency.
 */
export const resolveApprovalToken = (
  chainId: number,
  paymentToken?: Address,
): Address => {
  if (paymentToken && paymentToken.toLowerCase() !== zeroAddress) {
    return paymentToken;
  }
  const weth = WETH_CONTRACT[chainId];
  if (!weth) throw new Error(`No wrapped native token for chain ${chainId}`);
  return weth;
};

/**
 * Upgrades the stealth EOA to a MetaMask Stateless7702 delegator via an
 * EIP-7702 authorization, hands the relayer an unrestricted delegation over
 * it, and — in the same relayer-sponsored transaction — redeems that
 * delegation to approve the Sweeper contract for max uint256 of the fee
 * token. The stealth key is discarded afterwards, so this approval (plus the
 * standing delegation) is what lets the platform sweep the fees later.
 */
export const delegateAndApprove = async (
  stealthAccount: PrivateKeyAccount,
  stealthPrivateKey: Hex,
  chainId: number,
  approvalToken: Address,
): Promise<void> => {
  let environment;
  try {
    environment = getSmartAccountsEnvironment(chainId);
  } catch {
    // Local chains have no MetaMask delegation contracts; fee receivers there
    // are throwaway, so skip the delegation instead of failing the payment.
    console.warn(
      `No smart accounts environment for chain ${chainId}; skipping 7702 delegation`,
    );
    return;
  }

  const sweeper = SWEEPER_CONTRACT[chainId];
  if (!sweeper) throw new Error(`No sweeper contract for chain ${chainId}`);

  const { relayerAccount, publicClient, walletClient } = getClients(chainId);

  const nonce = await publicClient.getTransactionCount({
    address: stealthAccount.address,
  });
  const authorization = await stealthAccount.signAuthorization({
    address: environment.implementations.EIP7702StatelessDeleGatorImpl,
    chainId,
    nonce,
  });

  const delegation = {
    delegate: relayerAccount.address as Hex,
    delegator: stealthAccount.address as Hex,
    authority: ROOT_AUTHORITY as Hex,
    caveats: [],
    salt: `0x${randomBytes(32).toString("hex")}` as Hex,
  };
  const delegationSignature = await signDelegation({
    privateKey: stealthPrivateKey,
    delegation,
    delegationManager: environment.DelegationManager,
    chainId,
    allowInsecureUnrestrictedDelegation: true,
  });

  const data = contracts.DelegationManager.encode.redeemDelegations({
    delegations: [[{ ...delegation, signature: delegationSignature }]],
    modes: [ExecutionMode.SingleDefault],
    executions: [
      [
        createExecution({
          target: approvalToken,
          value: BigInt(0),
          callData: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [sweeper, maxUint256],
          }),
        }),
      ],
    ],
  });

  const hash = await walletClient.sendTransaction({
    to: environment.DelegationManager,
    data,
    authorizationList: [authorization],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Stealth fee receiver delegation transaction failed");
  }
};
