-- Several agent keys per user, one per agent or machine, each named and signed out on its own (was one key per user).
-- A kept key keeps working: its row moves over with the name "Key".
create table "agent_key_new" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "name" text not null, "hash" text not null unique, "last4" text not null, "createdAt" integer not null);
insert into "agent_key_new" select substr("hash", 1, 12), "userId", 'Key', "hash", "last4", "createdAt" from "agent_key";
drop table "agent_key";
alter table "agent_key_new" rename to "agent_key";
create index "agent_key_userId" on "agent_key" ("userId");

-- A terminal waiting on a browser sign-in (`tastebase login`): `id` is the SHA-256 of the terminal's secret, which the user
-- approved on /connect; the terminal claims one key with the secret itself. Rows stay, claimed, until 10 minutes pass.
create table "device_login" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "name" text not null, "claimed" integer not null default 0, "createdAt" integer not null);
