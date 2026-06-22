# @opencode-ai/httpapi-codegen

Build-time source generation for domain-oriented Effect APIs derived from `HttpApi` and Effect Schema contracts.

The package is private while its API is explored. Its tests are the executable specification for the generator. It must remain independent of OpenCode Core and use synthetic `HttpApi` fixtures.

## Settled rules

- Flatten path, query, header, and payload fields into one input object.
- Reject duplicate field names across input channels.
- Emit no method argument for zero fields, an optional object when every field is optional, and a required object when any field is required.
- Unwrap exact `{ data: A }` success envelopes.
- Map no-content success to `void`.
- Preserve other single success values.
- Reject ambiguous multiple-success contracts.
- Expose streaming success as `Stream`, not `Effect<Stream>`.
- Reject schemas whose wire/domain transformation cannot be generated exactly.
- Map transport, unexpected-status, and response-decoding failures to one stable generated `ClientError`.
- Generate only the Effect API initially; Promise runtime ownership, cancellation, and stream adaptation are deferred.
- Commit generated source for review; CI regenerates and fails when the worktree changes.
- Track generated files in `.httpapi-codegen.json` so regeneration removes only stale files previously owned by the generator.

## Boundary

This package generates only the remote API derived from `HttpApi`. It does not generate embedded implementations or embedded-only capabilities. The OpenCode integration composes two distinct total objects:

- A remote object containing the generated HTTP capabilities.
- An embedded object implementing the shared shape against local services and adding embedded-only capabilities.

The embedded object may be a structural superset of the remote object, but the constructors and concrete result types remain distinct.

Codegen generates every endpoint in the `HttpApi` it receives. OpenCode owns the product decision by composing the exact remote API before invoking the generator; the generic package has no endpoint filtering policy.

The public `generate(Api, { directory })` operation is an Effect requiring `FileSystem`. Internally it composes a pure `compile(Api)` phase with `write(output, directory)`. Compiler tests inspect virtual files directly; writer tests use `FileSystem.makeNoop`.

Generation formats TypeScript with Prettier before writing. Output paths are flat, unique, and checked against traversal, reserved manifest names, and existing symbolic links.

Generated source starts with one self-contained module per `HttpApiGroup`, plus root client and index modules. Schema dependencies may be duplicated across group modules. Cross-group schema partitioning is deferred until measured output or bundle cost requires it.

Codegen preserves group and endpoint identifiers exactly. The composed remote `HttpApi` owns public names such as `session` and `get`; the generator performs no prefix stripping, casing conversion, or public-name annotation mapping.
