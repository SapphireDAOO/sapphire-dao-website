"use client";

import { MultiSigSigner } from "@/model/multisig";
import { Badge } from "@/components/ui/badge";

function fmt(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function SignerList({ signers, threshold }: { signers: MultiSigSigner[]; threshold: number }) {
  const active = signers.filter((s) => s.active);
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {active.length} signer{active.length !== 1 ? "s" : ""} · threshold {threshold}
      </p>
      <div className="flex flex-wrap gap-2">
        {active.map((s) => (
          <Badge key={s.id} variant="outline" className="font-mono text-xs py-1 px-2">
            <a
              href={`https://sepolia.basescan.org/address/${s.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              {fmt(s.address)}
            </a>
          </Badge>
        ))}
      </div>
    </div>
  );
}
