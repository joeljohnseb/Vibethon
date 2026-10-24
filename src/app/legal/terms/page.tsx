import { Prose } from "@/components/prose";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Terms of service" };

export default function Terms() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Legal" title="Terms of service" subtitle="Template terms for the Eber MVP — have these reviewed by counsel before launch." />
      <Prose>
        <h2>1. The service</h2>
        <p>Eber is a marketplace that connects EV owners (“drivers”) with people who make a private charger available (“hosts”). Eber is not a party to the charging arrangement and does not own or operate chargers.</p>
        <h2>2. Accounts</h2>
        <p>You must provide accurate information and keep your credentials secure. One account may act as both a driver and a host. Hosts must verify a phone number before publishing a listing.</p>
        <h2>3. Bookings & cancellations</h2>
        <p>Bookings are requests until confirmed by the host (or automatically for instant-booking listings). Each listing&apos;s cancellation policy applies. Charging cannot be cancelled once a session has started.</p>
        <h2>4. Pricing & billing</h2>
        <p>The price per kWh is fixed when a booking is made. Billable energy is estimated as the vehicle&apos;s registered battery capacity multiplied by the change in state of charge recorded by the host at the start and end of the session. This estimate may differ from energy drawn from the supply. Platform fees or taxes, if any, are shown separately before payment.</p>
        <h2>5. Payments & payouts</h2>
        <p>Payments are processed by a third-party payment gateway. A session is complete only once payment is confirmed by the gateway. Host earnings are paid out on request after confirmation of the transfer.</p>
        <h2>6. Conduct & safety</h2>
        <p>Users must follow the Safety guidelines, local laws and electricity regulations. Hosts are responsible for the safety and legality of their installations.</p>
        <h2>7. Reviews</h2>
        <p>Reviews must be honest and relate to a completed booking. Eber may remove reviews that are abusive, discriminatory or irrelevant.</p>
        <h2>8. Disputes</h2>
        <p>Report problems through Help within 7 days of a session. Eber will review the evidence from both parties and may adjust, refund or close a dispute at its discretion.</p>
        <h2>9. Liability</h2>
        <p>To the extent permitted by law, Eber is not liable for damage, loss or injury arising from a charging session between users.</p>
      </Prose>
    </div>
  );
}
