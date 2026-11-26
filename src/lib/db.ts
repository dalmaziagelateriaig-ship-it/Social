import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import {
  EMPTY_PROFILE,
  type Post,
  type PostInput,
  type Profile,
} from "./types";

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      platforms TEXT NOT NULL,
      captions TEXT NOT NULL,
      hashtags TEXT NOT NULL,
      scheduled_at TEXT,
      status TEXT NOT NULL,
      image_idea TEXT NOT NULL DEFAULT '',
      video_script TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS posts_scheduled_at ON posts (scheduled_at);
  `);
  return db;
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
  video_script: string;
  notes: string;
  created_at: string;
};

function rowToPost(row: PostRow): Post {
  return {
    id: row.id,
    title: row.title,
    type: row.type as Post["type"],
    platforms: JSON.parse(row.platforms),
    captions: JSON.parse(row.captions),
    hashtags: JSON.parse(row.hashtags),
    scheduledAt: row.scheduled_at,
    status: row.status as Post["status"],
    imageIdea: row.image_idea,
    videoScript: row.video_script,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function getProfile(): Profile {
  const row = getDb().prepare("SELECT data FROM profile WHERE id = 1").get() as
    | { data: string }
    | undefined;
  return row ? { ...EMPTY_PROFILE, ...JSON.parse(row.data) } : { ...EMPTY_PROFILE };
}

export function saveProfile(profile: Profile): Profile {
  getDb()
    .prepare(
      "INSERT INTO profile (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
    )
    .run(JSON.stringify(profile));
  return profile;
}

/** Posts in a date range (inclusive "YYYY-MM-DD" bounds), or all posts when no range. */
export function listPosts(range?: { from: string; to: string }): Post[] {
  const d = getDb();
  const rows = range
    ? d
        .prepare(
          "SELECT * FROM posts WHERE scheduled_at >= ? AND scheduled_at < ? ORDER BY scheduled_at",
        )
        .all(range.from, `${range.to}T99`)
    : d
        .prepare(
          "SELECT * FROM posts ORDER BY scheduled_at IS NULL, scheduled_at, id DESC",
        )
        .all();
  return (rows as PostRow[]).map(rowToPost);
}

export function getPost(id: number): Post | null {
  const row = getDb().prepare("SELECT * FROM posts WHERE id = ?").get(id) as
    | PostRow
    | undefined;
  return row ? rowToPost(row) : null;
}

export function createPost(input: PostInput): Post {
  const result = getDb()
    .prepare(
      `INSERT INTO posts (title, type, platforms, captions, hashtags, scheduled_at, status, image_idea, video_script, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.title,
      input.type,
      JSON.stringify(input.platforms),
      JSON.stringify(input.captions),
      JSON.stringify(input.hashtags),
      input.scheduledAt,
      input.status,
      input.imageIdea,
      input.videoScript,
      input.notes,
      new Date().toISOString(),
    );
  return getPost(Number(result.lastInsertRowid))!;
}

export function updatePost(id: number, input: PostInput): Post | null {
  getDb()
    .prepare(
      `UPDATE posts SET title = ?, type = ?, platforms = ?, captions = ?, hashtags = ?, scheduled_at = ?,
       status = ?, image_idea = ?, video_script = ?, notes = ? WHERE id = ?`,
    )
    .run(
      input.title,
      input.type,
      JSON.stringify(input.platforms),
      JSON.stringify(input.captions),
      JSON.stringify(input.hashtags),
      input.scheduledAt,
      input.status,
      input.imageIdea,
      input.videoScript,
      input.notes,
      id,
    );
  return getPost(id);
}

export function deletePost(id: number): void {
  getDb().prepare("DELETE FROM posts WHERE id = ?").run(id);
}
