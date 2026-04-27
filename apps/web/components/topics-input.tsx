"use client";

import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TopicsInputProps = {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  max?: number;
};

export function TopicsInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Add a topic and press Enter",
  max = 10,
}: TopicsInputProps) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const topic = raw.trim();
    if (!topic) return;
    if (value.includes(topic)) {
      setDraft("");
      return;
    }
    if (value.length >= max) return;
    onChange([...value, topic]);
    setDraft("");
  };

  const remove = (topic: string) => {
    onChange(value.filter((t) => t !== topic));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && draft.length === 0 && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  const remainingSuggestions = suggestions.filter((s) => !value.includes(s));

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 shadow-sm",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 focus-within:ring-offset-background",
        )}
      >
        {value.map((topic) => (
          <span
            key={topic}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {topic}
            <button
              type="button"
              onClick={() => remove(topic)}
              className="rounded-sm p-0.5 hover:bg-primary/20"
              aria-label={`Remove ${topic}`}
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="h-7 flex-1 border-0 bg-transparent p-0 px-1 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          aria-label="Add a topic"
        />
      </div>

      {remainingSuggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Try:</span>
          {remainingSuggestions.slice(0, 6).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => add(suggestion)}
              className="rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
