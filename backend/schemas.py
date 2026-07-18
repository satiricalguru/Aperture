from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    model: str = Field(..., description="Model identifier: gpt-image-2, gemini-2.5-flash-image, flux-schnell")
    aspect_ratio: str = Field(..., pattern="^(1:1|16:9|9:16|4:5)$")
    count: int = Field(1, ge=1, le=4)

class GenerationResponse(BaseModel):
    id: str
    frame_number: int
    prompt: str
    model_id: str
    aspect_ratio: str
    seed: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
