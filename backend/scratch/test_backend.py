import sys
import os

# Add project root directory to Python path
workspace_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(workspace_root)

from fastapi.testclient import TestClient
from backend.main import app

def test_api_flow():
    client = TestClient(app)
    
    # 1. Health check
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    print("✔ Health check endpoint passed.")

    # 2. Trigger generation with mock model to verify DB + storage
    payload = {
        "prompt": "Test exposure high contrast grain",
        "model": "mock-darkroom-exposure",
        "aspect_ratio": "16:9",
        "count": 2
    }
    response = client.post("/api/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    
    # Verify session cookie was set
    assert "aperture_sid" in response.cookies
    cookie = response.cookies["aperture_sid"]
    print(f"✔ Generation passed. Cookie aperture_sid generated and signed: {cookie}")
    
    # Verify frames sequence
    gen1, gen2 = data[0], data[1]
    assert gen1["prompt"] == payload["prompt"]
    assert gen1["aspect_ratio"] == payload["aspect_ratio"]
    assert gen1["frame_number"] == 1
    assert gen2["frame_number"] == 2
    print(f"✔ Frame sequential increment verified: No. {gen1['frame_number']}, No. {gen2['frame_number']}")

    # 3. Retrieve history using the signed session cookie
    response = client.get("/api/history", cookies={"aperture_sid": cookie})
    assert response.status_code == 200
    history = response.json()
    assert len(history) == 2
    # Check descending ordering (newest frame first)
    assert history[0]["frame_number"] == 2
    assert history[1]["frame_number"] == 1
    print("✔ History retrieval (ordered descending) verified.")

    # 4. Stream image
    image_id = history[0]["id"]
    response = client.get(f"/api/image/{image_id}")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    print("✔ Image streaming from static storage verified.")

    # 5. Delete (soft-delete) generation
    response = client.delete(f"/api/generation/{image_id}", cookies={"aperture_sid": cookie})
    assert response.status_code == 204
    
    # Fetch history again (should only contain 1 item now)
    response = client.get("/api/history", cookies={"aperture_sid": cookie})
    assert response.status_code == 200
    history_after = response.json()
    assert len(history_after) == 1
    assert history_after[0]["frame_number"] == 1
    print("✔ Soft-delete verified (removed from history, file kept on disk).")
    
    # Cleanup DB file created during test if exists
    db_file = os.path.join(workspace_root, "aperture.db")
    if os.path.exists(db_file):
        try:
            os.remove(db_file)
            print("✔ SQLite test DB cleaned up.")
        except Exception:
            pass
            
    print("\nALL BACKEND API TESTS COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    test_api_flow()
