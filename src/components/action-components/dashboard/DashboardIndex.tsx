"use client";

import Container from "@/components/Container";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardHeader from "./Header";
import RecentPayment from "./IndexRecentPayment";
import { useRouter } from "next/navigation";
import { useState, useContext, useEffect } from "react";
import { ContractContext } from "@/context/contract-context";

const DashboardIndex = ({
  isIntermediatedTab,
}: {
  isIntermediatedTab: boolean;
}) => {
  const router = useRouter();
  const { setActiveEventTab } = useContext(ContractContext);
  const [activeTab, setActiveTab] = useState(
    isIntermediatedTab ? "intermediated" : "invoices",
  );

  // Sync the event watcher to the current route on mount and route changes.
  // Without this, opening /intermediated-dashboard directly leaves the simple
  // watcher active because setActiveEventTab was only fired in handleTabChange.
  useEffect(() => {
    setActiveEventTab?.(isIntermediatedTab ? "intermediated" : "simple");
  }, [isIntermediatedTab, setActiveEventTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setActiveEventTab?.(value === "intermediated" ? "intermediated" : "simple");
    if (value === "intermediated") {
      router.push("/intermediated-dashboard");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="container mx-auto">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex items-center justify-center mt-10">
          <TabsList>
            <TabsTrigger value="invoices">Direct Invoices</TabsTrigger>
            <TabsTrigger value="intermediated">Intermediated Platforms</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="invoices">
          <Container>
            <div className="mt-8 pb-8">
              <RecentPayment
                isIntermediatedTab={false}
                enabled={activeTab === "invoices"}
              />
            </div>
          </Container>
        </TabsContent>

        <TabsContent value="intermediated">
          <Container>
            <div className="mt-8 pb-8">
              <DashboardHeader title="" rightContent="" />
              <RecentPayment
                isIntermediatedTab={true}
                enabled={activeTab === "intermediated"}
              />
            </div>
          </Container>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardIndex;
