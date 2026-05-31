"use server";

import { fetchClassDetailsForView } from "@/actions/queries";

export async function viewClassDetails(classId: string) {
  return await fetchClassDetailsForView(classId);
}

