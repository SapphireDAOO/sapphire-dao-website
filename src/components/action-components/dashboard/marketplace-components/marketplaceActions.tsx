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
            {payment.status === "CREATED" && (
              <>
                {payment.type === "Buyer" && t !== "Time Elapsed" && (
                  <>
                    <DropdownMenuItem>Pay Invoice</DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                {payment.type === "Seller" && t !== "Time Elapsed" && (
                  <>
                    <DropdownMenuItem>Waiting for Payment</DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
              </>
            )}

            {payment.status === "PAID" && (
              <>
                {payment.type === "Seller" && t !== "Time Elapsed" && (
                  <>
                    <DropdownMenuItem>Accept Payment</DropdownMenuItem>
                    <DropdownMenuItem>Reject Payment</DropdownMenuItem>
                  </>
                )}

                {payment.type === "Buyer" && t !== "Time Elapsed" && (
                  <DropdownMenuItem>
                    Waiting for Seller Response
                  </DropdownMenuItem>
                )}

                {payment.type === "Buyer" && t === "Time Elapsed" && (
                  <DropdownMenuItem>Request Cancelation</DropdownMenuItem>
                )}
              </>
            )}

            {payment.status === "ACCEPTED" && payment.type === "Buyer" && (
              <DropdownMenuItem>Create Dispute</DropdownMenuItem>
            )}

            {payment.status === "REJECTED" && (
              <DropdownMenuItem>Refunded</DropdownMenuItem>
            )}

            {payment.status === "CANCELED" && (
              <DropdownMenuItem>Invoice Cancelled</DropdownMenuItem>
            )}

            {payment.status === "CANCELATION_REQUESTED" &&
              payment.type === "Seller" && (
                <>
                  <DropdownMenuItem>Accept Cancelation</DropdownMenuItem>
                  <DropdownMenuItem>Reject Cancelation</DropdownMenuItem>
                </>
              )}

            {payment.status === "CANCELATION_REJECTED" &&
              payment.type === "Seller" && (
                <DropdownMenuItem>Accept Invoice</DropdownMenuItem>
              )}

            {payment.status === "CANCELATION_ACCEPTED" &&
              payment.type === "Buyer" && (
                <DropdownMenuItem>Refunded</DropdownMenuItem>
              )}

            {payment.status === "DISPUTED" && (
              <DropdownMenuItem>Dispute In Progress</DropdownMenuItem>
            )}

            {payment.status === "DISPUTE_DISMISSED" && (
              <DropdownMenuItem>Dispute Dismissed</DropdownMenuItem>
            )}

            {payment.status === "DISPUTE_RESOLVED" && (
              <DropdownMenuItem>Dispute Resolved</DropdownMenuItem>
            )}

            {payment.status === "RELEASED" && (
              <DropdownMenuItem>Payment Released</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export default marketplaceColumns;
