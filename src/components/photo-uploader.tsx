"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

export type Photo = { id: string; url: string };

export function PhotoUploader({ initial, max = 8 }: { initial: Photo[]; max?: number }) {
  const [photos, setPhotos] = useState<Photo[]>(initial);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const list = Array.from(files).slice(0, max - photos.length);
    for (const f of list) {
      if (f.size > 6 * 1024 * 1024) {
        setError(`${f.name} is larger than 6 MB`);
        continue;
      }
      setBusy((b) => b + 1);
      try {
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch("/api/uploads", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        setPhotos((p) => [...p, data as Photo]);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (input.current) input.current.value = "";
  };

  return (
    <div>
      {photos.map((p) => (
        <input key={p.id} type="hidden" name="photoIds" value={p.id} />
      ))}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((p, i) => (
          <div key={p.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="size-full object-cover" />
            {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-bg/80 px-1.5 text-[10px] font-semibold">Cover</span>}
            <button type="button" onClick={() => setPhotos((ps) => ps.filter((x) => x.id !== p.id))} className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-bg/80 text-ink hover:bg-danger" aria-label="Remove photo">
              <X size={14} />
            </button>
          </div>
        ))}
        {photos.length < max && (
          <button type="button" onClick={() => input.current?.click()} className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong text-sm text-muted hover:border-volt hover:text-volt">
            {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
            {busy ? "Uploading…" : "Add photos"}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      <p className="mt-2 text-xs text-faint">JPEG, PNG or WebP up to 6 MB. Location data (EXIF) is stripped automatically. Show the charger, the parking spot and the entrance.</p>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
