"use client";

import { useContext } from "react";
import { ContractContext } from "@/context/contract-context";
import { formatAddress } from "@/utils";
import { ADVANCE_INVOICE_ADDRESS, INVOICE_ADDRESS } from "@/constants";
import { polygonAmoy } from "viem/chains";
import DataTable from "../dashboard/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardHeader from "../dashboard/Header";
import Container from "@/components/Container";
import allInvoicesColumns from "./allInvoicesColumns";
import adminActionsColumns from "./adminActionsColumns";

const ContractLink = ({ address }: { address: string }) => (
  <>
    Contract:{" "}
    <a
      href={`https://amoy.polygonscan.com/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-500 underline"
    >
      {formatAddress(address)}
    </a>
  </>
);

const AdminInvoices = () => {
  const { allInvoiceData } = useContext(ContractContext);

  return (
    <div className="container mx-auto">
      <Tabs defaultValue="invoices">
        <div className="flex items-center justify-center mt-10">
          <TabsList>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="actions">Admin Actions</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="invoices">
          <Container>
            <DashboardHeader
              title="INVOICES"
              rightContent={
                <ContractLink address={INVOICE_ADDRESS[polygonAmoy.id]} />
              }
            />
            <DataTable
              columns={allInvoicesColumns}
              data={allInvoiceData.invoices ?? []}
            />
          </Container>
        </TabsContent>
        <TabsContent value="actions">
          <Container>
            <DashboardHeader
              title="Admin Action"
              rightContent={
                <ContractLink
                  address={ADVANCE_INVOICE_ADDRESS[polygonAmoy.id]}
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
