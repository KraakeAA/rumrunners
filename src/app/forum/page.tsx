import { redirect } from "next/navigation";

// The forums now live inside the game, so the old standalone page just sends
// you there.
export default function ForumPage() {
  redirect("/?go=Forums");
}
