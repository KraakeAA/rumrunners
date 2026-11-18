import { redirect } from "next/navigation";

// Travel now lives inside the game so the header and location update straight away.
export default function RailwayPage() {
  redirect("/");
}
