# Releases

Version Packages creates the version PR after successful main CI. Release
publishes the merged version commit after its main CI succeeds. `release.yml`
owns npm and JSR publishing; don't publish packages locally.

## Version PR checks

Set the repository Actions secret `CHANGESETS_GITHUB_TOKEN` to a dedicated
personal access token for `kehto/web`, with Contents and Pull requests read/write
permissions. An alternative GitHub App setup needs to mint a fresh installation
token before invoking the version action; don't store an expiring installation
token as a permanent secret.
Pass the token to both checkout and the Changesets action's `github-token` input.
Setting only the action's `GITHUB_TOKEN` environment variable doesn't select a
custom token in the current action.

Without the secret, the workflow falls back to GitHub's default token. GitHub
requires approval for workflows on PRs created or updated with that token. Open
the Version Packages PR and select **Approve workflows to run** before the runs
expire. A failed run with no jobs and the annotation "required approval but was
not approved before it expired" is an approval failure, not a build failure.
Don't merge the version PR until its checks pass.

See [GitHub's workflow trigger rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
and the [Changesets action inputs](https://github.com/changesets/action).

## Registry permissions

For every public package, configure npm Trusted Publishing for owner `kehto`,
repository `web`, workflow filename `release.yml`, and no environment unless the
release job declares one. The publisher needs permission to publish, not just
to stage packages. Check each new package individually: another package's
successful publish doesn't establish permission for it.

On JSR, create the package under `@kehto` and link its settings to `kehto/web`.
The human triggering the main CI/recovery run needs to belong to the JSR scope.
`actorNotAuthorized` with `githubRepository: null` in the public package API means
the repository link is missing. npm `E404` on a publish PUT can mean an absent
or mismatched Trusted Publisher even when the package already exists.

An upload can also be staged without becoming public. npm may report the upload
as successful while public metadata still shows the old version. A retry then
fails with `E409 Cannot publish over previously staged version`. Open your npm
account's **Staged Packages** tab and approve the existing version with 2FA.
Enabling direct publishing doesn't promote versions already staged. Don't bump
the version or keep retrying that upload. The release workflow checks public
metadata after a successful npm upload, makes six attempts five seconds apart,
and fails with approval guidance if a version is still unavailable.

See [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/),
[JSR publishing](https://jsr.io/docs/publishing-packages), and
[JSR authorization errors](https://jsr.io/docs/troubleshooting).
See also [npm staged publishing](https://docs.npmjs.com/staged-publishing/).

## Recover a partial release

Fetch `origin/main` and identify the exact target SHA. Confirm the CI run for
that same SHA succeeded, including required docs and browser checks or their
intentional release-metadata skips. Check Pages and Version Packages prerequisite
runs too. Resolve any pending or failed prerequisite before dispatching Release.

```bash
git fetch origin main
gh run list --branch main --commit <validated-sha>
gh workflow run release.yml --ref main -f release_sha=<validated-sha>
```

To repair only JSR, add `-f skip_npm=true`. To limit a JSR repair, add
`-f 'jsr_filter=@kehto/mocks @kehto/services'`; include unpublished dependencies
or run the default full package set. Existing published versions are skipped.
JSR runs sequentially in dependency order. A failure leaves the run red while
independent packages can still publish. JSR requires a successful build and
metadata sync, even when npm fails.

After the run finishes, compare every public package's target version against
npm and JSR metadata. A green build alone doesn't prove publication, and a
partial npm release can leave consumers referencing an unpublished dependency.
