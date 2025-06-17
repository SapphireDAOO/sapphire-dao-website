// eslint-disable react-hooks/rules-of-hooks
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
import { MoreHorizontal } from "lucide-react";
import { timeLeft } from "@/utils";

const marketplaceColumns: ColumnDef<Invoice>[] = [
  {
    id: "actions",
    cell: ({ row }) => {
      const paidAtTimestamp = row.getValue("paidAt");
      const t = timeLeft(Number(paidAtTimestamp), 259200000);

      const payment = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {payment.type === "Buyer" &&
              t !== "Time Elapsed" &&
              payment.status === "CREATED" && (
                <>
                  <DropdownMenuItem>Pay Invoice</DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

            {payment.status === "PAID" &&
              payment.type === "Seller" &&
              t !== "Time Elapsed" && (
                <>
                  <DropdownMenuItem>Accept Payment</DropdownMenuItem>
                  <DropdownMenuItem>Reject Payment</DropdownMenuItem>
                </>
              )}

            {payment.status === "PAID" &&
              payment.type === "Seller" &&
              t === "Time Elapsed" && (
                <DropdownMenuItem>Time Elapsed</DropdownMenuItem>
              )}

            {payment.status === "PAID" &&
              payment.type === "Buyer" &&
              t === "Time Elapsed" && (
                <DropdownMenuItem>Request Cancel</DropdownMenuItem>
              )}

            {payment.status === "CANCELLED" && payment.type === "Seller" && (
              <>
                <DropdownMenuItem>Accept Cancel</DropdownMenuItem>
                <DropdownMenuItem>Reject Cancel</DropdownMenuItem>
              </>
            )}

            {(payment.status === "REJECTED" ||
              payment.status === "REFUNDED") && (
              <DropdownMenuItem>Refunded / Resolved</DropdownMenuItem>
            )}

            {payment.status === "ACCEPTED" && payment.type === "Buyer" && (
              <DropdownMenuItem>Create Dispute</DropdownMenuItem>
            )}

            {payment.status === "DISPUTE" && (
              <DropdownMenuItem>Dispute in progress</DropdownMenuItem>
            )}

            {payment.status === "RESOLVE" && (
              <DropdownMenuItem>RESOLVED</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export default marketplaceColumns;
