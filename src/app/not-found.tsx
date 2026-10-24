import { MapPinOff } from "lucide-react";
import { EmptyState, LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <EmptyState icon={<MapPinOff />} title="We couldn't find that page" body="It may have been removed, or you may not have access to it." action={<LinkButton href="/">Go home</LinkButton>} />
    </div>
  );
}
