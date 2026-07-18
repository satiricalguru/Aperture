import React, { useState, useEffect } from "react";
import { LocalOS, LOCAL_ENGINES, pingLocalEngine } from "../lib/localProvider";
import { installLocalEngine, checkEnginesStatus, launchLocalEngine } from "../lib/api";

interface LocalSetupModalProps {
  os: LocalOS;
  onClose: () => void;
  onConnected: () => void;
}

export default function LocalSetupModal({ os, onClose, onConnected }: LocalSetupModalProps) {
  const [currentOS, setCurrentOS] = useState<Exclude<LocalOS, "unsupported">>((os === "unsupported") ? "mac" : os);
  const [isUnsupported, setIsUnsupported] = useState(os === "unsupported");
  const [isChecking, setIsChecking] = useState(false);
  const [pingFailed, setPingFailed] = useState(false);
  
  const [isInstalling, setIsInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  
  const [isInstalled, setIsInstalled] = useState(false);

  const checkConnection = async (targetOS: Exclude<LocalOS, "unsupported">) => {
    setIsChecking(true);
    setPingFailed(false);
    try {
      const isRunning = await pingLocalEngine(targetOS);
      if (isRunning) {
        onConnected();
        onClose();
      } else {
        setPingFailed(true);
      }
    } catch (err) {
      console.error(err);
      setPingFailed(true);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    async function queryStatus() {
      try {
        const modelId = currentOS === "mac" ? "local-drawthings" : "local-comfyui";
        const statusMap = await checkEnginesStatus();
        setIsInstalled(!!statusMap[modelId]?.installed);
      } catch (err) {
        console.error("Failed to query local engine status", err);
      }
    }
    queryStatus();
  }, [currentOS]);

  useEffect(() => {
    if (os !== "unsupported") {
      checkConnection(os);
    }
  }, [os]);

  const toggleOS = () => {
    const nextOS = currentOS === "mac" ? "windows" : "mac";
    setCurrentOS(nextOS);
    setPingFailed(false);
    setInstallMessage(null);
    setInstallError(null);
  };

  const handleDownload = async () => {
    setIsInstalling(true);
    setInstallMessage("Starting installation command...");
    setInstallError(null);
    const modelId = currentOS === "mac" ? "local-drawthings" : "local-comfyui";
    try {
      if (currentOS === "mac") {
        setInstallMessage("Installing Draw Things via Homebrew Cask... Please check terminal logs.");
      } else {
        setInstallMessage("Cloning ComfyUI to local_engines/comfyui...");
      }
      const res = await installLocalEngine(modelId);
      setInstallMessage(res.message);
      setIsInstalled(true);
      setTimeout(() => {
        checkConnection(currentOS);
      }, 2000);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Installation failed";
      setInstallError(`${errMsg}. Redirecting to website for manual download...`);
      window.open(engine.downloadUrl, "_blank");
    } finally {
      setIsInstalling(false);
    }
  };

  const handleLaunch = async () => {
    setIsInstalling(true);
    setInstallMessage("Attempting to launch application...");
    setInstallError(null);
    const modelId = currentOS === "mac" ? "local-drawthings" : "local-comfyui";
    try {
      const res = await launchLocalEngine(modelId);
      setInstallMessage(res.message);
      setTimeout(() => {
        checkConnection(currentOS);
      }, 2000);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Launch failed";
      setInstallError(`${errMsg}. Please open the application manually.`);
    } finally {
      setIsInstalling(false);
    }
  };

  const engine = LOCAL_ENGINES[currentOS];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void/90 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-fog border border-slate p-6 flex flex-col gap-6 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate pb-4">
          <h2 className="font-serif text-lg font-bold tracking-wider uppercase text-ink">
            Local Generation — {engine.label}
          </h2>
          <button
            onClick={onClose}
            className="text-silver hover:text-ink cursor-pointer font-mono text-[10px] tracking-widest uppercase focus:outline-none"
          >
            CLOSE
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4">
          {isUnsupported && (
            <p className="font-mono text-xs text-red-400 bg-void/50 border border-red-500/20 p-3 leading-normal uppercase">
              • System: Local generation currently supports macOS and Windows only. 
              If you have Draw Things or ComfyUI installed on another platform, you can manually switch instructions below.
            </p>
          )}

          <div className="font-mono text-xs text-silver leading-relaxed flex flex-col gap-3">
            <span className="uppercase tracking-widest text-[10px] text-ink font-semibold">Setup Instructions</span>
            <ol className="list-decimal list-inside flex flex-col gap-2 bg-void p-4 border border-slate rounded-[2px]">
              {engine.setupSteps.map((step, idx) => (
                <li key={idx} className="tracking-wide">
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {pingFailed && (
            <p className="font-mono text-[10px] text-red-400 uppercase tracking-wide">
              • Connection failed. Ensure the app is running with API mode enabled.
            </p>
          )}

          {installMessage && (
            <p className="font-mono text-[10px] text-silver uppercase tracking-wide bg-void/50 border border-slate p-3 rounded-[2px] leading-normal animate-pulse">
              • {installMessage}
            </p>
          )}

          {installError && (
            <p className="font-mono text-[10px] text-red-400 uppercase tracking-wide bg-void/50 border border-red-500/20 p-3 rounded-[2px] leading-normal">
              • {installError}
            </p>
          )}
        </div>

        {/* Footer controls & buttons */}
        <div className="flex flex-col gap-3 border-t border-slate pt-4">
          {/* Switch link */}
          <button
            type="button"
            onClick={toggleOS}
            className="font-mono text-[10px] text-silver hover:text-ink tracking-wider uppercase text-left transition-colors focus:outline-none"
          >
            Not on {currentOS === "mac" ? "macOS" : "Windows"}? Switch instructions to {currentOS === "mac" ? "Windows (ComfyUI)" : "macOS (Draw Things)"}
          </button>

          <div className="flex gap-4 mt-2">
            {isInstalled ? (
              <button
                onClick={handleLaunch}
                disabled={isInstalling || isChecking}
                className="flex-1 bg-flash text-void border border-flash py-3 font-mono text-[10px] tracking-widest uppercase hover:bg-ink hover:border-ink transition-colors cursor-pointer focus:outline-none font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isInstalling ? "Launching..." : `Launch ${engine.label}`}
              </button>
            ) : (
              <button
                onClick={handleDownload}
                disabled={isInstalling || isChecking}
                className="flex-1 bg-flash text-void border border-flash py-3 font-mono text-[10px] tracking-widest uppercase hover:bg-ink hover:border-ink transition-colors cursor-pointer focus:outline-none font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isInstalling ? "Installing..." : `Download ${engine.label}`}
              </button>
            )}
            <button
              onClick={() => checkConnection(currentOS)}
              disabled={isChecking || isInstalling}
              className="flex-1 bg-transparent border border-slate text-ink py-3 font-mono text-[10px] tracking-widest uppercase hover:border-silver transition-colors cursor-pointer focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChecking ? "Checking..." : "Check again"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
