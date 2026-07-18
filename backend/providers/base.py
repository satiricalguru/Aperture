from typing import Protocol, Optional, List
from dataclasses import dataclass

@dataclass
class GeneratedImage:
    image_bytes: bytes
    mime_type: str
    model_id: str
    seed: Optional[int] = None

class ImageProvider(Protocol):
    async def generate(self, prompt: str, aspect_ratio: str, count: int) -> List[GeneratedImage]:
        """Generates images based on prompt, aspect ratio, and count."""
        ...
