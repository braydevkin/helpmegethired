#!/usr/bin/env bash

# A release document is the source of truth for a production release. This turns every
# document that has no GitHub Release yet into one, tagging the given commit.
#
# Every document is checked before any release is created, so a malformed one stops the
# run whole rather than half done. Re-running publishes nothing, which makes a retry and
# an unrelated push to main both safe.

set -euo pipefail
shopt -s nullglob

readonly commit="${1:?Usage: publish-releases.sh <commit the tags point at>}"
readonly version_pattern='^v[0-9]+\.[0-9]+\.[0-9]+$'

field() {
  sed -n "s/^- \*\*$1:\*\* \(.*\)$/\1/p" "$2" | head -1
}

documents=(docs/releases/v*.md)

if [ ${#documents[@]} -eq 0 ]; then
  echo "::error::No release document under docs/releases. A release reaches main with its document (see docs/workflow.md, Releases)."
  exit 1
fi

mapfile -t documents < <(printf '%s\n' "${documents[@]}" | sort --version-sort)

for document in "${documents[@]}"; do
  version="$(basename "$document" .md)"

  if [[ ! "$version" =~ $version_pattern ]]; then
    echo "::error file=$document::A release document is named after its tag, as vMAJOR.MINOR.PATCH.md."
    exit 1
  fi

  declared_version="$(field Tag "$document" | tr -d '`')"

  if [ "$declared_version" != "$version" ]; then
    echo "::error file=$document::The document declares the tag '$declared_version' but is named '$version'. They must agree."
    exit 1
  fi
done

reached_main_on="$(git log -1 --format=%cs "$commit")"
published=0

for document in "${documents[@]}"; do
  version="$(basename "$document" .md)"

  if gh release view "$version" >/dev/null 2>&1; then
    continue
  fi

  declared_date="$(field Date "$document")"

  if [ "$declared_date" != "$reached_main_on" ]; then
    echo "::warning file=$document::The document is dated $declared_date and reached main on $reached_main_on."
  fi

  gh release create "$version" --target "$commit" --title "$version" --notes-file "$document"
  echo "Published $version from $document."
  published=$((published + 1))
done

if [ "$published" -eq 0 ]; then
  echo "Every release document already has its GitHub Release."
fi
