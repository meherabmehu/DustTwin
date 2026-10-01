"""Browser-origin configuration for the teammate's separately hosted frontend."""

from pathlib import Path
import sys
import unittest

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/inference"))
from app import cors_origins, create_app


class FrontendOriginTests(unittest.TestCase):
    def test_allowed_frontend_can_preflight_and_read_forecast(self):
        origin = "http://localhost:5173"
        with TestClient(create_app(allowed_origins=[origin])) as client:
            preflight = client.options("/v1/predict", headers={"Origin": origin,
                "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
            self.assertEqual(preflight.status_code, 200)
            self.assertEqual(preflight.headers["access-control-allow-origin"], origin)
            snapshot = client.get("/v1/replay/lab_e3_drill10?second=120", headers={"Origin": origin})
            self.assertEqual(snapshot.status_code, 200)
            response = client.post("/v1/predict", json=snapshot.json()["request"], headers={"Origin": origin})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers["access-control-allow-origin"], origin)
            self.assertEqual(response.json()["mode"], "live_inference")

    def test_unlisted_and_default_origins_are_not_allowed(self):
        with TestClient(create_app(allowed_origins=["http://localhost:5173"])) as client:
            response = client.options("/v1/predict", headers={"Origin": "https://unlisted.example",
                "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
            self.assertEqual(response.status_code, 400)
            self.assertNotIn("access-control-allow-origin", response.headers)
        with TestClient(create_app(allowed_origins=[])) as client:
            self.assertNotIn("access-control-allow-origin", client.get("/health", headers={"Origin": "http://localhost:5173"}).headers)

    def test_origins_must_be_explicit_and_well_formed(self):
        self.assertEqual(cors_origins(" http://localhost:5173/,http://localhost:5173 "), ["http://localhost:5173"])
        for value in ("*", "null", "https://*.example.com", "https://example.com/page", "https://user:pass@example.com", "https://example.com:invalid"):
            with self.assertRaises(ValueError):
                cors_origins(value)


if __name__ == "__main__":
    unittest.main()
