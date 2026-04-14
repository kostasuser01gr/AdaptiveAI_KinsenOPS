import { describe, it, expect, vi } from "vitest";
import { validateIdParam, idParamSchema, sanitizeInput } from "../../server/middleware/validation.js";
import type { Request, Response, NextFunction } from "express";

// ─── validateIdParam middleware unit tests ────────────────────────────────────

function mockReqResNext(params: Record<string, string>) {
  const req = { params, body: {}, query: {} } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe("idParamSchema", () => {
  it("accepts positive integer strings", () => {
    expect(idParamSchema.parse({ id: "1" })).toEqual({ id: 1 });
    expect(idParamSchema.parse({ id: "42" })).toEqual({ id: 42 });
    expect(idParamSchema.parse({ id: "999999" })).toEqual({ id: 999999 });
  });

  it("accepts numeric values", () => {
    expect(idParamSchema.parse({ id: 5 })).toEqual({ id: 5 });
  });

  it("rejects zero", () => {
    expect(() => idParamSchema.parse({ id: "0" })).toThrow();
  });

  it("rejects negative numbers", () => {
    expect(() => idParamSchema.parse({ id: "-1" })).toThrow();
  });

  it("rejects non-numeric strings", () => {
    expect(() => idParamSchema.parse({ id: "abc" })).toThrow();
    expect(() => idParamSchema.parse({ id: "NaN" })).toThrow();
  });

  it("rejects floats", () => {
    expect(() => idParamSchema.parse({ id: "1.5" })).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => idParamSchema.parse({ id: "" })).toThrow();
  });

  it("rejects SQL injection payloads", () => {
    expect(() => idParamSchema.parse({ id: "1; DROP TABLE users" })).toThrow();
    expect(() => idParamSchema.parse({ id: "1 OR 1=1" })).toThrow();
  });
});

describe("validateIdParam() middleware", () => {
  it("calls next() for valid integer id", async () => {
    const mw = validateIdParam();
    const { req, res, next } = mockReqResNext({ id: "7" });
    await mw(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 400 for non-integer id", async () => {
    const mw = validateIdParam();
    const { req, res, next } = mockReqResNext({ id: "abc" });
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Validation error" }),
    );
  });

  it("returns 400 for negative id", async () => {
    const mw = validateIdParam();
    const { req, res, next } = mockReqResNext({ id: "-5" });
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─── sanitizeInput ───────────────────────────────────────────────────────────

describe("sanitizeInput", () => {
  it("strips HTML tags", () => {
    expect(sanitizeInput("<script>alert('xss')</script>hello")).toBe("hello");
  });

  it("trims whitespace", () => {
    expect(sanitizeInput("  hello world  ")).toBe("hello world");
  });

  it("passes through plain strings", () => {
    expect(sanitizeInput("normal text")).toBe("normal text");
  });
});
