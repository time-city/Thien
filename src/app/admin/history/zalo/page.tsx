import { getZaloMessageLogs } from "@/actions/zalo";
import ZaloLogClient from "./ZaloLogClient";

export default async function ZaloLogPage() {
  const data = await getZaloMessageLogs({ page: 1, pageSize: 30 });
  return <ZaloLogClient initialData={data} />;
}
