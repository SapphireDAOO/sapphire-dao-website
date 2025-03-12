/* eslint-disable react-hooks/rules-of-hooks */
"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Invoice } from "@/model/model";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import CreatorsAction from "./creators-action";
import CancelInvoice from "./cancel-payment";
import ReleaseInvoice from "./release-invoice";
import RefundPayer from "./refund-payer";
import { timeLeft } from "@/utils";
import generateSecureLink from "@/lib/generate-link";
import React from "react";

const columns: ColumnDef<Invoice>[] = [
  {
    accessorKey: "id",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Invoice id
          <ArrowUpDown />
        </Button>
      );
    },
    cell: ({ row }) => <div className="text-center">{row.getValue("id")}</div>,
  },
  {
    accessorKey: "createdAt",
    header: "Time Created ",
    cell: ({ row }) => <div className="bold">{row.getValue("createdAt")}</div>,
  },
  {
    accessorKey: "paidAt",
    header: () => <div className="text-center">Decision Window</div>,
    cell: ({ row }) => {
      const paidAtTimestamp = row.getValue("paidAt");
      const payment = row.original;

      const [timeRemaining, setTimeRemaining] = React.useState(() =>
        payment?.status === "PAID"
          ? timeLeft(Number(paidAtTimestamp), 259200000)
          : "-"
      );

      React.useEffect(() => {
        if (payment?.status !== "PAID" || !paidAtTimestamp) {
          return;
        }

        const interval = setInterval(() => {
          const updatedTime = timeLeft(paidAtTimestamp, 259200000);
          setTimeRemaining(updatedTime);

          if (updatedTime === "Time Elapsed") {
            clearInterval(interval);
          }
        }, 1000);

        return () => clearInterval(interval);
      }, [paidAtTimestamp, payment?.status]);

      return <div className="text-center">{timeRemaining}</div>;
    },
  },
  {
    accessorKey: "holdPeriod",
    header: () => <div className="text-center">Hold Time</div>,
    cell: ({ row }) => {
      const t = row.getValue("holdPeriod");

      const payment = row.original;

      const [timeRemaining, setTimeRemaining] = React.useState(() =>
        payment?.status === "ACCEPTED" ? timeLeft(t) : "-"
      );

      React.useEffect(() => {
        if (payment?.status !== "ACCEPTED" || !t) {
          return;
        }

        const interval = setInterval(() => {
          const updatedTime = timeLeft(t);

          setTimeRemaining(updatedTime);

          if (updatedTime === "Time Elapsed") {
            clearInterval(interval);
          }
        }, 1000);

        return () => clearInterval(interval);
      }, [t, payment?.status]);

      return <div className="text-center">{timeRemaining}</div>;
    },
  },
  {
    accessorKey: "status",
    header: () => <div className="text-center">Status</div>,
    cell: ({ row }) => (
      <div className="text-center capitalize">{row.getValue("status")}</div>
    ),
  },
  {
    accessorKey: "price",
    header: () => <div className="text-center">Amount</div>,
    cell: ({ row }) => {
      return (
        <div className="text-center">{row.getValue("price") + " POL"}</div>
      );
    },
  },
  {
    accessorKey: "amountPaid",
    header: () => <div className="text-center">Paid Amount</div>,
    cell: ({ row }) => {
      const payment = row.original;
      return (
        <div className="text-center">
          {payment.amountPaid
            ? row.getValue("amountPaid") + " POL"
            : "Not paid"}
        </div>
      );
    },
  },
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
            {payment.type === "Creator" &&
              t !== "Time Elapsed" &&
              payment.status == "CREATED" && (
                <>
                  <DropdownMenuItem
                    onClick={async () => {
                      const domain =
                        typeof window !== "undefined"
                          ? window.location.origin
                          : "";
                      const encodedEncryptedData = generateSecureLink(payment);
                      navigator.clipboard.writeText(
                        `${domain}/pay/?data=${encodedEncryptedData}`
                      );
                      toast.success("Copied");
                    }}
                  >
                    Copy payment URL
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

            {payment?.status === "PAID" &&
              payment.type === "Creator" &&
              t !== "Time Elapsed" && (
                <>
                  <DropdownMenuItem>
                    <CreatorsAction
                      invoiceId={payment.id}
                      state={true}
                      text="Accept Payment"
                      key="0"
                    />
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <CreatorsAction
                      invoiceId={payment.id}
                      state={false}
                      text="Reject Payment"
                      key="1"
                    />
                  </DropdownMenuItem>
                </>
              )}
            {payment?.status === "CREATED" && (
              <DropdownMenuItem>
                <CancelInvoice invoiceId={payment.id} />
              </DropdownMenuItem>
            )}

            {payment?.status === "ACCEPTED" && payment.type === "Creator" && (
              <DropdownMenuItem>
                <ReleaseInvoice invoiceId={payment.id} />
              </DropdownMenuItem>
            )}
            {payment?.status !== "REFUNDED" &&
              payment?.status !== "REJECTED" &&
              payment?.type === "Payer" && (
                <DropdownMenuItem>
                  <RefundPayer
                    invoiceId={payment.id}
                    timeStamp={payment.paidAt}
                  />
                </DropdownMenuItem>
              )}
            {payment?.status === "REFUNDED" ||
              (payment?.status === "REJECTED" && payment?.type === "Payer" && (
                <DropdownMenuItem>
                  <Button className="w-full">All Settled</Button>
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export default columns;
