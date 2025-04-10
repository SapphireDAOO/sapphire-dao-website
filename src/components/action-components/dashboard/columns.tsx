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
import { formatAddress, timeLeft } from "@/utils";
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
      const payment = row.original;
      const creatorsAddress = row.getValue("creator");
      return (
        <div className="text-center">
          {payment.type === "Creator" ? (
            "me"
          ) : creatorsAddress ? (
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
    accessorKey: "paymentTxHash",
    header: () => <div className="text-center">Payment</div>,
    cell: ({ row }) => {
      const paymentHash = row.getValue("paymentTxHash");

      if (!paymentHash) {
        return <div className="text-center">-</div>;
      }

      return (
        <div className="bold">
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
    accessorKey: "payer",
    header: () => <div className="text-center">By</div>,
    cell: ({ row }) => {
      const { type } = row.original;
      const payersAddress = row.getValue("payer") as string | undefined;

      if (!payersAddress) return <div className="text-center">-</div>;

      const displayText =
        type === "Payer" ? "me" : formatAddress(payersAddress);

      return (
        <div className="text-center">
          <a
            href={`https://amoy.polygonscan.com/address/${payersAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline"
          >
            {displayText}
          </a>
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: () => <div className="text-center">Time Created</div>,
    cell: ({ row }) => (
      <div className="text-center">{row.getValue("createdAt")}</div>
    ),
  },
  {
    accessorKey: "releaseHash",
    header: () => <div className="text-center">Release</div>,
    cell: ({ row }) => {
      const releaseHash = row.getValue("releaseHash");
      const status = row.original?.status; // Fetch invoice status
      const releaseAt = row.original?.releaseAt ?? null; // Ensure null safety

      // If status is RELEASED, show hash
      if (status === "RELEASED" && releaseHash) {
        return (
          <div className="text-center">
            <a
              href={`https://amoy.polygonscan.com/tx/${releaseHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              {formatAddress(releaseHash as string)}
            </a>
          </div>
        );
      }

      // If status is ACCEPTED, show time left
      if (status === "ACCEPTED") {
        if (!releaseAt) return <div className="text-center">-</div>;

        const [timeRemaining, setTimeRemaining] = React.useState(
          timeLeft(Number(releaseAt))
        );

        React.useEffect(() => {
          if (!releaseAt) return;

          const interval = setInterval(() => {
            const updatedTime = timeLeft(Number(releaseAt));
            setTimeRemaining(updatedTime);

            if (updatedTime === "Time Elapsed") {
              clearInterval(interval);
            }
          }, 1000);

          return () => clearInterval(interval);
        }, [releaseAt]);

        return (
          <div className="text-yellow-500 text-center">{timeRemaining}</div>
        );
      }

      // Default case, return "-"
      return <div className="text-center">-</div>;
    },
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
    accessorKey: "status",
    header: () => <div className="text-center">State</div>,
    cell: ({ row }) => (
      <div className="text-center capitalize">{row.getValue("status")}</div>
    ),
  },
  {
    accessorKey: "price",
    header: () => <div className="text-center">Amount</div>,
    cell: ({ row }) => (
      <div className="text-center">{row.getValue("price") + " POL"}</div>
    ),
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
