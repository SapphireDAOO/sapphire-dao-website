"use client";

import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ContractActionsContext } from "@/context/contract-context";
import { PausedNotice } from "./PausedNotice";
import RecentPayment from "./IndexRecentPayment";
import { CreateInvoiceCard } from "./invoice-cards";
import { SegmentedControl } from "./DashboardOverview";

type Kind = "direct" | "intermediated";

const DashboardIndex = ({
  isIntermediatedTab,
}: {
  isIntermediatedTab: boolean;
}) => {
  const router = useRouter();
  const { watchInvoiceEvents } = useContext(ContractActionsContext);

  useEffect(
    () => watchInvoiceEvents?.(isIntermediatedTab ? "intermediated" : "simple"),
    [isIntermediatedTab, watchInvoiceEvents],
  );

  const kindSwitch = (
    <SegmentedControl<Kind>
      ariaLabel="Invoice type"
      value={isIntermediatedTab ? "intermediated" : "direct"}
      onChange={(kind) =>
        router.push(
          kind === "intermediated" ? "/intermediated-dashboard" : "/dashboard",
        )
      }
      options={[
        { value: "direct", label: "Direct invoices" },
        { value: "intermediated", label: "Intermediated platforms" },
      ]}
    />
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <RecentPayment
        isIntermediatedTab={isIntermediatedTab}
        kindSwitch={kindSwitch}
        primaryAction={isIntermediatedTab ? undefined : <CreateInvoiceCard />}
        notice={<PausedNotice />}
      />
    </div>
  );
};

export default DashboardIndex;
