import React from "react";
import { Generation } from "../lib/api";
import Frame from "./Frame";

interface ContactSheetProps {
  generations: Generation[];
  newGenerationIds: Set<string>;
  onFrameClick: (gen: Generation) => void;
  onDelete: (id: string) => Promise<void>;
}

export default function ContactSheet({
  generations,
  newGenerationIds,
  onFrameClick,
  onDelete,
}: ContactSheetProps) {
  if (generations.length === 0) {
    return (
      <div className="w-full py-24 flex flex-col items-center justify-center border border-dashed border-slate bg-fog/20 text-center px-4 rounded-[4px]">
        <h3 className="font-serif text-lg md:text-xl text-ink font-bold mb-2">
          Darkroom Empty
        </h3>
        <p className="font-mono text-xs text-silver tracking-wider max-w-sm">
          Your first exposure is one prompt away. Select your configuration and expose a frame.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Contact Sheet Placard Header */}
      <div className="flex justify-between items-end border-b border-slate pb-2">
        <h2 className="font-serif text-base md:text-lg text-ink font-bold tracking-wider uppercase">
          Contact Sheet
        </h2>
        <span className="font-mono text-[10px] text-silver tracking-widest uppercase">
          {generations.length} {generations.length === 1 ? "EXPOSURE" : "EXPOSURES"} DEVELOPED
        </span>
      </div>

      {/* Modern gallery grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 bg-transparent">
        {generations.map((gen) => (
          <Frame
            key={gen.id}
            generation={gen}
            onClick={() => onFrameClick(gen)}
            onDelete={onDelete}
            isNew={newGenerationIds.has(gen.id)}
          />
        ))}
      </div>
    </div>
  );
}
