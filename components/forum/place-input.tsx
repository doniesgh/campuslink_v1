"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { searchPlaces, type Place } from "@/lib/forum/geo";
import { S } from "@/lib/forum/strings";
import { fieldIcon } from "@/lib/forum/ui";
import { CheckCircleIcon } from "./icons";

interface Props {
  id: string;
  value: string;
  place: Place | null;
  icon: ReactNode;
  onText: (t: string) => void;
  onPlace: (p: Place | null) => void;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
}

/** Champ lieu avec suggestions. On peut aussi taper un lieu libre : il n'aura alors pas de carte. */
export function PlaceInput({ id, value, place, icon, onText, onPlace, ...aria }: Props) {
  const listId = useId();
  const typed = useRef(false); // true seulement quand l'utilisateur tape (pas quand on remplit après un choix)
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "empty" | "error">("idle");
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (!typed.current) return;
    const q = value.trim();
    if (q.length < 3) {
      setResults([]);
      setState("idle");
      return;
    }
    const ctrl = new AbortController();
    setState("loading");
    const t = setTimeout(() => {
      searchPlaces(q, ctrl.signal)
        .then((r) => {
          setResults(r);
          setActive(-1);
          setState(r.length ? "idle" : "empty");
          setOpen(true);
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setState("error");
        });
    }, 600); // Nominatim limite à 1 requête par seconde
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  function choose(p: Place) {
    typed.current = false;
    onText(p.label);
    onPlace(p);
    setOpen(false);
    setResults([]);
    setState("idle");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || !results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      const p = results[active];
      if (p) choose(p);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && (state !== "idle" || results.length > 0);

  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 [&>svg]:size-[18px]">{icon}</span>
      <input
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className={`${fieldIcon.replace("pr-3.5", "pr-10")} w-full`}
        value={value}
        onChange={(e) => {
          typed.current = true;
          onText(e.target.value);
          if (place) onPlace(null); // le texte a changé : les coordonnées ne sont plus valables
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setOpen(false)}
        {...aria}
      />
      {place && (
        <span title={S.located} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 [&>svg]:size-5">
          <CheckCircleIcon />
        </span>
      )}
      {showList && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-12 z-20 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white py-1 text-sm text-slate-800 shadow-lg">
          {state === "loading" && <li role="presentation" className="px-3 py-2 text-slate-500">{S.searchingPlaces}</li>}
          {state === "empty" && <li role="presentation" className="px-3 py-2 text-slate-500">{S.noPlaces}</li>}
          {state === "error" && <li role="presentation" className="px-3 py-2 text-slate-500">{S.placesUnavailable}</li>}
          {results.map((p, i) => (
            <li
              key={`${p.lat},${p.lng}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault(); // garde le focus pour que le blur ne ferme pas la liste avant le clic
                choose(p);
              }}
              className={`cursor-pointer px-3 py-2 ${i === active ? "bg-[#eff4ff] text-blue-900" : "hover:bg-blue-50"}`}
            >
              {p.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
