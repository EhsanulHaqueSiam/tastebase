// Heart, add to folder and hide, over a ListingCard's screenshot (`actions`), plus the editor's pick badge and the note a
// hidden card shows. Hearts and folders hold libraries only, so a resource card gets hide alone. Loaded on demand
// (ListingCard), so pages whose cards never show these do not ship the folder sheet.
import FolderPicker from "./FolderPicker.tsx";
import { EditorBadge, HiddenNote, HideButton, SaveButton } from "./LibCard.tsx";

export default function CardActions({ id, name, href }: { id: string; name: string; href: string }) {
  const library = href.startsWith("/browse/"); // a resource's page is under its category
  return (
    <>
      <span className="absolute top-2.5 left-2.5 z-10">
        <EditorBadge id={id} tight />
      </span>
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <HideButton id={id} name={name} href={href} className="bg-black/55 backdrop-blur-md" />
        {library && (
          <>
            <FolderPicker id={id} name={name} className="bg-black/55 backdrop-blur-md" />
            <SaveButton id={id} name={name} className="bg-black/55 backdrop-blur-md" />
          </>
        )}
      </div>
      <HiddenNote id={id} name={name} href={href} />
    </>
  );
}
