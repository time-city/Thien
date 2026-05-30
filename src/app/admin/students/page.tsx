import { getStudentsDetailed, getAllClasses } from "@/actions/queries";
import StudentsClient from "./StudentsClient";
import AppLayout from "@/components/AppLayout";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Quản lý Học sinh",
};

export default async function StudentsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [initialStudents, classes] = await Promise.all([
    getStudentsDetailed(),
    getAllClasses()
  ]);

  return (
    
      <StudentsClient initialStudents={initialStudents} classes={classes} />
  
  );
}