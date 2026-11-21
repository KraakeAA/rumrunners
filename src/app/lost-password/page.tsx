import Link from "next/link";
import SimplePage from "@/components/SimplePage";

export default function LostPassword() {
  return (
    <SimplePage title="Lost Password">
      <p style={{ marginTop: 0 }}>
        Automatic password reset by email is not switched on yet, so we cannot send you a reset link.
      </p>
      <p>
        If you are locked out, please <Link href="/contact" style={{ color: "#e4c04d" }}>contact us</Link> with
        your username and we will help you back in.
      </p>
    </SimplePage>
  );
}
