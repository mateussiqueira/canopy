import { Location } from "@opencode-ai/core/location"
import { Project } from "@opencode-ai/core/project"
import { AbsolutePath } from "@opencode-ai/core/schema"

export function location(
  ref: Location.Ref,
  input: { projectID?: Project.ID; projectDirectory?: AbsolutePath; vcs?: Project.Vcs } = {},
) {
  return {
    directory: ref.directory,
    workspaceID: ref.workspaceID,
    project: { id: input.projectID ?? Project.ID.global, directory: input.projectDirectory ?? ref.directory },
    vcs: input.vcs,
  } satisfies Location.Interface
}
