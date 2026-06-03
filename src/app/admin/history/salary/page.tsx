import { getAdminSalaryHistory } from "@/actions/queries";
import SalaryHistoryAdminClient from "./SalaryHistoryAdminClient";

export default async function SalaryHistoryPage() {
  const initialData = await getAdminSalaryHistory();

  return <SalaryHistoryAdminClient initialData={initialData} />;
}
