import os
import base64
import asyncio
from typing import List
import httpx
from backend.providers.base import GeneratedImage

class OpenAIProvider:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = os.getenv("OPENAI_MODEL_ID", "gpt-image-2")

    async def generate_single(self, client: httpx.AsyncClient, prompt: str, size: str) -> GeneratedImage:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "prompt": prompt,
            "n": 1,
            "size": size,
            "response_format": "b64_json"
        }

        response = await client.post(
            "https://api.openai.com/v1/images/generations",
            headers=headers,
            json=payload,
            timeout=60.0
        )

        if response.status_code != 200:
            raise Exception(f"OpenAI generation failed: {response.status_code} - {response.text}")

        res_data = response.json()
        if "data" not in res_data or not res_data["data"]:
            raise Exception(f"OpenAI returned no image data: {response.text}")

        b64_data = res_data["data"][0]["b64_json"]
        image_bytes = base64.b64decode(b64_data)
        
        return GeneratedImage(
            image_bytes=image_bytes,
            mime_type="image/png",
            model_id=self.model
        )

    async def generate(self, prompt: str, aspect_ratio: str, count: int) -> List[GeneratedImage]:
        size_map = {
            "1:1": "1024x1024",
            "16:9": "1024x576",
            "9:16": "576x1024",
            "4:5": "832x1040"
        }
        size = size_map.get(aspect_ratio, "1024x1024")

        async with httpx.AsyncClient() as client:
            tasks = [self.generate_single(client, prompt, size) for _ in range(count)]
            results = await asyncio.gather(*tasks)
            return list(results)
