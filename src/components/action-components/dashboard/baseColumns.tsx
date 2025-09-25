/* eslint-disable react-hooks/rules-of-hooks */
"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Invoice } from "@/model/model";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Info } from "lucide-react";
import { formatAddress, timeLeft } from "@/utils";
import React from "react";
import { useGetTokenName } from "@/hooks/useGetTokenName";
import { Address } from "viem";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
        <div className="text-center w-full">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="mx-auto"
          >
            Id
            <ArrowUpDown className="ml-1 h-4 w-4" />
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      const id: string = row.getValue("id");
      if (!id) return <div className="text-center">-</div>;
      return <div className="text-center">{id}</div>;
    },
  },
  {
    accessorKey: "contract",
    header: () => {
      return (
        <div className="text-center flex items-center justify-center gap-1">
          <span>Contract</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent className="w-56 text-xs p-3">
                <p className="mb-1">
                  The address of the smart contract managing invoice and payment
                  logic.
                </p>
                <a
                  href="https://sapphiredao.gitbook.io/sapphiredao-docs/technical-docs/core-contracts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Learn more
                </a>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    cell: ({ row }) => {
      const contractAddress = row.getValue("contract");
      return (
        <div className="text-center">
          {contractAddress ? (
            <a
              href={`https://sepolia.etherscan.io/address/${contractAddress}`}
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
    header: () => {
      return (
        <div className="text-center flex items-center justify-center gap-1">
          <span>Seller</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent className="w-56 text-xs p-3">
                <p className="mb-1">
                  The address designated to receive payment for the invoice.
                </p>
                <a
                  href="https://sapphiredao.gitbook.io/sapphiredao-docs/user-docs/publish-your-docs#seller"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Learn more
                </a>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    cell: ({ row }) => {
      const payment = row.original;
      const sellersAddress = row.getValue("seller");
      return (
        <div className="text-center">
          {payment.type === "Seller" ? (
            "me"
          ) : sellersAddress ? (
            <a
              href={`https://sepolia.etherscan.io/address/${sellersAddress}`}
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
    header: () => {
      return (
        <div className="text-center flex items-center justify-center gap-1">
          <span>Buyer</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent className="w-56 text-xs p-3">
                <p className="mb-1">
                  The address responsible for making the payment.
                </p>
                <a
                  href="https://sapphiredao.gitbook.io/sapphiredao-docs/user-docs/publish-your-docs#buyer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Learn more
                </a>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    cell: ({ row }) => {
      const { type } = row.original;
      const buyersAddress = row.getValue("buyer") as string | undefined;

      if (!buyersAddress) return <div className="text-center">-</div>;

      const displayText =
        type === "Buyer" ? "me" : formatAddress(buyersAddress);

      return (
        <div className="text-center">
          <a
            href={`https://sepolia.etherscan.io/address/${buyersAddress}`}
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
    header: () => {
      return (
        <div className="text-center flex items-center justify-center gap-1">
          <span>Payment</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent className="w-56 text-xs p-3">
                <p className="mb-1">
                  The transaction hash showing when payment was sent.
                </p>
                {/* <a
                  href="https://docs.sapphiredao.xyz/docs/payment-processor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Learn more
                </a> */}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    cell: ({ row }) => {
      const paymentHash = row.getValue("paymentTxHash");

      if (!paymentHash) {
        return <div className="text-center">-</div>;
      }

      return (
        <div className="bold">
          {paymentHash ? (
            <a
              href={`https://sepolia.etherscan.io/tx/${paymentHash}`}
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
    header: () => {
      return (
        <div className="text-center flex items-center justify-center gap-1">
          <span>Payment Token</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent className="w-56 text-xs p-3">
                <p className="mb-1">
                  The asset used for payment, such as ETH or an ERC-20 token.
                </p>
                {/* <a
                  href="https://docs.sapphiredao.xyz/docs/payment-processor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Learn more
                </a> */}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    cell: ({ row }) => {
      const paymentToken = row.getValue("paymentToken") as string;
      const paymentTokenAddress = row.getValue("paymentToken") as Address;
      const zeroAddress = "0x0000000000000000000000000000000000000000";
      if (!paymentToken) return <div className="text-center">-</div>;

      const link =
        paymentToken === zeroAddress
          ? "https://polygon.technology/pol-token"
          : `https://sepolia.etherscan.io/address/${paymentToken}`;

      const { data: name, error } = useGetTokenName(paymentTokenAddress);

      let tokenName = name;
      if (error) {
        tokenName = "ETH";
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
    header: () => {
      return (
        <div className="text-center flex items-center justify-center gap-1">
          <span>Time Created</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent className="w-56 text-xs p-3">
                <p className="mb-1">
                  The moment the invoice was generated on-chain.
                </p>
                {/* <a
                  href="https://docs.sapphiredao.xyz/docs/payment-processor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Learn more
                </a> */}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    cell: ({ row }) => (
      <div className="text-center">{row.getValue("createdAt")}</div>
    ),
  },
  {
    accessorKey: "releaseHash",
    header: () => {
      return (
        <div className="text-center flex items-center justify-center gap-1">
          <span>Release</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent className="w-56 text-xs p-3">
                <p className="mb-1">
                  Either the release transaction hash or countdown to scheduled
                  release.
                </p>
                {/* <a
                  href="https://docs.sapphiredao.xyz/docs/payment-processor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Learn more
                </a> */}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    cell: ({ row }) => {
      const releaseHash = row.getValue("releaseHash");
      const status = row.original?.status; // Fetch invoice status
      const releaseAt = row.original?.releaseAt ?? null; // Ensure null safety

      // If status is RELEASED, show hash
      if (status === "RELEASED" && releaseHash) {
        return (
          <div className="text-center">
            <a
              href={`https://sepolia.etherscan.io/tx/${releaseHash}`}
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

      return <div className="text-center">-</div>;
    },
  },
  {
    accessorKey: "paidAt",
    header: () => {
      return (
        <div className="text-center flex items-center justify-center gap-1">
          <span>Decision Window</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent className="w-56 text-xs p-3">
                <p className="mb-1">
                  Time left to accept or reject an invoice.
                </p>
                {/* <a
                  href="https://docs.sapphiredao.xyz/docs/payment-processor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Learn more
                </a> */}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
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
    header: () => {
      return (
        <div className="text-center flex items-center justify-center gap-1">
          <span>State</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent className="w-56 text-xs p-3">
                <p className="mb-1">
                  The current lifecycle stage of the invoice.
                </p>
                {/* <a
                  href="https://docs.sapphiredao.xyz/docs/payment-processor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Learn more
                </a> */}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return <div className="text-center capitalize">{status}</div>;
    },
  },
  {
    accessorKey: "price",
    header: () => {
      return (
        <div className="text-center flex items-center justify-center gap-1">
          <span>Amount</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent className="w-56 text-xs p-3">
                <p className="mb-1">The payment value linked to the invoice.</p>
                {/* <a
                  href="https://docs.sapphiredao.xyz/docs/payment-processor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Learn more
                </a> */}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    cell: ({ row }) => {
      const price = row.getValue("price");
      const source = row.original.source?.toLowerCase();

      const orderCost =
        source !== "simple"
          ? `$${(Number(price) / 1e8).toFixed(2)}`
          : `${price} ETH`;

      return <div className="text-center">{orderCost}</div>;
    },
  },
];

export default baseColumns;
