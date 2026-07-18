import urllib.parse
from typing import List
import httpx
from backend.providers.base import GeneratedImage

class MockProvider:
    def __init__(self):
        self.model = "mock-darkroom-exposure"

    async def generate_single(self, client: httpx.AsyncClient, prompt: str, width: int, height: int) -> GeneratedImage:
        # URL encode prompt to put inside the placeholder image
        clean_prompt = prompt[:30] + "..." if len(prompt) > 30 else prompt
        encoded_prompt = urllib.parse.quote(clean_prompt)
        
        # Query placehold.co with fog (#17171a) background and ink (#f5f5f4) text
        url = f"https://placehold.co/{width}x{height}/17171A/F5F5F4.png?text={encoded_prompt}"
        
        response = await client.get(url, timeout=15.0)
        if response.status_code != 200:
            # Return a simple 1x1 black pixel fallback if offline/failed
            fallback_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x00\x00\x00\x00.\x11\xf1\x04\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
            return GeneratedImage(
                image_bytes=fallback_bytes,
                mime_type="image/png",
                model_id=self.model,
                seed=42
            )
            
        return GeneratedImage(
            image_bytes=response.content,
            mime_type="image/png",
            model_id=self.model,
            seed=1337
        )

    async def generate(self, prompt: str, aspect_ratio: str, count: int) -> List[GeneratedImage]:
        # Resolve dimensions based on aspect ratio
        dims = {
            "1:1": (1024, 1024),
            "16:9": (1024, 576),
            "9:16": (576, 1024),
            "4:5": (800, 1000)
        }
        width, height = dims.get(aspect_ratio, (1024, 1024))
        
        async with httpx.AsyncClient() as client:
            results = []
            for _ in range(count):
                img = await self.generate_single(client, prompt, width, height)
                results.append(img)
            return results
