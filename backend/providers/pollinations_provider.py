import urllib.parse
import random
import asyncio
import httpx
from typing import List
from backend.providers.base import GeneratedImage

class PollinationsProvider:
    def __init__(self, model: str = "flux"):
        self.model_key = model
        self.model = f"pollinations-{model}"

    async def generate_single(self, client: httpx.AsyncClient, prompt: str, width: int, height: int) -> GeneratedImage:
        seed = random.randint(1, 1000000)
        encoded_prompt = urllib.parse.quote(prompt)
        url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={width}&height={height}&seed={seed}&nologo=true&private=true&model={self.model_key}"
        
        max_retries = 3
        backoff_sec = 1.5
        for attempt in range(max_retries):
            try:
                response = await client.get(url, timeout=45.0)
                if response.status_code == 200:
                    image_bytes = response.content
                    return GeneratedImage(
                        image_bytes=image_bytes,
                        mime_type="image/jpeg",
                        model_id=self.model,
                        seed=seed
                    )
                elif response.status_code == 429:
                    if attempt < max_retries - 1:
                        await asyncio.sleep(backoff_sec * (attempt + 1))
                        continue
                    raise Exception(f"Pollinations/SDXL rate limited (429) after {max_retries} attempts.")
                else:
                    raise Exception(f"Pollinations/SDXL generation failed with status: {response.status_code}")
            except (httpx.RequestError, asyncio.TimeoutError) as e:
                if attempt < max_retries - 1:
                    await asyncio.sleep(backoff_sec * (attempt + 1))
                    continue
                raise Exception(f"Pollinations/SDXL request failed: {str(e)}")


    async def generate(self, prompt: str, aspect_ratio: str, count: int) -> List[GeneratedImage]:
        size_map = {
            "1:1": (1024, 1024),
            "16:9": (1024, 576),
            "9:16": (576, 1024),
            "4:5": (832, 1040)
        }
        width, height = size_map.get(aspect_ratio, (1024, 1024))
        
        async with httpx.AsyncClient() as client:
            tasks = [self.generate_single(client, prompt, width, height) for _ in range(count)]
            results = await asyncio.gather(*tasks)
            return list(results)
