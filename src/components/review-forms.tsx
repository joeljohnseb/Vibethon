"use client";

import { useState } from "react";
import { Flag, Star } from "lucide-react";
import { ActionForm, FieldError, SubmitButton } from "./action-form";
import { inputClass } from "./ui";
import { cn } from "@/lib/utils";
import { reportReviewAction, reviewAction } from "@/app/actions/bookings";

export function ReviewForm({ bookingId, subject }: { bookingId: string; subject: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  return (
    <ActionForm action={reviewAction} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="rating" value={rating || ""} />
      <div>
        <div className="mb-1.5 text-sm font-medium">How was {subject}?</div>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={rating === i}
              aria-label={`${i} star${i > 1 ? "s" : ""}`}
              onMouseEnter={() => setHover(i)}
              onClick={() => setRating(i)}
              className="p-1"
            >
              <Star size={30} className={cn("transition", i <= (hover || rating) ? "fill-warn text-warn" : "text-line-strong")} />
            </button>
          ))}
        </div>
        <FieldError name="rating" />
      </div>
      <textarea name="comment" rows={3} maxLength={1000} placeholder="Share a few words (optional)" className={cn(inputClass, "h-auto py-2.5")} />
      <SubmitButton disabled={!rating} pendingText="Posting…">Post review</SubmitButton>
    </ActionForm>
  );
}

export function ReportReviewButton({ reviewId }: { reviewId: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return <p className="mt-2 text-xs text-faint">Reported — thanks.</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 flex items-center gap-1 text-xs text-faint hover:text-danger">
        <Flag size={12} /> Report
      </button>
    );
  return (
    <ActionForm action={reportReviewAction} className="mt-3 flex flex-col gap-2 sm:flex-row" onSuccess={() => setDone(true)}>
      <input type="hidden" name="reviewId" value={reviewId} />
      <input name="reason" placeholder="What's inappropriate about this review?" className={cn(inputClass, "h-9 text-sm")} />
      <div className="flex gap-2">
        <SubmitButton size="sm" variant="danger">Report</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted">Cancel</button>
      </div>
    </ActionForm>
  );
}
