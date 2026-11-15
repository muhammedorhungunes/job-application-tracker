import { notDeleted } from "./soft-delete.extension";

describe("notDeleted", () => {
  it("adds deletedAt: null when there is no where or no deletedAt", () => {
    expect(notDeleted(undefined)).toEqual({ deletedAt: null });
    expect(notDeleted({ userId: "u1" })).toEqual({ userId: "u1", deletedAt: null });
  });

  it("still adds it when deletedAt is present but undefined", () => {
    expect(notDeleted({ userId: "u1", deletedAt: undefined })).toEqual({ userId: "u1", deletedAt: null });
  });

  it("keeps an explicit deletedAt filter", () => {
    const where = { userId: "u1", deletedAt: { not: null } };
    expect(notDeleted(where)).toBe(where);
  });
});
