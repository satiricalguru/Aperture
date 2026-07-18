import os
from fastapi import APIRouter, Depends, HTTPException, status, Cookie
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from backend.db import get_db
from backend.models import Generation, Session as SessionModel
from backend.schemas import GenerationResponse
from backend.storage.local_storage import LocalStorage
from backend.session import verify_session_id
from typing import List

router = APIRouter(prefix="/api")

@router.get("/history", response_model=List[GenerationResponse])
def get_history(
    aperture_sid: str = Cookie(None),
    db: Session = Depends(get_db)
):
    session_id = verify_session_id(aperture_sid)
    if not session_id:
        return []

    # Verify session exists in DB
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        return []
        
    generations = db.query(Generation)\
        .filter(Generation.session_id == session_id, Generation.is_deleted == False)\
        .order_by(desc(Generation.frame_number))\
        .all()
    return generations

@router.get("/image/{generation_id}")
def get_image(
    generation_id: str,
    db: Session = Depends(get_db)
):
    generation = db.query(Generation).filter(Generation.id == generation_id).first()
    if not generation:
        raise HTTPException(status_code=404, detail="Image not found")
        
    storage = LocalStorage()
    abs_path = storage.get_image_path(generation.file_path)
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="Image file not found on disk")
        
    return FileResponse(abs_path, media_type="image/png")

@router.delete("/generation/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_generation(
    id: str,
    aperture_sid: str = Cookie(None),
    db: Session = Depends(get_db)
):
    session_id = verify_session_id(aperture_sid)
    if not session_id:
        raise HTTPException(status_code=401, detail="No active session found")
        
    generation = db.query(Generation).filter(
        Generation.id == id,
        Generation.session_id == session_id
    ).first()
    
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found or unauthorized")
        
    generation.is_deleted = True
    db.commit()
    
    # Re-index remaining frames for this session sequentially
    remaining = db.query(Generation).filter(
        Generation.session_id == session_id,
        Generation.is_deleted == False
    ).order_by(Generation.created_at.asc()).all()
    
    for idx, gen in enumerate(remaining):
        gen.frame_number = idx + 1
        
    db.commit()
    return
