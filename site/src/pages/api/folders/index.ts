import { env } from "cloudflare:workers";
import { createFolder, MAX_FOLDERS } from "../../../lib/auth-data.ts";
import { folderName, json, libId, signedIn } from "../../../lib/auth.ts";

// POST /api/folders {name, lib?} -> the new folder; `lib` files a first library into it.
export const POST = signedIn(async (user, b) => {
  const name = folderName(b?.name);
  if (!name) return json({ error: "A folder name is 1 to 60 characters." }, 400);
  const folder = await createFolder(env.DB, user.id, name, libId(b?.lib));
  return folder ? json(folder, 201) : json({ error: `You have ${MAX_FOLDERS} folders, the most there can be.` }, 409);
});
