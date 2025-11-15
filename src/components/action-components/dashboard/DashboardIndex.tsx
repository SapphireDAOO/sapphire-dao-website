import Container from "@/components/Container";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardHeader from "./Header";
import RecentPayment from "./IndexRecentPayment";

const DashboardIndex = () => {
  return (
    <div className="container mx-auto">
      <Tabs defaultValue="invoices">
        <div className="flex items-center justify-center mt-10">
          <TabsList>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="invoices">
          <Container>
            <div className="mt-8 pb-8">
              <RecentPayment isMarketplaceTab={false} />
            </div>
          </Container>
        </TabsContent>

        <TabsContent value="marketplace">
          <Container>
            <div className="mt-8 pb-8">
              <DashboardHeader title="" rightContent="" />
              <RecentPayment isMarketplaceTab={true} />
            </div>
          </Container>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardIndex;
