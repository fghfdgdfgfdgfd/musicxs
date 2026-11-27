# Music

Static site (HTML + CSS + JS) served by nginx.

## Run locally
    docker build -t music .
    docker run --rm -p 8080:8080 music
Open http://localhost:8080

## Deploy on Railway
Push this folder to a GitHub repo, then in Railway: New Project > Deploy from GitHub repo.
Railway detects the Dockerfile and builds it. Under Settings > Networking, click Generate Domain.
