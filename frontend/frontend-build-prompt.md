# Build Prompt: Media Downloader Frontend (Next.js + Liquid Glass UI)

You are a senior frontend engineer building the Next.js client for a media
downloader app. The backend is already built and lives in a sibling
`backend/` folder in this same repo — **do not modify it.** Your job is to
create a new `frontend/` folder next to it.

```
project-root/
├── backend/      ← already built (FastAPI + yt-dlp), do not touch
└── frontend/     ← you are building this
```

## What the app does

User pastes a YouTube or Instagram link → app fetches available
qualities/formats with estimated file sizes → user picks one → app downloads
it. That's the whole product. One page, no auth, no database.

---

## 1. Backend API contract (already deployed — build against this exactly)

Base URL comes from `NEXT_PUBLIC_API_URL` (set in `.env.local` for dev,
Netlify env vars for prod).

### `POST /api/info`
Request:
```json
{ "url": "https://www.youtube.com/watch?v=..." }
```

Response `200`:
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
      "fps": 30,
      "abr": null,
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
`type` is one of `"video"` (has audio baked in) / `"video_only"` (will be
merged with audio server-side on download) / `"audio"` / `"image"`.

Response `400`: `{ "detail": "human-readable error message" }` — display
this directly, the backend already writes it to be user-facing.

### `POST /api/download`
Request:
```json
{ "url": "...", "format_id": "137", "format_type": "video_only" }
```
`format_type` must be the exact `type` value from the format the user
picked in `/api/info` — the backend needs it to know whether to merge audio.

Response `200`: raw file bytes, with a `Content-Disposition: attachment;
filename="..."` header. Read the filename from that header rather than
inventing one client-side.

Response `400`: same `{ "detail": ... }` shape as above.

### `GET /health`
Returns `{ "status": "ok" }`. Not needed in the UI, just exists for Render's
health checks.

---

## 2. Design direction: Apple Liquid Glass

Follow Apple's actual Liquid Glass material system (introduced WWDC 2025,
iOS 26/macOS Tahoe), translated to web. Specifics, not vibes:

**Two-layer hierarchy.** A content layer and a controls/navigation layer
that floats above it. In this app: the animated gradient background *is*
the content layer; every glass panel (input bar, preview card, format
list, buttons) belongs to the floating control layer above it. Never put
glass-on-glass — one glass surface per region of the screen.

**Material, not decoration.** Glass should look like it's bending and
reflecting the gradient behind it, not like a flat semi-transparent PNG.
Use `backdrop-filter: blur() saturate()`, a soft outer shadow for lift, and
an inset highlight on the top edge to fake a specular reflection.

**Text never sits directly on raw glass at full transparency.** Apple's own
guideline: foreground text needs a solid or near-opaque backing for
legibility. Use the "regular" (more opaque, ~90% blur+luminosity dampening)
variant for anything with real text — titles, format lists, buttons. Only
use a "clear" (more transparent) variant for purely decorative chrome.

**Tint sparingly.** Real Liquid Glass tints color based on what's behind
it, and only on primary actions — not every element. In this app: only the
Download button gets an accent tint. Everything else stays neutral
frosted white/black glass.

**Elements get "thicker" when they expand.** When a control morphs into a
larger one (e.g. a toolbar button opening a menu), Apple deepens the
shadow and blur to suggest more material. Use this for the signature
interaction below.

**Concentric corners.** Corner radius of inner elements should echo the
radius of whatever contains them, nested neatly — not arbitrary mismatched
radii.

### Signature interaction (the one thing this page should be remembered by)

The URL input is not a separate element from the results. It's **one glass
container that morphs**: it starts as a small pill-shaped search bar
centered on screen. On submit, that same container smoothly grows and
thickens (deeper shadow, more blur) into the full results panel —
thumbnail, title, format list, download button — using a spring transition,
not a hard cut. This directly mirrors how real Liquid Glass controls behave
when they expand, and gives the page one clear "wow" moment instead of
scattered effects everywhere.

### Design tokens

```css
:root {
  /* Background — vivid mesh gradient. Glass needs something colorful behind
     it to refract, this is the content layer. */
  --bg: radial-gradient(circle at 15% 20%, #6F5BFF 0%, transparent 55%),
        radial-gradient(circle at 85% 25%, #00C2FF 0%, transparent 55%),
        radial-gradient(circle at 50% 95%, #FF4FA0 0%, transparent 60%),
        #0B0B12;

  --accent: #5E8BFF;                    /* used ONLY on the download button */
  --accent-pressed: #4A72E0;

  --text-primary: #F5F5F7;
  --text-secondary: rgba(245, 245, 247, 0.65);
  --danger: #FF6B6B;

  --radius-outer: 32px;                 /* the morphing container */
  --radius-inner: 18px;                 /* chips, buttons inside it */

  --glass-bg: rgba(255, 255, 255, 0.10);
  --glass-bg-thick: rgba(255, 255, 255, 0.14);
  --glass-border: rgba(255, 255, 255, 0.18);
  --glass-highlight: rgba(255, 255, 255, 0.35);
}

.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--glass-border);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 var(--glass-highlight);
  border-radius: var(--radius-outer);
}

/* Applied to the container when it's expanded into the results state */
.glass-thick {
  background: var(--glass-bg-thick);
  backdrop-filter: blur(40px) saturate(200%);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 var(--glass-highlight);
}
```

