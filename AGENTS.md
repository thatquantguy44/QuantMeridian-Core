# Repository agent guidance

For changes to `docs/specs/spec012/`, the Sources & Uses page and contracts, or its service and optimization model, use the pinned upstream skills in `.agents/skills/`:

1. Start with `using-agent-skills` and follow `incremental-implementation` for multi-file changes.
2. Use `test-driven-development` for behavior and `doubt-driven-development` for independent technical validation.
3. Apply `code-review-and-quality` before marking a slice complete. Use `frontend-ui-engineering` for the Sources & Uses UI.
4. Verify the immutable upstream snapshot with `npm run check:agent-skills-pin`; CI runs the same check.
5. Follow approved decisions in spec012. Do not encode unresolved decisions into model behavior.

The complete `.agents/` tree is a byte-for-byte mirror of `thatquantguy44/agent-skills` at the commit and paths recorded in `contracts/agent/agent-skills.pin.json`. The manifest covers every upstream file and symlink; CI rejects changed, missing, or extra snapshot content. Update the mirror only by reviewing the upstream repository and intentionally regenerating the pin. The mirror is deliberately tracked by Git and must not be added to `.gitignore`.

After copying a reviewed upstream checkout into `.agents/`, regenerate the manifest with `npm run generate:agent-skills-pin -- --source-root <reviewed-checkout> --commit <full-sha> --reviewed-on <YYYY-MM-DD>`, then run `npm run check:agent-skills-pin`.

The six skills named above remain mandatory for SXU work. The other pinned skills are available repository-wide when their documented trigger applies; vendoring the full toolkit does not silently change module architecture or approve unresolved product decisions.
