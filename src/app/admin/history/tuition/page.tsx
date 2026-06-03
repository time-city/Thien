import { getAdminTuitionHistory } from "@/actions/queries";
import TuitionHistoryClient from "./TuitionHistoryClient";

export default async function TuitionHistoryPage() {
  const initialData = await getAdminTuitionHistory();

  return <TuitionHistoryClient initialData={initialData} />;
}
