out=/tmp/log.patch
  one=/tmp/log-one-commit.patch
  : > "$out"

  for sha in $(git rev-list HEAD); do
    git show -s --date=default \
      --format='commit %H%nAuthor: %an <%ae>%nDate:   %ad%n%n    %s%n' \
      "$sha" >> "$out"

    git show --format= --stat "$sha" >> "$out"

    printf '\nPatch excluding artifacts/** and lockfiles:\n\n' >> "$out"

    git show --format= --patch --unified=0 --no-ext-diff "$sha" -- . \
      ':(exclude)artifacts/**' \
      ':(exclude)package-lock.json' \
      ':(exclude)pnpm-lock.yaml' \
      ':(exclude)yarn.lock' > "$one"

    if [ -s "$one" ]; then
      cat "$one" >> "$out"
    else
      printf 'Patch omitted: this commit only changes artifacts/** and/or lockfiles. Full file stats are shown above.\n'
      >> "$out"
    fi

    printf '\n\n' >> "$out"
  done