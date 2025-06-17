"use client";

import { useContext } from "react";
import { ContractContext } from "@/context/contract-context";
import columns from "./admin-columns";
import { formatAddress } from "@/utils";
import { ADVANCE_INVOICE_ADDRESS, INVOICE_ADDRESS } from "@/constants";
import { polygonAmoy } from "viem/chains";
import DataTable from "../dashboard/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardHeader from "../dashboard/Header";
import Container from "@/components/Container";

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
            <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
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
            <DataTable columns={columns} data={allInvoiceData ?? []} />
          </Container>
        </TabsContent>
        <TabsContent value="marketplace">
          <Container>
            <DashboardHeader
              title="MARKETPLACE"
              rightContent={
                <ContractLink
                  address={ADVANCE_INVOICE_ADDRESS[polygonAmoy.id]}
                />
              }
            />
            <DataTable columns={columns} data={[]} />
          </Container>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminInvoices;
