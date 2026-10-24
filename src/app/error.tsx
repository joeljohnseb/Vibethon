"use client";

import { AlertTriangle } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <EmptyState icon={<AlertTriangle />} title="Something went wrong" body="Please try again. If it keeps happening, contact support from the Help page." action={<Button onClick={reset}>Try again</Button>} />
    </div>
  );
}
