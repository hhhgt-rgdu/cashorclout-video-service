import os
import tempfile
import subprocess
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

SERVICE_SECRET = os.environ.get("SERVICE_SECRET", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

class VideoRequest(BaseModel):
    url: str
    secret: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/transcribe")
def transcribe(req: VideoRequest):
    if SERVICE_SECRET and req.secret != SERVICE_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")
    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = os.path.join(tmpdir, "audio.mp3")
        result = subprocess.run(["yt-dlp", "--extract-audio", "--audio-format", "mp3", "--audio-quality", "5", "--output", audio_path, "--no-playlist", "--max-filesize", "25m", req.url], capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            raise HTTPException(status_code=400, detail="Download failed")
        mp3_file = audio_path
        if not os.path.exists(mp3_file):
            mp3_file = audio_path + ".mp3"
        if not os.path.exists(mp3_file):
            files = os.listdir(tmpdir)
            if not files:
                raise HTTPException(status_code=400, detail="No audio downloaded")
            mp3_file = os.path.join(tmpdir, files[0])
        openai_client = OpenAI(api_key=OPENAI_API_KEY)
        with open(mp3_file, "rb") as audio_file:
            transcription = openai_client.audio.transcriptions.create(model="whisper-1", file=audio_file)
        transcript_text = transcription.text.strip()
        desc_result = subprocess.run(["yt-dlp", "--skip-download", "--print", "%(description)s", "--no-playlist", req.url], capture_output=True, text=True, timeout=30)
        description = desc_result.stdout.strip()[:500] if desc_result.returncode == 0 else ""
        return {"transcript": transcript_text, "description": description, "url": req.url}