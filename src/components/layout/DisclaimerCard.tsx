"use client";

import * as React from "react";
import { ShieldAlert, ChevronDown } from "lucide-react";
import { DISCLAIMER_PARAGRAPHS } from "@/lib/disclaimer";
import { cn } from "@/lib/utils";

export function DisclaimerCard() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-lg border border-caution/30 bg-caution/5">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <ShieldAlert className="size-5 shrink-0 text-caution" />
        <span className="flex-1 text-sm font-medium text-foreground">
          Educational tool — not investment advice. Read the full disclaimer.
        </span>
        <ChevronDown
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="space-y-2 px-4 pb-4 pl-12 text-sm text-muted-foreground">
          {DISCLAIMER_PARAGRAPHS.map((p, i) => (
            <p key={i} className="leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
