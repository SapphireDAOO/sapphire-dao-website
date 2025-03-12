"use client";
import CreateInvoiceDialog from "./create-invoice";

const DashboardHeader = () => {
  return (
    <div className="flex justify-between mt-6 mb-6">
      <h1 className="text-3xl font-semibold">Invoices</h1>
      <CreateInvoiceDialog />
    </div>
  );
};

export default DashboardHeader;
