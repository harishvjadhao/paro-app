"""OCR / vision providers for scanned PDFs (Azure Foundry + stub)."""

from __future__ import annotations

from abc import ABC, abstractmethod

import fitz
import httpx

from app.config import settings


class OcrProvider(ABC):
    @abstractmethod
    def ocr_page_image(self, image_png: bytes, *, page_index: int) -> tuple[str, float]:
        """Return (text, confidence 0-100)."""
        raise NotImplementedError


class StubOcrProvider(OcrProvider):
    """Deterministic OCR stand-in when Azure vision is not configured."""

    def ocr_page_image(self, image_png: bytes, *, page_index: int) -> tuple[str, float]:
        _ = image_png
        text = (
            f"Chapter {page_index + 1}\n\n"
            f"[Stub OCR] Scanned page {page_index + 1}. "
            "Configure Azure Foundry vision for real OCR."
        )
        return text, 72.0


class AzureFoundryVisionOcr(OcrProvider):
    def __init__(
        self,
        *,
        endpoint: str,
        api_key: str,
        api_version: str,
        deployment: str,
    ) -> None:
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.api_version = api_version or "2024-02-15-preview"
        self.deployment = deployment

    def ocr_page_image(self, image_png: bytes, *, page_index: int) -> tuple[str, float]:
        import base64

        url = (
            f"{self.endpoint}/openai/deployments/{self.deployment}/chat/completions"
            f"?api-version={self.api_version}"
        )
        b64 = base64.b64encode(image_png).decode("ascii")
        payload = {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Extract all readable text from this scanned book page. "
                                "Preserve paragraph breaks. Return plain text only."
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{b64}"},
                        },
                    ],
                }
            ],
            "temperature": 0,
            "max_tokens": 2000,
        }
        headers = {"api-key": self.api_key, "Content-Type": "application/json"}
        with httpx.Client(timeout=90.0) as client:
            response = client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
        text = (((data.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""
        return str(text).strip(), 85.0


def get_ocr_provider() -> OcrProvider:
    endpoint = (settings.azure_foundry_endpoint or "").strip()
    key = (settings.azure_foundry_key or "").strip()
    deployment = (settings.azure_foundry_vision_deployment or "").strip()
    if endpoint and key and deployment and not settings.ai_force_stub:
        return AzureFoundryVisionOcr(
            endpoint=endpoint,
            api_key=key,
            api_version=settings.azure_foundry_api_version or "2024-02-15-preview",
            deployment=deployment,
        )
    return StubOcrProvider()


def render_page_png(pdf_path: str, page_index: int, *, zoom: float = 2.0) -> bytes:
    doc = fitz.open(pdf_path)
    try:
        page = doc.load_page(page_index)
        matrix = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        return pix.tobytes("png")
    finally:
        doc.close()
