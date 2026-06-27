# Media Downloader API

FastAPI backend that wraps [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) to fetch
metadata + downloadable formats for a YouTube or Instagram link, and to stream
the chosen format back to the client.

## Endpoints

### `GET /health`
Liveness check for Render.

### `POST /api/info`
Returns title, thumbnail, duration, and a list of available formats (with
estimated file size) for a single link. Doesn't download anything.

```bash
curl -X POST http://localhost:8000/api/info \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}'
```

Response shape:

```json
{
  "title": "Some Video",
  "thumbnail": "https://...",
  "duration": 212.0,
  "uploader": "Channel Name",
  "source": "youtube",
  "media_type": "video",
  "formats": [
    {
      "format_id": "137",
      "ext": "mp4",
      "type": "video_only",
      "resolution": "1920x1080",
      "filesize": 45831204,
      "filesize_is_estimate": false,
      "note": "1080p (no audio, merged on download)"
    },
    {
      "format_id": "140",
      "ext": "m4a",
      "type": "audio",
      "abr": 128.0,
      "filesize": 3392011,
      "filesize_is_estimate": false,
      "note": "128kbps audio"
    }
  ]
}
```

Show `note` and a human-readable size (convert `filesize` bytes → MB) in your
quality picker. If `filesize_is_estimate` is true, prefix the size with "~"
in the UI.

### `POST /api/download`
Downloads the chosen format and streams the file back. Pass through the
`type` field from the format you got out of `/api/info` as `format_type` —
it tells the backend whether it needs to merge a separate audio track.

```bash
curl -X POST http://localhost:8000/api/download \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID", "format_id": "137", "format_type": "video_only"}' \
  -o output_video.mp4
```

## Local development

```bash
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

You'll also need `ffmpeg` installed locally (not just in the Docker image) if
you want to test merged/audio downloads:

- macOS: `brew install ffmpeg`
- Ubuntu/Debian: `sudo apt install ffmpeg`
- Windows: [ffmpeg.org/download](https://ffmpeg.org/download.html)

Then run:

```bash
uvicorn main:app --reload --port 8000
```

## Deploying to Render

1. Push this folder to a GitHub repo.
2. In Render: **New → Web Service**, connect the repo, and Render will
   detect `render.yaml` automatically (or set Environment = Docker manually).
3. Set `ALLOWED_ORIGINS` in the Render dashboard to your real Netlify URL
   once the frontend is deployed.
4. Health check path is already set to `/health`.

> **ffmpeg note:** Render's native Python runtime does *not* include ffmpeg.
> This is why the project uses a Dockerfile instead — don't switch the
> service type away from Docker, or audio merging/extraction will fail.

## Known limitations (MVP scope)

- **Instagram Stories** are usually only visible to logged-in followers.
  There's no public/anonymous way to fetch them — supporting this later
  means handling user-supplied session cookies, which adds real security
  considerations (you'd be holding their Instagram login).
- **Carousels / multi-image posts**: only the first item is returned for now.
- **Playlists are intentionally blocked** (`noplaylist: True`) — each request
  handles exactly one video/post, to keep server load predictable.
- **yt-dlp goes stale**: YouTube changes things that break extraction every
  few weeks. Run `pip install -U yt-dlp` regularly, and consider pinning a
  Render cron job or redeploy hook to do this automatically.
- **No rate limiting yet** — add this before going public, since each
  request costs you real bandwidth/CPU on Render.
- **Double-bandwidth download**: the server pulls the file from
  YouTube/Instagram, then re-serves it to your user. This is simpler and
  more reliable than redirecting to the CDN URL directly (which often 403s
  due to header/IP checks), but it means your Render bandwidth usage scales
  with downloads, not just requests.

## Suggested next steps

1. Build the Next.js frontend against these two endpoints.
2. Add basic rate limiting (e.g. `slowapi`) before deploying publicly.
3. Add a scheduled job to keep `yt-dlp` updated.
4. If you want Instagram Stories/private content, design a separate opt-in
   flow for users to provide their own session cookie — don't store it
   longer than the request needs it.
