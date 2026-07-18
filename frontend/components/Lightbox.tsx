import React, { useEffect, useRef } from "react";
import { Generation, getImageUrl } from "../lib/api";
import { X, ArrowLeft, ArrowRight, Download, Trash2 } from "lucide-react";

interface LightboxProps {
  isOpen: boolean;
  activeGen: Generation | null;
  generations: Generation[];
  onClose: () => void;
  onChangeActive: (gen: Generation) => void;
  onDelete?: (id: string) => void;
}

export default function Lightbox({
  isOpen,
  activeGen,
  generations,
  onClose,
  onChangeActive,
  onDelete,
}: LightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && activeGen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen, activeGen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || !activeGen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = generations.findIndex((g) => g.id === activeGen.id);
      if (currentIndex === -1) return;

      if (e.key === "ArrowLeft") {
        if (currentIndex > 0) {
          onChangeActive(generations[currentIndex - 1]);
        }
      } else if (e.key === "ArrowRight") {
        if (currentIndex < generations.length - 1) {
          onChangeActive(generations[currentIndex + 1]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activeGen, generations, onChangeActive]);

  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (e.target !== dialog) return;

    const rect = dialog.getBoundingClientRect();
    const isInside =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;

    if (!isInside) {
      onClose();
    }
  };

  if (!activeGen) return null;

  const currentIndex = generations.findIndex((g) => g.id === activeGen.id);
  const hasNewer = currentIndex > 0;
  const hasOlder = currentIndex < generations.length - 1;

  const dateStr = new Date(activeGen.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const handleDownload = async () => {
    try {
      const url = getImageUrl(activeGen.id);
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const paddedFrame = String(activeGen.frame_number).padStart(3, "0");
      a.download = `aperture-exposure-${paddedFrame}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Failed to download image", err);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleDialogClick}
      // @ts-ignore
      closedby="any"
      className="p-0 border-0 bg-transparent outline-none max-w-full max-h-full w-full h-full overflow-hidden text-ink backdrop:bg-void/95 backdrop:backdrop-blur-md open:flex open:items-center open:justify-center"
      aria-label={`Exposure Details No. ${activeGen.frame_number}`}
    >
      <div className="relative w-full h-full flex flex-col justify-between p-4 md:p-8">
        {/* Top Control Bar */}
        <div className="w-full flex items-center justify-between z-20">
          <div className="font-mono text-xs text-silver">
            EXPOSURE <span className="text-ink">No. {String(activeGen.frame_number).padStart(3, "0")}</span>
          </div>
          <div className="flex items-center gap-3">
            {onDelete && (
              <button
                onClick={() => {
                  onDelete(activeGen.id);
                  onClose();
                }}
                title="Discard Frame"
                className="p-2 text-silver hover:text-red-400 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button
              onClick={handleDownload}
              title="Download Original"
              className="p-2 text-silver hover:text-ink cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              <Download size={18} />
            </button>
            <button
              onClick={onClose}
              title="Close Viewer"
              className="p-2 text-silver hover:text-flash cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-flash"
            >
              <X size={20} className="text-flash" />
            </button>
          </div>
        </div>

        {/* Loupe Window */}
        <div className="flex-1 flex items-center justify-between gap-4 min-h-0 py-4 relative">
          <div className="hidden md:block z-10 w-12">
            {hasNewer && (
              <button
                onClick={() => onChangeActive(generations[currentIndex - 1])}
                className="w-12 h-12 flex items-center justify-center border border-slate bg-void text-silver hover:text-ink cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-ink"
                title="Newer Exposure"
              >
                <ArrowLeft size={18} />
              </button>
            )}
          </div>

          <div className="flex-1 h-full flex items-center justify-center relative overflow-hidden select-none">
            <div className="max-w-full max-h-full p-2 border border-slate/50 bg-fog">
              <img
                src={getImageUrl(activeGen.id)}
                alt={activeGen.prompt}
                className="max-h-[72vh] max-w-[85vw] object-contain block pointer-events-none"
              />
            </div>
          </div>

          <div className="hidden md:block z-10 w-12">
            {hasOlder && (
              <button
                onClick={() => onChangeActive(generations[currentIndex + 1])}
                className="w-12 h-12 flex items-center justify-center border border-slate bg-void text-silver hover:text-ink cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-ink"
                title="Older Exposure"
              >
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Metadata Overlay Bar */}
        <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-end gap-4 z-20 bg-void/80 p-4 border border-slate mt-2">
          <div className="flex-1">
            <div className="font-mono text-[10px] text-silver uppercase tracking-wider mb-1">Prompt Log</div>
            <p className="font-sans text-sm text-ink max-h-[80px] overflow-y-auto leading-relaxed pr-2">
              {activeGen.prompt}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] text-silver border-t md:border-t-0 md:border-l border-slate pt-2 md:pt-0 md:pl-6 shrink-0 min-w-[200px]">
            <div>
              <span className="text-slate-500">MODEL</span>
              <p className="text-ink uppercase">{activeGen.model_id.replace("black-forest-labs/", "")}</p>
            </div>
            <div>
              <span className="text-slate-500">ASPECT</span>
              <p className="text-ink">{activeGen.aspect_ratio}</p>
            </div>
            <div>
              <span className="text-slate-500">TIME</span>
              <p className="text-ink">{dateStr}</p>
            </div>
            {activeGen.seed !== null && (
              <div>
                <span className="text-slate-500">SEED</span>
                <p className="text-ink">{activeGen.seed}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
