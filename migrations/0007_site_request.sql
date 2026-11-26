-- Requests to list a library or design site, from signed-in users: their own list shows each one's status, and admins
-- settle them (added, with the registry id it became, or declined with a reason). `url` is normalized (https, lowercase
-- host, no trailing slash or hash), so one user asks for a site once and an admin settles every ask for it at once.
create table "site_request" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "url" text not null, "host" text not null, "note" text not null default '', "status" text not null default 'open', "libId" text, "reason" text, "createdAt" integer not null, unique ("userId", "url"));
create index "site_request_open" on "site_request" ("status", "createdAt");
create index "site_request_url" on "site_request" ("url");
-- The caps count one user's rows (waiting, and in the last day) without reading everyone's queue.
create index "site_request_user" on "site_request" ("userId", "status", "createdAt");
