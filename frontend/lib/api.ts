export interface Generation {
  id: string;
  frame_number: number;
  prompt: string;
  model_id: string;
  aspect_ratio: string;
  seed: number | null;
  created_at: string;
}

export interface GenerateRequest {
  prompt: string;
  model: string;
  aspect_ratio: string;
  count: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export const getImageUrl = (generationId: string): string => {
  return `${API_BASE_URL}/image/${generationId}`;
};

export async function fetchHistory(): Promise<Generation[]> {
  const response = await fetch(`${API_BASE_URL}/history`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Ensure session cookies are sent/saved
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch history: ${response.statusText}`);
  }

  return response.json();
}

export async function generateImages(req: GenerateRequest): Promise<Generation[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (typeof window !== "undefined") {
    const openaiKey = localStorage.getItem("aperture-openai-key");
    const geminiKey = localStorage.getItem("aperture-gemini-key");
    const replicateToken = localStorage.getItem("aperture-replicate-token");

    if (openaiKey) headers["X-OpenAI-Key"] = openaiKey;
    if (geminiKey) headers["X-Gemini-Key"] = geminiKey;
    if (replicateToken) headers["X-Replicate-Token"] = replicateToken;
  }

  const response = await fetch(`${API_BASE_URL}/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(req),
    credentials: "include",
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to generate: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteGeneration(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/generation/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete generation: ${response.statusText}`);
  }
}

export async function importLocalGeneration(params: {
  blob: Blob;
  prompt: string;
  model_id: string;
  aspect_ratio: string;
  seed: number | null;
}): Promise<Generation> {
  const form = new FormData();
  form.append("file", params.blob, "generation.png");
  form.append("prompt", params.prompt);
  form.append("model_id", params.model_id);
  form.append("aspect_ratio", params.aspect_ratio);
  if (params.seed !== null) form.append("seed", String(params.seed));

  const response = await fetch(`${API_BASE_URL}/generations/import`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
  if (!response.ok) throw new Error(`Failed to import local generation: ${response.statusText}`);
  return response.json();
}

export async function installLocalEngine(modelId: string): Promise<{ status: string; message: string }> {
  const form = new FormData();
  form.append("model_id", modelId);
  const response = await fetch(`${API_BASE_URL}/engines/install`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to install engine: ${response.statusText}`);
  }
  return response.json();
}

export async function launchLocalEngine(modelId: string): Promise<{ status: string; message: string }> {
  const form = new FormData();
  form.append("model_id", modelId);
  const response = await fetch(`${API_BASE_URL}/engines/launch`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to launch engine: ${response.statusText}`);
  }
  return response.json();
}

export async function checkEnginesStatus(): Promise<Record<string, { installed: boolean }>> {
  const response = await fetch(`${API_BASE_URL}/engines/status`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(`Failed to check engines status: ${response.statusText}`);
  }
  return response.json();
}
