"""Genre / radio photos. Photos come from free image sites that need no API key (Wikimedia Commons first,
LoremFlickr as a fallback). Every photo is downloaded ONCE and stored on disk next to the DB (like covers),
then served by /api/img/... with a long cache header.

- Genre tiles: one photo per genre, picked from the search results of a hand-written query (GENRE_Q) and kept.
- Radio covers: a RANDOM photo from the search results of the station's title/genre; it is re-rolled every
  IMG_RADIO_TTL seconds (default 7 days) so the covers change from time to time."""
import hashlib
import json
import logging
import os
import random
import re
import threading
import time
import urllib.parse
import urllib.request

from . import db

log = logging.getLogger("images")
DIR = os.environ.get("IMG_DIR") or os.path.join(os.path.dirname(db.PATH) or ".", "imgs")
RADIO_TTL = int(os.environ.get("IMG_RADIO_TTL", str(7 * 86400)))
UA = "MusicSite/1.0 (personal music web app; https://commons.wikimedia.org/wiki/Commons:API)"
MAX_BYTES = 4 * 1024 * 1024
BAD = re.compile(r"logo|map\b|flag|diagram|poster|cover|album|stamp|screenshot|chart|icon|signature|coat of arms|"
                 r"sheet music|score|\bbook\b|advert|banner|cartoon|drawing|painting|manuscript|\bcd\b|vinyl record label", re.I)

# genre name -> photo search phrases (first that returns usable photos wins)
GENRE_Q = {
    "Pop": ["pop concert stage lights crowd", "pop singer on stage"],
    "Hip-Hop": ["hip hop dj turntables", "hip hop concert rapper stage"],
    "Rap": ["rapper performing microphone stage", "rap battle microphone"],
    "Trap": ["rapper performing night club lights", "hip hop producer studio"],
    "R&B": ["soul singer microphone concert", "singer microphone studio"],
    "Rock": ["rock band concert guitarist", "electric guitar stage"],
    "Indie": ["indie band live small venue", "guitarist band live"],
    "Alternative": ["alternative rock band live concert", "band performing concert"],
    "Electronic": ["electronic music synthesizer", "dj controller club lights"],
    "House": ["house music dj club", "dj mixing nightclub"],
    "Deep House": ["dj mixer night club blue light", "club dj sunset"],
    "Tech House": ["dj booth club", "dj headphones mixer"],
    "Techno": ["techno club laser lights", "rave laser lights crowd"],
    "Trance": ["trance festival crowd lasers", "electronic dance festival main stage"],
    "Drum & Bass": ["drum and bass dj", "dj mixer festival night"],
    "Dubstep": ["dubstep festival crowd", "bass music festival stage"],
    "Future Bass": ["electronic festival stage lights", "music festival colorful lights"],
    "Synthwave": ["synthesizer keyboard analog", "retro synthesizer"],
    "Lo-Fi": ["headphones desk night study", "vinyl turntable cozy room"],
    "Chill": ["beach sunset calm", "hammock beach relax"],
    "Ambient": ["misty mountains sunrise", "foggy forest landscape"],
    "Jazz": ["jazz saxophone player", "jazz club musicians"],
    "Blues": ["blues guitarist", "blues musician old guitar"],
    "Soul": ["soul singer on stage", "gospel choir singing"],
    "Funk": ["funk band bass guitar", "bass guitarist live"],
    "Disco": ["disco ball", "mirror ball dance floor"],
    "Classical": ["symphony orchestra concert hall", "orchestra conductor"],
    "Piano": ["grand piano keys", "pianist playing piano"],
    "Soundtrack": ["film orchestra recording", "cinema film projector"],
    "Acoustic": ["acoustic guitar", "acoustic guitar player outdoors"],
    "Folk": ["folk musicians instruments", "banjo player"],
    "Country": ["country music guitar cowboy hat", "nashville country musician"],
    "Metal": ["heavy metal concert guitarist", "metal band live fire stage"],
    "Punk": ["punk rock concert crowd", "punk band live"],
    "Phonk": ["night street car neon", "drift car night"],
    "Drill": ["city night street hooded", "urban night street lights"],
    "Reggae": ["reggae musician dreadlocks guitar", "jamaica beach palm"],
    "Dancehall": ["jamaica carnival dancers", "caribbean carnival"],
    "Reggaeton": ["latin dancers street", "reggaeton concert crowd"],
    "Latin": ["latin band musicians", "salsa dancers"],
    "Salsa": ["salsa dancers", "salsa band congas"],
    "Afrobeats": ["african drummers", "djembe drummer"],
    "Amapiano": ["south africa johannesburg party", "african dancers"],
    "K-Pop": ["k-pop concert", "korean pop idol group stage"],
    "J-Pop": ["tokyo neon street night", "japanese idol concert"],
    "Bollywood": ["bollywood dancers", "indian dance festival colorful"],
    "Arabic": ["oud player", "arabic musicians instruments"],
    "Turkish": ["saz baglama player", "istanbul bosphorus"],
    "Persian Pop": ["tehran milad tower", "iranian musicians concert"],
    "Persian Rap": ["tehran skyline night", "azadi tower tehran"],
    "Persian Traditional": ["santur player", "tar setar persian instrument"],
    "Workout": ["gym weights training", "runner sunrise"],
    "Focus": ["desk laptop focus study", "library reading desk"],
    "Sleep": ["moon night sky stars", "starry night sky"],
    "Party": ["party confetti crowd", "nightclub dancing crowd"],
}

