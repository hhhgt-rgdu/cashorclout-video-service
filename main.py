import os
import tempfile
import subprocess
import whisper
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Whisper model once on startup
model = whisper.load_model("base")

SERVICE_SECRET = os.environ.get("SERVICE_SECRET", "")

class VideoRequest(BaseModel):
    url: str
    secret: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/transcribe")
def transcribe(req: VideoRequest):
    # Validate secret
    if SERVICE_SECRET and req.secret != SERVICE_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = os.path.join(tmpdir, "audio.mp3")

        # Download audio only with yt-dlp
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

        # Find the actual output file (yt-dlp may add extension)
        mp3_file = audio_path
        if not os.path.exists(mp3_file):
            # Try with .mp3 appended
            mp3_file = audio_path + ".mp3"
        if not os.path.exists(mp3_file):
            # Find whatever was downloaded
            files = os.listdir(tmpdir)
            if not files:
                raise HTTPException(status_code=400, detail="No audio file downloaded")
            mp3_file = os.path.join(tmpdir, files[0])

        # Transcribe with Whisper
        transcription = model.transcribe(mp3_file)
        transcript_text = transcription.get("text", "").strip()

        # Also try to get video description via yt-dlp
        desc_result = subprocess.run([
            "yt-dlp",
            "--skip-download",
            "--print", "%(description)s",
            "--no-playlist",
            req.url
        ], capture_output=True, text=True, timeout=30)

        description = desc_result.stdout.strip() if desc_result.returncode == 0 else ""

        return {
            "transcript": transcript_text,
            "description": description[:500] if description else "",
            "url": req.url
        }
