import { test, expect } from "@playwright/test";
import { execSync } from "child_process";

test.describe("Provider configuration", () => {
  test("should list providers without error", async () => {
    const output = execSync("node ./bin/opencode providers list", {
      encoding: "utf8",
      timeout: 10000,
    });
    // Should output something (maybe empty)
    expect(output).toBeDefined();
  });

  test("should show help for providers command", async () => {
    const output = execSync("node ./bin/opencode providers --help", {
      encoding: "utf8",
      timeout: 10000,
    });
    expect(output).toContain("manage AI providers");
  });

  test("should show login help", async () => {
    const output = execSync("node ./bin/opencode providers login --help", {
      encoding: "utf8",
      timeout: 10000,
    });
    expect(output).toContain("login");
  });
});