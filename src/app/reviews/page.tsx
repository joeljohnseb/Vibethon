import Link from "next/link";
import { requireUserPage } from "@/lib/auth/session";
import { reviewsAbout, reviewsBy } from "@/lib/services/reviews";
import { ReviewList } from "@/components/review-list";
import { Card, PageHeader, StarRow, Tabs } from "@/components/ui";
import { fmtDate } from "@/lib/time";

export const metadata = { title: "Reviews" };

export default async function Reviews({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUserPage("/reviews");
  const tab = (await searchParams).tab ?? "driver";
  const [asDriver, asHost, written] = await Promise.all([reviewsAbout(user.id, "giver_to_taker"), reviewsAbout(user.id, "taker_to_giver"), reviewsBy(user.id)]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader title="Reviews & ratings" subtitle="Ratings you've received and reviews you've written." />
      <Tabs
        active={tab}
        tabs={[
          { key: "driver", label: "As a driver", href: "/reviews?tab=driver", count: asDriver.length },
          { key: "host", label: "As a host", href: "/reviews?tab=host", count: asHost.length },
          { key: "written", label: "Written by you", href: "/reviews?tab=written", count: written.length },
        ]}
      />
      {tab === "driver" && <ReviewList reviews={asDriver} empty="No reviews from hosts yet" reportable />}
      {tab === "host" && <ReviewList reviews={asHost} empty="No reviews from drivers yet" reportable />}
      {tab === "written" &&
        (written.length === 0 ? (
          <p className="text-sm text-faint">You haven&apos;t written any reviews yet.</p>
        ) : (
          <div className="space-y-3">
            {written.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    About <span className="font-medium">{r.subjectName}</span> <span className="text-faint">· {r.direction === "taker_to_giver" ? "host" : "driver"} · <Link href={`/bookings/${r.bookingId}`} className="hover:text-volt">{r.bookingRef}</Link> · {fmtDate(r.createdAt)}</span>
                  </div>
                  <StarRow rating={r.rating} />
                </div>
                {r.comment && <p className="mt-2 text-sm text-muted">{r.comment}</p>}
              </Card>
            ))}
          </div>
        ))}
    </div>
  );
}
