import SimplePage from "@/components/SimplePage";

// Put a real contact email between the quote marks to show it on this page.
const CONTACT_EMAIL = "";

export default function Contact() {
  return (
    <SimplePage title="Contact">
      <p style={{ marginTop: 0 }}>
        Already playing? Open the Help Desk inside the game and send a ticket. The staff will reply there.
      </p>
      {CONTACT_EMAIL ? (
        <p>
          Locked out of your account? Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#e4c04d" }}>
            {CONTACT_EMAIL}
          </a>{" "}
          with your username.
        </p>
      ) : (
        <p>Contact details for locked-out players will be added here soon.</p>
      )}
    </SimplePage>
  );
}
