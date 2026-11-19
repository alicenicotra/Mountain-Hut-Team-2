import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { StatusCodes } from "http-status-codes";
import argon2 from "argon2";
import { z } from "zod";

import { UserRepository } from "../users/user-repository.ts";
import { PasswordResetRepository } from "./password-reset-repository.ts";
import { forgotPasswordSchema, resetPasswordSchema } from "./auth-schema.ts";
import { emailSender } from "../notifications/sender.ts";
import {
  renderPasswordResetEmail,
  renderPasswordChangedConfirmationEmail,
} from "../notifications/utils.ts";
import { env } from "../config.ts";

export const passwordResetRoutes: FastifyPluginAsync = async (server) => {
  const typed = server.withTypeProvider<ZodTypeProvider>();

  /**
   * POST /api/v1/auth/forgot-password
   * Sends a reset-password email if the account exists.
   * Always returns 200 to prevent user enumeration.
   */
  typed.post(
    "/forgot-password",
    {
      schema: {
        body: forgotPasswordSchema,
        response: {
          [StatusCodes.OK]: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { email } = request.body;
      const user = await UserRepository.getUserByEmail(email);

      if (user) {
        const plainToken = await PasswordResetRepository.createToken(user.id);
        const resetUrl = `${env.APP_URL}/reset-password?token=${plainToken}`;
        const { text, html } = renderPasswordResetEmail(resetUrl, user.name);

        // fire-and-forget: don't leak timing info or fail the response on SMTP error
        emailSender
          .send({
            to: user.email,
            subject: "Mountain Hut — Reset your password",
            text,
            html,
          })
          .catch((err) =>
            server.log.error({ err }, "Failed to send password reset email"),
          );
      }

      return reply.code(StatusCodes.OK).send({
        message:
          "If an account with that email exists, a reset link has been sent.",
      });
    },
  );

  /**
   * POST /api/v1/auth/reset-password
   * Validates token and updates the password.
   */
  typed.post(
    "/reset-password",
    {
      schema: {
        body: resetPasswordSchema,
        response: {
          [StatusCodes.OK]: z.object({ message: z.string() }),
          [StatusCodes.BAD_REQUEST]: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { token, newPassword } = request.body;

      const tokenRow = await PasswordResetRepository.findValidToken(token);
      if (!tokenRow) {
        return reply.code(StatusCodes.BAD_REQUEST).send({
          message: "Invalid or expired reset token.",
        });
      }

      const user = await UserRepository.getUserById(tokenRow.userId);
      if (!user) {
        return reply.code(StatusCodes.BAD_REQUEST).send({
          message: "User not found.",
        });
      }

      const isSamePassword = await argon2.verify(user.passwordHash, newPassword);
      if (isSamePassword) {
        return reply.code(StatusCodes.BAD_REQUEST).send({
          message: "For safety reasons, you cannot change the password to your old one.",
        });
      }

      const newPasswordHash = await argon2.hash(newPassword);
      await UserRepository.updatePasswordHash(tokenRow.userId, newPasswordHash);
      await PasswordResetRepository.deleteByUserId(tokenRow.userId);

      // Send confirmation email
      const { text, html } = renderPasswordChangedConfirmationEmail(user.name);
      emailSender
        .send({
          to: user.email,
          subject: "Mountain Hut — Password changed successfully",
          text,
          html,
        })
        .catch((err) =>
          server.log.error(
            { err },
            "Failed to send password changed confirmation email",
          ),
        );

      return reply
        .code(StatusCodes.OK)
        .send({ message: "Password reset successfully." });
    },
  );
};
