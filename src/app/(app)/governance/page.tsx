import GovernancePage from "@/components/action-components/multisig/GovernancePage";
import ProtectedPage from "@/components/ProtectedPage";

export default function Governance() {
  return (
    <ProtectedPage allowEmergencyPauser>
      <GovernancePage />
    </ProtectedPage>
  );
}
