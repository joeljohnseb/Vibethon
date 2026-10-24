import { Prose } from "@/components/prose";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Safety" };

export default function Safety() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Safety" title="Safety guidelines" subtitle="Simple rules that keep drivers, hosts and homes safe." />
      <Prose>
        <h2>For hosts</h2>
        <ul>
          <li>Only list chargers installed by a qualified electrician on a dedicated circuit with RCD/earth-leakage protection.</li>
          <li>Never offer charging through extension cords, multi-plugs or damaged cables.</li>
          <li>Keep the charging area dry, well lit and free of trip hazards. Cables shouldn&apos;t cross footpaths.</li>
          <li>Record battery percentages from the vehicle&apos;s own display, with the driver present.</li>
          <li>Don&apos;t share access codes or the start code outside the app.</li>
        </ul>
        <h2>For drivers</h2>
        <ul>
          <li>Check the connector and cable for damage before plugging in. If anything looks wrong, don&apos;t charge — report it.</li>
          <li>Follow the host&apos;s access instructions and parking rules. Don&apos;t block gates or neighbours.</li>
          <li>Show your start code only after you&apos;ve arrived and met the host.</li>
          <li>Stop charging using the charger&apos;s controls before unplugging.</li>
        </ul>
        <h2>Privacy</h2>
        <ul>
          <li>Exact addresses are shown only to drivers with a confirmed booking.</li>
          <li>Phone numbers are shared between the two parties of a confirmed booking only.</li>
          <li>Photo location metadata is removed automatically on upload.</li>
        </ul>
        <h2>If something goes wrong</h2>
        <p>In an emergency, call <strong>112</strong>. For anything else — billing disagreements, damage, no-shows — use <a href="/help#report" className="text-volt underline">Help → Report a problem</a> with your booking reference.</p>
      </Prose>
    </div>
  );
}
