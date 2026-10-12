"use client";

import Container from "@/components/Container";
import { PausedNotice } from "./PausedNotice";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardHeader from "./Header";
import RecentPayment from "./IndexRecentPayment";
import { useRouter } from "next/navigation";
import { useState, useContext, useEffect } from "react";
import { ContractActionsContext } from "@/context/contract-context";

const DashboardIndex = ({
  isIntermediatedTab,
}: {
  isIntermediatedTab: boolean;
}) => {
  const router = useRouter();
  const { watchInvoiceEvents } = useContext(ContractActionsContext);
  const [activeTab, setActiveTab] = useState(
    isIntermediatedTab ? "intermediated" : "invoices",
  );

  useEffect(
    () =>
      watchInvoiceEvents?.(
        activeTab === "intermediated" ? "intermediated" : "simple",
      ),
    [activeTab, watchInvoiceEvents],
  );

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "intermediated") {
      router.push("/intermediated-dashboard");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="container mx-auto">
      <Container>
        <PausedNotice />
      </Container>

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
