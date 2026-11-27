"""SoundCloud scraping through yt-dlp (no API key). Needs outbound internet access."""
import hashlib
import logging
import os
import re
import threading
import time
import zlib
from concurrent.futures import ThreadPoolExecutor

import yt_dlp

log = logging.getLogger("scraper")
CACHE_DIR = os.environ.get("YTDLP_CACHE", "/tmp/yt-dlp-cache")
SEM = threading.BoundedSemaphore(int(os.environ.get("SCRAPE_CONCURRENCY", "4")))

PERMALINK = re.compile(r"^https://(?:www\.|m\.)?soundcloud\.com/([A-Za-z0-9_\-\.]+)/([A-Za-z0-9_\-\.%]+)/?$")
RESERVED = {"discover", "charts", "stations", "you", "upload", "search", "pages", "mobile", "tags", "popular"}


def valid_permalink(u):
    m = PERMALINK.match(u or "")
    return bool(m) and m.group(1) not in RESERVED and m.group(2) not in ("sets", "tracks", "likes", "reposts", "albums", "popular-tracks")


def norm_url(u):
    u = (u or "").split("?")[0].split("#")[0].rstrip("/")
    return u.replace("://www.", "://").replace("://m.", "://")


def track_id(url):
    """Stable id derived from the permalink. The server can therefore verify an (id, url) pair."""
    return hashlib.sha1(norm_url(url).encode()).hexdigest()[:12]


def _opts(**kw):
    o = dict(quiet=True, no_warnings=True, skip_download=True, socket_timeout=20,
             retries=2, extractor_retries=2, cachedir=CACHE_DIR)
    o.update(kw)
    return o


def _cover(e):
    u = e.get("thumbnail")
    if not u:
        th = [x for x in (e.get("thumbnails") or []) if x.get("url")]
        u = th[-1]["url"] if th else None
    if u:  # ask for 500x500 instead of the 100x100 / original variants
        u = re.sub(r"-(?:large|original|crop|badge|small|tiny|mini|t\d+x\d+)\.", "-t500x500.", u)
    return u


def _light(e):
    """Turn a yt-dlp entry into our track dict, or None if it lacks what we need."""
    url = norm_url(e.get("webpage_url") or e.get("original_url") or e.get("url") or "")
    title = e.get("title")
    artist = e.get("uploader") or e.get("channel") or e.get("artist")
    if not (valid_permalink(url) and title and artist):
        return None
    dur = int(e.get("duration") or 0)
    if dur and (dur < 45 or dur > 1200):  # skip 30s previews and hour-long mixes
        return None
    return {"id": track_id(url), "t": str(title)[:120], "a": str(artist)[:80],
            "cover": _cover(e), "url": url, "dur": dur}


def collect(src, fetch, flat_limit=None):
    """Run a yt-dlp playlist/search source and return clean track dicts."""
    with SEM:
        opts = _opts(extract_flat="in_playlist")
        if flat_limit:
            opts["playlistend"] = flat_limit
        with yt_dlp.YoutubeDL(opts) as y:
            info = y.extract_info(src, download=False) or {}
        entries = [e for e in (info.get("entries") or []) if e][:fetch]

        def one(e):
            t = _light(e)
            if t:
                return t
            u = e.get("url") or e.get("webpage_url")  # flat entries can be bare API urls: resolve them
            if not u:
                return None
            try:
                with yt_dlp.YoutubeDL(_opts(format="bestaudio/best", ignore_no_formats_error=True)) as y:
                    return _light(y.extract_info(u, download=False) or {})
            except Exception as ex:  # geo-blocked, deleted, private ...
                log.debug("skip %s: %s", u, ex)
                return None

        with ThreadPoolExecutor(6) as ex:
            res = list(ex.map(one, entries))
    seen, out = set(), []
    for t in res:
        if t and t["id"] not in seen:
            seen.add(t["id"])
            out.append(t)
    return out


def search(q, n=20):
    return collect(f"scsearch{n}:{q}", fetch=n)


def related(url, n=15):
    """SoundCloud's own 'recommended' list for a track."""
    return collect(norm_url(url) + "/recommended", fetch=n, flat_limit=n)


# ---------- stream resolving (cached, URLs expire) ----------
_cache = {}
_locks = {}
_locks_guard = threading.Lock()


