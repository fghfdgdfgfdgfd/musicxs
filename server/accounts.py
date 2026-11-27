"""Persistent user accounts and opaque, revocable browser sessions."""
import hashlib
import hmac
import re
import secrets
import sqlite3
import time

from . import db

PBKDF2_ITERATIONS = 310_000
SESSION_TTL = 30 * 24 * 60 * 60


def normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def valid_email(email: str) -> bool:
    return len(email) <= 254 and len(email) >= 3 and bool(
        re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]{2,}", email)
    )


def _password_record(password: str):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return salt.hex(), digest.hex()


def _verify(password: str, salt_hex: str, digest_hex: str) -> bool:
    try:
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
    except (TypeError, ValueError):
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return hmac.compare_digest(actual, expected)


def _public(row):
    return {"name": row["name"], "email": row["email"]}


def get_user_by_email(email: str):
    with db.db() as c:
        row = c.execute("SELECT * FROM users WHERE email=? COLLATE NOCASE", (normalize_email(email),)).fetchone()
    return dict(row) if row else None


def create_user(name: str, email: str, password: str):
    name = " ".join(str(name or "").split())
    email = normalize_email(email)
    salt, digest = _password_record(password)
    now = int(time.time())
    try:
        with db.db() as c:
            cur = c.execute(
                "INSERT INTO users(name,email,password_salt,password_hash,created,updated) VALUES(?,?,?,?,?,?)",
                (name, email, salt, digest, now, now),
            )
            user_id = cur.lastrowid
    except sqlite3.IntegrityError:
        return None
    return {"id": user_id, "name": name, "email": email}


def authenticate(email: str, password: str):
    user = get_user_by_email(email)
    if not user or not _verify(password, user["password_salt"], user["password_hash"]):
        return None
    return {"id": user["id"], "name": user["name"], "email": user["email"]}


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(user_id: int):
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    with db.db() as c:
        c.execute("DELETE FROM sessions WHERE expires<=?", (now,))
        c.execute("INSERT INTO sessions(token_hash,user_id,expires,created) VALUES(?,?,?,?)",
                  (_token_hash(token), user_id, now + SESSION_TTL, now))
    return token


def get_session_user(token: str):
    if not token:
        return None
    now = int(time.time())
    with db.db() as c:
        row = c.execute(
            """SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id
               WHERE s.token_hash=? AND s.expires>?""",
            (_token_hash(token), now),
        ).fetchone()
    return dict(row) if row else None


def revoke_session(token: str):
    if not token:
        return
    with db.db() as c:
        c.execute("DELETE FROM sessions WHERE token_hash=?", (_token_hash(token),))


def change_password(user_id: int, current: str, new: str, keep_token: str) -> bool:
    with db.db() as c:
        row = c.execute("SELECT password_salt,password_hash FROM users WHERE id=?", (user_id,)).fetchone()
        if not row or not _verify(current, row["password_salt"], row["password_hash"]):
            return False
        salt, digest = _password_record(new)
        now = int(time.time())
        c.execute("UPDATE users SET password_salt=?,password_hash=?,updated=? WHERE id=?",
                  (salt, digest, now, user_id))
        c.execute("DELETE FROM sessions WHERE user_id=? AND token_hash<>?",
                  (user_id, _token_hash(keep_token)))
    return True


def delete_user(user_id: int, password: str) -> bool:
    with db.db() as c:
        row = c.execute("SELECT password_salt,password_hash FROM users WHERE id=?", (user_id,)).fetchone()
        if not row or not _verify(password, row["password_salt"], row["password_hash"]):
            return False
        c.execute("DELETE FROM users WHERE id=?", (user_id,))
    return True
