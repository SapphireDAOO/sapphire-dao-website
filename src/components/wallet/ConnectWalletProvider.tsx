"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BaseError } from "viem";
import { useConnect, type Connector } from "wagmi";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOrderedWallets, type WalletOption } from "@/hooks/useOrderedWallets";
import { isUserRejection } from "@/lib/walletErrors";
import { cn } from "@/lib/utils";

type ConnectWalletContextValue = { openConnectModal: () => void };

type ConnectorOption = Extract<WalletOption, { kind: "connector" }>;

const ConnectWalletContext = createContext<ConnectWalletContextValue | null>(
  null,
);

const describe = (error: Error) =>
  error instanceof BaseError ? error.shortMessage : error.message;

const rowClass =
  "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const WalletIcon = ({ option }: { option: WalletOption }) =>
  option.icon ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={option.icon}
      alt=""
      width={32}
      height={32}
      className="h-8 w-8 rounded-md"
    />
  ) : (
    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground">
      {option.name.charAt(0)}
    </span>
  );

const WalletBadge = ({ option }: { option: WalletOption }) =>
  option.recent || option.installed ? (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs",
        option.recent
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground",
      )}
    >
      {option.recent ? "Recent" : "Installed"}
    </span>
  ) : null;

// Rows stay enabled while connecting: a wallet prompt closed without an answer
// can leave the attempt pending, and picking again must still work.
const WalletRow = ({
  option,
  pending,
  onSelect,
}: {
  option: WalletOption;
  pending: boolean;
  onSelect: (option: ConnectorOption) => void;
}) => {
  const content = (
    <>
      <WalletIcon option={option} />
      <span className="flex-1 font-medium">{option.name}</span>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <WalletBadge option={option} />
      )}
    </>
  );
  if (option.kind === "link") {
    return (
      <a href={option.href} className={rowClass}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={() => onSelect(option)} className={rowClass}>
      {content}
    </button>
  );
};

/** Opens a wallet app from a tap once WalletConnect has its link ready. */
const OpenWalletApp = ({
  option,
  uri,
  onBack,
}: {
  option: ConnectorOption;
  uri?: string;
  onBack: () => void;
}) => (
  <div className="flex flex-col items-center gap-4 text-center">
    <WalletIcon option={option} />
    <p className="text-sm text-muted-foreground">
      Open {option.name}, approve the connection, then come back to this tab.
    </p>
    {uri && option.appLink ? (
      <Button asChild className="w-full">
        <a href={option.appLink(uri)}>Open {option.name}</a>
      </Button>
    ) : (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Getting {option.name} ready…
      </p>
    )}
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="h-4 w-4" />
      Other wallets
    </button>
  </div>
);

const ConnectWalletProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [appWallet, setAppWallet] = useState<{
    option: ConnectorOption;
    uri?: string;
  } | null>(null);
  const stopListening = useRef<(() => void) | null>(null);
  const wallets = useOrderedWallets();
  const { mutate: connect, isPending, variables, error, reset } = useConnect();

  const leaveAppWallet = useCallback(() => {
    stopListening.current?.();
    stopListening.current = null;
    setAppWallet(null);
  }, []);

  useEffect(() => leaveAppWallet, [leaveAppWallet]);

  const openConnectModal = useCallback(() => {
    reset();
    leaveAppWallet();
    setOpen(true);
  }, [reset, leaveAppWallet]);

  const close = () => {
    setOpen(false);
    leaveAppWallet();
  };

  // The URI arrives once the relay has the pairing.
  const listenForUri = (connector: Connector) => {
    stopListening.current?.();
    const onMessage = ({ type, data }: { type: string; data?: unknown }) => {
      if (type !== "display_uri" || typeof data !== "string") return;
      setAppWallet((current) =>
        current?.option.connector === connector
          ? { ...current, uri: data }
          : current,
      );
    };
    connector.emitter.on("message", onMessage);
    stopListening.current = () => connector.emitter.off("message", onMessage);
  };

  const select = (option: ConnectorOption) => {
    if (option.appLink) {
      setAppWallet({ option });
      listenForUri(option.connector);
    } else if (!option.installed) {
      // WalletConnect and MetaMask's app show their own QR code or app prompt.
      setOpen(false);
    }
    connect({ connector: option.connector }, { onSuccess: close });
  };

  const value = useMemo(() => ({ openConnectModal }), [openConnectModal]);
  const pendingConnector = isPending ? variables?.connector : undefined;
  const failure = error && !isUserRejection(error) ? describe(error) : null;

  return (
    <ConnectWalletContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {appWallet ? `Connect ${appWallet.option.name}` : "Connect a wallet"}
            </DialogTitle>
            <DialogDescription>
              Connecting only lets this site see your address and balance.
            </DialogDescription>
          </DialogHeader>
          {appWallet ? (
            <OpenWalletApp
              option={appWallet.option}
              uri={appWallet.uri}
              onBack={leaveAppWallet}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {wallets.map((option) => (
                <WalletRow
                  key={option.key}
                  option={option}
                  pending={
                    option.kind === "connector" &&
                    pendingConnector === option.connector
                  }
                  onSelect={select}
                />
              ))}
            </div>
          )}
          {failure && <p className="text-sm text-destructive">{failure}</p>}
        </DialogContent>
      </Dialog>
    </ConnectWalletContext.Provider>
  );
};

export const useConnectWalletModal = () => {
  const value = useContext(ConnectWalletContext);
  if (!value) {
    throw new Error(
      "useConnectWalletModal must be used within ConnectWalletProvider",
    );
  }
  return value;
};

export default ConnectWalletProvider;
