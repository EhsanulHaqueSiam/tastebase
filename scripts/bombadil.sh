#!/bin/sh
# pnpm bombadil <url> [time-limit]: Bombadil explores the site with bombadil/specification.ts, once at desktop size and
# once at phone size, and stops at the first broken property. Traces land in bench-results/ for `bombadil browser inspect`.
set -eu
url="${1:?usage: pnpm bombadil <url> [time-limit, default 3m]}"
limit="${2:-3m}"
mkdir -p bench-results
stamp=$(date +%Y%m%d-%H%M%S)
status=0
for size in "1440 900 desktop" "390 844 phone"; do
  set -- $size
  echo "bombadil: $3 (${1}x${2}) for $limit against $url"
  npx bombadil browser test "$url" bombadil/specification.ts --headless --width "$1" --height "$2" \
    --time-limit "$limit" --exit-on-violation --output-path "bench-results/bombadil-$3-$stamp" || status=1
done
exit $status
