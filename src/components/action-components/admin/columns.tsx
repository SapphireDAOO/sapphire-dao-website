"use client";
import { ColumnDef } from "@tanstack/react-table";
import { AllInvoice } from "@/model/model";
import { formatAddress } from "@/utils";
import React from "react";
import { formatEther } from "viem";

const columns: ColumnDef<AllInvoice>[] = [
  {
    accessorKey: "id",
    header: () => <div className="text-center">Invoice id</div>,
    cell: ({ row }) => <div className="text-center">{row.getValue("id")}</div>,
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
  {
    accessorKey: "fee",
    header: () => <div className="text-center">Fee</div>,
    cell: ({ row }) => {
      const releasedAtTimeStamp: string = formatEther(row.getValue("fee"));
      console.log("THE FEE IS", releasedAtTimeStamp);

      return <div className="text-center">{releasedAtTimeStamp}</div>;
    },
  },
];

export default columns;
