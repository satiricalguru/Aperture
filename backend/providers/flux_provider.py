import os
import asyncio
from typing import List
import httpx
from backend.providers.base import GeneratedImage

class FluxProvider:
    def __init__(self, api_token: str = None):
        self.api_token = api_token or os.getenv("REPLICATE_API_TOKEN")
        self.model_owner = "black-forest-labs"
        self.model_name = "flux-schnell"

    async def generate_single(self, client: httpx.AsyncClient, prompt: str, aspect_ratio: str) -> GeneratedImage:
        if not self.api_token:
            raise ValueError("REPLICATE_API_TOKEN environment variable is not set")

        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
            "Prefer": "wait"
        }

        url = f"https://api.replicate.com/v1/models/{self.model_owner}/{self.model_name}/predictions"
        payload = {
            "input": {
                "prompt": prompt,
                "aspect_ratio": aspect_ratio,
                "num_outputs": 1,
                "output_format": "png"
            }
        }

        response = await client.post(url, headers=headers, json=payload, timeout=65.0)

        if response.status_code not in (200, 201):
            raise Exception(f"Replicate prediction trigger failed: {response.status_code} - {response.text}")

        prediction = response.json()
        status = prediction.get("status")
        get_url = prediction.get("urls", {}).get("get")
        
        while status not in ("succeeded", "failed", "canceled"):
            if not get_url:
                raise Exception(f"Missing polling URL in Replicate prediction response: {prediction}")
                
            await asyncio.sleep(1.0)
            
            poll_headers = {
                "Authorization": f"Bearer {self.api_token}"
            }
            poll_response = await client.get(get_url, headers=poll_headers, timeout=10.0)
            if poll_response.status_code != 200:
                raise Exception(f"Replicate polling failed: {poll_response.status_code} - {poll_response.text}")
                
            prediction = poll_response.json()
            status = prediction.get("status")

        if status != "succeeded":
            error_detail = prediction.get("error", "Unknown error")
            raise Exception(f"Replicate prediction failed with status '{status}': {error_detail}")

        output = prediction.get("output")
        if not output or not isinstance(output, list):
            raise Exception(f"Invalid output in Replicate response: {prediction}")

        image_url = output[0]
        
        image_response = await client.get(image_url, timeout=30.0)
        if image_response.status_code != 200:
            raise Exception(f"Failed to download image from Replicate CDN: {image_response.status_code}")

        seed = prediction.get("input", {}).get("seed")

        return GeneratedImage(
            image_bytes=image_response.content,
            mime_type="image/png",
            model_id=f"{self.model_owner}/{self.model_name}",
            seed=seed
        )

    async def generate(self, prompt: str, aspect_ratio: str, count: int) -> List[GeneratedImage]:
        async with httpx.AsyncClient() as client:
            tasks = [self.generate_single(client, prompt, aspect_ratio) for _ in range(count)]
            results = await asyncio.gather(*tasks)
            return list(results)
