import { Prisma } from "@prisma/client";

/**
 * Auto-filters `deletedAt: null` into reads, and turns `.delete()` /
 * `.deleteMany()` into `updatedAt`-bumping `deletedAt` updates, for the
 * models that support soft delete (CLAUDE.md: soft delete only, no hard
 * delete). Without this, every repository method has to remember
 * `where: { deletedAt: null }` by hand — the most common soft-delete bug.
 *
 * Not applied to `RefreshToken` (hard-deleted via cascade, it's auth infra).
 * `Activity` is included for user notes; system entries are never deleted.
 *
 * A query that sets `deletedAt` itself at the top level of `where` (e.g.
 * `{ deletedAt: { not: null } }` to list archived applications) keeps its own
 * filter. `deletedAt: undefined` still gets the default — an unset optional
 * field must never quietly include deleted rows.
 *
 * Caveat: these hooks only run on top-level queries. A nested relation
 * select (e.g. `application.findMany({ select: { activities: ... } })`)
 * bypasses them and needs its own `where: { deletedAt: null }`.
 *
 * Prisma can't redirect delete -> update generically via the `$allModels`
 * query hook (the underlying operation stays a DELETE), so each
 * soft-deletable model gets its own `delete`/`deleteMany` override at the
 * `model` level, per Prisma's documented soft-delete recipe.
 */
/** Adds `deletedAt: null` unless the caller filtered on `deletedAt` explicitly. */
export function notDeleted<W extends { deletedAt?: unknown }>(where: W | undefined): W {
  if (where?.deletedAt !== undefined) return where;
  return { ...where, deletedAt: null } as W;
}

export const softDeleteExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: "soft-delete",
    query: {
      user: {
        findMany: ({ args, query }) => query({ ...args, where: notDeleted(args.where) }),
        findFirst: ({ args, query }) => query({ ...args, where: notDeleted(args.where) }),
      },
      company: {
        findMany: ({ args, query }) => query({ ...args, where: notDeleted(args.where) }),
        findFirst: ({ args, query }) => query({ ...args, where: notDeleted(args.where) }),
      },
      application: {
        findMany: ({ args, query }) => query({ ...args, where: notDeleted(args.where) }),
        findFirst: ({ args, query }) => query({ ...args, where: notDeleted(args.where) }),
      },
      activity: {
        findMany: ({ args, query }) => query({ ...args, where: notDeleted(args.where) }),
        findFirst: ({ args, query }) => query({ ...args, where: notDeleted(args.where) }),
      },
      interview: {
        findMany: ({ args, query }) => query({ ...args, where: notDeleted(args.where) }),
        findFirst: ({ args, query }) => query({ ...args, where: notDeleted(args.where) }),
      },
      contact: {
        findMany: ({ args, query }) => query({ ...args, where: notDeleted(args.where) }),
        findFirst: ({ args, query }) => query({ ...args, where: notDeleted(args.where) }),
      },
      // Read filter only: nothing deletes parse rows yet, so no delete override.
      jobPostingParse: {
        findMany: ({ args, query }) => query({ ...args, where: notDeleted(args.where) }),
        findFirst: ({ args, query }) => query({ ...args, where: notDeleted(args.where) }),
      },
    },
    model: {
      user: {
        delete(args: Prisma.UserDeleteArgs) {
          return client.user.update({ where: args.where, data: { deletedAt: new Date() } });
        },
        deleteMany(args: Prisma.UserDeleteManyArgs) {
          return client.user.updateMany({ where: args.where, data: { deletedAt: new Date() } });
        },
      },
      company: {
        delete(args: Prisma.CompanyDeleteArgs) {
          return client.company.update({ where: args.where, data: { deletedAt: new Date() } });
        },
        deleteMany(args: Prisma.CompanyDeleteManyArgs) {
          return client.company.updateMany({ where: args.where, data: { deletedAt: new Date() } });
        },
      },
      application: {
        delete(args: Prisma.ApplicationDeleteArgs) {
          return client.application.update({ where: args.where, data: { deletedAt: new Date() } });
        },
        deleteMany(args: Prisma.ApplicationDeleteManyArgs) {
          return client.application.updateMany({ where: args.where, data: { deletedAt: new Date() } });
        },
      },
      activity: {
        delete(args: Prisma.ActivityDeleteArgs) {
          return client.activity.update({ where: args.where, data: { deletedAt: new Date() } });
        },
      },
      interview: {
        delete(args: Prisma.InterviewDeleteArgs) {
          return client.interview.update({ where: args.where, data: { deletedAt: new Date() } });
        },
      },
      contact: {
        delete(args: Prisma.ContactDeleteArgs) {
          return client.contact.update({ where: args.where, data: { deletedAt: new Date() } });
        },
      },
    },
  }),
);
