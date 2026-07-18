export type LocalOS = "mac" | "windows" | "unsupported";

export const LOCAL_ENGINES: Record<Exclude<LocalOS, "unsupported">, {
  label: string;
  port: number;
  downloadUrl: string;
  setupSteps: string[];
}> = {
  mac: {
    label: "Draw Things",
    port: 7860,
    downloadUrl: "https://drawthings.ai",
    setupSteps: [
      "Install and open Draw Things.",
      "Settings → Advanced → enable \"API Server\" (HTTP, port 7860, localhost only).",
      "Keep Draw Things running in the background.",
    ],
  },
  windows: {
    label: "ComfyUI",
    port: 8188,
    downloadUrl: "https://www.comfy.org/download",
    setupSteps: [
      "Install ComfyUI Desktop and let first-run setup finish.",
      "Make sure at least one checkpoint is installed (ComfyUI Manager → Models).",
      "Keep the ComfyUI window open — its API starts automatically.",
    ],
  },
};

export function detectOS(): LocalOS {
  if (typeof navigator === "undefined") return "unsupported";
  const platform = navigator.platform || "";
  const ua = navigator.userAgent || "";
  if (/Mac|iPhone|iPad|iPod/.test(platform) || /Macintosh/.test(ua)) return "mac";
  if (/Win/.test(platform) || /Windows/.test(ua)) return "windows";
  return "unsupported";
}

export async function pingLocalEngine(os: Exclude<LocalOS, "unsupported">, timeoutMs = 1500): Promise<boolean> {
  const { port } = LOCAL_ENGINES[os];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(`http://127.0.0.1:${port}/`, { signal: controller.signal, mode: "cors" });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Returns raw image bytes as a Blob — caller is responsible for uploading
// to /api/generations/import to persist it into the contact sheet.
export async function generateLocalImage(
  os: "mac" | "windows",
  params: { prompt: string; width: number; height: number }
): Promise<{ blob: Blob; seed: number | null }> {
  if (os === "mac") {
    const res = await fetch(`http://127.0.0.1:7860/sdapi/v1/txt2img`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: params.prompt,
        negative_prompt: "",
        width: params.width,
        height: params.height,
        seed: -1,
      }),
    });
    if (!res.ok) throw new Error(`Draw Things request failed: ${res.statusText}`);
    const data = await res.json();
    // Draw Things returns { images: ["<base64>"], ... } — convert to Blob.
    const b64 = data.images[0];
    const byteChars = atob(b64);
    const byteNumbers = Array.from(byteChars, (c) => c.charCodeAt(0));
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: "image/png" });
    return { blob, seed: data.seed ?? null };
  }

  // Windows / ComfyUI: submit a workflow graph, then poll for the result.
  // Discover checkpoints
  const objectInfoRes = await fetch(`http://127.0.0.1:8188/object_info`);
  if (!objectInfoRes.ok) {
    throw new Error("Failed to contact ComfyUI to retrieve object info. Make sure ComfyUI is running.");
  }
  const info = await objectInfoRes.json();
  const loaderNode = info.CheckpointLoaderSimple || info.CheckpointLoader;
  const ckptNames = loaderNode?.input?.required?.ckpt_name?.[1];
  if (!ckptNames || ckptNames.length === 0) {
    throw new Error("no checkpoint found — install one in ComfyUI Manager first");
  }
  const checkpointName = ckptNames[0];

  // Seed generation
  const seed = Math.floor(Math.random() * 1000000000);

  // Default workflow graph template
  const workflow = {
    "4": {
      "inputs": {
        "ckpt_name": checkpointName
      },
      "class_type": "CheckpointLoaderSimple"
    },
    "5": {
      "inputs": {
        "width": params.width,
        "height": params.height,
        "batch_size": 1
      },
      "class_type": "EmptyLatentImage"
    },
    "6": {
      "inputs": {
        "text": params.prompt,
        "clip": ["4", 1]
      },
      "class_type": "CLIPTextEncode"
    },
    "7": {
      "inputs": {
        "text": "watermark, text, blurry, low quality, bad hands, deformed",
        "clip": ["4", 1]
      },
      "class_type": "CLIPTextEncode"
    },
    "3": {
      "inputs": {
        "seed": seed,
        "steps": 20,
        "cfg": 8.0,
        "sampler_name": "euler",
        "scheduler": "normal",
        "denoise": 1,
        "model": ["4", 0],
        "positive": ["6", 0],
        "negative": ["7", 0],
        "latent_image": ["5", 0]
      },
      "class_type": "KSampler"
    },
    "8": {
      "inputs": {
        "samples": ["3", 0],
        "vae": ["4", 2]
      },
      "class_type": "VAEDecode"
    },
    "9": {
      "inputs": {
        "filename_prefix": "Aperture",
        "images": ["8", 0]
      },
      "class_type": "SaveImage"
    }
  };

  // Submit prompt
  const promptRes = await fetch(`http://127.0.0.1:8188/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
  });
  if (!promptRes.ok) {
    const errorBody = await promptRes.text().catch(() => "");
    throw new Error(`ComfyUI prompt submission failed: ${promptRes.statusText}. ${errorBody}`);
  }
  const promptData = await promptRes.json();
  const promptId = promptData.prompt_id;

  // Poll history
  let completed = false;
  let outputImages: { filename: string; subfolder: string; type: string }[] = [];

  // Poll every 1000ms until complete
  while (!completed) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const historyRes = await fetch(`http://127.0.0.1:8188/history/${promptId}`);
    if (!historyRes.ok) continue;
    const historyData = await historyRes.json();
    const taskResult = historyData[promptId];
    if (taskResult) {
      if (taskResult.status?.completed) {
        completed = true;
        const outputs = taskResult.outputs;
        const saveImageOutput = outputs["9"];
        if (saveImageOutput && saveImageOutput.images) {
          outputImages = saveImageOutput.images;
        }
        break;
      }
    }
  }

  if (outputImages.length === 0) {
    throw new Error("ComfyUI generation completed but no output images were returned.");
  }

  const imgInfo = outputImages[0];
  const viewUrl = `http://127.0.0.1:8188/view?filename=${encodeURIComponent(imgInfo.filename)}&subfolder=${encodeURIComponent(imgInfo.subfolder)}&type=${encodeURIComponent(imgInfo.type)}`;
  const imgRes = await fetch(viewUrl);
  if (!imgRes.ok) {
    throw new Error("Failed to retrieve image from ComfyUI.");
  }
  const blob = await imgRes.blob();

  return { blob, seed };
}
