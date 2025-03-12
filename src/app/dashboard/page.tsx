import RecentPayment from "@/components/action-components/dashboard/recent-payment";
import DashboardHeader from "@/components/action-components/dashboard/Header";
import Container from "@/components/Container";

export default function Dashboard() {
  return (
    <main>
      <Container>
        <DashboardHeader />
        <RecentPayment />
      </Container>
    </main>
  );
}
