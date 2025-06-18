/* eslint-disable react-hooks/rules-of-hooks */
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
import AcceptInvoice from "./accept-invoice";
import RequestCancelation from "./request-cancelation";
import CreateDispute from "./create-dispute";
import HandleCancelationRequest from "./handle-cancelation";
import CancelInvoice from "./cancel-invoice";
import Refund from "./refund";

const marketplaceActions: ColumnDef<Invoice>[] = [
  {
    id: "actions",
    cell: ({ row }) => {
      const paidAtTimestamp = row.getValue("paidAt");
      const t = timeLeft(Number(paidAtTimestamp), 259200000);

      const payment = row.original;
      console.log("RES", row.original);
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

            {payment.status === "PAID" && (
              <>
                {payment.type === "IssuedInvoice" && t !== "Time Elapsed" && (
                  <>
                    <AcceptInvoice invoiceKey={payment.invoiceKey} />
                    <CancelInvoice invoiceKey={payment.invoiceKey} />
                  </>
                )}

                {payment.type === "ReceivedInvoice" && t !== "Time Elapsed" && (
                  <RequestCancelation invoiceKey={payment.invoiceKey} />
                )}

                {payment.type === "ReceivedInvoice" && t === "Time Elapsed" && (
                  <Refund invoiceKey={payment.invoiceKey} />
                )}
              </>
            )}

            {payment.status === "ACCEPTED" &&
              payment.type === "ReceivedInvoice" && (
                <CreateDispute invoiceKey={payment.invoiceKey} />
              )}

            {payment.status === "REJECTED" && (
              <DropdownMenuItem>Refunded</DropdownMenuItem>
            )}

            {payment.status === "CANCELED" && (
              <DropdownMenuItem>Invoice Cancelled</DropdownMenuItem>
            )}

            {payment.status === "CANCELATION REQUESTED" &&
              payment.type === "IssuedInvoice" && (
                <>
                  <DropdownMenuItem asChild>
                    <HandleCancelationRequest
                      invoiceKey={payment.invoiceKey}
                      state={true}
                      text="Accept"
                      key="0"
                    />
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <HandleCancelationRequest
                      invoiceKey={payment.invoiceKey}
                      state={false}
                      text="Reject"
                      key="1"
                    />
                  </DropdownMenuItem>
                </>
              )}

            {payment.status === "CANCELATION REJECTED" &&
              payment.type === "IssuedInvoice" && (
                <DropdownMenuItem>Accept Invoice</DropdownMenuItem>
              )}

            {payment.status === "CANCELATION ACCEPTED" &&
              payment.type === "ReceivedInvoice" && (
                <DropdownMenuItem>Refunded</DropdownMenuItem>
              )}

            {payment.status === "DISPUTED" && (
              <DropdownMenuItem>Dispute In Progress</DropdownMenuItem>
            )}

            {payment.status === "DISPUTE DISMISSED" && (
              <DropdownMenuItem>Dispute Dismissed</DropdownMenuItem>
            )}

            {payment.status === "DISPUTE RESOLVED" && (
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

export default marketplaceActions;
