"use client";

import { useRef, useState, type DragEvent } from "react";
import { errorMessage } from "@/lib/forum/bff";
import { ACCEPT, MAX_IMAGES, fileToDataUrl } from "@/lib/forum/images";
import { S } from "@/lib/forum/strings";
import { CloseIcon, IconCircle, ImageIcon } from "./icons";

/** Choix des photos du post : bouton ou glisser-déposer, aperçu, suppression. La première photo est la couverture. */
export function ImagePicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const room = MAX_IMAGES - value.length;

  async function add(files: File[]) {
    if (!files.length || busy) return;
    setError("");
    if (files.length > room) setError(S.photoLimit(MAX_IMAGES));
    setBusy(true);
    const next = [...value];
    for (const f of files.slice(0, room)) {
      try {
        next.push(await fileToDataUrl(f));
      } catch (e) {
        setError(errorMessage(e));
      }
    }
    onChange(next);
    setBusy(false);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setOver(false);
    void add(Array.from(e.dataTransfer.files));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{S.photos} <span className="font-normal text-muted-foreground">({S.optional.toLowerCase()})</span></p>
        <span className="text-xs text-muted-foreground" aria-live="polite">{value.length}/{MAX_IMAGES}</span>
      </div>

      {value.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {value.map((src, i) => (
            <li key={i} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-full object-cover" />
              {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">{S.photoCover}</span>}
              <button
                type="button"
                aria-label={`${S.removePhoto} ${i + 1}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CloseIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {room > 0 && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed px-4 py-4 transition-colors focus-within:ring-2 focus-within:ring-ring ${over ? "border-primary bg-primary/5" : "border-input hover:bg-accent"}`}
        >
          <IconCircle tone="soft" size="lg"><ImageIcon /></IconCircle>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{busy ? S.photoProcessing : S.addPhotos}</span>
            <span className="block text-xs text-muted-foreground">{S.photosHint}</span>
          </span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []); // copie avant de vider le champ
              e.target.value = "";
              void add(files);
            }}
          />
        </label>
      )}

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
