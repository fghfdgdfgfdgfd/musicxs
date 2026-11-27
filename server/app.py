import json
import logging
import os
import subprocess
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import date
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import db, scraper

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
log = logging.getLogger("app")

HERE = os.path.dirname(__file__)
WEB = os.environ.get("WEB_DIR", os.path.join(HERE, "..", "web"))
REC_TTL = scraper.INTERVAL  # recommendations are re-fetched (and replaced) every 3h too

with open(os.path.join(HERE, "radio_stations.json"), encoding="utf-8") as f:
    STATIONS = json.load(f)


# ---------------------------------------------------------------- scheduler
_refreshing = threading.Event()


def refresh_all():
    """Pick today's genres, then rebuild every row. A row is only replaced if the new scrape succeeded."""
    if _refreshing.is_set():
        return
    _refreshing.set()
    try:
        day = date.today().isoformat()
        rows = scraper.rows_for(day)  # same day -> same random genres, new day -> new genres
        db.prune_rows({r["slug"] for r in rows})
        db.set_positions(rows)
        slot = int(time.time() // scraper.INTERVAL)

        def one(ix_row):
            ix, r = ix_row
            try:
                ts = scraper.row_tracks(r, slot)
                if len(ts) < 5:
                    raise RuntimeError(f"only {len(ts)} tracks")
                db.replace_row(r["slug"], r["title"], r.get("q", ""), ix, ts)
                log.info("row %-14s %d tracks", r["title"], len(ts))
            except Exception as e:
                log.warning("row %s failed, keeping old list: %s", r["title"], e)

        with ThreadPoolExecutor(3) as ex:
            list(ex.map(one, enumerate(rows)))
        db.meta_set("last_refresh", int(time.time()))
        db.meta_set("genre_day", day)
    finally:
        _refreshing.clear()


def scheduler():
    while True:
        last = int(db.meta_get("last_refresh", 0) or 0)
        wait = last + scraper.INTERVAL - time.time()
        if wait > 0:
            time.sleep(min(wait, 600))
            continue
        try:
            refresh_all()
        except Exception:
            log.exception("refresh failed")
            time.sleep(120)


@asynccontextmanager
async def lifespan(_):
    db.init()
    threading.Thread(target=scheduler, daemon=True, name="scheduler").start()
    yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None)


# ---------------------------------------------------------------- helpers
def track_url(tid, u=None):
    """Find a track's permalink. If the DB doesn't know it, accept the client's URL only when it
    is a real soundcloud.com permalink whose hash equals the id (so it can't be an arbitrary URL)."""
    t = db.get_track(tid)
    if t:
        return t["url"]
    if u and scraper.valid_permalink(u) and scraper.track_id(u) == tid:
        return scraper.norm_url(u)
    return None


def _need(tid, u):
    url = track_url(tid, u)
    if not url:
        raise HTTPException(404, "unknown track")
    try:
        return url, scraper.resolve(url)
    except Exception as e:
        log.warning("resolve failed %s: %s", url, e)
        raise HTTPException(502, "could not get a stream for this track")


