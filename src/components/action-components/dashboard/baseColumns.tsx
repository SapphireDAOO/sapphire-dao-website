/* eslint-disable react-hooks/rules-of-hooks */
"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Invoice } from "@/model/model";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import { formatAddress, timeLeft } from "@/utils";
import React from "react";
import { useGetTokenName } from "@/hooks/useGetTokenName";
import { Address } from "viem";

const DecisionWindowCell = ({
  paidAtTimestamp,
  status,
  source,
  cancelAt,
}: {
  paidAtTimestamp: number | string | null;
  status?: string;
  source?: string;
  cancelAt?: string;
}) => {
  if (!status || !source) return <div className="text-center">-</div>;

  const expiresAt = Number(cancelAt) * 1000;

  const [timeRemaining, setTimeRemaining] = React.useState(() =>
    status === "PAID" ? timeLeft(paidAtTimestamp, 259200000, expiresAt) : "-"
  );

  React.useEffect(() => {
    if (status !== "PAID" || !paidAtTimestamp) return;

    const interval = setInterval(() => {
      const updatedTime = timeLeft(paidAtTimestamp, 259200000, expiresAt);
      setTimeRemaining(updatedTime);

      if (updatedTime === "Time Elapsed") {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [paidAtTimestamp, status, expiresAt]);

  return <div className="text-center">{timeRemaining}</div>;
};

const baseColumns: ColumnDef<Invoice>[] = [
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
    accessorKey: "seller",
    header: () => <div className="text-center">Seller</div>,
    cell: ({ row }) => {
      const payment = row.original;
      const sellersAddress = row.getValue("seller");
      return (
        <div className="text-center">
          {payment.type === "Seller" ? (
            "me"
          ) : sellersAddress ? (
            <a
              href={`https://amoy.polygonscan.com/address/${sellersAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              {formatAddress(sellersAddress as string)}
            </a>
          ) : (
            "-"
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "buyer",
    header: () => <div className="text-center">Buyer</div>,
    cell: ({ row }) => {
      const { type } = row.original;
      const buyersAddress = row.getValue("buyer") as string | undefined;

      if (!buyersAddress) return <div className="text-center">-</div>;

      const displayText =
        type === "Buyer" ? "me" : formatAddress(buyersAddress);

      return (
        <div className="text-center">
          <a
            href={`https://amoy.polygonscan.com/address/${buyersAddress}`}
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
    accessorKey: "paymentToken",
    header: () => <div className="text-center">Payment Token</div>,
    cell: ({ row }) => {
      const paymentToken = row.getValue("paymentToken") as string;
      const paymentTokenAddress = row.getValue("paymentToken") as Address;
      const zeroAddress = "0x0000000000000000000000000000000000000000";
      if (!paymentToken) return <div className="text-center">-</div>;

      const link =
        paymentToken === zeroAddress
          ? "https://polygon.technology/pol-token"
          : `https://amoy.polygonscan.com/address/${paymentToken}`;

      const { data: name, error } = useGetTokenName(paymentTokenAddress);

      let tokenName = name;
      if (error) {
        tokenName = "POL";
      }

      return (
        <div className="text-center">
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline"
          >
            {tokenName}
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
      const payment = row.original;

      return (
        <DecisionWindowCell
          paidAtTimestamp={row.getValue("paidAt")}
          status={payment.status}
          source={payment.source}
          cancelAt={payment.cancelAt}
        />
      );
    },
  },
  {
    accessorKey: "status",
    header: () => <div className="text-center">State</div>,
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return <div className="text-center capitalize">{status}</div>;
    },
  },
  {
    accessorKey: "price",
    header: () => <div className="text-center">Amount</div>,
    cell: ({ row }) => {
      const price = row.getValue("price");
      const source = row.original.source?.toLowerCase();

      const orderCost =
        source !== "simple"
          ? `$${(Number(price) / 1e8).toFixed(2)}`
          : `${price} POL`;

      return <div className="text-center">{orderCost}</div>;
    },
  },
];

export default baseColumns;
