import "server-only";
import { sql } from "./sql";
import {
  EMPTY_PROFILE,
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
