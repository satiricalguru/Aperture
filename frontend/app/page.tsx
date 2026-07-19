"use client";

import React, { useEffect, useState } from "react";
import Composer from "../components/Composer";
import ContactSheet from "../components/ContactSheet";
import Lightbox from "../components/Lightbox";
import {
  Generation,
  GenerateRequest,
  fetchHistory,
  generateImages,
  deleteGeneration,
  importLocalGeneration,
} from "../lib/api";
import { generateLocalImage } from "../lib/localProvider";

export default function Home() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newGenerationIds, setNewGenerationIds] = useState<Set<string>>(new Set());
  const [activeGen, setActiveGen] = useState<Generation | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("aperture-theme") as "dark" | "light" | null;
      if (savedTheme === "dark" || savedTheme === "light") {
        return savedTheme;
      }
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark";
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [openaiKey, setOpenaiKey] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("aperture-openai-key") || "";
    }
    return "";
  });
  const [geminiKey, setGeminiKey] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("aperture-gemini-key") || "";
    }
    return "";
  });
  const [replicateToken, setReplicateToken] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("aperture-replicate-token") || "";
    }
    return "";
  });

  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiTestError, setGeminiTestError] = useState<string | null>(null);

  const testGeminiKey = async () => {
    if (!geminiKey.trim()) {
      setGeminiTestError("Enter a Gemini API key first");
      return;
    }
    setTestingGemini(true);
    setGeminiTestError(null);
    setGeminiModels([]);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey.trim()}`);
      if (!res.ok) {
        throw new Error(`API returned ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      const models = data.models || [];
      const imageModels = models
        .map((m: { name: string }) => m.name)
        .filter((name: string) => name.includes("imagen") || name.includes("image"));
      
      if (imageModels.length === 0) {
        setGeminiModels(["No image models found. You may need to upgrade to a billing plan in AI Studio."]);
      } else {
        setGeminiModels(imageModels.map((m: string) => m.replace("models/", "")));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to query Google AI Studio models";
      setGeminiTestError(msg);
    } finally {
      setTestingGemini(false);
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem("aperture-openai-key", openaiKey.trim());
    localStorage.setItem("aperture-gemini-key", geminiKey.trim());
    localStorage.setItem("aperture-replicate-token", replicateToken.trim());
    setIsSettingsOpen(false);
  };

  const applyTheme = (t: "dark" | "light") => {
    setTheme(t);
    localStorage.setItem("aperture-theme", t);
    document.documentElement.classList.add(t);
    document.documentElement.classList.remove(t === "dark" ? "light" : "dark");
  };

  // Sync theme on mount and configure Next.js DevTools portal
  useEffect(() => {
    document.documentElement.classList.add(theme);
    document.documentElement.classList.remove(theme === "dark" ? "light" : "dark");

    let portalObserver: MutationObserver | null = null;
    let bodyObserver: MutationObserver | null = null;

    const syncWithPortal = (portal: Element) => {
      const updateFromPortal = () => {
        // Inject custom "Connect Models" menu item inside Next.js DevTools portal shadow DOM
        const shadowRoot = portal.shadowRoot;
        if (shadowRoot) {
          const preferencesRow = shadowRoot.querySelector("[data-preferences]");
          if (preferencesRow && preferencesRow.parentElement) {
            const menuContainer = preferencesRow.parentElement;
            
            if (!menuContainer.querySelector("[data-custom-connect]")) {
              const connectRow = preferencesRow.cloneNode(true) as HTMLElement;
              connectRow.setAttribute("data-custom-connect", "true");
              connectRow.removeAttribute("data-preferences");
              
              // Walk text nodes and replace "Preferences" with "Connect Models"
              const walk = document.createTreeWalker(connectRow, NodeFilter.SHOW_TEXT, null);
              let textNode;
              while ((textNode = walk.nextNode())) {
                if (textNode.nodeValue && textNode.nodeValue.includes("Preferences")) {
                  textNode.nodeValue = "Connect Models";
                  break;
                }
              }
              
              // Replace SVG gear icon with key icon
              const svgEl = connectRow.querySelector("svg");
              if (svgEl) {
                svgEl.outerHTML = `
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="key-icon" style="opacity: 0.8;">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                  </svg>
                `;
              }
              
              // Add custom click event to trigger the React modal
              connectRow.addEventListener("click", (e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsSettingsOpen(true);
              });
              
              menuContainer.insertBefore(connectRow, preferencesRow);
            }
          }
        }
      };

      // Watch for class/attribute changes on the portal
      portalObserver = new MutationObserver(() => {
        updateFromPortal();
      });
      
      portalObserver.observe(portal, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      });

      // Also watch its shadow DOM if it is open
      const shadowRoot = portal.shadowRoot;
      if (shadowRoot) {
        portalObserver.observe(shadowRoot, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      }
      
      // Run initial check
      updateFromPortal();
    };

    // Find the Next.js portal element or watch for it
    const portal = document.querySelector("nextjs-portal");
    if (portal) {
      syncWithPortal(portal);
    } else {
      bodyObserver = new MutationObserver((_, obs) => {
        const foundPortal = document.querySelector("nextjs-portal");
        if (foundPortal) {
          syncWithPortal(foundPortal);
          obs.disconnect();
        }
      });
      bodyObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      if (portalObserver) portalObserver.disconnect();
      if (bodyObserver) bodyObserver.disconnect();
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  };

  // Load history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const history = await fetchHistory();
        setGenerations(history);
      } catch (err) {
        console.error("Failed to load history", err);
      }
    }
    loadHistory();
  }, []);

  const handleGenerate = async (req: GenerateRequest) => {
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      if (req.model === "local-drawthings" || req.model === "local-comfyui") {
        const os = req.model === "local-drawthings" ? "mac" : "windows";
        const sizeMap: Record<string, { width: number; height: number }> = {
          "1:1": { width: 1024, height: 1024 },
          "16:9": { width: 1024, height: 576 },
          "9:16": { width: 576, height: 1024 },
          "4:5": { width: 832, height: 1040 },
        };
        const { width, height } = sizeMap[req.aspect_ratio] || { width: 1024, height: 1024 };

        const { blob, seed } = await generateLocalImage(os, {
          prompt: req.prompt,
          width,
          height,
        });

        const newGen = await importLocalGeneration({
          blob,
          prompt: req.prompt,
          model_id: req.model,
          aspect_ratio: req.aspect_ratio,
          seed,
        });

        setGenerations((prev) => [newGen, ...prev]);

        const newIds = new Set([newGen.id]);
        setNewGenerationIds(newIds);

        setTimeout(() => {
          setNewGenerationIds(new Set());
        }, 1200);
      } else {
        const newGens = await generateImages(req);
        
        setGenerations((prev) => [...newGens, ...prev]);
        
        const newIds = new Set(newGens.map((g) => g.id));
        setNewGenerationIds(newIds);
        
        setTimeout(() => {
          setNewGenerationIds(new Set());
        }, 1200);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("An unexpected error occurred during exposure.");
      console.error(error);
      setErrorMsg(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGeneration(id);
      const history = await fetchHistory();
      setGenerations(history);
      if (activeGen?.id === id) {
        setActiveGen(null);
      }
    } catch (err) {
      console.error("Failed to delete generation", err);
    }
  };

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 md:py-12 flex flex-col gap-10">
      {/* Studio Header Placard */}
      <header className="flex flex-col gap-1.5 border-b border-slate pb-6">
        <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-ink uppercase">
          Aperture
        </h1>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 font-mono text-[10px] text-silver tracking-widest uppercase">
          <span>AI Image Generation Studio / Darkroom v1.0</span>
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="text-silver hover:text-ink transition-colors duration-150 cursor-pointer flex items-center gap-1.5 focus:outline-none"
              aria-label="Toggle Theme"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              <span>{theme === "dark" ? "DARKROOM" : "LIGHTROOM"} MODE</span>
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-silver hover:text-ink transition-colors duration-150 cursor-pointer flex items-center gap-1.5 focus:outline-none"
              aria-label="Open Connection Settings"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              <span>CONNECT MODELS</span>
            </button>
            <a
              href="https://github.com/satiricalguru/Aperture"
              target="_blank"
              rel="noopener noreferrer"
              className="w-6 h-6 rounded-full border border-slate flex items-center justify-center text-silver hover:text-ink hover:border-ink transition-colors duration-150 bg-fog hover:bg-void shrink-0"
              aria-label="View on GitHub"
              title="View on GitHub"
            >
              <svg
                className="w-3.5 h-3.5 fill-current"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      {/* Development Error Alert */}
      {errorMsg && (
        <div className="w-full bg-void border border-red-500/50 p-4 font-mono text-xs text-red-400 flex justify-between items-start">
          <div className="flex-1">
            <span className="font-bold uppercase text-red-500 mr-2">[DEVELOPMENT ERROR]:</span>
            {errorMsg}
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-silver hover:text-ink cursor-pointer ml-4 font-bold"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Composer Section */}
      <section className="w-full">
        <Composer onGenerate={handleGenerate} isGenerating={isGenerating} />
      </section>

      {/* Contact Sheet Gallery Grid */}
      <section className="w-full mt-2">
        <ContactSheet
          generations={generations}
          newGenerationIds={newGenerationIds}
          onFrameClick={setActiveGen}
          onDelete={handleDelete}
        />
      </section>

      {/* Lightbox Loupe Overlay */}
      <Lightbox
        isOpen={activeGen !== null}
        activeGen={activeGen}
        generations={generations}
        onClose={() => setActiveGen(null)}
        onChangeActive={setActiveGen}
        onDelete={handleDelete}
      />

      {/* Connection Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void/90 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-fog border border-slate p-6 flex flex-col gap-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate pb-4">
              <h2 className="font-mono text-xs font-bold tracking-widest uppercase text-ink">
                CONNECTION SETTINGS
              </h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-silver hover:text-ink cursor-pointer font-mono text-[10px] tracking-widest uppercase focus:outline-none"
              >
                CLOSE
              </button>
            </div>
            
            <div className="flex flex-col gap-4 font-mono text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="text-silver uppercase tracking-wider text-[9px]">OPENAI API KEY</label>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="bg-void border border-slate text-ink p-2 rounded-[2px] focus:outline-none placeholder:text-silver/20 focus:border-silver transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-silver uppercase tracking-wider text-[9px]">GEMINI API KEY</label>
                  <button
                    type="button"
                    onClick={testGeminiKey}
                    disabled={testingGemini}
                    className="text-silver hover:text-ink cursor-pointer uppercase text-[8px] tracking-wider font-bold border border-slate px-1.5 py-0.5 rounded-[2px] transition-colors focus:outline-none"
                  >
                    {testingGemini ? "QUERYING..." : "TEST KEY"}
                  </button>
                </div>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="bg-void border border-slate text-ink p-2 rounded-[2px] focus:outline-none placeholder:text-silver/20 focus:border-silver transition-colors"
                />
                {geminiTestError && (
                  <div className="text-[8px] text-red-500 font-mono tracking-wide mt-1 leading-normal uppercase">
                    • Error: {geminiTestError}
                  </div>
                )}
                {geminiModels.length > 0 && (
                  <div className="bg-void border border-slate p-2 mt-1 rounded-[2px] font-mono text-[8px] flex flex-col gap-1 text-silver">
                    <span className="text-ink font-bold uppercase tracking-wider">AVAILABLE IMAGE MODELS:</span>
                    {geminiModels.map((m) => (
                      <span key={m} className="lowercase">• {m}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-silver uppercase tracking-wider text-[9px]">REPLICATE API TOKEN</label>
                <input
                  type="password"
                  value={replicateToken}
                  onChange={(e) => setReplicateToken(e.target.value)}
                  placeholder="r8_..."
                  className="bg-void border border-slate text-ink p-2 rounded-[2px] focus:outline-none placeholder:text-silver/20 focus:border-silver transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 font-mono text-[9px] text-silver tracking-wide leading-relaxed border-t border-slate pt-4">
              <p>• API keys are saved locally in your browser&apos;s LocalStorage and sent only during exposure requests.</p>
              <p>• Leave empty to fall back to the project environment (.env) keys or darkroom mock fallback.</p>
            </div>

            <button
              onClick={handleSaveSettings}
              className="w-full bg-flash text-void border border-flash p-3 font-mono text-[10px] tracking-widest uppercase hover:bg-ink hover:border-ink transition-colors cursor-pointer focus:outline-none"
            >
              SAVE CONFIGURATION
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
