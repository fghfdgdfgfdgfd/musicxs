# Music (SoundCloud + رادیو)

وب‌اپ موزیک با بک‌اند پایتون (FastAPI + yt-dlp + SQLite). بدون API key.

## اجرا
    docker build -t music .
    docker run --rm -p 8080:8080 -v music-data:/data music
    # http://localhost:8080

سرور باید به اینترنت (soundcloud.com) دسترسی داشته باشد.

## Railway
ریپو را به Railway وصل کن، بعد در Settings > Volumes یک Volume با Mount Path برابر `/data` بساز
(وگرنه با هر دیپلوی دیتابیس پاک می‌شود و لیست‌ها دوباره ساخته می‌شوند).
فقط **یک** instance/worker اجرا شود، چون زمان‌بند ۳ ساعته داخل همین پروسه است.

## چطور کار می‌کند
- **Home**: هر ۳ ساعت لیست هر ردیف دوباره اسکرپ می‌شود و لیست قبلی در دیتابیس **جایگزین** می‌شود
  (اگر اسکرپ شکست بخورد لیست قبلی می‌ماند).
- هر روز ۸ ژانر تصادفی انتخاب می‌شود (+ ردیف‌های ثابت Top Hits و New Releases). ژانرهای روز قبل حذف می‌شوند.
- **Recommended for You**: برای هر پلی‌لیست کاربر یک ردیف جدا؛ از لیست «related» خود SoundCloud
  برای ۳ آهنگ آخر همان پلی‌لیست ساخته می‌شود، هر ۳ ساعت تازه و جایگزین می‌شود.
- **پخش**: `/api/stream/<id>` لینک مستقیم mp3 را با yt-dlp می‌گیرد و ریدایرکت می‌کند. اگر فقط HLS بود، با ffmpeg پخش می‌شود.
- **دانلود**: `/api/download/<id>`.
- **Radio**: ایستگاه‌های رایگان (SomaFM، Radio Paradise، NTS) از `server/radio_stations.json`؛ بدون API.
  ایستگاه جدید = یک آبجکت جدید در همان فایل.

## تنظیمات (env)
`REFRESH_SECONDS` (پیش‌فرض 10800)، `DAILY_GENRES` (8)، `ROW_SIZE` (20)، `DB_PATH`، `SCRAPE_CONCURRENCY` (4)

## نکته
SoundCloud گاهی ساختارش را عوض می‌کند. اگر پخش/اسکرپ خراب شد، دوباره build کن تا آخرین yt-dlp نصب شود.
