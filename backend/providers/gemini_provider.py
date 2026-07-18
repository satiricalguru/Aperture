import os
import base64
import asyncio
from typing import List
import httpx
from backend.providers.base import GeneratedImage

class GeminiProvider:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("GOOGLE_AI_API_KEY")

    async def generate_single(self, client: httpx.AsyncClient, prompt: str, aspect_ratio: str) -> GeneratedImage:
        if not self.api_key:
            raise ValueError("GOOGLE_AI_API_KEY environment variable is not set")

        errors = []

        # 1. Try Imagen 4 Models (:predict endpoint)
        imagen_models = ["imagen-4.0-fast-generate-001", "imagen-4.0-generate-001", "imagen-4.0-ultra-generate-001"]
        for model in imagen_models:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:predict?key={self.api_key}"
                aspect_ratio_map = {
                    "1:1": "1:1",
                    "16:9": "16:9",
                    "9:16": "9:16",
                    "4:5": "3:4"
                }
                mapped_aspect = aspect_ratio_map.get(aspect_ratio, "1:1")

                payload = {
                    "instances": [
                        {"prompt": prompt}
                    ],
                    "parameters": {
                        "sampleCount": 1,
                        "aspectRatio": mapped_aspect,
                        "outputMimeType": "image/jpeg"
                    }
                }

                response = await client.post(
                    url,
                    headers={"Content-Type": "application/json"},
                    json=payload,
                    timeout=45.0
                )

                if response.status_code == 200:
                    res_data = response.json()
                    predictions = res_data.get("predictions", [])
                    if predictions:
                        b64_data = predictions[0].get("bytesBase64Encoded")
                        if b64_data:
                            return GeneratedImage(
                                image_bytes=base64.b64decode(b64_data),
                                mime_type="image/jpeg",
                                model_id=model
                            )
                
                # If non-200, record the failure details
                errors.append(f"{model}: {response.status_code} - {response.text[:200]}")
            except Exception as e:
                errors.append(f"{model} exception: {str(e)}")

        # 2. Try Gemini Multimodal Models (:generateContent endpoint)
        gemini_models = [
            "gemini-3.1-flash-lite-image",
            "gemini-3-pro-image",
            "gemini-3.1-flash-image",
            "gemini-2.5-flash-image"
        ]
        for model in gemini_models:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"
                payload = {
                    "contents": [
                        {
                            "parts": [{"text": prompt}]
                        }
                    ],
                    "generationConfig": {
                        "responseModalities": ["TEXT", "IMAGE"],
                        "imageConfig": {
                            "aspectRatio": aspect_ratio
                        }
                    }
                }

                response = await client.post(
                    url,
                    headers={"Content-Type": "application/json"},
                    json=payload,
                    timeout=45.0
                )

                if response.status_code == 200:
                    res_data = response.json()
                    candidates = res_data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        for part in parts:
                            if "inlineData" in part:
                                mime_type = part["inlineData"].get("mimeType", "")
                                if mime_type.startswith("image/"):
                                    b64_data = part["inlineData"]["data"]
                                    return GeneratedImage(
                                        image_bytes=base64.b64decode(b64_data),
                                        mime_type=mime_type,
                                        model_id=model
                                    )
                
                errors.append(f"{model}: {response.status_code} - {response.text[:200]}")
            except Exception as e:
                errors.append(f"{model} exception: {str(e)}")

        # Raise combined exception if all attempts failed
        error_details = "\n".join(errors)
        raise Exception(f"All Google AI Studio image models failed to generate:\n{error_details}")

    async def generate(self, prompt: str, aspect_ratio: str, count: int) -> List[GeneratedImage]:
        async with httpx.AsyncClient() as client:
            tasks = [self.generate_single(client, prompt, aspect_ratio) for _ in range(count)]
            results = await asyncio.gather(*tasks)
            return list(results)
