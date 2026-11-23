export type StatusTone =
  | "primary"
  | "success"
  | "warning"
  | "info"
  | "destructive"
  | "muted";

export type StatusGroup = {
  id: string;
  label: string;
  tone: StatusTone;
  /** Canonical statuses (spaces, upper case) this group covers. */
  statuses: string[];
  description: string;
};

export const ALL_GROUP_ID = "all";

export const normalizeStatus = (status?: string | null) =>
  (status ?? "").replace(/_/g, " ").toUpperCase().trim();

// Shown in its own sidebar panel rather than as a tile.
export const AWAITING_ACCEPTANCE_GROUP: StatusGroup = {
  id: "awaiting-acceptance",
  label: "Awaiting acceptance",
  tone: "warning",
  statuses: ["PAID"],
  description:
    "Paid by the buyer and waiting for the seller to accept or reject. If the seller doesn't respond in time, the buyer is refunded.",
};

export const DIRECT_GROUPS: StatusGroup[] = [
  {
    id: "awaiting-payment",
    label: "Awaiting payment",
    tone: "primary",
    statuses: ["AWAITING PAYMENT"],
    description: "Created and waiting for the buyer to pay.",
  },
  {
    id: "in-escrow",
    label: "In escrow",
    tone: "success",
    statuses: ["ACCEPTED"],
    description:
      "Accepted by the seller. The funds are held in escrow until the release time, then paid out to the seller.",
  },
  {
    id: "released",
    label: "Released",
    tone: "success",
    statuses: ["RELEASED"],
    description: "Paid out of escrow to the seller.",
  },
  {
    id: "refunded",
    label: "Refunded",
    tone: "info",
    statuses: ["REFUNDED"],
    description:
      "Returned to the buyer: the seller rejected it, or didn't respond in time.",
  },
  {
    id: "cancelled",
    label: "Cancelled",
    tone: "destructive",
    statuses: ["CANCELED"],
    description: "The seller cancelled it before anyone paid.",
  },
  {
    id: "expired",
    label: "Expired",
    tone: "muted",
    statuses: ["EXPIRED"],
    description: "Nobody paid before the payment window closed.",
  },
];

export const INTERMEDIATED_GROUPS: StatusGroup[] = [
  {
    id: "awaiting-payment",
    label: "Awaiting payment",
    tone: "primary",
    statuses: ["AWAITING PAYMENT"],
    description: "Created and waiting for the buyer to pay.",
  },
  {
    id: "in-escrow",
    label: "In escrow",
    tone: "success",
    statuses: [
      "PAID",
      "DISPUTE RESOLVED",
      "DISPUTE DISMISSED",
      "DISPUTE EXPIRED",
    ],
    description:
      "Paid and held in escrow until the release time. Includes closed disputes whose funds can now be released.",
  },
  {
    id: "in-dispute",
    label: "In dispute",
    tone: "destructive",
    statuses: ["DISPUTED"],
    description:
      "The buyer raised a dispute. The funds stay in escrow until it's decided.",
  },
  {
    id: "released",
    label: "Released",
    tone: "success",
    statuses: ["RELEASED"],
    description: "Paid out of escrow to the seller.",
  },
  {
    id: "refunded",
    label: "Refunded",
    tone: "info",
    statuses: ["REFUNDED"],
    description: "Part or all of the payment was returned to the buyer.",
  },
  {
    id: "settled",
    label: "Settled",
    tone: "info",
    statuses: ["DISPUTE SETTLED"],
    description:
      "A dispute settled by splitting the funds between buyer and seller.",
  },
  {
    id: "cancelled",
    label: "Cancelled",
    tone: "destructive",
    statuses: ["CANCELED"],
    description: "Cancelled before anyone paid.",
  },
];

export const ALL_GROUP: StatusGroup = {
  id: ALL_GROUP_ID,
  label: "All",
  tone: "muted",
  statuses: [],
  description: "",
};

export const groupsFor = (isIntermediated: boolean) =>
  isIntermediated ? INTERMEDIATED_GROUPS : DIRECT_GROUPS;

export const matchesGroup = (group: StatusGroup, status?: string | null) =>
  group.id === ALL_GROUP_ID || group.statuses.includes(normalizeStatus(status));

type StatusLook = { label: string; tone: StatusTone };

const DIRECT_STATUS_LOOK: Record<string, StatusLook> = {
  "AWAITING PAYMENT": { label: "Awaiting payment", tone: "primary" },
  PAID: { label: "Awaiting acceptance", tone: "warning" },
  ACCEPTED: { label: "In escrow", tone: "success" },
  RELEASED: { label: "Released", tone: "success" },
  REFUNDED: { label: "Refunded", tone: "info" },
  CANCELED: { label: "Cancelled", tone: "destructive" },
  EXPIRED: { label: "Expired", tone: "muted" },
};

const INTERMEDIATED_STATUS_LOOK: Record<string, StatusLook> = {
  "AWAITING PAYMENT": { label: "Awaiting payment", tone: "primary" },
  PAID: { label: "In escrow", tone: "success" },
  DISPUTED: { label: "In dispute", tone: "destructive" },
  "DISPUTE RESOLVED": { label: "Dispute resolved", tone: "warning" },
  "DISPUTE DISMISSED": { label: "Dispute dismissed", tone: "warning" },
  "DISPUTE EXPIRED": { label: "Dispute expired", tone: "warning" },
  "DISPUTE SETTLED": { label: "Settled", tone: "info" },
  RELEASED: { label: "Released", tone: "success" },
  REFUNDED: { label: "Refunded", tone: "info" },
  CANCELED: { label: "Cancelled", tone: "destructive" },
};

export const statusLook = (
  status: string,
  isIntermediated: boolean,
): StatusLook => {
  const key = normalizeStatus(status);
  const table = isIntermediated ? INTERMEDIATED_STATUS_LOOK : DIRECT_STATUS_LOOK;
  return table[key] ?? { label: key.toLowerCase() || "Unknown", tone: "muted" };
};

export const TONE_DOT: Record<StatusTone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground",
};

export const TONE_PILL: Record<StatusTone, string> = {
  primary: "border-primary/30 bg-primary/10 text-primary",
  success: "border-success/30 bg-success/10 text-success-foreground",
  warning: "border-warning/30 bg-warning/10 text-warning-foreground",
  info: "border-info/30 bg-info/10 text-info-foreground",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted text-muted-foreground",
};
