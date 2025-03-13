"use client";

import { useContext, useEffect, useState } from "react";
import { ContractContext } from "@/context/contract-context";
import DataTable from "./data-table";
import columns from "./columns";
import { Tabs } from "@/components/ui/tabs";

export default function InvoicePage() {
  const { allInvoiceData, refetchAllInvoiceData } = useContext(ContractContext);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refetchAllInvoiceData?.().finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto">
      <main>
        <div className="flex justify-between mt-6 mb-6">
          <h1 className="text-3xl font-semibold">Invoices</h1>
        </div>

        {/* <Tabs>
          <TabsContent value={""}>
            <DataTable columns={columns} data={allInvoiceData} statuses={[]} />
          </TabsContent>
        </Tabs> */}

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
