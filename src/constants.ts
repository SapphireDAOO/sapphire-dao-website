import { ErrorMessages } from "./model/model";
import type { Address } from "viem";
import { polygonAmoy } from "wagmi/chains";

export const POLYGON = 137;
export const POLYGON_AMOY = 80_002;

export const INVOICE_ADDRESS: Record<number, Address> = {
  [polygonAmoy.id]: "0xe067ec2b51f1d623824089b81c54a2097e38880c",
};

export const THE_GRAPH_API_URL: Record<number, string> = {
  [polygonAmoy.id]:
    "https://api.studio.thegraph.com/query/100227/payment-processor-test-v1/version/latest",
};

export const errorMessages: ErrorMessages = {
  "0x5033f274":
    "ValueIsTooLow: The provided value is lower than the required minimum.",
  "0x90b8ec18": "TransferFailed: A fund transfer failed.",
  "0xe24b09f6":
    "InvoiceNotPaid: An action is attempted on an invoice that has not been paid.",
  "0x3c6690e6":
    "ExcessivePayment: The payment amount exceeds the required invoice amount.",
  "0x2bc29bcc": "FeeValueCanNotBeZero: The fee value provided is zero.",
  "0x705a7153":
    "HoldPeriodCanNotBeZero: The hold period provided is zero, which is invalid.",
  "0xaba23e24":
    "ZeroAddressIsNotAllowed: A zero address (`address(0)`) is provided.",
  "0xe92fb4ef":
    "InvoicePriceIsTooLow: The invoice price is below the allowed minimum.",
  "0x1d5b1556":
    "InvalidInvoiceState(uint256): The invoice is in an invalid state for the requested action.",
  "0xff42dbfc":
    "InvoiceIsNoLongerValid: The invoice is no longer valid (e.g., cancelled or expired).",
  "0x322be652":
    "InvoiceAlreadyPaid: An invoice that has already been fully paid is attempted to be paid again.",
  "0x715d9228":
    "InvoiceDoesNotExist: An action is attempted on a non-existent invoice.",
  "0x2b8af0bb":
    "AcceptanceWindowExceeded: The creator attempts to take action on an invoice after the acceptance window has expired.",
  "0xd5fd807b":
    "CreatorCannotPayOwnedInvoice: The creator of an invoice attempts to pay for their own invoice.",
  "0xbb126ff1":
    "InvoiceNotEligibleForRefund: The invoice is not eligible for a refund to the creator.",
  "0xad2652ac":
    "HoldPeriodHasNotBeenExceeded: The hold period for an invoice has not yet been exceeded.",
  "0x80e5b116":
    "HoldPeriodShouldBeGreaterThanDefault: A custom hold period is less than the default hold period.",
  "0xbd798a2d":
    "InvoiceHasAlreadyBeenReleased: An attempt is made to release an invoice that has already been released.",
  "0x82b42900":
    "Unauthorized: An unauthorized address attempts to perform a restricted action.",
};
