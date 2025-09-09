"use client";
import { ColumnDef } from "@tanstack/react-table";
import { AdminAction } from "@/model/model";

import React from "react";
import CopyableAddress from "@/components/ui/CopyableAddress";

const adminActionsColumns: ColumnDef<AdminAction>[] = [
  {
    accessorKey: "id",
    header: () => <div className="text-center">Id</div>,
    cell: ({ row }) => <div className="text-center">{row.getValue("id")}</div>,
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
    accessorKey: "time",
    header: () => <div className="text-center">Time</div>,
    cell: ({ row }) => {
      const time: string = row.getValue("time");
      return <div className="text-center">{time}</div>;
    },
  },
  {
    accessorKey: "action",
    header: () => <div className="text-center">Action</div>,
    cell: ({ row }) => {
      const action: string = row.getValue("action");

      return <div className="text-center">{action}</div>;
    },
  },
  {
    accessorKey: "balance",
    header: () => <div className="text-center">Balance</div>,
    cell: ({ row }) => {
      let balance: string = row.getValue("balance");
      if (!balance) balance = "0";

      return <div className="text-center">{balance}</div>;
    },
  },
  {
    accessorKey: "type",
    header: () => <div className="text-center">Type</div>,
    cell: ({ row }) => {
      return <div className="text-center">{row.getValue("type")}</div>;
    },
  },
];

export default adminActionsColumns;
