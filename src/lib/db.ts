import "server-only";
import { sql } from "./sql";
import {
  EMPTY_PROFILE,
  type Platform,
  type Publication,
  type PublicationStatus,
  type Post,
  type PostInput,
  type Profile,
} from "./types";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    platforms TEXT NOT NULL,
    captions TEXT NOT NULL,
    hashtags TEXT NOT NULL,
    scheduled_at TEXT,
    status TEXT NOT NULL,
    image_idea TEXT NOT NULL DEFAULT '',
    media TEXT NOT NULL DEFAULT '[]',
    video_script TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS posts_scheduled_at ON posts (scheduled_at);
  CREATE TABLE IF NOT EXISTS accounts (
    platform TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS publications (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    status TEXT NOT NULL,
    external_id TEXT,
    error TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (post_id, platform)
  );
`;

let ready: Promise<void> | null = null;

/** Database handle, creating the tables on first use. */
async function db() {
  const s = await sql();
  ready ??= s.exec(SCHEMA).catch((e) => {
    ready = null;
    throw e;
  });
  await ready;
  return s;
}

type PostRow = {
  id: number;
  title: string;
  type: string;
  platforms: string;
  captions: string;
  hashtags: string;
  scheduled_at: string | null;
  status: string;
  image_idea: string;
  media: string;
  video_script: string;
  notes: string;
  created_at: string;
};

function rowToPost(row: PostRow): Post {
  return {
    id: Number(row.id),
    title: row.title,
    type: row.type as Post["type"],
    platforms: JSON.parse(row.platforms),
    captions: JSON.parse(row.captions),
    hashtags: JSON.parse(row.hashtags),
    scheduledAt: row.scheduled_at,
    status: row.status as Post["status"],
    imageIdea: row.image_idea,
    media: JSON.parse(row.media),
    videoScript: row.video_script,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function postValues(input: PostInput): unknown[] {
  return [
    input.title,
    input.type,
    JSON.stringify(input.platforms),
    JSON.stringify(input.captions),
    JSON.stringify(input.hashtags),
    input.scheduledAt,
    input.status,
    input.imageIdea,
    JSON.stringify(input.media),
    input.videoScript,
    input.notes,
  ];
}

export async function getProfile(): Promise<Profile> {
  const [row] = await (await db()).query<{ data: string }>("SELECT data FROM profile WHERE id = 1");
  return row ? { ...EMPTY_PROFILE, ...JSON.parse(row.data) } : { ...EMPTY_PROFILE };
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  await (await db()).query(
    "INSERT INTO profile (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = excluded.data",
    [JSON.stringify(profile)],
  );
  return profile;
}

/** Posts in a date range (inclusive "YYYY-MM-DD" bounds), or all posts when no range. */
export async function listPosts(range?: { from: string; to: string }): Promise<Post[]> {
  const d = await db();
  const rows = range
    ? await d.query<PostRow>(
        "SELECT * FROM posts WHERE scheduled_at >= $1 AND scheduled_at < $2 ORDER BY scheduled_at",
        [range.from, `${range.to}T99`],
      )
    : await d.query<PostRow>("SELECT * FROM posts ORDER BY scheduled_at NULLS LAST, id DESC");
  return rows.map(rowToPost);
}

export async function getPost(id: number): Promise<Post | null> {
  const [row] = await (await db()).query<PostRow>("SELECT * FROM posts WHERE id = $1", [id]);
  return row ? rowToPost(row) : null;
}

export async function createPost(input: PostInput): Promise<Post> {
  const [row] = await (await db()).query<PostRow>(
    `INSERT INTO posts (title, type, platforms, captions, hashtags, scheduled_at, status, image_idea, media, video_script, notes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
    [...postValues(input), new Date().toISOString()],
  );
  return rowToPost(row);
}

export async function updatePost(id: number, input: PostInput): Promise<Post | null> {
  const [row] = await (await db()).query<PostRow>(
    `UPDATE posts SET title = $1, type = $2, platforms = $3, captions = $4, hashtags = $5, scheduled_at = $6,
     status = $7, image_idea = $8, media = $9, video_script = $10, notes = $11 WHERE id = $12 RETURNING *`,
    [...postValues(input), id],
  );
  return row ? rowToPost(row) : null;
}

export async function deletePost(id: number): Promise<void> {
  await (await db()).query("DELETE FROM posts WHERE id = $1", [id]);
}

// ---------- Connected accounts (tokens stay on the server) ----------

export async function getAccount<T>(platform: "meta" | "tiktok"): Promise<T | null> {
  const [row] = await (await db()).query<{ data: string }>("SELECT data FROM accounts WHERE platform = $1", [platform]);
  return row ? (JSON.parse(row.data) as T) : null;
}

export async function saveAccount(platform: "meta" | "tiktok", data: unknown): Promise<void> {
  await (await db()).query(
    "INSERT INTO accounts (platform, data) VALUES ($1, $2) ON CONFLICT (platform) DO UPDATE SET data = excluded.data",
    [platform, JSON.stringify(data)],
  );
}

export async function deleteAccount(platform: "meta" | "tiktok"): Promise<void> {
  await (await db()).query("DELETE FROM accounts WHERE platform = $1", [platform]);
}

// ---------- Publishing results ----------

type PublicationRow = {
  post_id: number;
  platform: string;
  status: string;
  external_id: string | null;
  error: string | null;
  updated_at: string;
};

export async function listPublications(postId: number): Promise<Publication[]> {
  const rows = await (await db()).query<PublicationRow>(
    "SELECT * FROM publications WHERE post_id = $1 ORDER BY platform",
    [postId],
  );
  return rows.map((r) => ({
    postId: Number(r.post_id),
    platform: r.platform as Platform,
    status: r.status as PublicationStatus,
    externalId: r.external_id,
    error: r.error,
    updatedAt: r.updated_at,
  }));
}

export async function savePublication(
  postId: number,
  platform: Platform,
  status: PublicationStatus,
  externalId: string | null = null,
  error: string | null = null,
): Promise<void> {
  await (await db()).query(
    `INSERT INTO publications (post_id, platform, status, external_id, error, updated_at) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (post_id, platform) DO UPDATE SET status = excluded.status, external_id = excluded.external_id,
     error = excluded.error, updated_at = excluded.updated_at`,
    [postId, platform, status, externalId, error, new Date().toISOString()],
  );
}

/** Moves a post from one status to another; false if it was no longer in `from` (someone else took it). */
export async function transitionPostStatus(id: number, from: Post["status"], to: Post["status"]): Promise<boolean> {
  const rows = await (await db()).query("UPDATE posts SET status = $1 WHERE id = $2 AND status = $3 RETURNING id", [to, id, from]);
  return rows.length > 0;
}

export async function setPostStatus(id: number, status: Post["status"]): Promise<void> {
  await (await db()).query("UPDATE posts SET status = $1 WHERE id = $2", [status, id]);
}

/** Scheduled posts whose time (local "YYYY-MM-DDTHH:mm") has come. */
export async function listDuePosts(nowLocal: string): Promise<Post[]> {
  const rows = await (await db()).query<PostRow>(
    "SELECT * FROM posts WHERE status = 'programmato' AND scheduled_at IS NOT NULL AND scheduled_at <= $1 ORDER BY scheduled_at",
    [nowLocal],
  );
  return rows.map(rowToPost);
}
