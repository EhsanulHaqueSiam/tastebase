#!/bin/sh
# The plugin's headersHelper: sends the key `tastebase login` saved (or TASTEBASE_KEY) to the hosted server, so answers
# carry the user's taste. Signed out it prints {} and the server answers as it does for everyone.
k="${TASTEBASE_KEY:-$(cat "${XDG_CONFIG_HOME:-$HOME/.config}/tastebase/key" 2>/dev/null)}"
if [ -n "$k" ]; then printf '{"Authorization":"Bearer %s"}\n' "$k"; else echo '{}'; fi
