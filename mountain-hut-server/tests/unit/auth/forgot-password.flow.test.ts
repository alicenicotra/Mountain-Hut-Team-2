import Fastify from "fastify";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import fastifyJwt from "@fastify/jwt";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

import { authRoutes, type AuthRoutesOptions } from "../../../src/auth/auth-routes.ts";
import { UserRepository } from "../../../src/users/user-repository.ts";
import type { EmailSender } from "../../../src/notifications/sender.ts";

vi.mock("../../../src/users/user-repository.ts", () => ({
  UserRepository: {
    getUserByEmail: vi.fn(),
    saveUser: vi.fn(),
    getUserById: vi.fn(),
    updateUser: vi.fn(),
  },
}));

describe("POST /forgot-password flow", () => {
  const JWT_SECRET = "super_secret_jwt_key_at_least_32_chars";
  let mockEmailSender: EmailSender;

  async function createTestApp(opts?: AuthRoutesOptions) {
    const app = Fastify({ logger: false });
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(fastifyJwt, { secret: JWT_SECRET });
    await app.register(authRoutes, opts ?? { emailSender: mockEmailSender });
    return app;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockEmailSender = {
      send: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("sends password reset email with JWT link if user exists and is not THROWAWAY", async () => {
    const app = await createTestApp();
    try {
      vi.mocked(UserRepository.getUserByEmail).mockResolvedValue({
        id: 10,
        email: "hiker@example.com",
        passwordHash: "hash123",
        name: "Mario",
        surname: "Rossi",
        phoneNumber: "+3912345678",
        type: "HIKER",
      });

      const res = await app.inject({
        method: "POST",
        url: "/forgot-password",
        payload: { email: "hiker@example.com" },
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(res.json()).toEqual({
        message: "If an account with that email exists, a reset link has been sent.",
      });

      expect(mockEmailSender.send).toHaveBeenCalledTimes(1);
      expect(mockEmailSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "hiker@example.com",
          subject: "Mountain Hut — Password Reset",
          text: expect.stringContaining("/reset-password?token="),
          html: expect.stringContaining("Reset password"),
        }),
      );
    } finally {
      await app.close();
    }
  });

  it("does not send email for THROWAWAY account but still returns 200 OK", async () => {
    const app = await createTestApp();
    try {
      vi.mocked(UserRepository.getUserByEmail).mockResolvedValue({
        id: 11,
        email: "throwaway@example.com",
        passwordHash: null,
        name: "Guest",
        surname: null,
        phoneNumber: null,
        type: "THROWAWAY",
      });

      const res = await app.inject({
        method: "POST",
        url: "/forgot-password",
        payload: { email: "throwaway@example.com" },
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(res.json()).toEqual({
        message: "If an account with that email exists, a reset link has been sent.",
      });
      expect(mockEmailSender.send).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("returns 200 OK without sending email when email does not exist", async () => {
    const app = await createTestApp();
    try {
      vi.mocked(UserRepository.getUserByEmail).mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/forgot-password",
        payload: { email: "unknown@example.com" },
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(res.json()).toEqual({
        message: "If an account with that email exists, a reset link has been sent.",
      });
      expect(mockEmailSender.send).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("returns 400 Bad Request if email format is invalid", async () => {
    const app = await createTestApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/forgot-password",
        payload: { email: "not-an-email" },
      });

      expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mockEmailSender.send).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