def _ffmpeg_iter(src, copy):
    cmd = ["ffmpeg", "-loglevel", "error", "-i", src, "-vn", "-c:a", "copy" if copy else "libmp3lame"]
    cmd += ([] if copy else ["-b:a", "128k"]) + ["-f", "mp3", "pipe:1"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        while True:
            b = p.stdout.read(32768)
            if not b:
                break
            yield b
    finally:
        p.kill()
        p.wait()


def _http_iter(src):
    r = urllib.request.urlopen(urllib.request.Request(src, headers={"User-Agent": "Mozilla/5.0"}), timeout=30)
    try:
        while True:
            b = r.read(65536)
            if not b:
                break
            yield b
    finally:
        r.close()


# ---------------------------------------------------------------- API
@app.get("/api/home")
def api_home():
    rows = db.home()
    last = int(db.meta_get("last_refresh", 0) or 0)
    return JSONResponse({"rows": rows, "updated": last, "refreshing": _refreshing.is_set()},
                        headers={"Cache-Control": "no-store"})


@app.get("/api/radio")
def api_radio():
    return {"stations": STATIONS}


_search_cache = {}


@app.get("/api/search")
def api_search(q: str = Query(min_length=2, max_length=80)):
    q = " ".join(q.split()).lower()
    hit = _search_cache.get(q)
    if hit and hit[0] > time.time():
        return {"tracks": hit[1]}
    try:
        ts = scraper.search(q, 20)
    except Exception as e:
        log.warning("search failed: %s", e)
        raise HTTPException(502, "search failed")
    db.save_tracks(ts)
    if len(_search_cache) > 200:
        _search_cache.clear()
    _search_cache[q] = (time.time() + 600, ts)
    return {"tracks": ts}


class Seed(BaseModel):
    id: str = Field(max_length=32)
    url: str | None = Field(default=None, max_length=300)


class RecIn(BaseModel):
    seeds: list[Seed] = Field(max_length=6)
    exclude: list[str] = Field(default_factory=list, max_length=1000)


@app.post("/api/recommend")
def api_recommend(b: RecIn):
    """Recommended tracks for ONE playlist: SoundCloud 'related' lists of its seed tracks, merged."""
    skip = set(b.exclude) | {s.id for s in b.seeds}
    lists = []
    for s in b.seeds[:4]:
        url = track_url(s.id, s.url)
        if not url:
            continue
        ids = db.get_recs(s.id, REC_TTL)
        if ids is None:  # missing or older than 3h -> fetch and REPLACE
            try:
                ts = scraper.related(url, 15)
            except Exception as e:
                log.warning("related failed %s: %s", url, e)
                ts = []
            if ts:
                db.save_tracks(ts)
                ids = [t["id"] for t in ts]
                db.put_recs(s.id, ids)
            else:
                ids = db.get_recs(s.id, None) or []  # fall back to the stale list
        lists.append(ids)
    out, seen = [], set()
    for i in range(max((len(l) for l in lists), default=0)):  # round-robin so every seed contributes
        for l in lists:
            if i < len(l) and l[i] not in skip and l[i] not in seen:
                seen.add(l[i])
                out.append(l[i])
    return {"tracks": db.get_tracks(out[:20])}


@app.get("/api/stream/{tid}")
def api_stream(tid: str, u: str | None = None):
    _, info = _need(tid, u)
    if info["progressive"]:  # browser talks to SoundCloud's CDN directly: seeking just works
        return RedirectResponse(info["url"], status_code=302, headers={"Cache-Control": "no-store"})
    # only HLS offered: remux/transcode through ffmpeg (no seeking)
    return StreamingResponse(_ffmpeg_iter(info["url"], info["acodec"].startswith("mp3")), media_type="audio/mpeg")


@app.get("/api/download/{tid}")
def api_download(tid: str, u: str | None = None):
    url, info = _need(tid, u)
    t = db.get_track(tid) or {"t": "track", "a": "SoundCloud"}
    ext = info["ext"] if info["progressive"] else "mp3"
    name = f"{t['a']} - {t['t']}.{ext}"
    ascii_name = "".join(c if c.isascii() and c not in '\\/:*?"<>|' else "_" for c in name)
    cd = f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(name)}"
    it = _http_iter(info["url"]) if info["progressive"] else _ffmpeg_iter(info["url"], info["acodec"].startswith("mp3"))
    return StreamingResponse(it, media_type="audio/mpeg" if ext == "mp3" else "application/octet-stream",
                             headers={"Content-Disposition": cd})


@app.get("/api/health")
def health():
    return {"ok": True, "last_refresh": int(db.meta_get("last_refresh", 0) or 0), "refreshing": _refreshing.is_set()}


# ---------------------------------------------------------------- static site
@app.middleware("http")
async def headers(request, call_next):
    r = await call_next(request)
    r.headers["X-Content-Type-Options"] = "nosniff"
    r.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if not request.url.path.startswith("/api"):
        r.headers["Cache-Control"] = "no-cache"
    return r


app.mount("/", StaticFiles(directory=WEB, html=True), name="web")
