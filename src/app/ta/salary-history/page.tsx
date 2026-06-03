import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTeacherSalaryHistory } from "@/actions/queries";
import MySalaryHistoryClient from "./MySalaryHistoryClient";

export default async function TeacherSalaryHistoryPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const initialData = await getTeacherSalaryHistory(session.user.id);

  return <MySalaryHistoryClient initialData={initialData} />;
}
