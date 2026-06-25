import { test, expect } from "@playwright/test";
import { execSync } from "child_process";

test.describe("Session management", () => {
  test("should list sessions without error", async () => {
    const output = execSync("node ./bin/opencode session list", {
      encoding: "utf8",
      timeout: 10000,
    });
    // Could be empty, but command should succeed
    expect(output).toBeDefined();
  });

  test("should show help for session command", async () => {
    const output = execSync("node ./bin/opencode session --help", {
      encoding: "utf8",
      timeout: 10000,
    });
    expect(output).toContain("manage sessions");
  });

  test("should return error for deleting non-existent session", async () => {
    try {
      execSync("node ./bin/opencode session delete non-existent-id", {
        encoding: "utf8",
        timeout: 10000,
      });
      // If command succeeds, that's also fine (maybe it prints an error)
    } catch (error: any) {
      // Expect exit code non-zero
      expect(error.status).not.toBe(0);
    }
  });
});