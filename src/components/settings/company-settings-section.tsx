import CompanyProfileView from "./company-profile-view";
import CompanySettingsForm from "./company-settings-form";

export default function CompanySettingsSection({ canEdit }: { canEdit: boolean }) {
  if (canEdit) {
    return <CompanySettingsForm />;
  }
  return <CompanyProfileView />;
}
