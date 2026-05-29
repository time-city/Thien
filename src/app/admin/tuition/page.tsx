import { getRentalLogs, getTuitionData } from "@/lib/queries";
import TuitionClient from "@/app/admin/tuition/TuitionClient";

export default async function TuitionPage() {
  const [initialStudents, initialRentalLogs] = await Promise.all([
    getTuitionData(),
    getRentalLogs(),
  ]);

  return (
    <TuitionClient
      initialStudents={initialStudents}
      initialRentalLogs={initialRentalLogs}
    />
  );
}

