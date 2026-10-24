import { requireUserPage } from "@/lib/auth/session";
import { reviewsAbout } from "@/lib/services/reviews";
import { ReviewList } from "@/components/review-list";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Reviews received" };

export default async function HostReviews() {
  const user = await requireUserPage("/host/reviews");
  const reviews = await reviewsAbout(user.id, "taker_to_giver");
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader title="Reviews from drivers" subtitle="What drivers say about you and your chargers." />
      <ReviewList reviews={reviews} empty="No reviews yet" reportable />
    </div>
  );
}