**Typography:** `-apple-system, BlinkMacSystemFont` first in the stack so
real Apple devices render actual SF Pro for free. SF Pro itself isn't
licensed for bundling on the web, so load **Inter** via `next/font` as the
fallback for everyone else — it shares SF Pro's geometry closely enough
that the two are visually consistent.

**Motion:** Framer Motion, spring transitions (`stiffness: 300, damping: 30`)
for the morph. Buttons scale to `0.97` on press for tactile feedback.
Respect `prefers-reduced-motion`: swap the spring morph for a simple
cross-fade, no scale/elastic effects — this mirrors Apple's own Reduced
Motion behavior, which strips elastic properties from Liquid Glass.

**Accessibility:** also respect `prefers-contrast: more` (fall back to
near-solid backgrounds with a visible border instead of translucent glass)
and ensure every interactive element has a visible keyboard focus ring —
glass surfaces are notoriously easy to make illegible, don't skip this.

**No light mode for v1.** Real Liquid Glass adapts between light and dark;
that's a good v2 task, but for now ship one polished dark, color-saturated
theme rather than spreading effort thin. Note this as a deliberate scope
cut, not an oversight.

---

## 3. Components to build

- **`Background`** — fixed, full-viewport gradient mesh from the tokens
  above. Static is fine; a very slow drift animation (60s+ loop) is a nice
  bonus, not a requirement.
- **`MorphCard`** — the signature glass container described above. Holds
  everything else as children, animates between `pill` and `expanded`
  states.
- **`UrlInputBar`** — paste field + submit button, inside `MorphCard` in
  its pill state. Auto-detect YouTube vs Instagram from the URL to show a
  small platform icon once recognized.
- **`LoadingSkeleton`** — shimmering glass placeholder shown inside the
  expanding card while `/api/info` is in flight.
- **`MediaPreview`** — thumbnail, title, uploader, duration (format as
  `mm:ss`), small source badge.
- **`FormatPicker`** — group formats by `type`. If more than one type is
  present, show simple tabs/segmented control (Video / Audio). List each
  format as a selectable glass chip: resolution or bitrate label, plus
  human file size (`formatBytes()` helper — convert to KB/MB/GB, prefix
  with `~` when `filesize_is_estimate` is true).
- **`DownloadButton`** — the one tinted element. Three states: idle → "Use
  this" / downloading → progress bar / done → checkmark, briefly, then
  resets. See progress notes below.
- **`ErrorBanner`** — glass panel, danger-tinted icon + text only (not the
  whole panel), shows the backend's `detail` message verbatim.
- **`Footer`** — one quiet line: something like "For personal use with
  content you have the rights to download." Plain, not preachy, just
  sets expectations.

### Download progress detail worth getting right

`fetch().blob()` alone won't give you progress. To show a real progress
bar: read `response.body` as a `ReadableStream`, accumulate chunk sizes,
and compute percentage against the `Content-Length` response header (the
backend's `FileResponse` sets this automatically since it reads a file of
known size off disk). Reassemble the chunks into a `Blob` at the end, then
trigger the save:

```ts
const blob = new Blob(chunks);
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = filename; // parsed from Content-Disposition header
a.click();
URL.revokeObjectURL(url);
```

---

## 4. Copy guidelines

Write from the user's side of the screen, not the system's. "Pick a
quality" not "Select format." Errors state what happened and don't
apologize — the backend already hands you a clear `detail` message, just
display it. The empty/initial state should invite action: something like
"Paste a YouTube or Instagram link to get started" rather than a blank box.

---

## 5. Build phases

1. **Scaffold** — `create-next-app` (TypeScript, Tailwind, App Router),
   install `framer-motion` + `lucide-react`, wire up design tokens in
   `globals.css`, build the static `Background`.
2. **Input → fetch** — `UrlInputBar` in its pill state, call `/api/info`,
   handle loading + error states (no morph animation yet, just get the
   data flow right).
3. **The morph** — build `MorphCard`'s expand/collapse animation, wire in
   `MediaPreview` + `FormatPicker` once info loads successfully.
4. **Download flow** — `DownloadButton`, the streaming-progress download
   logic above, success/reset states.
5. **Polish** — responsive pass (mobile-first, the card should go
   near-full-width with safe-area padding under ~480px), keyboard focus
   states, `prefers-reduced-motion` / `prefers-contrast` fallbacks.
6. **Deploy** — `netlify.toml`, set `NEXT_PUBLIC_API_URL` in Netlify env
   vars pointing at the Render backend URL, then update the backend's
   `ALLOWED_ORIGINS` env var on Render with the real Netlify URL once
   you have it. Smoke-test the full flow against the live backend before
   calling it done.

Build and verify each phase before moving to the next — don't write all six
phases of code in one pass.
