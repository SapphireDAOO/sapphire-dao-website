"use client";

import { useState } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, Loader2, ShieldCheck } from "lucide-react";
import Container from "@/components/Container";
import { useMultiSigData } from "@/hooks/useMultiSigData";
import { useFeeBalances } from "@/hooks/useFeeBalances";
import TransactionList from "./TransactionList";
import ProposeForm from "./ProposeForm";
import SignerList from "./SignerList";
import SweepForm from "./SweepForm";
import {
  MULTISIG_CONTRACT,
  SIMPLE_PAYMENT_PROCESSOR,
  INTERMEDIATED_PAYMENT_PROCESSOR,
  PAYMENT_PROCESSOR_STORAGE,
  BASE_SEPOLIA,
  CONTRACT_MINIMUM_THRESHOLD,
} from "@/constants";
import { Address, encodeFunctionData } from "viem";
import { proposeMultiSigTransaction } from "@/services/blockchain/MultiSig";
import { formatAddress } from "./decodeCalldata";
import { FunctionInfo } from "./FunctionInfo";
import { MULTISIG_ADMIN_CONTRACT } from "./governableFunctions";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useHintedWalletClient } from "@/components/wallet-hint/useHintedWalletClient";
import EmergencyPause from "@/components/action-components/admin/EmergencyPause";

const CONTRACT_DESCRIPTIONS = [
  {
    label: "SimplePaymentProcessor",
    description:
      "Handles peer-to-peer invoice creation, payment, and release for standard (non-intermediated) transactions. Governs minimum invoice value, seller decision window, and forwarder address.",
    getAddress: (chainId: number) => SIMPLE_PAYMENT_PROCESSOR[chainId],
  },
  {
    label: "IntermediatedPaymentProcessor",
    description:
      "Handles intermediated-platform meta-invoices with multi-item support, USD-denominated pricing, and dispute resolution. Governs the minimum invoice price.",
    getAddress: (chainId: number) => INTERMEDIATED_PAYMENT_PROCESSOR[chainId],
  },
  {
    label: "PaymentProcessorStorage",
    description:
      "Central configuration store shared by both processors. Governs the platform fee rate, fee receiver, default hold period, invoice validity duration, and intermediated platforms operator wallet address.",
    getAddress: (chainId: number) => PAYMENT_PROCESSOR_STORAGE[chainId],
  },
];

const fn1 = (name: string, type: string) =>
  [{ name, type: "function" as const, inputs: [{ name: "v", type, internalType: type }], outputs: [], stateMutability: "nonpayable" as const }] as const;

