import os
import hmac
import hashlib
from typing import Optional

SECRET_KEY = os.getenv("SESSION_SECRET", "darkroom_aperture_monochrome_secret_key_2026")

def sign_session_id(session_id: str) -> str:
    """Signs a session ID using HMAC-SHA256."""
    signature = hmac.new(SECRET_KEY.encode(), session_id.encode(), hashlib.sha256).hexdigest()
    return f"{session_id}.{signature}"

def verify_session_id(cookie_value: Optional[str]) -> Optional[str]:
    """
    Verifies the signature of a session cookie value.
    Returns the clean session ID if valid, otherwise None.
    """
    if not cookie_value or "." not in cookie_value:
        return None
        
    try:
        session_id, signature = cookie_value.split(".", 1)
        expected_sig = hmac.new(SECRET_KEY.encode(), session_id.encode(), hashlib.sha256).hexdigest()
        
        if hmac.compare_digest(signature, expected_sig):
            return session_id
    except Exception:
        pass
        
    return None
