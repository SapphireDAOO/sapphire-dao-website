"use client";
import { ColumnDef } from "@tanstack/react-table";
import { AdminAction } from "@/model/model";

import React from "react";
import { Address } from "viem";
import CopyableAddress from "@/components/ui/CopyableAddress";

const adminActionsColumns: ColumnDef<AdminAction>[] = [
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
    accessorKey: "type",
    header: () => <div className="text-center">Type</div>,
    cell: ({ row }) => {
      return <div className="text-center">{row.getValue("type")}</div>;
    },
  },
];

export default adminActionsColumns;
