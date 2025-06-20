import Container from "@/components/Container";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardHeader from "./Header";
import RecentPayment from "./IndexRecentPayment";
import CreateInvoiceDialog from "./invoices-components/create-invoice";

const DashboardIndex = () => {
  return (
    <div className="container mx-auto">
      <Tabs defaultValue="invoices">
        <div className="flex items-center justify-center mt-10">
          <TabsList>
            <TabsTrigger value="invoices" >Invoices</TabsTrigger>
            <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="invoices">
          <Container>
            <DashboardHeader
              title="INVOICES"
              rightContent={<CreateInvoiceDialog />}
            />
            <RecentPayment isMarketplaceTab={false} />
          </Container>
        </TabsContent>
        <TabsContent value="marketplace">
          <Container>
            <DashboardHeader title="MARKETPLACE" rightContent={""} />
            <RecentPayment isMarketplaceTab={true} />
          </Container>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardIndex;
