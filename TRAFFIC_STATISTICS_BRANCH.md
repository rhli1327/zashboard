# Traffic statistics branch

`traffic-statistics` is a long-lived, opt-in dashboard variant. The normal
`main` branch continues to track Zephyruso/zashboard and publish the regular
`latest` release.

## Updating from upstream

Let the existing `sync-upstream.yml` workflow open and update the upstream sync
pull request against `main`. After that pull request is reviewed and merged,
bring the result into the feature branch without rewriting history:

```bash
git fetch origin
git switch -c sync/traffic-upstream-YYYYMMDD origin/traffic-statistics
git merge --no-edit origin/main
pnpm type-check
pnpm build
git push -u origin sync/traffic-upstream-YYYYMMDD
```

Resolve conflicts by preserving upstream UI behavior first, then reapplying the
small capability probe, traffic API client/store, route gate, and statistics
page. Merge the temporary branch through a reviewed pull request whose base is
`traffic-statistics`; do not force-push the long-lived feature branch. Do not
merge this feature branch back into `main` unless traffic statistics is
deliberately promoted to the regular product.

A feature-branch push updates only the `traffic-statistics-latest` rolling
release and the `traffic-statistics` container tag. It does not move the normal
`latest` tag.

When both projects change, verify and publish the mbox REST contract first, then
publish Zashboard. Incompatible REST changes require a new `api_version`;
additive changes should remain capability-driven.
