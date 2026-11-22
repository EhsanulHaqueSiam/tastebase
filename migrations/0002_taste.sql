-- What each user hid from their agent (library or resource ids; the API only accepts known ones), and their agent key:
-- its SHA-256 hash and last 4 characters. The key itself is shown once, when made; a new key replaces the old.
create table "hidden" ("userId" text not null references "user" ("id") on delete cascade, "item" text not null, "createdAt" integer not null, primary key ("userId", "item"));
create table "agent_key" ("userId" text not null primary key references "user" ("id") on delete cascade, "hash" text not null unique, "last4" text not null, "createdAt" integer not null);
