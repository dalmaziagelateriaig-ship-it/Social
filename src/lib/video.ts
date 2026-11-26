import "server-only";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";
import { saveMedia, withLocalMedia } from "./media";

import { VIDEO_FORMATS, type FitMode, type VideoFormat } from "./videoFormats";

export { VIDEO_FORMATS, type FitMode, type VideoFormat };

export interface VideoClip {
  /** Media URL (/api/media/...) of an uploaded video. */
  url: string;
  start: number;
  end: number;
}

export interface VideoEditRequest {
  clips: VideoClip[];
  format: VideoFormat;
  fit: FitMode;
  mute: boolean;
  /** Transparent PNG the size of the output, drawn in the browser with the on-screen text. */
  overlayUrl?: string | null;
}

export class VideoError extends Error {}

function ffmpegPath(): string {
  const p = process.env.FFMPEG_PATH ?? ffmpegStatic;
  if (!p) throw new VideoError("ffmpeg non è disponibile su questo computer.");
  return p;
}

function run(args: string[], timeoutMs = 10 * 60 * 1000): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath(), args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr = (stderr + d).slice(-20000);
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stderr });
    });
  });
}

async function hasAudio(file: string): Promise<boolean> {
  const { stderr } = await run(["-hide_banner", "-i", file], 30_000);
  return /Stream #\d+:\d+.*: Audio:/.test(stderr);
}


/**
 * Builds the ffmpeg filter graph: each clip is trimmed and fitted to the output
 * size, then all clips are joined and the text overlay is drawn on top.
 */
export function buildFilterGraph(opts: {
  clips: { start: number; end: number; audio: boolean }[];
  w: number;
  h: number;
  fit: FitMode;
  mute: boolean;
  overlayInput: number | null;
  silenceInputs: (number | null)[];
}): { graph: string; videoOut: string; audioOut: string | null } {
  const { w, h } = opts;
  const parts: string[] = [];
  const concatInputs: string[] = [];

  opts.clips.forEach((clip, i) => {
    const trim = `trim=start=${clip.start}:end=${clip.end},setpts=PTS-STARTPTS`;
    const tail = `setsar=1,fps=30,format=yuv420p`;
    if (opts.fit === "sfocato") {
      parts.push(
        `[${i}:v]${trim},split[s${i}a][s${i}b]`,
        `[s${i}a]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=25:2[bg${i}]`,
        `[s${i}b]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg${i}]`,
        `[bg${i}][fg${i}]overlay=(W-w)/2:(H-h)/2,${tail}[v${i}]`,
      );
    } else {
      parts.push(
        `[${i}:v]${trim},scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},${tail}[v${i}]`,
      );
    }
    concatInputs.push(`[v${i}]`);
    if (!opts.mute) {
      const audioSource = clip.audio
        ? `[${i}:a]atrim=start=${clip.start}:end=${clip.end},asetpts=PTS-STARTPTS,`
        : `[${opts.silenceInputs[i]}:a]`;
      parts.push(`${audioSource}aresample=44100,aformat=channel_layouts=stereo[a${i}]`);
      concatInputs.push(`[a${i}]`);
    }
  });

  const n = opts.clips.length;
  parts.push(`${concatInputs.join("")}concat=n=${n}:v=1:a=${opts.mute ? 0 : 1}[vcat]${opts.mute ? "" : "[acat]"}`);
  let videoOut = "[vcat]";
  if (opts.overlayInput !== null) {
    parts.push(`[${opts.overlayInput}:v]scale=${w}:${h}[ovl]`, `[vcat][ovl]overlay=0:0:format=auto,format=yuv420p[vout]`);
    videoOut = "[vout]";
  }
  return { graph: parts.join(";"), videoOut, audioOut: opts.mute ? null : "[acat]" };
}

/** Renders the edited video, stores it in the media folder and returns its URL. */
export async function renderVideo(req: VideoEditRequest): Promise<string> {
  const locals = await Promise.all(
    [...req.clips.map((c) => c.url), ...(req.overlayUrl ? [req.overlayUrl] : [])].map(withLocalMedia),
  );
  try {
    return await render(req, locals.map((l) => l.filePath));
  } finally {
    locals.forEach((l) => l.release());
  }
}

async function render(req: VideoEditRequest, paths: string[]): Promise<string> {
  const { w, h } = VIDEO_FORMATS[req.format];
  const files = paths.slice(0, req.clips.length);
  const audio = req.mute ? files.map(() => false) : await Promise.all(files.map(hasAudio));

  const args = ["-hide_banner", "-y"];
  files.forEach((f) => args.push("-i", f));
  let nextInput = files.length;

  // Silent audio for clips without sound, so all clips can be joined.
  const silenceInputs = req.clips.map((clip, i) => {
    if (req.mute || audio[i]) return null;
    args.push("-f", "lavfi", "-t", String(clip.end - clip.start), "-i", "anullsrc=r=44100:cl=stereo");
    return nextInput++;
  });

  let overlayInput: number | null = null;
  if (req.overlayUrl) {
    args.push("-i", paths[req.clips.length]);
    overlayInput = nextInput++;
  }

  const { graph, videoOut, audioOut } = buildFilterGraph({
    clips: req.clips.map((c, i) => ({ start: c.start, end: c.end, audio: audio[i] })),
    w,
    h,
    fit: req.fit,
    mute: req.mute,
    overlayInput,
    silenceInputs,
  });

  const out = path.join(os.tmpdir(), `social-video-${process.pid}-${Date.now()}.mp4`);
  args.push("-filter_complex", graph, "-map", videoOut);
  if (audioOut) args.push("-map", audioOut, "-c:a", "aac", "-b:a", "128k");
  // Two threads keep memory low on small (free) servers.
  args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-threads", "2", "-movflags", "+faststart", out);

  try {
    const { code, stderr } = await run(args);
    if (code !== 0) {
      console.error("ffmpeg failed", stderr);
      throw new VideoError("Non sono riuscito a creare il video. Controlla che i file siano video validi.");
    }
    return await saveMedia(fs.readFileSync(out), "video/mp4");
  } finally {
    fs.rmSync(out, { force: true });
  }
}

/** Converts an image (PNG, WEBP…) to JPEG, which Instagram requires. Returns the new media URL. */
export async function convertToJpeg(url: string): Promise<string> {
  const local = await withLocalMedia(url);
  const input = local.filePath;
  const out = path.join(os.tmpdir(), `social-jpeg-${process.pid}-${Date.now()}.jpg`);
  try {
    // White background for transparent images, high quality.
    const { code, stderr } = await run(
      ["-hide_banner", "-y", "-i", input, "-vf", "format=rgba,geq=r='r(X,Y)*alpha(X,Y)/255+255*(1-alpha(X,Y)/255)':g='g(X,Y)*alpha(X,Y)/255+255*(1-alpha(X,Y)/255)':b='b(X,Y)*alpha(X,Y)/255+255*(1-alpha(X,Y)/255)',format=yuvj420p", "-q:v", "2", "-frames:v", "1", out],
      60_000,
    );
    if (code !== 0) {
      console.error("jpeg conversion failed", stderr);
      throw new VideoError("Non sono riuscito a convertire l'immagine in JPEG.");
    }
    return await saveMedia(fs.readFileSync(out), "image/jpeg");
  } finally {
    local.release();
    fs.rmSync(out, { force: true });
  }
}
