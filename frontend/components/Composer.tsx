import React, { useState } from "react";
import ParamDial from "./ParamDial";
import { GenerateRequest } from "../lib/api";
import { detectOS, pingLocalEngine, LocalOS } from "../lib/localProvider";
import LocalSetupModal from "./LocalSetupModal";

interface ComposerProps {
  onGenerate: (req: GenerateRequest) => Promise<void>;
  isGenerating: boolean;
}

export default function Composer({ onGenerate, isGenerating }: ComposerProps) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("free-pollinations");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [count, setCount] = useState(1);

  const [showLocalModal, setShowLocalModal] = useState(false);
  const [localModalOS, setLocalModalOS] = useState<LocalOS>("unsupported");

  const handleModelChange = async (value: string) => {
    if (value !== "local") {
      setModel(value);
      return;
    }
    const os = detectOS();
    if (os === "unsupported") {
      setLocalModalOS(os);
      setShowLocalModal(true);
      return;
    }

    const hasConfirmed = localStorage.getItem("aperture-local-confirmed") === "true";
    if (hasConfirmed) {
      const alreadyRunning = await pingLocalEngine(os);
      if (alreadyRunning) {
        setModel(os === "mac" ? "local-drawthings" : "local-comfyui");
        return;
      }
    }

    setLocalModalOS(os);
    setShowLocalModal(true);
  };

  const handleLocalConnected = () => {
    const os = detectOS();
    if (os !== "unsupported") {
      localStorage.setItem("aperture-local-confirmed", "true");
      setModel(os === "mac" ? "local-drawthings" : "local-comfyui");
    }
  };

  const modelOptions = [
    { label: "Flux (Free)", value: "free-pollinations" },
    { label: "SDXL (Free)", value: "free-sdxl" },
    { label: "GPT", value: "gpt-image-2" },
    { label: "Gemini", value: "gemini-2.5-flash-image" },
    { label: "Schnell", value: "flux-schnell" },
    { label: "Local (Free)", value: "local" },
  ];

  const aspectOptions = [
    { label: "1:1", value: "1:1" },
    { label: "16:9", value: "16:9" },
    { label: "9:16", value: "9:16" },
    { label: "4:5", value: "4:5" },
  ];

  const countOptions = [
    { label: "1 Exp", value: 1 },
    { label: "2 Exp", value: 2 },
    { label: "4 Exp", value: 4 },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    onGenerate({
      prompt: prompt.trim(),
      model,
      aspect_ratio: aspectRatio,
      count,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
      {/* Exposure Log Textarea */}
      <div className="flex flex-col gap-1.5 w-full">
        <label
          htmlFor="prompt-input"
          className="font-mono text-xs text-silver uppercase tracking-widest"
        >
          Exposure Log / Prompt
        </label>
        <textarea
          id="prompt-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your exposure details (e.g. A high-contrast portrait captured in deep shadow, harsh grain...)"
          disabled={isGenerating}
          className="w-full min-h-[110px] bg-fog border border-slate text-ink p-4 rounded-[4px] font-sans text-sm focus:outline-none resize-y placeholder:text-silver/40"
        />
      </div>

      {/* Dials & Generate Button Row */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          <ParamDial
            label="Selected Model"
            options={modelOptions}
            value={model.startsWith("local-") ? "local" : model}
            onChange={handleModelChange}
          />
          <ParamDial
            label="Aspect Ratio"
            options={aspectOptions}
            value={aspectRatio}
            onChange={setAspectRatio}
          />
          <ParamDial
            label="Exposures"
            options={countOptions}
            value={count}
            onChange={setCount}
          />
        </div>

        {/* Generate Button */}
        <button
          type="submit"
          disabled={!prompt.trim() || isGenerating}
          className={`px-8 py-3.5 font-mono text-sm tracking-widest uppercase font-bold select-none cursor-pointer border transition-all duration-300 w-full xl:w-auto text-center ${
            isGenerating
              ? "bg-fog text-silver border-slate animate-pulse"
              : "bg-flash text-void border-flash hover:bg-ink hover:border-ink active:scale-98 disabled:bg-fog disabled:text-silver/30 disabled:border-slate/50 disabled:cursor-not-allowed disabled:scale-100"
          }`}
        >
          {isGenerating ? "Developing..." : "Expose Frame"}
        </button>
      </div>
      {showLocalModal && (
        <LocalSetupModal
          os={localModalOS}
          onClose={() => setShowLocalModal(false)}
          onConnected={handleLocalConnected}
        />
      )}
    </form>
  );
}
