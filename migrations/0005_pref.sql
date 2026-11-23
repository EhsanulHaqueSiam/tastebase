-- Each user's defaults for their agent: the look (an aesthetic id) and framework a plan or pick uses when the brief
-- names none. Either may be null: then the look is detected or Minimal, the framework detected or React, as for everyone.
create table "pref" ("userId" text not null primary key references "user" ("id") on delete cascade, "look" text, "framework" text, "updatedAt" integer not null);
