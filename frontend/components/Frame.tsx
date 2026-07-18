/* eslint-disable @next/next/no-img-element */
import React from "react";
import { Download, Trash2 } from "lucide-react";
import { Generation, getImageUrl } from "../lib/api";
import FlashTransition from "./FlashTransition";

interface FrameProps {
  generation: Generation;
  onClick: () => void;
  onDelete: (id: string) => Promise<void>;
  isNew?: boolean;
}

export default function Frame({ generation, onClick, onDelete, isNew = false }: FrameProps) {
  const modelName = generation.model_id
    .replace("black-forest-labs/", "")
    .replace("-image-generation", "")
    .replace("-image", "")
    .toUpperCase();

  const formattedFrame = String(generation.frame_number).padStart(3, "0");
  
  const timeStr = new Date(generation.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening lightbox
    try {
      const url = getImageUrl(generation.id);
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `aperture-exposure-${formattedFrame}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Failed to download image", err);
    }
  };

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening lightbox
    if (confirm(`Discard this exposure (No. ${formattedFrame})?`)) {
      await onDelete(generation.id);
    }
  };

  const imgContent = (
    <div className="aspect-square w-full bg-void flex items-center justify-center overflow-hidden border-b border-slate group-hover:border-silver transition-colors duration-200">
      <img
        src={getImageUrl(generation.id)}
        alt={generation.prompt}
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103"
      />
    </div>
  );

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="group flex flex-col bg-fog border border-slate hover:border-silver transition-colors duration-200 cursor-pointer overflow-hidden outline-none"
    >
      <div className="w-full aspect-square relative">
        {isNew ? (
          <FlashTransition>{imgContent}</FlashTransition>
        ) : (
          imgContent
        )}

        {/* Hover Action Overlay */}
        <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex gap-2 z-10">
          <button
            onClick={handleDownload}
            title="Download Exposure"
            className="w-8 h-8 rounded-full bg-void/90 border border-slate hover:border-silver text-silver hover:text-ink flex items-center justify-center transition-all duration-150 cursor-pointer hover:scale-105 focus:outline-none shadow-lg"
          >
            <Download size={14} />
          </button>
          <button
            onClick={handleDeleteClick}
            title="Discard Exposure"
            className="w-8 h-8 rounded-full bg-void/90 border border-slate hover:border-red-500/50 text-silver hover:text-red-500 flex items-center justify-center transition-all duration-150 cursor-pointer hover:scale-105 focus:outline-none shadow-lg"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      
      {/* Technical EXIF-like Footer */}
      <div className="p-3 flex flex-col gap-1 font-mono text-[10px]">
        <div className="flex justify-between items-center">
          <span className="text-ink font-semibold">No. {formattedFrame}</span>
          <span className="text-silver uppercase tracking-wider">{modelName}</span>
        </div>
        <div className="flex justify-between text-silver/60">
          <span>{generation.aspect_ratio}</span>
          <span>{timeStr}</span>
        </div>
      </div>
    </div>
  );
}
