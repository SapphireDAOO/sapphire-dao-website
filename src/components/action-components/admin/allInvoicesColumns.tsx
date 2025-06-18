"use client";
import { ColumnDef } from "@tanstack/react-table";
import { AllInvoice } from "@/model/model";
import { formatAddress } from "@/utils";
import React from "react";
import { Address, formatEther } from "viem";
import CopyableAddress from "@/components/ui/CopyableAddress";

const allInvoicesColumns: ColumnDef<AllInvoice>[] = [
  {
    accessorKey: "id",
    header: () => <div className="text-center">Invoice id</div>,
    cell: ({ row }) => <div className="text-center">{row.getValue("id")}</div>,
  },
  {
    accessorKey: "invoiceKey",
    header: () => <div className="text-center">Order Id</div>,
    cell: ({ row }) => {
      const invoiceKey: Address = row.getValue("invoiceKey");
      return <CopyableAddress fullValue={invoiceKey} />;
    },
  },
  {
    accessorKey: "seller",
    header: () => <div className="text-center">Seller</div>,
    cell: ({ row }) => {
      const sellersAddress = row.getValue("seller");
      return (
        <div className="text-center">
          {sellersAddress ? (
            <a
              href={`https://amoy.polygonscan.com/address/${sellersAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              {formatAddress(sellersAddress as string)}
            </a>
          ) : (
            "-"
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: () => <div className="text-center">Time Created</div>,
    cell: ({ row }) => {
      const createdAt: string = row.getValue("createdAt");

      return <div className="text-center">{createdAt}</div>;
    },
  },
  {
    accessorKey: "payment",
    header: () => <div className="text-center">Payment</div>,
    cell: ({ row }) => {
      const paymentHash = row.getValue("payment");

      if (!paymentHash) {
        return <div className="text-center">-</div>;
      }

      return (
        <div className="bold text-center">
          {paymentHash ? (
            <a
              href={`https://amoy.polygonscan.com/tx/${paymentHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              {formatAddress(paymentHash as string)}
            </a>
          ) : (
            "-"
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "paidAt",
    header: () => <div className="text-center">Time Paid</div>,
    cell: ({ row }) => {
      const paidAt: string = row.getValue("paidAt");

      if (!paidAt) return <div className="text-center">-</div>;

      return <div className="text-center">{paidAt}</div>;
    },
  },
  {
    accessorKey: "by",
    header: () => <div className="text-center">By</div>,
    cell: ({ row }) => {
      const buyersAddress = row.getValue("by");
      return (
        <div className="text-center">
          {buyersAddress ? (
            <a
              href={`https://amoy.polygonscan.com/address/${buyersAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              {formatAddress(buyersAddress as string)}
            </a>
          ) : (
            "-"
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: () => <div className="text-center">State</div>,
    cell: ({ row }) => {
      const status: string = row.getValue("status");

      return <div className="text-center">{status}</div>;
    },
  },
  {
    accessorKey: "release",
    header: () => <div className="text-center">Release</div>,
    cell: ({ row }) => {
      const releasedAtTimeStamp: string = row.getValue("release");
      const { releaseHash, status } = row.original;

      if (status === "REFUNDED" || status === "REJECTED") {
        return <div className="text-center">-</div>;
      }

      if (status === "RELEASED") {
        return (
          <a
            href={`https://amoy.polygonscan.com/address/${releaseHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline"
          >
            {formatAddress(releaseHash)}
          </a>
        );
      }

      return <div className="text-center">{releasedAtTimeStamp}</div>;
    },
  },
  {
    accessorKey: "fee",
    header: () => <div className="text-center">Fee</div>,
    cell: ({ row }) => {
      const releasedAtTimeStamp: string = formatEther(row.getValue("fee"));

      return <div className="text-center">{releasedAtTimeStamp}</div>;
    },
  },
];

export default allInvoicesColumns;
