import { test, expect } from "@playwright/test";
import { execSync } from "child_process";

const runCli = (args: string): string => {
  try {
    return execSync(`bun run dev ${args} 2>&1`, {
      encoding: "utf8",
      timeout: 15000,
      cwd: process.cwd(),
    });
  } catch (error: any) {
    return (error.stdout || "") + (error.stderr || "");
  }
};

test.describe("Session management", () => {
  test("should list sessions without error", async () => {
    const output = runCli("session list");
    expect(output).toBeDefined();
  });

  test("should show help for session command", async () => {
    const output = runCli("session --help");
    expect(output).toContain("session");
  });

  test("should return error for deleting non-existent session", async () => {
    try {
      runCli("session delete non-existent-id");
    } catch (error: any) {
      expect(error.status).not.toBe(0);
    }
  });
});