export default function GovernancePage() {
  const { address } = useAccount();
  const chainId = useChainId() || BASE_SEPOLIA;
  const { data: walletClient } = useHintedWalletClient();
  const publicClient = usePublicClient({ chainId });
  const [showContracts, setShowContracts] = useState(false);
  const contractAddress = MULTISIG_CONTRACT[chainId];

  const {
    wallet,
    transactions,
    hasNextPage,
    isLoading,
    error,
    page,
    nextPage,
    prevPage,
    applyLogs,
  } = useMultiSigData();

  const fees = useFeeBalances();

  const threshold = wallet ? Number(wallet.threshold) : 0;
  const signerCount = wallet
    ? wallet.signers.filter((signer) => signer.active).length
    : 0;

  // A threshold at or below half the signers would let a minority execute, so
  // the floor is a strict majority. The contract only enforces its own
  // MINIMUM_THRESHOLD of 2 and an upper bound of the signer count; whichever
  // of the two is higher applies here.
  const minimumThreshold = signerCount
    ? Math.max(CONTRACT_MINIMUM_THRESHOLD, Math.floor(signerCount / 2) + 1)
    : CONTRACT_MINIMUM_THRESHOLD;
  const isSigner =
    !!address &&
    (wallet?.signers.some(
      (s) => s.active && s.address.toLowerCase() === address.toLowerCase(),
    ) ?? false);

  // --- Signer management state ---
  const [addLoading, setAddLoading] = useState("");
  const [removeLoading, setRemoveLoading] = useState("");
  const [thresholdLoading, setThresholdLoading] = useState("");
  const [addSignerAddr, setAddSignerAddr] = useState("");
  const [removeSignerAddr, setRemoveSignerAddr] = useState("");
  const [newThreshold, setNewThreshold] = useState("");

  // Checked before proposing as well as shown: a proposal that can never
  // execute still costs a signature and clutters the queue.
  const thresholdError = (() => {
    if (!newThreshold) return null;
    const n = Number(newThreshold);
    if (!Number.isInteger(n) || n < 1) return "Enter a whole number.";
    if (n < minimumThreshold) {
      return signerCount
        ? `At least ${minimumThreshold} of ${signerCount} signers must approve.`
        : `The threshold cannot be below ${minimumThreshold}.`;
    }
    if (signerCount && n > signerCount) {
      return `Cannot exceed the ${signerCount} current signers.`;
    }
    return null;
  })();

  const handleAddSigner = async () => {
    if (!addSignerAddr || !walletClient || !publicClient) return;
    const { ok, receipt } = await proposeMultiSigTransaction(
      { walletClient, publicClient },
      MULTISIG_CONTRACT[chainId] as Address,
      encodeFunctionData({ abi: fn1("addSigner", "address"), functionName: "addSigner", args: [addSignerAddr as Address] }),
      chainId,
      setAddLoading,
    );
    if (ok) {
      if (receipt) applyLogs(receipt.logs);
      setAddSignerAddr("");
    }
  };

  const handleRemoveSigner = async () => {
    if (!removeSignerAddr || !walletClient || !publicClient) return;
    const { ok, receipt } = await proposeMultiSigTransaction(
      { walletClient, publicClient },
      MULTISIG_CONTRACT[chainId] as Address,
      encodeFunctionData({ abi: fn1("removeSigner", "address"), functionName: "removeSigner", args: [removeSignerAddr as Address] }),
      chainId,
      setRemoveLoading,
    );
    if (ok) {
      if (receipt) applyLogs(receipt.logs);
      setRemoveSignerAddr("");
    }
  };

  const handleUpdateThreshold = async () => {
    const n = Number(newThreshold);
    if (thresholdError || !n || !walletClient || !publicClient) return;
    const { ok, receipt } = await proposeMultiSigTransaction(
      { walletClient, publicClient },
      MULTISIG_CONTRACT[chainId] as Address,
      encodeFunctionData({ abi: fn1("updateThreshold", "uint256"), functionName: "updateThreshold", args: [BigInt(n)] }),
      chainId,
      setThresholdLoading,
    );
    if (ok) {
      if (receipt) applyLogs(receipt.logs);
      setNewThreshold("");
    }
  };

  return (
    <Container>
      <div className="py-8 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-green-600" />
              <h1 className="text-2xl font-bold">Governance</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Contract:{" "}
              <a
                href={`https://sepolia.basescan.org/address/${contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 underline font-mono"
              >
                {formatAddress(contractAddress)}
              </a>
            </p>
          </div>

          {/* Stats */}
          {wallet && (
            <div className="flex gap-6 text-sm">
              <Stat label="Threshold" value={`${wallet.threshold} / ${wallet.signerCount}`} />
              <Stat label="Total Txns" value={wallet.transactionCount} />
            </div>
          )}
        </div>

        {/* Halting the protocol is a governance action too, but an urgent one:
            it stays in the open rather than behind a tab. */}
        <EmergencyPause />

        {/* Signers */}
        {wallet?.signers && wallet.signers.length > 0 && (
          <SignerList signers={wallet.signers} threshold={threshold} />
        )}

        {!isLoading && !wallet && (
          <Card>
            <CardContent className="py-6 space-y-2">
              <p className="text-sm font-medium">
                {error ? "Unable to load multisig data." : "No multisig data in the subgraph yet."}
              </p>
              <p className="text-sm text-muted-foreground">
                {error ??
                  "The multisig wallet has not been indexed yet, or this subgraph does not expose it on the current network."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Contract descriptions — collapsible */}
        <div>
          <button
            type="button"
            onClick={() => setShowContracts((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showContracts ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showContracts ? "Hide" : "View"} governed contracts
          </button>

          {showContracts && (
            <div className="grid gap-3 sm:grid-cols-3 mt-3">
              {CONTRACT_DESCRIPTIONS.map((c) => {
                const addr = c.getAddress(chainId);
                return (
                  <div key={c.label} className="rounded-md border p-4 space-y-1.5">
                    <p className="font-semibold text-sm">{c.label}</p>
                    <a
                      href={`https://sepolia.basescan.org/address/${addr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-blue-500 underline"
                    >
                      {formatAddress(addr)}
                    </a>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {c.description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Main content */}
        <Tabs defaultValue="transactions">
          <TabsList>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="propose">Propose</TabsTrigger>
            <TabsTrigger value="signers">Signers</TabsTrigger>
            <TabsTrigger value="fees">Sweep</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="mt-4">
            <TransactionList
              transactions={transactions}
              threshold={threshold}
              isSigner={isSigner}
              isLoading={isLoading}
              page={page}
              hasNextPage={hasNextPage}
              onNextPage={nextPage}
              onPrevPage={prevPage}
              onApplyLogs={applyLogs}
            />
          </TabsContent>

          <TabsContent value="propose" className="mt-4">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle className="text-base">Propose New Transaction</CardTitle>
              </CardHeader>
              <CardContent>
                <ProposeForm onApplyLogs={applyLogs} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signers" className="mt-4">
            <TooltipProvider delayDuration={150}>
              <Card className="max-w-md">
                <CardHeader>
                  <CardTitle className="text-base">Signer Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Add Signer */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="addSigner">Add Signer</Label>
                      {ADD_SIGNER && (
                        <FunctionInfo
                          contract={MULTISIG_ADMIN_CONTRACT}
                          fn={ADD_SIGNER}
                        />
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        id="addSigner"
                        placeholder="Enter address (0x...)"
                        value={addSignerAddr}
                        onChange={(e) => setAddSignerAddr(e.target.value)}
                      />
                      <Button onClick={handleAddSigner} disabled={!!addLoading || !addSignerAddr}>
                        {addLoading ? (
                          <Loader2 className="animate-spin h-4 w-4" />
                        ) : "Propose"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Proposes adding a new authorized signer to the multisig.</p>
                  </div>

                  {/* Remove Signer */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="removeSigner">Remove Signer</Label>
                      {REMOVE_SIGNER && (
                        <FunctionInfo
                          contract={MULTISIG_ADMIN_CONTRACT}
                          fn={REMOVE_SIGNER}
                        />
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        id="removeSigner"
                        placeholder="Enter address (0x...)"
                        value={removeSignerAddr}
                        onChange={(e) => setRemoveSignerAddr(e.target.value)}
                      />
                      <Button onClick={handleRemoveSigner} disabled={!!removeLoading || !removeSignerAddr}>
                        {removeLoading ? (
                          <Loader2 className="animate-spin h-4 w-4" />
                        ) : "Propose"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Proposes removing a signer. Cannot drop below the current threshold.</p>
                  </div>

                  {/* Update Threshold */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="updateThreshold">Update Threshold</Label>
                      {UPDATE_THRESHOLD && (
                        <FunctionInfo
                          contract={MULTISIG_ADMIN_CONTRACT}
                          fn={UPDATE_THRESHOLD}
                        />
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        id="updateThreshold"
                        type="number"
                        placeholder="Enter new threshold"
                        min={minimumThreshold}
                        max={signerCount || undefined}
                        value={newThreshold}
                        onChange={(e) => setNewThreshold(e.target.value)}
                        aria-invalid={!!thresholdError}
                      />
                      <Button
                        onClick={handleUpdateThreshold}
                        disabled={
                          !!thresholdLoading || !newThreshold || !!thresholdError
                        }
                      >
                        {thresholdLoading ? (
                          <Loader2 className="animate-spin h-4 w-4" />
                        ) : "Propose"}
                      </Button>
                    </div>
                    {thresholdError ? (
                      <p className="text-xs text-destructive">{thresholdError}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Proposes changing the number of approvals required to
                        execute a transaction. Must be a majority
                        {signerCount ? ` — ${minimumThreshold} of ${signerCount}` : ""}{" "}
                        or more.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TooltipProvider>
          </TabsContent>

          <TabsContent value="fees" className="mt-4">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle className="text-base">Sweep Fees</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Collected fee balances are listed on the admin page.
                </p>
              </CardHeader>
              <CardContent>
                {fees.isLoading ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading fee balances…
                  </p>
                ) : fees.error ? (
                  <p className="text-sm text-muted-foreground">
                    {fees.notIndexed
                      ? "Fee receivers are not indexed by this subgraph deployment yet, so there is nothing to sweep."
                      : fees.error}
                  </p>
                ) : (
                  <SweepForm
                    tokens={fees.tokens}
                    chainId={chainId}
                    isSigner={isSigner}
                    onProposed={applyLogs}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Container>
  );
}

/**
 * The signer-management fields propose calls on the multisig itself, so their
 * explanations and docs links come from the same definitions the decoder uses
 * to render those proposals.
 */
const multisigAction = (name: string) =>
  MULTISIG_ADMIN_CONTRACT.functions.find((fn) => fn.name === name);

const ADD_SIGNER = multisigAction("addSigner");
const REMOVE_SIGNER = multisigAction("removeSigner");
const UPDATE_THRESHOLD = multisigAction("updateThreshold");

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="font-semibold text-lg leading-tight">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}
