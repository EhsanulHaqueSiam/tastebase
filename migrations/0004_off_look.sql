-- What each user's agent marked wrong for one look (`item`: a library id or library/part; `look`: a look id). That user
-- never gets it under that look; counted across users (GET /api/off-look), it tells tune-picks which tags are wrong.
create table "off_look" ("userId" text not null references "user" ("id") on delete cascade, "item" text not null, "look" text not null, "createdAt" integer not null, primary key ("userId", "item", "look"));
create index "off_look_item_idx" on "off_look" ("item", "look");
