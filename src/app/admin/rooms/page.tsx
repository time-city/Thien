import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getRooms } from "@/lib/queries";
import RoomsClient from "./RoomsClient";

export const metadata = {
  title: "Quản lý Phòng học",
};

export default async function RoomsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "SUPER_ADMIN") {
    return <div className="p-8 text-center text-slate-500">Không có quyền truy cập.</div>;
  }

  const rooms = await getRooms();

  return (
    <RoomsClient initialRooms={rooms} />
  );
}
