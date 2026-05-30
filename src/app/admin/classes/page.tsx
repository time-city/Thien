import { getAllClasses, getAllSubjects, getTeachers } from "@/actions/queries";
import ClassesClient from "./ClassesClient";

export default async function ClassesPage() {
  const [classes, subjects, teachers] = await Promise.all([
    getAllClasses(),
    getAllSubjects(),
    getTeachers(),
  ]);

  return (
    <ClassesClient
      initialClasses={classes}
      subjects={subjects}
      teachers={teachers.map((t) => ({ id: t.id, fullName: t.fullName }))}
    />
  );
}

