import Fastify from "fastify";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import fastifyJwt from "@fastify/jwt";
import argon2 from "argon2";
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

vi.mock("argon2", () => ({
  default: {
    hash: vi.fn(async (pw: string) => `new_hash_${pw}`),
    verify: vi.fn(async (h: string, p: string) => h === `new_hash_${p}`),
  },
}));

describe("API call to change user account information: PATCH /update-password", () => {
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

  it("updates password and promotes TEMPORARY user to HIKER", async () => {
    const app = await createTestApp();
    try {
      const validToken = app.jwt.sign(
        { sub: 42, purpose: "password_reset" },
        { expiresIn: "15m" },
      );

      vi.mocked(UserRepository.getUserById).mockResolvedValue({
        id: 42,
        email: "temp@example.com",
        passwordHash: "old_temporary_hash",
        name: "Temporary",
        surname: "Hiker",
        phoneNumber: "+39111222333",
        type: "TEMPORARY",
      });

      vi.mocked(UserRepository.updateUser).mockResolvedValue(true);

      const res = await app.inject({
        method: "PATCH",
        url: "/update-password",
        payload: {
          token: validToken,
          newPassword: "BrandNewPassword123!",
        },
      });

      expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);
      expect(argon2.hash).toHaveBeenCalledWith("BrandNewPassword123!");

      // Verify user promotion to HIKER and updated hash
      expect(UserRepository.updateUser).toHaveBeenCalledWith(42, {
        id: 42,
        email: "temp@example.com",
        passwordHash: "new_hash_BrandNewPassword123!",
        name: "Temporary",
        surname: "Hiker",
        phoneNumber: "+39111222333",
        type: "HIKER", // Promoted!
      });

      // Verify security confirmation email is sent
      expect(mockEmailSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "temp@example.com",
          subject: "Mountain Hut — Password Changed",
          text: expect.stringContaining("Your password has been changed successfully."),
        }),
      );
    } finally {
      await app.close();
    }
  });

  it("rejects password reuse with 400 Bad Request if user provides their existing password", async () => {
    const app = await createTestApp();
    try {
      const validToken = app.jwt.sign(
        { sub: 42, purpose: "password_reset" },
        { expiresIn: "15m" },
      );

      vi.mocked(UserRepository.getUserById).mockResolvedValue({
        id: 42,
        email: "hiker@example.com",
        passwordHash: "new_hash_CurrentSecretPassword123",
        name: "Hiker",
        surname: "Explorer",
        phoneNumber: "+39111222333",
        type: "HIKER",
      });

      const res = await app.inject({
        method: "PATCH",
        url: "/update-password",
        payload: {
          token: validToken,
          newPassword: "CurrentSecretPassword123",
        },
      });

      expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(res.json()).toEqual({
        message: "For safety reasons, you cannot change the password to your old one.",
      });
      expect(UserRepository.updateUser).not.toHaveBeenCalled();
      expect(mockEmailSender.send).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("updates password for a standard HIKER without changing type", async () => {
    const app = await createTestApp();
    try {
      const validToken = app.jwt.sign(
        { sub: 50, purpose: "password_reset" },
        { expiresIn: "15m" },
      );

      vi.mocked(UserRepository.getUserById).mockResolvedValue({
        id: 50,
        email: "regular@example.com",
        passwordHash: "old_hash",
        name: "Regular",
        surname: "User",
        phoneNumber: "+39123456",
        type: "HIKER",
      });

      vi.mocked(UserRepository.updateUser).mockResolvedValue(true);

      const res = await app.inject({
        method: "PATCH",
        url: "/update-password",
        payload: {
          token: validToken,
          newPassword: "BrandNewPassword123!",
        },
      });

      expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);
      expect(UserRepository.updateUser).toHaveBeenCalledWith(50, expect.objectContaining({
        type: "HIKER",
        passwordHash: "new_hash_BrandNewPassword123!",
      }));
    } finally {
      await app.close();
    }
  });

  it("returns 400 Bad Request when token has invalid purpose", async () => {
    const app = await createTestApp();
    try {
      const wrongPurposeToken = app.jwt.sign(
        { sub: 42, purpose: "auth_session" },
        { expiresIn: "15m" },
      );

      const res = await app.inject({
        method: "PATCH",
        url: "/update-password",
        payload: {
          token: wrongPurposeToken,
          newPassword: "BrandNewPassword123!",
        },
      });

      expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(res.json()).toEqual({ message: "Invalid token purpose" });
      expect(UserRepository.updateUser).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("returns 400 Bad Request when token is invalid or expired", async () => {
    const app = await createTestApp();
    try {
      const res = await app.inject({
        method: "PATCH",
        url: "/update-password",
        payload: {
          token: "invalid.jwt.token",
          newPassword: "BrandNewPassword123!",
        },
      });

      expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(res.json()).toEqual({ message: "Invalid or expired reset token" });
    } finally {
      await app.close();
    }
  });

  it("returns 400 Bad Request when user does not exist", async () => {
    const app = await createTestApp();
    try {
      const validToken = app.jwt.sign(
        { sub: 9999, purpose: "password_reset" },
        { expiresIn: "15m" },
      );

      vi.mocked(UserRepository.getUserById).mockResolvedValue(null);

      const res = await app.inject({
        method: "PATCH",
        url: "/update-password",
        payload: {
          token: validToken,
          newPassword: "BrandNewPassword123!",
        },
      });

      expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(res.json()).toEqual({ message: "Invalid token" });
      expect(UserRepository.updateUser).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
