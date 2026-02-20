FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --upgrade pip

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN printf "#!/bin/bash\nRUN_PORT=\"\${PORT:-8000}\"\nuvicorn main:app --host 0.0.0.0 --port \$RUN_PORT\n" > ./start.sh && chmod +x start.sh

CMD ./start.sh
