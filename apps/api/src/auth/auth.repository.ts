import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** The only place in the auth module that touches Prisma directly. */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string) {
    return this.prisma.client.user.findFirst({ where: { email } });
  }

  findUserById(id: string) {
    return this.prisma.client.user.findFirst({ where: { id } });
  }

  createUser(data: { email: string; passwordHash: string; name: string }) {
    return this.prisma.client.user.create({ data });
  }

  createRefreshToken(data: { id: string; userId: string; tokenHash: string; expiresAt: Date }) {
    // RefreshToken isn't a soft-delete model, so it's queried via the raw
    // client rather than prisma.client (both point at the same extended
    // instance here, but this keeps intent explicit for auth infra rows).
    return this.prisma.client.refreshToken.create({ data });
  }

  findRefreshTokenById(id: string) {
    return this.prisma.client.refreshToken.findUnique({ where: { id } });
  }

  revokeRefreshToken(id: string) {
    return this.prisma.client.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllRefreshTokensForUser(userId: string) {
    return this.prisma.client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
