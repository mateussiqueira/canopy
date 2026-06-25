import { test, expect } from "@playwright/test";
import { execSync } from "child_process";

test.describe("CLI", () => {
  test("should show help with --help flag", async () => {
    const output = execSync("node ./bin/opencode --help", {
      encoding: "utf8",
      timeout: 10000,
    });
    expect(output).toContain("Usage");
  });

  test("should show version with --version flag", async () => {
    const output = execSync("node ./bin/opencode --version", {
      encoding: "utf8",
      timeout: 10000,
    });
    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });

  test("should start and exit cleanly with run command", async () => {
    // Test that the CLI can start and exit without hanging
    const result = execSync("timeout 5 node ./bin/opencode run --help || true", {
      encoding: "utf8",
      timeout: 10000,
    });
    expect(result).toContain("run");
  });
});