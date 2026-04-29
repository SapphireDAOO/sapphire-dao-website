"use client";

import Container from "@/components/Container";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardHeader from "./Header";
import RecentPayment from "./IndexRecentPayment";
import { useRouter } from "next/navigation";
import { useState, useContext, useEffect } from "react";
import { ContractContext } from "@/context/contract-context";

const DashboardIndex = ({
  isMarketplaceTab,
}: {
  isMarketplaceTab: boolean;
}) => {
  const router = useRouter();
  const { setActiveEventTab } = useContext(ContractContext);
  const [activeTab, setActiveTab] = useState(
    isMarketplaceTab ? "marketplace" : "invoices",
  );

  // Sync the event watcher to the current route on mount and route changes.
  // Without this, opening /marketplace-dashboard directly leaves the simple
  // watcher active because setActiveEventTab was only fired in handleTabChange.
  useEffect(() => {
    setActiveEventTab?.(isMarketplaceTab ? "marketplace" : "simple");
  }, [isMarketplaceTab, setActiveEventTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setActiveEventTab?.(value === "marketplace" ? "marketplace" : "simple");
    if (value === "marketplace") {
      router.push("/marketplace-dashboard");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="container mx-auto">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex items-center justify-center mt-10">
          <TabsList>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="invoices">
          <Container>
            <div className="mt-8 pb-8">
              <RecentPayment
                isMarketplaceTab={false}
                enabled={activeTab === "invoices"}
              />
            </div>
          </Container>
        </TabsContent>

        <TabsContent value="marketplace">
          <Container>
            <div className="mt-8 pb-8">
              <DashboardHeader title="" rightContent="" />
              <RecentPayment
                isMarketplaceTab={true}
                enabled={activeTab === "marketplace"}
              />
            </div>
          </Container>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardIndex;
