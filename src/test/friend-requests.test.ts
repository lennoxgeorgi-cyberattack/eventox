import { describe, expect, it } from "vitest";
import { acceptRequest, createRequest, declineRequest, emptyDirectory, exactUser, mergeFriends, registerUser } from "@/lib/friend-requests";

describe("friend requests", () => {
  it("only matches an existing username exactly", () => {
    const registered = registerUser(emptyDirectory(), "a", "Lena");
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    expect(exactUser(registered.directory.users, "lena")).toBeUndefined();
    expect(exactUser(registered.directory.users, "Lena")?.id).toBe("a");
    const missing = createRequest(registered.directory, "a", "Jonas");
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error).toBe("Diesen Nutzernamen gibt es nicht.");
  });

  it("keeps the friend off the list until the request is accepted", () => {
    let directory = emptyDirectory();
    const lena = registerUser(directory, "lena", "Lena");
    if (!lena.ok) throw new Error("lena");
    const jonas = registerUser(lena.directory, "jonas", "Jonas");
    if (!jonas.ok) throw new Error("jonas");
    directory = jonas.directory;
    const sent = createRequest(directory, "lena", "Jonas", "req-1");
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.directory.friendships).toHaveLength(0);
    const accepted = acceptRequest(sent.directory, "req-1", "jonas", "ship-1");
    expect(accepted.ok && accepted.directory.friendships).toHaveLength(1);
    expect(accepted.ok && accepted.directory.requests).toHaveLength(0);
    const declined = declineRequest(sent.directory, "req-1", "jonas");
    expect(declined.ok && declined.directory.friendships).toHaveLength(0);
  });

  it("keeps sample friends while adding accepted friends", () => {
    const merged = mergeFriends([{ id: "f1", name: "Lena", favorites: ["e1"] }], [{ id: "jonas", username: "Jonas" }], new Set(["f1"]));
    expect(merged.map((friend) => friend.id)).toEqual(["f1", "jonas"]);
  });
});
