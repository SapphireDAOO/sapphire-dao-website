"use client";

import { useContext, useEffect, useState } from "react";
import { ContractContext } from "@/context/contract-context";
import DataTable from "./data-table";
import columns from "./columns";
import { Tabs } from "@/components/ui/tabs";
import { formatAddress } from "@/utils";
import { INVOICE_ADDRESS } from "@/constants";
import { polygonAmoy } from "viem/chains";

export default function InvoicePage() {
  const { allInvoiceData, refetchAllInvoiceData } = useContext(ContractContext);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refetchAllInvoiceData?.().finally(() => setLoading(false));
  }, []);

  const contractAddress = INVOICE_ADDRESS[polygonAmoy.id];

  return (
    <div className="container mx-auto">
      <main>
        <div className="flex flex-col sm:flex-row sm:justify-between items-center mt-6 mb-6 gap-2">
          <h1 className="text-3xl font-semibold">Invoices</h1>
          <p className="text-2xl font-semibold text-gray-700">
            Contract :{" "}
            <a
              href={`https://amoy.polygonscan.com/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              {formatAddress(contractAddress)}
            </a>
          </p>
        </div>

        {loading ? (
          <p className="text-center text-gray-500">Loading invoices...</p>
        ) : (
          <Tabs>
            <DataTable columns={columns} data={allInvoiceData} statuses={[]} />
          </Tabs>
        )}
      </main>
    </div>
  );
}
