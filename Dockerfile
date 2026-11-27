FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
# no version pin on yt-dlp on purpose: SoundCloud changes often, rebuilding pulls the newest extractor
RUN pip install --no-cache-dir -r requirements.txt

COPY server ./server
COPY web ./web

# Railway: add a Volume mounted at /data so the DB survives redeploys.
ENV PORT=8080 DB_PATH=/data/music.db
RUN mkdir -p /data
EXPOSE 8080

# ONE worker only: the 3-hour scheduler runs inside the process.
CMD ["sh", "-c", "uvicorn server.app:app --host 0.0.0.0 --port ${PORT} --workers 1"]
