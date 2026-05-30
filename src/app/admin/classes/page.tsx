import { getAllClasses, getAllSubjects } from "@/actions/queries";
import ClassesClient from "./ClassesClient";

export default async function ClassesPage() {
  const [classes, subjects] = await Promise.all([
    getAllClasses(),
    getAllSubjects(),
  ]);

  return <ClassesClient initialClasses={classes} subjects={subjects} />;
}
