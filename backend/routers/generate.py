import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Response, Cookie, Header, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.db import get_db
from backend.models import Generation, Session as SessionModel
from backend.schemas import GenerateRequest, GenerationResponse
from backend.session import sign_session_id, verify_session_id
from backend.storage.local_storage import LocalStorage
from backend.providers.openai_provider import OpenAIProvider
from backend.providers.gemini_provider import GeminiProvider
from backend.providers.flux_provider import FluxProvider
from backend.providers.mock_provider import MockProvider
from backend.providers.pollinations_provider import PollinationsProvider
from typing import List

router = APIRouter(prefix="/api")

@router.post("/generate", response_model=List[GenerationResponse])
async def generate_images(
    request: GenerateRequest,
    response: Response,
    aperture_sid: str = Cookie(None),
    x_openai_key: str = Header(None),
    x_gemini_key: str = Header(None),
    x_replicate_token: str = Header(None),
    db: Session = Depends(get_db)
):
    # 1. Manage Session Cookie
    session_id = verify_session_id(aperture_sid)
    new_session_created = False
    
    if not session_id:
        session_id = str(uuid.uuid4())
        new_session_created = True
        
    # Check if session exists in DB, create if not
    session_row = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_row:
        session_row = SessionModel(id=session_id)
        db.add(session_row)
        db.commit()

    # 2. Select Provider
    provider = None
    allow_mock = os.getenv("ALLOW_MOCK_FALLBACK", "true").lower() == "true"

    if request.model == "gpt-image-2":
        api_key = x_openai_key or os.getenv("OPENAI_API_KEY")
        if not api_key:
            if allow_mock:
                provider = MockProvider()
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="OPENAI_API_KEY is not set. Please connect it in settings."
                )
        else:
            provider = OpenAIProvider(api_key=api_key)
            
    elif request.model == "gemini-2.5-flash-image":
        api_key = x_gemini_key or os.getenv("GOOGLE_AI_API_KEY")
        if not api_key:
            if allow_mock:
                provider = MockProvider()
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="GOOGLE_AI_API_KEY is not set. Please connect it in settings."
                )
        else:
            provider = GeminiProvider(api_key=api_key)
            
    elif request.model == "flux-schnell":
        api_token = x_replicate_token or os.getenv("REPLICATE_API_TOKEN")
        if not api_token:
            if allow_mock:
                provider = MockProvider()
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="REPLICATE_API_TOKEN is not set. Please connect it in settings."
                )
        else:
            provider = FluxProvider(api_token=api_token)
            
    elif request.model == "free-pollinations":
        provider = PollinationsProvider(model="flux")
        
    elif request.model == "free-sdxl":
        provider = PollinationsProvider(model="turbo")
        
    elif request.model == "mock-darkroom-exposure":
        provider = MockProvider()
        
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported model: {request.model}"
        )

    # 3. Generate Images
    try:
        generated_images = await provider.generate(
            prompt=request.prompt,
            aspect_ratio=request.aspect_ratio,
            count=request.count
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Generation failed: {str(e)}"
        )

    # 4. Save and record exposures
    storage = LocalStorage()
    
    # Calculate starting frame number in a transaction-safe manner
    max_frame = db.query(func.max(Generation.frame_number))\
                  .filter(Generation.session_id == session_id)\
                  .scalar() or 0
                  
    generations_created = []
    
    for i, img in enumerate(generated_images):
        frame_number = max_frame + i + 1
        
        # Save image file to disk
        file_path = storage.save_image(
            session_id=session_id,
            frame_number=frame_number,
            image_bytes=img.image_bytes
        )
        
        # Create database entry
        gen = Generation(
            id=str(uuid.uuid4()),
            session_id=session_id,
            frame_number=frame_number,
            prompt=request.prompt,
            model_id=img.model_id,
            aspect_ratio=request.aspect_ratio,
            seed=img.seed,
            file_path=file_path
        )
        db.add(gen)
        generations_created.append(gen)
        
    db.commit()

    for gen in generations_created:
        db.refresh(gen)

    # 5. Set session cookie if newly created or if we want to extend it
    if new_session_created:
        signed_val = sign_session_id(session_id)
        response.set_cookie(
            key="aperture_sid",
            value=signed_val,
            max_age=30 * 24 * 60 * 60,
            httponly=True,
            samesite="lax",
            secure=False
        )
    else:
        # Re-set cookie to extend max-age on active interactions
        signed_val = sign_session_id(session_id)
        response.set_cookie(
            key="aperture_sid",
            value=signed_val,
            max_age=30 * 24 * 60 * 60,
            httponly=True,
            samesite="lax",
            secure=False
        )
        
    return generations_created
