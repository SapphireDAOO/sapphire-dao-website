"use client";

import { useContext, useRef } from "react";
import { ContractContext } from "@/context/contract-context";
import { formatAddress } from "@/utils";
import {
  ADVANCED_PAYMENT_PROCESSOR,
  SIMPLE_PAYMENT_PROCESSOR,
} from "@/constants";
import { sepolia } from "viem/chains";
import DataTable from "../dashboard/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardHeader from "../dashboard/Header";
import Container from "@/components/Container";
import allInvoicesColumns from "./allInvoicesColumns";
import adminActionsColumns from "./adminActionsColumns";
import allMarketplaceInvoices from "./allMarketplaceInvoicesColumns";

import { useGetBalance } from "@/hooks/useGetBalance";
import { Address } from "viem";

/**
 * Props for the ContractLink component.
 */
interface ContractLinkProps {
  address: Address; // The contract address to display
  showBalance?: boolean; // Whether to display the balance (defaults to true)
}

/**
 * A component that displays a clickable contract address link and optionally the POL balance of the marketplace wallet.
 *
 * @param {ContractLinkProps} props - The component props.
 * @returns {JSX.Element} The rendered contract link and optional balance display.
 */
const ContractLink: React.FC<ContractLinkProps> = ({
  address,
  showBalance = true,
}) => {
  const { data: balance, isLoading } = useGetBalance();

  const formattedBalance = balance ? Number(balance).toFixed(3) : undefined;

  return (
    <div className="flex flex-col gap-2">
      <span>
        Contract:{" "}
        <a
          href={`https://sepolia.etherscan.io/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 underline"
        >
          {formatAddress(address)}
        </a>
      </span>
      {showBalance && (
        <span>
          Wallet Balance:{" "}
          {isLoading
            ? "Loading..."
            : formattedBalance
            ? `${formattedBalance} ETH`
            : "0 ETH"}
        </span>
      )}
    </div>
  );
};

const AdminInvoices = () => {
  const { allInvoiceData, refreshAdminData } = useContext(ContractContext);
  const hasFetchedAdmin = useRef(false);

  if (!hasFetchedAdmin.current) {
    hasFetchedAdmin.current = true;
    refreshAdminData?.(true);
  }

  return (
    <div className="container mx-auto">
      <Tabs defaultValue="invoices">
        <div className="flex items-center justify-center mt-10">
          <TabsList>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="marketplace">Marketplace Invoices</TabsTrigger>
            <TabsTrigger value="actions">Marketplace Actions</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="invoices">
          <Container>
            <DashboardHeader
              title="INVOICES"
              rightContent={
                <ContractLink
                  address={SIMPLE_PAYMENT_PROCESSOR[sepolia.id] as Address}
                  showBalance={false}
                />
              }
            />
            <DataTable
              columns={allInvoicesColumns}
              data={allInvoiceData.invoices ?? []}
            />
          </Container>
        </TabsContent>
        <TabsContent value="marketplace">
          <Container>
            <DashboardHeader
              title="MARKETPLACE"
              rightContent={
                <ContractLink
                  address={ADVANCED_PAYMENT_PROCESSOR[sepolia.id] as Address}
                />
              }
            />
            <DataTable
              columns={allMarketplaceInvoices}
              data={allInvoiceData.marketplaceInvoices ?? []}
            />
          </Container>
        </TabsContent>
        <TabsContent value="actions">
          <Container>
            <DashboardHeader
              title="Admin Action"
              rightContent={
                <ContractLink
                  address={ADVANCED_PAYMENT_PROCESSOR[sepolia.id] as Address}
                />
              }
            />
            <DataTable
              columns={adminActionsColumns}
              data={allInvoiceData.actions ?? []}
            />
          </Container>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminInvoices;
