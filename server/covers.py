"""Cover cache: every cover image is downloaded ONCE and stored on the server's disk (next to the DB,
so it survives redeploys when /data is a volume). The browser then loads /api/cover/<id> with a
1-year immutable cache header and never has to hit SoundCloud again."""
import logging
import os
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from . import db

log = logging.getLogger("covers")
DIR = os.environ.get("COVER_DIR") or os.path.join(os.path.dirname(db.PATH) or ".", "covers")
MAX_BYTES = 3 * 1024 * 1024


def path(tid):
    return os.path.join(DIR, tid + ".img")


def have(tid):
    p = path(tid)
    return os.path.isfile(p) and os.path.getsize(p) > 200


def fetch(tid):
    """Make sure the cover of track `tid` is on disk. Returns True when it is."""
    if have(tid):
        return True
    src = db.raw_cover(tid)
    if not src or not src.startswith("http"):
        return False
    try:
        os.makedirs(DIR, exist_ok=True)
        req = urllib.request.Request(src, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            if not (r.headers.get("Content-Type") or "").startswith("image/"):
                return False
            data = r.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES or len(data) < 200:
            return False
        tmp = path(tid) + ".tmp"
        with open(tmp, "wb") as f:
            f.write(data)
        os.replace(tmp, path(tid))
        return True
    except Exception as e:
        log.debug("cover %s failed: %s", tid, e)
        return False


def media_type(tid):
    with open(path(tid), "rb") as f:
        h = f.read(12)
    if h.startswith(b"\x89PNG"):
        return "image/png"
    if h[:4] == b"RIFF" and h[8:12] == b"WEBP":
        return "image/webp"
    if h[:3] == b"GIF":
        return "image/gif"
    return "image/jpeg"


def prefetch(ids, workers=8):
    ids = [i for i in dict.fromkeys(ids) if not have(i)]
    if ids:
        with ThreadPoolExecutor(workers) as ex:
            ok = sum(ex.map(fetch, ids))
        log.info("covers cached %d/%d", ok, len(ids))


def prune(keep_ids, max_age=3 * 86400):
    """Delete cached covers that aren't in today's rows and haven't been touched for a while."""
    if not os.path.isdir(DIR):
        return
    keep = set(keep_ids)
    now = time.time()
    for n in os.listdir(DIR):
        tid = n.rsplit(".", 1)[0]
        p = os.path.join(DIR, n)
        try:
            if tid not in keep and now - os.path.getmtime(p) > max_age:
                os.remove(p)
        except OSError:
            pass
