import os
import tempfile
import subprocess
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from faster_whisper import WhisperModel

app = FastAPI()

app.add_middleware(
CORSMiddleware,
allow_origins=[”*”],
allow_methods=[”*”],
allow_headers=[”*”],
)

# Load model once on startup

model = WhisperModel(“base”, device=“cpu”, compute_type=“int8”)

SERVICE_SECRET = os.environ.get(“SERVICE_SECRET”, “”)

class VideoRequest(BaseModel):
url: str
secret: str

@app.get(”/health”)
def health():
return {“status”: “ok”}

@app.post(”/transcribe”)
def transcribe(req: VideoRequest):
if SERVICE_SECRET and req.secret != SERVICE_SECRET:
raise HTTPException(status_code=401, detail=“Unauthorized”)

```
with tempfile.TemporaryDirectory() as tmpdir:
    audio_path = os.path.join(tmpdir, "audio.mp3")

    result = subprocess.run([
        "yt-dlp",
        "--extract-audio",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "--output", audio_path,
        "--no-playlist",
        "--max-filesize", "50m",
        req.url
    ], capture_output=True, text=True, timeout=120)

    if result.returncode != 0:
        raise HTTPException(status_code=400, detail=f"Download failed: {result.stderr}")

    # Find output file
    mp3_file = audio_path
    if not os.path.exists(mp3_file):
        mp3_file = audio_path + ".mp3"
    if not os.path.exists(mp3_file):
        files = os.listdir(tmpdir)
        if not files:
            raise HTTPException(status_code=400, detail="No audio file downloaded")
        mp3_file = os.path.join(tmpdir, files[0])

    # Transcribe
    segments, _ = model.transcribe(mp3_file)
    transcript_text = " ".join([seg.text for seg in segments]).strip()

    # Get description
    desc_result = subprocess.run([
        "yt-dlp", "--skip-download", "--print", "%(description)s",
        "--no-playlist", req.url
    ], capture_output=True, text=True, timeout=30)

    description = desc_result.stdout.strip() if desc_result.returncode == 0 else ""

    return {
        "transcript": transcript_text,
        "description": description[:500] if description else "",
        "url": req.url
    }
```
