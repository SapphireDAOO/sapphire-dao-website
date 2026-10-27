"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAccount, useChainId, useConfig, useSwitchChain } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { QRCodeSVG } from "qrcode.react";
import { CircleCheck, Loader2 } from "lucide-react";
import type { Hash } from "viem";
import { BASE_SEPOLIA } from "@/constants";
import { formatAddress } from "@/utils";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";
import { getChainById } from "@/services/blockchain/utils";
import { formatTokenAmount } from "@/hooks/useCheckoutQuote";
import {
  CheckoutColumns,
  CheckoutStep,
  PrimaryButton,
  StatusPanel,
  TextLink,
} from "./CheckoutLayout";
import WalletSetup from "./WalletSetup";

type TokenOption = { id: string; name: string };

const TokenChooser = ({
  tokens,
  selectedId,
  onChange,
  disabled,
}: {
  tokens: TokenOption[];
  selectedId?: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) => (
  <div>
    <p id="pay-with" className="mb-2 font-medium text-stone-900">
      Pay with
    </p>
    <div
      role="radiogroup"
      aria-labelledby="pay-with"
      className="flex flex-wrap gap-1.5"
    >
      {tokens.map((option) => {
        const selected = option.id === selectedId;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={cn(
              "min-h-9 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 disabled:opacity-50 sm:text-sm",
              selected
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-300 bg-white/60 text-stone-700 hover:border-stone-500",
            )}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  </div>
);

type Phase = "connect" | "fund" | "pay" | "confirming" | "paid";

const CopyAddress = ({ address }: { address: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (!(await copyText(address))) return;
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="w-full break-all rounded-lg border border-stone-300 bg-white/60 px-2.5 py-2 text-left font-mono text-[10px] leading-relaxed text-stone-800 transition-colors hover:border-stone-500 sm:text-xs"
    >
      {address}
      <span className="mt-1 block font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-blue-900">
        {copied ? "Copied" : "Tap to copy"}
      </span>
    </button>
  );
};

export type PaymentStepsProps = {
  symbol: string;
  decimals: number;
  /** Tokens other than ETH need an allowance before the payment. */
  isNative: boolean;
  amount?: bigint;
  balance?: bigint;
  /** Set when this wallet can't pay the invoice; ignored once a payment is sent. */
  blocked?: { title: string; body: ReactNode; status: string };
  paying: boolean;
  /** Calls `onSubmitted` with the hash once the wallet sends; resolves on confirmation. */
  onPay: (onSubmitted: (hash: Hash) => void) => Promise<boolean>;
  payDetails?: ReactNode;
  paidDetails?: ReactNode;
  /** Where the buyer goes next, shown once paid or blocked. */
  exitLinks: ReactNode;
  walletHelpHref?: string;
  exchangeHelpHref?: string;
  /** Offered as a choice when the invoice accepts more than one token. */
  tokens?: TokenOption[];
  selectedTokenId?: string;
  onTokenChange?: (id: string) => void;
};

/**
 * Connect, add funds if short, pay, confirm: each step's
 * action on the left and its status on the right.
 */
const PaymentSteps = ({
  symbol,
  decimals,
  isNative,
  amount,
  balance,
  blocked,
  paying,
  onPay,
  payDetails,
  paidDetails,
  exitLinks,
  walletHelpHref,
  exchangeHelpHref,
  tokens = [],
  selectedTokenId,
  onTokenChange,
}: PaymentStepsProps) => {
  const { address, chain, isConnected } = useAccount();
  const chainId = useChainId() || BASE_SEPOLIA;
  const network = useConfig().chains[0];
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { openConnectModal } = useConnectModal();

  const [txHash, setTxHash] = useState<Hash>();
  const [paid, setPaid] = useState(false);

  // `chain` is unset when the wallet is on a network the app doesn't support.
  const wrongNetwork = isConnected && !chain;
  const phase: Phase = paid
    ? "paid"
    : txHash
      ? "confirming"
      : !isConnected ||
          wrongNetwork ||
          amount === undefined ||
          balance === undefined
        ? "connect"
        : balance < amount
          ? "fund"
          : "pay";

  // Once a wallet has needed funds, keep its four-step count
  // so the steps don't renumber when the funds arrive.
  const [needsFunding, setNeedsFunding] = useState(false);
  useEffect(() => setNeedsFunding(false), [address]);
  useEffect(() => {
    if (phase === "fund") setNeedsFunding(true);
  }, [phase]);
  const total = needsFunding ? 4 : 3;

  const format = (value: bigint, roundUp = false) =>
    `${formatTokenAmount(value, decimals, roundUp)} ${symbol}`;
  const explorer = getChainById(chainId).blockExplorers?.default;
  const txUrl = explorer && txHash ? `${explorer.url}/tx/${txHash}` : undefined;

  const pay = async () => {
    const success = await onPay(setTxHash);
    if (success) setPaid(true);
    else setTxHash(undefined);
  };

  const connect = () => openConnectModal?.();
  // Offered once a wallet is connected, when there's a balance to pay from.
  const tokenChooser = isConnected && tokens.length > 1 && onTokenChange && (
    <TokenChooser
      tokens={tokens}
      selectedId={selectedTokenId}
      onChange={onTokenChange}
      disabled={paying}
    />
  );

  if (blocked && !txHash && !paid) {
    return (
      <CheckoutColumns
        left={
          <CheckoutStep step={1} total={1} title={blocked.title}>
            {blocked.body}
          </CheckoutStep>
        }
        right={
          <StatusPanel
            tone="warning"
            title={blocked.status}
            links={exitLinks}
          />
        }
      />
    );
  }

  switch (phase) {
    case "connect":
      return (
        <CheckoutColumns
          left={
            <CheckoutStep step={1} total={total} title="Connect your wallet">
              <p>
                Your wallet is the easiest way to pay. Connect it to continue
                securely.
              </p>
              {!isConnected && (
                <PrimaryButton type="button" onClick={connect}>
                  Connect wallet
                </PrimaryButton>
              )}
              <WalletSetup
                connected={isConnected}
                wrongNetwork={wrongNetwork}
                networkName={network.name}
                isSwitching={isSwitching}
                onConnect={connect}
                onSwitchNetwork={() => switchChain({ chainId: network.id })}
              />
            </CheckoutStep>
          }
          right={
            wrongNetwork ? (
              <StatusPanel tone="warning" title="Wrong network">
                Switch your wallet to {network.name} to pay.
              </StatusPanel>
            ) : isConnected ? (
              <StatusPanel tone="active" title="Wallet connected">
                Checking that it holds enough {symbol}.
              </StatusPanel>
            ) : (
              <StatusPanel
                tone="waiting"
                title="Ethereum wallet required"
                links={
                  walletHelpHref && (
                    <TextLink href={walletHelpHref}>More wallets</TextLink>
                  )
                }
              >
                You pay from a wallet only you control. Nobody else ever holds
                your keys.
              </StatusPanel>
            )
          }
        />
      );

    case "fund":
      return (
        <CheckoutColumns
          left={
            <CheckoutStep
              step={2}
              total={total}
              title={`Add ${symbol} to your wallet`}
            >
              {tokenChooser}
              <p>
                You need to add{" "}
                <strong className="font-semibold text-stone-900">
                  {amount !== undefined && balance !== undefined
                    ? format(amount - balance, true)
                    : "…"}
                </strong>{" "}
                to your wallet.
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-stone-400">Balance</dt>
                <dd className="text-stone-900">
                  {balance !== undefined && format(balance)}
                </dd>
                <dt className="text-stone-400">Due</dt>
                <dd className="text-stone-900">
                  {amount !== undefined && format(amount)}
                </dd>
              </dl>
              {address && (
                <div className="space-y-2">
                  <QRCodeSVG
                    value={address}
                    bgColor="transparent"
                    className="h-auto w-full max-w-[9rem]"
                  />
                  <CopyAddress address={address} />
                  <p className="text-[11px] text-stone-500 sm:text-[13px]">
                    Send {symbol} on {network.name} only.
                  </p>
                </div>
              )}
              <p className="flex items-center gap-2 text-stone-500">
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                This page moves on once the funds arrive.
              </p>
            </CheckoutStep>
          }
          right={
            <StatusPanel
              tone="warning"
              title="Your wallet has exchange options"
              links={
                exchangeHelpHref && (
                  <TextLink href={exchangeHelpHref}>Exchange help</TextLink>
                )
              }
            >
              Most wallets let you buy {symbol} with a card or bank transfer.
              Look for Buy in your wallet, or send it from an exchange.
            </StatusPanel>
          }
        />
      );

    case "pay":
      return (
        <CheckoutColumns
          left={
            <CheckoutStep
              step={needsFunding ? 3 : 2}
              total={total}
              title="Pay from your wallet"
            >
              {tokenChooser}
              <p>
                You&apos;ll send{" "}
                <strong className="font-semibold text-stone-900">
                  {amount !== undefined && format(amount)}
                </strong>
                . Your wallet will ask you to confirm
                {isNative
                  ? "."
                  : ": once to allow the amount, then once to pay."}
              </p>
              {payDetails}
              <PrimaryButton type="button" onClick={pay} disabled={paying}>
                {paying ? (
                  <>
                    Confirm in your wallet
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </>
                ) : (
                  "Pay now"
                )}
              </PrimaryButton>
            </CheckoutStep>
          }
          right={
            <StatusPanel tone="success" title="Wallet connected">
              {address && (
                <span className="font-mono">{formatAddress(address)}</span>
              )}
              {balance !== undefined && (
                <span className="block">Balance {format(balance)}</span>
              )}
            </StatusPanel>
          }
        />
      );

    case "confirming":
      return (
        <CheckoutColumns
          left={
            <CheckoutStep
              step={total}
              total={total}
              title="Payment awaiting confirmation"
              icon={
                <Loader2 className="mt-1 h-[0.8em] w-[0.8em] shrink-0 animate-spin text-blue-900" />
              }
            >
              <p>
                Your payment is on its way. The network usually confirms it
                within a few seconds. Keep this page open.
              </p>
              {txUrl && (
                <TextLink href={txUrl}>
                  View on {explorer?.name ?? "explorer"}
                </TextLink>
              )}
            </CheckoutStep>
          }
          right={
            <StatusPanel tone="active" title="Confirming">
              Sent from your wallet, waiting for the network.
            </StatusPanel>
          }
        />
      );

    case "paid":
      return (
        <CheckoutColumns
          left={
            <CheckoutStep
              step={total}
              total={total}
              title="Payment received"
              icon={
                <CircleCheck className="mt-1 h-[0.8em] w-[0.8em] shrink-0 text-emerald-600" />
              }
            >
              <p>Thank you, your payment went through.</p>
              {paidDetails}
            </CheckoutStep>
          }
          right={
            <StatusPanel
              tone="success"
              title="Transaction complete"
              links={
                <>
                  {txUrl && <TextLink href={txUrl}>View transaction</TextLink>}
                  {exitLinks}
                </>
              }
            />
          }
        />
      );
  }
};

export default PaymentSteps;
