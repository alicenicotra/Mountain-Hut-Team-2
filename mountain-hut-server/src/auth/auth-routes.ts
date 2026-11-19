import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import argon2 from "argon2";
import { StatusCodes } from "http-status-codes";
import { randomInt } from "node:crypto";
import { z } from "zod";

import { UserRepository } from "../users/user-repository.ts";
import { userResponseSchema } from "../users/user-schema.ts";
import { env } from "../config.ts";
import { emailSender, type EmailSender } from "../notifications/sender.ts";
import {
  renderPasswordResetEmail,
  renderPasswordChangedConfirmationEmail,
} from "../notifications/utils.ts";
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth-schema.ts";

export interface AuthRoutesOptions {
  emailSender?: EmailSender;
}

export async function requireAuthenticatedUser(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!request.user) {
    return reply
      .code(StatusCodes.UNAUTHORIZED)
      .send({ message: "Not authenticated" });
  }
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  server,
  options = {},
) => {
  const typed = server.withTypeProvider<ZodTypeProvider>();
  const mailSender = options.emailSender ?? emailSender;

  typed.post(
    "/register",
    {
      schema: {
        body: registerSchema,
        response: {
          [StatusCodes.CREATED]: userResponseSchema,
          [StatusCodes.CONFLICT]: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const body = request.body;

      if (body.email) {
        const existingUser = await UserRepository.getUserByEmail(body.email);
        if (existingUser) {
          return reply
            .code(StatusCodes.CONFLICT)
            .send({ message: "An account with this email already exists" });
        }
      }

      let passwordHash: string | null = null;
      if (body.type === "TEMPORARY") {
        const rawPassword = `${body.name}${body.surname ?? ""}${randomInt(100, 1000)}`;
        passwordHash = await argon2.hash(rawPassword);
      } else if (body.type !== "THROWAWAY") {
        passwordHash = await argon2.hash(body.password);
      }

      const newUser = await UserRepository.saveUser({
        email: body.email,
        passwordHash,
        name: body.name,
        surname: body.surname,
        phoneNumber: body.phoneNumber,
        type: body.type,
      });

      return reply
        .code(StatusCodes.CREATED)
        .send(userResponseSchema.parse(newUser));
    },
  );

  typed.post(
    "/login",
    {
      schema: {
        body: loginSchema,
        response: {
          [StatusCodes.OK]: userResponseSchema,
          [StatusCodes.UNAUTHORIZED]: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const user = await UserRepository.getUserByEmail(request.body.email);
      if (!user || !user.passwordHash) {
        return reply
          .code(StatusCodes.UNAUTHORIZED)
          .send({ message: "Invalid email or password" });
      }

      const isPasswordValid = await argon2.verify(
        user.passwordHash,
        request.body.password,
      );
      if (!isPasswordValid) {
        return reply
          .code(StatusCodes.UNAUTHORIZED)
          .send({ message: "Invalid email or password" });
      }

      // save user ID directly into the encrypted cookie
      request.session.set("userId", user.id);

      return reply.code(StatusCodes.OK).send(userResponseSchema.parse(user));
    },
  );

  typed.post("/logout", async (request, reply) => {
    // Clears the encrypted cookie
    request.session.delete();
    return reply
      .code(StatusCodes.OK)
      .send({ message: "Logged out successfully" });
  });

  typed.get(
    "/me",
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      return reply
        .code(StatusCodes.OK)
        .send(userResponseSchema.parse(request.user));
    },
  );

  typed.post(
    "/forgot-password",
    {
      schema: {
        summary: "Request password reset",
        description:
          "Initiates the password recovery process by sending a time-limited reset link " +
          "to the specified email address, if an associated account exists.",
        tags: ["Auth"],
        body: forgotPasswordSchema,
        response: {
          [StatusCodes.OK]: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { email } = request.body;
      const user = await UserRepository.getUserByEmail(email);

      if (user && user.type !== "THROWAWAY") {
        // Generates a JWT token that's valid for 15 minutes
        const resetToken = server.jwt.sign(
          { sub: user.id, purpose: "password_reset" },
          { expiresIn: "15m" },
        );

        const frontendUrl = process.env.FRONTEND_URL || env.APP_URL;
        const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
        request.log.info({ resetLink }, "Password reset link generated");

        if (user.email) {
          try {
            const { text, html } = renderPasswordResetEmail(resetLink, user.name);
            await mailSender.send({
              to: user.email,
              subject: "Mountain Hut — Password Reset",
              text,
              html,
            });
          } catch (err) {
            request.log.error(err, "Failed to send password reset email");
          }
        }
      }

      return reply.code(StatusCodes.OK).send({
        message:
          "If an account with that email exists, a reset link has been sent.",
      });
    },
  );

  typed.patch(
    "/update-password",
    {
      schema: {
        summary: "Updates a user's password (requires a valid token).",
        tags: ["Auth"],
        body: resetPasswordSchema,
        response: {
          [StatusCodes.NO_CONTENT]: z.null(),
          [StatusCodes.BAD_REQUEST]: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { token, newPassword } = request.body;

      try {
        const payload = server.jwt.verify<{ sub: number; purpose?: string }>(
          token,
        );

        if (payload.purpose !== "password_reset") {
          return reply
            .code(StatusCodes.BAD_REQUEST)
            .send({ message: "Invalid token purpose" });
        }

        const userId = payload.sub;
        const user = await UserRepository.getUserById(userId);
        if (!user) {
          return reply
            .code(StatusCodes.BAD_REQUEST)
            .send({ message: "Invalid token" });
        }

        if (user.passwordHash) {
          const isSamePassword = await argon2.verify(
            user.passwordHash,
            newPassword,
          );
          if (isSamePassword) {
            return reply.code(StatusCodes.BAD_REQUEST).send({
              message:
                "For safety reasons, you cannot change the password to your old one.",
            });
          }
        }

        const newHash = await argon2.hash(newPassword);
        user.passwordHash = newHash;

        // promote temporary user to hiker if password change was successful
        if (user.type === "TEMPORARY") {
          user.type = "HIKER";
        }
        await UserRepository.updateUser(payload.sub, user);

        if (user.email) {
          try {
            const { text, html } = renderPasswordChangedConfirmationEmail(
              user.name,
            );
            await mailSender.send({
              to: user.email,
              subject: "Mountain Hut — Password Changed",
              text,
              html,
            });
          } catch (err) {
            request.log.error(
              err,
              "Failed to send password changed confirmation email",
            );
          }
        }

        return reply.code(StatusCodes.NO_CONTENT).send(null);
      } catch {
        if (reply.sent) return;
        return reply
          .code(StatusCodes.BAD_REQUEST)
          .send({ message: "Invalid or expired reset token" });
      }
    },
  );
};
