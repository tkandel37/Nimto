import { PrismaClient, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSION_CATALOG } from "../src/auth/permissions";

const prisma = new PrismaClient();
const SUPER_ADMIN_ROLE = "SUPER_ADMIN";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required to seed the Super Admin account.`);
  }

  return value;
}

async function main() {
  const email = requiredEnv("SUPER_ADMIN_EMAIL").toLowerCase();
  const password = requiredEnv("SUPER_ADMIN_PASSWORD");
  const name = requiredEnv("SUPER_ADMIN_NAME");

  if (password.length < 8) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(
    PERMISSION_CATALOG.map((permission) =>
      prisma.permission.upsert({
        where: { key: permission.key },
        update: { description: permission.description },
        create: permission,
      }),
    ),
  );

  const role = await prisma.role.upsert({
    where: {
      name: SUPER_ADMIN_ROLE,
    },
    update: {
      description: "Protected root administrator role.",
      isSystem: true,
    },
    create: {
      name: SUPER_ADMIN_ROLE,
      description: "Protected root administrator role.",
      isSystem: true,
    },
  });

  const user = await prisma.user.upsert({
    where: {
      email,
    },
    update: {
      name,
      passwordHash,
      status: UserStatus.ACTIVE,
      blockedAt: null,
      deactivatedAt: null,
      deletionRequestedAt: null,
      emailVerifiedAt: new Date(),
    },
    create: {
      name,
      email,
      passwordHash,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  });

  await prisma.rolePermission.createMany({
    data: (
      await prisma.permission.findMany({
        where: {
          key: { in: PERMISSION_CATALOG.map((permission) => permission.key) },
        },
      })
    ).map((permission) => ({
      roleId: role.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  console.log(`Seeded Super Admin: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
