import os
import sys
import uuid
import shutil
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Response, Cookie, Header, status, UploadFile, Form, File
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

@router.post("/generations/import", response_model=GenerationResponse)
async def import_local_generation(
    response: Response,
    file: UploadFile = File(...),
    prompt: str = Form(...),
    model_id: str = Form(...),
    aspect_ratio: str = Form(...),
    seed: int | None = Form(None),
    aperture_sid: str = Cookie(None),
    db: Session = Depends(get_db),
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

    # 2. Save and record exposure
    storage = LocalStorage()
    
    # Calculate starting frame number in a transaction-safe manner
    max_frame = db.query(func.max(Generation.frame_number))\
                  .filter(Generation.session_id == session_id)\
                  .scalar() or 0
                  
    frame_number = max_frame + 1
    
    try:
        # Save image file to disk
        file_path = storage.save_image(
            session_id=session_id,
            frame_number=frame_number,
            image_bytes=await file.read()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save imported generation: {str(e)}"
        )
        
    # Create database entry
    gen = Generation(
        id=str(uuid.uuid4()),
        session_id=session_id,
        frame_number=frame_number,
        prompt=prompt,
        model_id=model_id,
        aspect_ratio=aspect_ratio,
        seed=seed,
        file_path=file_path
    )
    db.add(gen)
    db.commit()
    db.refresh(gen)

    # 3. Set session cookie if newly created or if we want to extend it
    signed_val = sign_session_id(session_id)
    response.set_cookie(
        key="aperture_sid",
        value=signed_val,
        max_age=30 * 24 * 60 * 60,
        httponly=True,
        samesite="lax",
        secure=False
    )
        
    return gen

@router.post("/engines/install")
async def install_local_engine(
    model_id: str = Form(...),
):
    if model_id == "local-drawthings":
        # Draw Things macOS installation via brew cask
        try:
            brew_path = "brew"
            if not shutil.which("brew") and os.path.exists("/opt/homebrew/bin/brew"):
                brew_path = "/opt/homebrew/bin/brew"
                
            process = await asyncio.create_subprocess_exec(
                brew_path, "install", "--cask", "draw-things",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            if process.returncode != 0:
                err_msg = stderr.decode()
                if "already installed" in err_msg.lower():
                    return {"status": "success", "message": "Draw Things is already installed."}
                raise Exception(err_msg)
            return {"status": "success", "message": "Draw Things installed successfully via Homebrew."}
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Homebrew installation failed: {str(e)}"
            )
    elif model_id == "local-comfyui":
        # Clone ComfyUI into Aperture folder
        try:
            target_dir = os.path.abspath(os.path.join(os.getcwd(), "local_engines", "comfyui"))
            if os.path.exists(target_dir):
                return {"status": "success", "message": "ComfyUI is already cloned."}
                
            os.makedirs(os.path.dirname(target_dir), exist_ok=True)
            process = await asyncio.create_subprocess_exec(
                "git", "clone", "https://github.com/comfyanonymous/ComfyUI.git", target_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            if process.returncode != 0:
                raise Exception(stderr.decode())
            return {"status": "success", "message": "ComfyUI cloned into local_engines/comfyui successfully."}
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"ComfyUI clone failed: {str(e)}"
            )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported local engine: {model_id}"
        )

@router.get("/engines/status")
async def get_engines_status():
    drawthings_installed = os.path.exists("/Applications/Draw Things.app")
    comfyui_installed = os.path.exists(os.path.abspath(os.path.join(os.getcwd(), "local_engines", "comfyui")))
    return {
        "local-drawthings": {"installed": drawthings_installed},
        "local-comfyui": {"installed": comfyui_installed}
    }

@router.post("/engines/launch")
async def launch_local_engine(
    model_id: str = Form(...),
):
    if model_id == "local-drawthings":
        try:
            process = await asyncio.create_subprocess_exec(
                "open", "-a", "Draw Things",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            if process.returncode != 0:
                raise Exception(stderr.decode())
            return {"status": "success", "message": "Draw Things launched successfully."}
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to launch Draw Things: {str(e)}"
            )
    elif model_id == "local-comfyui":
        try:
            target_dir = os.path.abspath(os.path.join(os.getcwd(), "local_engines", "comfyui"))
            python_path = sys.executable or "python"
            import subprocess
            subprocess.Popen([python_path, os.path.join(target_dir, "main.py")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return {"status": "success", "message": "ComfyUI started in background."}
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to launch ComfyUI: {str(e)}"
            )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported local engine: {model_id}"
        )
