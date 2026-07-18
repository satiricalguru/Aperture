import os
from typing import Protocol

class ImageStorage(Protocol):
    def save_image(self, session_id: str, frame_number: int, image_bytes: bytes) -> str:
        """Saves image bytes and returns a relative file path key."""
        ...
    def get_image_path(self, relative_path: str) -> str:
        """Resolves a relative file path key to an absolute path."""
        ...

class LocalStorage:
    def __init__(self, base_dir: str = None):
        if base_dir is None:
            # Resolve to the workspace root: workspace_root/storage/generations
            backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            workspace_root = os.path.dirname(backend_dir)
            self.base_dir = os.path.join(workspace_root, "storage", "generations")
        else:
            self.base_dir = base_dir

    def save_image(self, session_id: str, frame_number: int, image_bytes: bytes) -> str:
        # Create directory for session
        session_dir = os.path.join(self.base_dir, session_id)
        os.makedirs(session_dir, exist_ok=True)
        
        filename = f"{frame_number}.png"
        file_path = os.path.join(session_dir, filename)
        
        # Write bytes untouched to preserve embedded watermarks/metadata
        with open(file_path, "wb") as f:
            f.write(image_bytes)
            
        # Return relative path for portability in the DB
        return f"{session_id}/{filename}"

    def get_image_path(self, relative_path: str) -> str:
        return os.path.join(self.base_dir, relative_path)
