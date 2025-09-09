"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Invoice } from "@/model/model";
import { Button } from "@/components/ui/button";
import React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText } from "lucide-react";
import { timeLeft } from "@/utils";

const marketplaceActions: ColumnDef<Invoice>[] = [
  {
    id: "actions",
    cell: ({ row }) => {
      const paidAtTimestamp = row.getValue("paidAt");
      const t = timeLeft(Number(paidAtTimestamp), 259200000);

      const payment = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 px-2 gap-1 text-xs">
              <FileText className="h-4 w-4" />
              Manage
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {payment.status === "CREATED" && (
              <>
                {payment.type === "ReceivedInvoice" && (
                  <>
                    <DropdownMenuItem>Pay Invoice</DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                {payment.type === "IssuedInvoice" && t !== "Time Elapsed" && (
                  <>
                    <DropdownMenuItem>Waiting for Payment</DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export default marketplaceActions;
