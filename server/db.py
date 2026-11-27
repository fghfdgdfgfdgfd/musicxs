"""SQLite storage. Each row's track list is REPLACED (not appended) on every refresh."""
import json
import os
import sqlite3
import time
from contextlib import contextmanager

PATH = os.environ.get("DB_PATH", "data/music.db")


@contextmanager
def db():
    d = os.path.dirname(PATH)
    if d:
        os.makedirs(d, exist_ok=True)
    c = sqlite3.connect(PATH, timeout=30)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    try:
        with c:  # commit on success, rollback on error
            yield c
    finally:
        c.close()


def init():
    with db() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS tracks(
              id TEXT PRIMARY KEY, title TEXT, artist TEXT, cover TEXT,
              url TEXT, dur INTEGER, seen INTEGER);
            CREATE TABLE IF NOT EXISTS rows(
              slug TEXT PRIMARY KEY, title TEXT, genre TEXT, pos INTEGER, updated INTEGER);
            CREATE TABLE IF NOT EXISTS row_tracks(
              slug TEXT, pos INTEGER, track_id TEXT, PRIMARY KEY(slug, pos));
            CREATE TABLE IF NOT EXISTS recs(
              seed TEXT PRIMARY KEY, ids TEXT, updated INTEGER);
            CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
            """
        )


# ---------- tracks ----------
def _upsert(c, tracks):
    now = int(time.time())
    c.executemany(
        """INSERT INTO tracks(id,title,artist,cover,url,dur,seen) VALUES(?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET title=excluded.title, artist=excluded.artist,
             cover=COALESCE(excluded.cover, tracks.cover), url=excluded.url,
             dur=excluded.dur, seen=excluded.seen""",
        [(t["id"], t["t"], t["a"], t.get("cover"), t["url"], t.get("dur") or 0, now) for t in tracks],
    )


def save_tracks(tracks):
    if tracks:
        with db() as c:
            _upsert(c, tracks)


def _out(r):
    return {"id": r["id"], "t": r["title"], "a": r["artist"], "cover": r["cover"],
            "url": r["url"], "dur": r["dur"]}


def get_track(tid):
    with db() as c:
        r = c.execute("SELECT * FROM tracks WHERE id=?", (tid,)).fetchone()
    return _out(r) if r else None


def get_tracks(ids):
    if not ids:
        return []
    with db() as c:
        q = ",".join("?" * len(ids))
        rs = {r["id"]: r for r in c.execute(f"SELECT * FROM tracks WHERE id IN ({q})", ids)}
    return [_out(rs[i]) for i in ids if i in rs]


# ---------- home rows ----------
def replace_row(slug, title, genre, pos, tracks):
    """Atomic: old list is deleted and the new one inserted in one transaction."""
    with db() as c:
        _upsert(c, tracks)
        c.execute("DELETE FROM row_tracks WHERE slug=?", (slug,))
        c.executemany("INSERT INTO row_tracks(slug,pos,track_id) VALUES(?,?,?)",
                      [(slug, i, t["id"]) for i, t in enumerate(tracks)])
        c.execute("INSERT OR REPLACE INTO rows(slug,title,genre,pos,updated) VALUES(?,?,?,?,?)",
                  (slug, title, genre, pos, int(time.time())))


def set_positions(rows):
    with db() as c:
        c.executemany("UPDATE rows SET pos=?, title=? WHERE slug=?",
                      [(i, r["title"], r["slug"]) for i, r in enumerate(rows)])


def prune_rows(keep):
    """Drop rows that are no longer part of today's genre selection."""
    with db() as c:
        have = [r["slug"] for r in c.execute("SELECT slug FROM rows")]
        for s in have:
            if s not in keep:
                c.execute("DELETE FROM rows WHERE slug=?", (s,))
                c.execute("DELETE FROM row_tracks WHERE slug=?", (s,))


def home():
    with db() as c:
        rows = c.execute("SELECT * FROM rows ORDER BY pos").fetchall()
        out = []
        for r in rows:
            ts = c.execute(
                """SELECT t.* FROM row_tracks rt JOIN tracks t ON t.id=rt.track_id
                   WHERE rt.slug=? ORDER BY rt.pos""", (r["slug"],)).fetchall()
            if ts:
                out.append({"slug": r["slug"], "title": r["title"], "genre": r["genre"],
                            "updated": r["updated"], "tracks": [_out(t) for t in ts]})
    return out


# ---------- recommendations cache ----------
def get_recs(seed, ttl):
    with db() as c:
        r = c.execute("SELECT ids, updated FROM recs WHERE seed=?", (seed,)).fetchone()
    if not r or (ttl is not None and time.time() - r["updated"] > ttl):
        return None
    return json.loads(r["ids"])


def put_recs(seed, ids):
    with db() as c:  # replaces the previous list
        c.execute("INSERT OR REPLACE INTO recs(seed,ids,updated) VALUES(?,?,?)",
                  (seed, json.dumps(ids), int(time.time())))


# ---------- meta ----------
def meta_get(k, default=None):
    with db() as c:
        r = c.execute("SELECT v FROM meta WHERE k=?", (k,)).fetchone()
    return r["v"] if r else default


def meta_set(k, v):
    with db() as c:
        c.execute("INSERT OR REPLACE INTO meta(k,v) VALUES(?,?)", (k, str(v)))
