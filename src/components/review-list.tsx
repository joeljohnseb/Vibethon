import { Star } from "lucide-react";
import { Card, EmptyState, StarRow, Stars } from "./ui";
import { ReportReviewButton } from "./review-forms";
import { fmtDate } from "@/lib/time";

type R = { id: string; rating: number; comment: string; createdAt: Date; authorName: string; bookingRef: string; chargerTitle?: string | null };

export function ReviewList({ reviews, empty, reportable }: { reviews: R[]; empty: string; reportable?: boolean }) {
  if (!reviews.length) return <EmptyState icon={<Star />} title={empty} body="Reviews open once a session is completed and paid." />;
  const avg = reviews.reduce((a, r) => a + r.rating, 0) / reviews.length;
  return (
    <div>
      <div className="mb-4"><Stars value={Math.round(avg * 10) / 10} count={reviews.length} size={18} /></div>
      <div className="space-y-3">
        {reviews.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm"><span className="font-medium">{r.authorName}</span> <span className="text-faint">· {r.bookingRef}{r.chargerTitle ? ` · ${r.chargerTitle}` : ""} · {fmtDate(r.createdAt)}</span></div>
              <StarRow rating={r.rating} />
            </div>
            {r.comment && <p className="mt-2 text-sm text-muted">{r.comment}</p>}
            {reportable && <ReportReviewButton reviewId={r.id} />}
          </Card>
        ))}
      </div>
    </div>
  );
}