# radio id -> phrases; stations not listed fall back to "<name> <genre>"
RADIO_Q = {
    "somafm-groovesalad": ["chillout lounge sunset", "salad bowl fresh", "ambient downtempo landscape"],
    "somafm-deepspaceone": ["deep space nebula", "galaxy milky way", "outer space stars"],
    "somafm-dronezone": ["foggy mountains ambient", "atmospheric clouds sky", "drone landscape fog"],
    "somafm-lush": ["woman singer microphone", "lush green plants", "vocalist soft light"],
    "somafm-spacestation": ["space station earth orbit", "astronaut space", "iss earth"],
    "somafm-beatblender": ["dj mixer blender club", "deep house dj", "night club lights"],
    "somafm-defcon": ["hacker keyboard code", "computer security hacker", "cyber binary code"],
    "somafm-thetrip": ["progressive house festival", "psychedelic light show", "festival lasers night"],
    "somafm-secretagent": ["spy suit mysterious", "retro lounge cocktail", "spy film noir city"],
    "somafm-indiepop": ["indie pop band live", "indie band guitar", "young band concert"],
    "somafm-bootliquor": ["americana guitar", "cowboy boots", "western desert road"],
    "somafm-u80s": ["1980s synthesizer", "retro arcade neon", "new wave band 1980s"],
    "rp-main": ["vinyl records collection", "music lover headphones", "record store"],
    "rp-mellow": ["mellow sunset lake", "calm acoustic guitar", "cozy coffee morning"],
    "rp-rock": ["rock concert guitarist", "rock band stage lights", "electric guitar amp"],
    "rp-global": ["world map globe", "world music drummers", "global cultures festival"],
    "nts-1": ["radio studio microphone", "dj radio booth", "london night city"],
    "nts-2": ["radio mixing desk", "vinyl dj record", "record shop crates"],
}

_locks = {}
_glock = threading.Lock()


def _lock(key):
    with _glock:
        return _locks.setdefault(key, threading.Lock())


def _get(url, timeout=20, limit=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(limit) if limit else r.read(), (r.headers.get("Content-Type") or "")


def _commons(q, n=30):
    """Photo URLs (800px wide thumbnails) from Wikimedia Commons for a search phrase."""
    p = dict(action="query", format="json", generator="search", gsrsearch=q + " filetype:bitmap", gsrnamespace=6,
             gsrlimit=n, prop="imageinfo", iiprop="url|mime|size", iiurlwidth=800)
    data, _ = _get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p), limit=2_000_000)
    pages = (json.loads(data).get("query") or {}).get("pages") or {}
    out = []
    for pg in pages.values():
        try:
            ii = pg["imageinfo"][0]
        except (KeyError, IndexError):
            continue
        if ii.get("mime") != "image/jpeg" or BAD.search(pg.get("title", "")):
            continue
        if ii.get("width", 0) < 900 or ii.get("height", 0) < 500:
            continue
        out.append(ii.get("thumburl") or ii["url"])
    return out


def _flickr(q, seed):
    kw = ",".join(re.findall(r"[a-z]+", q.lower())[:2]) or "music"
    return f"https://loremflickr.com/800/800/{kw}?lock={seed % 9999}"


def _path(kind, key):
    return os.path.join(DIR, kind + "-" + hashlib.sha1(key.encode()).hexdigest()[:16] + ".img")


def _ok(p, ttl=None):
    return os.path.isfile(p) and os.path.getsize(p) > 2000 and (ttl is None or time.time() - os.path.getmtime(p) < ttl)


def _save(p, data, ctype):
    if not ctype.startswith("image/") or not (2000 < len(data) <= MAX_BYTES):
        return False
    os.makedirs(DIR, exist_ok=True)
    tmp = p + ".tmp"
    with open(tmp, "wb") as f:
        f.write(data)
    os.replace(tmp, p)
    return True


def ensure(kind, key, queries, ttl=None, rng=None):
    """Path of the cached photo for (kind, key); downloads one when missing/expired. None if nothing worked."""
    p = _path(kind, key)
    if _ok(p, ttl):
        return p
    with _lock(p):
        if _ok(p, ttl):
            return p
        rng = rng or random.Random()
        urls = []
        for q in queries:
            try:
                urls += _commons(q)
            except Exception as e:
                log.debug("commons %r failed: %s", q, e)
            if len(urls) >= 6:
                break
        rng.shuffle(urls)
        for u in urls[:4]:
            try:
                data, ct = _get(u, limit=MAX_BYTES + 1)
                if _save(p, data, ct):
                    return p
            except Exception as e:
                log.debug("download failed: %s", e)
        try:  # fallback: keyword photo from LoremFlickr
            data, ct = _get(_flickr(queries[0], rng.randrange(10**6)), limit=MAX_BYTES + 1)
            if _save(p, data, ct):
                return p
        except Exception as e:
            log.debug("flickr failed: %s", e)
        return p if _ok(p) else None  # keep the old photo if a refresh failed


def genre(name):
    qs = GENRE_Q.get(name) or [name + " music"]
    return ensure("g", name, qs, None, random.Random(name))


def radio(st):
    qs = RADIO_Q.get(st["id"]) or [st["name"] + " " + st.get("genre", ""), st.get("genre", "") + " music"]
    return ensure("r", st["id"], qs, RADIO_TTL)


def media_type(p):
    with open(p, "rb") as f:
        h = f.read(12)
    if h.startswith(b"\x89PNG"):
        return "image/png"
    if h[:4] == b"RIFF" and h[8:12] == b"WEBP":
        return "image/webp"
    if h[:3] == b"GIF":
        return "image/gif"
    return "image/jpeg"


def warm(genres, stations):
    """Background job at startup: download everything once so the first visit is instant."""
    n = 0
    for st in stations:
        n += bool(radio(st))
        time.sleep(0.4)
    for g in genres:
        n += bool(genre(g))
        time.sleep(0.4)
    log.info("photos ready: %d/%d", n, len(stations) + len(genres))
