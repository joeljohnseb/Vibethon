import { Prose } from "@/components/prose";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Privacy policy" };

export default function Privacy() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Legal" title="Privacy policy" subtitle="Template policy for the Eber MVP — review for DPDP Act compliance before launch." />
      <Prose>
        <h2>What we collect</h2>
        <ul>
          <li>Account data: name, email, phone number, sign-in identities (Google, email, phone).</li>
          <li>Vehicle data: make/model, battery capacity, supported connectors.</li>
          <li>Listing data (hosts): address, coordinates, photos, availability and pricing.</li>
          <li>Booking and session data: times, battery percentages, invoices, payment status.</li>
          <li>Location: only when you tap “Near me”, used to search and not stored.</li>
        </ul>
        <h2>How we use it</h2>
        <p>To run bookings and charging sessions, calculate bills, process payments through our payment partner, send notifications, prevent fraud, and resolve disputes.</p>
        <h2>What others see</h2>
        <ul>
          <li>Before confirmation, drivers see a listing&apos;s approximate area (about 600 m), locality and the host&apos;s first name.</li>
          <li>After confirmation, the driver sees the exact address and access instructions; both parties see each other&apos;s phone number.</li>
          <li>Reviews show the reviewer&apos;s first name.</li>
        </ul>
        <h2>Security</h2>
        <p>Passwords are hashed with scrypt; session tokens and verification codes are stored only as hashes. Uploaded photos are re-encoded and stripped of metadata. Card and UPI details are handled by the payment gateway, never by Eber.</p>
        <h2>Your choices</h2>
        <p>You can edit your profile and vehicles, remove listings, and request account deletion via Help.</p>
      </Prose>
    </div>
  );
}
