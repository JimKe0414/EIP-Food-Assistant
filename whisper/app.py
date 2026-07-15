import asyncio
import gc
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from faster_whisper import WhisperModel

app = FastAPI(title="One Meal Choice local transcription", docs_url=None, redoc_url=None)
gpu_lock = asyncio.Lock()


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": False}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    suffix = Path(file.filename or "audio").suffix[:12]
    path = None
    model = None
    try:
        with tempfile.NamedTemporaryFile(prefix="meal-audio-", suffix=suffix, delete=False) as temporary:
            path = temporary.name
            while chunk := await file.read(1024 * 1024):
                temporary.write(chunk)

        async with gpu_lock:
            model = WhisperModel(
                os.getenv("WHISPER_MODEL", "medium"),
                device=os.getenv("WHISPER_DEVICE", "cuda"),
                compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "float16"),
            )
            segments, info = model.transcribe(path, vad_filter=True, beam_size=5)
            text = "".join(segment.text for segment in segments).strip()
            if not text:
                raise HTTPException(status_code=422, detail="No speech was detected")
            probability = getattr(info, "language_probability", None)
            return {"text": text, "language": info.language or "zh-TW", "confidence": probability}
    finally:
        await file.close()
        if path:
            Path(path).unlink(missing_ok=True)
        if model is not None:
            del model
        gc.collect()