def resolve(url, fresh=False):
    now = time.time()
    if fresh:
        _cache.pop(url, None)
    c = _cache.get(url)
    if c and c[0] > now:
        return c[1]
    with _locks_guard:
        lk = _locks.setdefault(url, threading.Lock())
    with lk:  # N people asking for the same track -> yt-dlp runs once, the rest get the cached result
        c = _cache.get(url)
        if c and c[0] > time.time():
            return c[1]
        return _resolve(url, now)


def _resolve(url, now):
    last = None
    for attempt in range(3):  # SoundCloud sometimes fails once (rate limit / rotated client_id): retry before giving up
        try:
            with SEM:
                with yt_dlp.YoutubeDL(_opts(format="bestaudio[protocol=https]/bestaudio[protocol=http]/bestaudio/best")) as y:
                    i = y.extract_info(url, download=False)
            break
        except Exception as e:
            last = e
            time.sleep(0.7 * (attempt + 1))
    else:
        raise last
    info = {"url": i["url"], "ext": i.get("ext") or "mp3",
            "progressive": i.get("protocol") in ("https", "http"),
            "acodec": i.get("acodec") or ""}
    if len(_cache) > 400:
        for k in [k for k, v in _cache.items() if v[0] < now]:
            _cache.pop(k, None)
    _cache[url] = (now + 600, info)
    return info


# ---------- home rows ----------
INTERVAL = int(os.environ.get("REFRESH_SECONDS", str(3 * 3600)))
DAILY_GENRES = int(os.environ.get("DAILY_GENRES", "8"))
ROW_SIZE = int(os.environ.get("ROW_SIZE", "20"))

FIXED_ROWS = [
    {"slug": "top-hits", "title": "Top Hits", "q": "top hits"},
    {"slug": "new-releases", "title": "New Releases", "q": "new release"},
]
# name -> SoundCloud search query. Order = order of the tiles in the Search tab.
GENRES = {
    "Pop": "pop", "Hip-Hop": "hip hop", "Rap": "rap", "Trap": "trap", "R&B": "r&b", "Rock": "rock",
    "Indie": "indie", "Alternative": "alternative rock", "Electronic": "electronic", "House": "house",
    "Deep House": "deep house", "Tech House": "tech house", "Techno": "techno", "Trance": "trance",
    "Drum & Bass": "drum and bass", "Dubstep": "dubstep", "Future Bass": "future bass", "Synthwave": "synthwave",
    "Lo-Fi": "lofi hip hop", "Chill": "chillout", "Ambient": "ambient", "Jazz": "jazz", "Blues": "blues",
    "Soul": "soul", "Funk": "funk", "Disco": "disco", "Classical": "classical piano", "Piano": "piano",
    "Soundtrack": "cinematic soundtrack", "Acoustic": "acoustic", "Folk": "folk", "Country": "country",
    "Metal": "metal", "Punk": "punk", "Phonk": "phonk", "Drill": "drill", "Reggae": "reggae",
    "Dancehall": "dancehall", "Reggaeton": "reggaeton", "Latin": "latin", "Salsa": "salsa", "Afrobeats": "afrobeats",
    "Amapiano": "amapiano", "K-Pop": "kpop", "J-Pop": "jpop", "Bollywood": "bollywood", "Arabic": "arabic music",
    "Turkish": "turkish pop", "Persian Pop": "persian pop", "Persian Rap": "persian rap", "Persian Traditional": "persian traditional",
    "Workout": "workout", "Focus": "focus study", "Sleep": "sleep music", "Party": "party hits",
}
# a different modifier each 3h slot so a refresh actually brings different tracks
MODS = ["", "new", "best", "hits", "mix", "vibes", "popular"]


def rows_for(day):
    import random
    names = random.Random(day).sample(sorted(GENRES), min(DAILY_GENRES, len(GENRES)))
    rows = list(FIXED_ROWS)
    for n in names:
        rows.append({"slug": "g-" + re.sub(r"[^a-z0-9]+", "-", n.lower()).strip("-"), "title": n, "q": GENRES[n]})
    return rows


def row_tracks(row, slot):
    mod = MODS[(slot + zlib.crc32(row["slug"].encode())) % len(MODS)]
    q = (row["q"] + " " + mod).strip()
    ts = collect(f"scsearch{ROW_SIZE + 12}:{q}", fetch=ROW_SIZE + 12)
    return ts[:ROW_SIZE]
