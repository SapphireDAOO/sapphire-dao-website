 
"use client";
import { ColumnDef } from "@tanstack/react-table";
import { AllInvoice } from "@/model/model";
import { formatAddress } from "@/utils";
import React from "react";

const columns: ColumnDef<AllInvoice>[] = [
  {
    accessorKey: "id",
    header: () => <div className="text-center">Invoice id</div>,
    cell: ({ row }) => <div className="text-center">{row.getValue("id")}</div>,
  },
  {
    accessorKey: "contract",
    header: () => <div className="text-center">Contract</div>,
    cell: ({ row }) => {
      const contractAddress = row.getValue("contract");
      return (
        <div className="text-center">
          {contractAddress ? (
            <a
              href={`https://amoy.polygonscan.com/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              {formatAddress(contractAddress as string)}
            </a>
          ) : (
            "-"
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "creator",
    header: () => <div className="text-center">Creator</div>,
    cell: ({ row }) => {
      const creatorsAddress = row.getValue("creator");
      return (
        <div className="text-center">
          {creatorsAddress ? (
            <a
              href={`https://amoy.polygonscan.com/address/${creatorsAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              {formatAddress(creatorsAddress as string)}
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

      console.log();

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
    accessorKey: "by",
    header: () => <div className="text-center">By</div>,
    cell: ({ row }) => {
      const payersAddress = row.getValue("by");
      return (
        <div className="text-center">
          {payersAddress ? (
            <a
              href={`https://amoy.polygonscan.com/address/${payersAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              {formatAddress(payersAddress as string)}
            </a>
          ) : (
            "-"
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "release",
    header: () => <div className="text-center">Release</div>,
    cell: ({ row }) => {
      const releasedAtTimeStamp: string = row.getValue("release");

      return <div className="text-center">{releasedAtTimeStamp}</div>;
    },
  },
];

export default columns;
