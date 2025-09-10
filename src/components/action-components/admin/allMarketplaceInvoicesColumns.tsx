"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Invoice } from "@/model/model";
import { formatAddress } from "@/utils";
import React from "react";
import { formatEther } from "viem";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import CopyableAddress from "@/components/ui/CopyableAddress";

const allMarketplaceInvoices: ColumnDef<Invoice>[] = [
  {
    accessorKey: "id",
    header: ({ column }) => {
      return (
        <div className="text-center w-full">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="mx-auto"
          >
            Id
            <ArrowUpDown className="ml-1 h-4 w-4" />
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      const id: string = row.getValue("id");
      if (!id) return <div className="text-center">-</div>;
      return <div className="text-center">{id}</div>;
    },
    enableSorting: true,
    sortingFn: (rowA, rowB, columnId) =>
      Number(rowA.getValue(columnId)) - Number(rowB.getValue(columnId)),
  },

  {
    accessorKey: "orderId",
    header: () => <div className="text-center">Invoice Id</div>,
    cell: ({ row }) => {
      const orderId: bigint = row.getValue("orderId");
      return (
        <div className="text-center">
          <CopyableAddress fullValue={orderId.toString()} />
        </div>
      );
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
              href={`https://sepolia.etherscan.io/address/${sellersAddress}`}
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
    accessorKey: "commisionTxHash",
    header: () => <div className="text-center">Commission Url</div>,
    cell: ({ row }) => {
      const commissionUrl = row.getValue("commisionTxHash");
      return (
        <div className="text-center">
          {commissionUrl ? (
            <a
              href={`https://sepolia.etherscan.io/tx/${commissionUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              {formatAddress(commissionUrl as string)}
            </a>
          ) : (
            "-"
          )}
        </div>
      );
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
              href={`https://sepolia.etherscan.io/tx/${paymentHash}`}
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
              href={`https://sepolia.etherscan.io/address/${buyersAddress}`}
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
  //   {
  //     accessorKey: "release",
  //     header: () => <div className="text-center">Release</div>,
  //     cell: ({ row }) => {
  //       const releasedAtTimeStamp: string = row.getValue("release");
  //       const { releaseHash, status } = row.original;

  //       if (status === "REFUNDED" || status === "REJECTED") {
  //         return <div className="text-center">-</div>;
  //       }

  //       if (status === "RELEASED") {
  //         return (
  //           <a
  //             href={`https://sepolia.etherscan.io/address/${releaseHash}`}
  //             target="_blank"
  //             rel="noopener noreferrer"
  //             className="text-blue-500 underline"
  //           >
  //             {formatAddress(releaseHash)}
  //           </a>
  //         );
  //       }

  //       return <div className="text-center">{releasedAtTimeStamp}</div>;
  //     },
  //   },
  {
    accessorKey: "fee",
    header: () => <div className="text-center">Fee</div>,
    cell: ({ row }) => {
      const releasedAtTimeStamp: string = formatEther(row.getValue("fee"));

      return <div className="text-center">{releasedAtTimeStamp}</div>;
    },
  },
];

export default allMarketplaceInvoices;
