/**
 * Host half of the recent-tasks bundle.
 *
 * The panel reads the Client's own Session list snapshot, so there is nothing to
 * serve from the Host: this empty body only keeps the package addressable from
 * the Loader roster and gives the Client half a parent to boot under.
 */
export function apply() {}
