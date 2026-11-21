import { env } from "cloudflare:workers";
import { deleteFolder, updateFolder, type FolderPatch } from "../../../lib/auth-data.ts";
import { folderName, json, libId, signedIn } from "../../../lib/auth.ts";

const notFound = () => json({ error: "No such folder." }, 404);

// PATCH /api/folders/<id> {name?, public?, add?, remove?} edits your folder; DELETE removes it. Others' folders 404.
export const PATCH = signedIn(async (user, b, { params }) => {
  const p: FolderPatch = { name: folderName(b?.name), public: typeof b?.public === "boolean" ? b.public : undefined, add: libId(b?.add), remove: libId(b?.remove) };
  // A field that was sent but does not parse is an error, not a no-op.
  if (!b || (["name", "public", "add", "remove"] as const).some((k) => b[k] !== undefined && p[k] === undefined))
    return json({ error: "Send {name?: 1 to 60 characters, public?: boolean, add?: library id, remove?: library id}." }, 400);
  return (await updateFolder(env.DB, user.id, params.id!, p)) ? json({ ok: true }) : notFound();
});

export const DELETE = signedIn(async (user, _b, { params }) => ((await deleteFolder(env.DB, user.id, params.id!)) ? json({ ok: true }) : notFound()));
