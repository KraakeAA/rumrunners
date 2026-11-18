import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import ProfileEditor from "@/components/ProfileEditor";

export default async function ProfileEditPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  return <ProfileEditor />;
}
