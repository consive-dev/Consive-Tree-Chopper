# Commit Message Rules

Generate commit messages using the **Conventional Commits** format.

Format:

```text
type(scope): short description
```

Allowed types:

* feat
* fix
* refactor
* docs
* style
* test
* chore

For Minecraft Bedrock addon projects use these scopes when applicable:

* tree
* leaves
* roots
* ui
* item
* recipe
* rp
* manifest
* docs

Rules:

* Use **English**.
* Keep the subject under **72 characters**.
* Use **imperative mood** (e.g. `add`, `fix`, `update`).
* Do not use generic messages such as `update`, `changes`, `fixes`, or `wip`.
* Focus only on the staged changes.
* Whenever a code change is made, also update the manifest version in the relevant pack manifests to keep versioning consistent.
* Treat version bumps as part of the change, not as a separate optional step.
* Prefer specific descriptions such as:

  * `feat(tree): add recursive log search`
  * `fix(leaves): prevent breaking detached leaves`
  * `chore(manifest): update addon version to 0.2.0`

Project-specific versioning rule:

* Any modification to scripts, behavior, resources, or config files should trigger a patch version bump in `*_pack/manifest.json`.
* Update the header, module entries, and dependency UUID versions consistently when the manifest is changed.
* Do not leave the project with stale manifest versions after a code change.
