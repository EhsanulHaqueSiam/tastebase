-- Editor's picks: libraries and resources the site owner vouches for, each with a one-line reason. Only admins
-- (ADMIN_EMAILS) write here; GET /api/picks lists them for everyone.
create table "editor_pick" ("item" text not null primary key, "reason" text not null, "createdAt" integer not null);
