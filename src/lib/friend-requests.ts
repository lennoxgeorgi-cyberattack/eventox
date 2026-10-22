import type { Friend } from "./events";

export type DirectoryUser = { id: string; username: string };
export type StoredFriendRequest = { id: string; fromId: string; toId: string; fromUsername: string };
export type Friendship = { id: string; a: string; b: string };
export type FriendDirectory = { users: DirectoryUser[]; requests: StoredFriendRequest[]; friendships: Friendship[] };

export type IncomingRequest = { id: string; fromId: string; fromUsername: string };
export type KnownFriend = { id: string; username: string };

const EMPTY: FriendDirectory = { users: [], requests: [], friendships: [] };

export function emptyDirectory(): FriendDirectory {
  return { users: [], requests: [], friendships: [] };
}

export function exactUser(users: DirectoryUser[], username: string) {
  const name = username.trim();
  if (!name) return undefined;
  return users.find((user) => user.username === name);
}

function pair(a: string, b: string) {
  return (friendship: Friendship) => (friendship.a === a && friendship.b === b) || (friendship.a === b && friendship.b === a);
}

export function registerUser(directory: FriendDirectory, id: string, username: string): { ok: true; directory: FriendDirectory } | { ok: false; error: string; status: number } {
  const name = username.trim();
  if (!id || !name || name.length > 40) return { ok: false, error: "Nutzername fehlt.", status: 400 };
  const taken = directory.users.find((user) => user.username === name && user.id !== id);
  if (taken) return { ok: false, error: "Dieser Nutzername ist schon vergeben.", status: 409 };
  const users = directory.users.some((user) => user.id === id)
    ? directory.users.map((user) => (user.id === id ? { ...user, username: name } : user))
    : [...directory.users, { id, username: name }];
  const requests = directory.requests.map((request) => (request.fromId === id ? { ...request, fromUsername: name } : request));
  return { ok: true, directory: { ...directory, users, requests } };
}

export function createRequest(directory: FriendDirectory, fromId: string, username: string, id = crypto.randomUUID()): { ok: true; directory: FriendDirectory } | { ok: false; error: string; status: number } {
  const from = directory.users.find((user) => user.id === fromId);
  if (!from) return { ok: false, error: "Leg zuerst deinen Nutzernamen fest.", status: 400 };
  const to = exactUser(directory.users, username);
  if (!to) return { ok: false, error: "Diesen Nutzernamen gibt es nicht.", status: 404 };
  if (to.id === fromId) return { ok: false, error: "Du kannst dich nicht selbst anfragen.", status: 400 };
  if (directory.friendships.some(pair(fromId, to.id))) return { ok: false, error: "Ihr seid schon befreundet.", status: 409 };
  const pending = directory.requests.find((request) => (request.fromId === fromId && request.toId === to.id) || (request.fromId === to.id && request.toId === fromId));
  if (pending?.fromId === to.id) return { ok: false, error: "Diese Person hat dir schon eine Anfrage geschickt.", status: 409 };
  if (pending) return { ok: false, error: "Die Anfrage ist schon offen.", status: 409 };
  const request: StoredFriendRequest = { id, fromId, toId: to.id, fromUsername: from.username };
  return { ok: true, directory: { ...directory, requests: [request, ...directory.requests] } };
}

export function incomingRequests(directory: FriendDirectory, userId: string): IncomingRequest[] {
  return directory.requests.filter((request) => request.toId === userId).map(({ id, fromId, fromUsername }) => ({ id, fromId, fromUsername }));
}

export function friendsOf(directory: FriendDirectory, userId: string): KnownFriend[] {
  return directory.friendships.flatMap((friendship) => {
    const otherId = friendship.a === userId ? friendship.b : friendship.b === userId ? friendship.a : "";
    if (!otherId) return [];
    const user = directory.users.find((item) => item.id === otherId);
    return user ? [{ id: user.id, username: user.username }] : [];
  });
}

export function acceptRequest(directory: FriendDirectory, requestId: string, userId: string, friendshipId = crypto.randomUUID()): { ok: true; directory: FriendDirectory } | { ok: false; error: string; status: number } {
  const request = directory.requests.find((item) => item.id === requestId && item.toId === userId);
  if (!request) return { ok: false, error: "Diese Anfrage gibt es nicht.", status: 404 };
  const friendships = directory.friendships.some(pair(request.fromId, request.toId))
    ? directory.friendships
    : [...directory.friendships, { id: friendshipId, a: request.fromId, b: request.toId }];
  return { ok: true, directory: { ...directory, friendships, requests: directory.requests.filter((item) => item.id !== requestId) } };
}

export function declineRequest(directory: FriendDirectory, requestId: string, userId: string): { ok: true; directory: FriendDirectory } | { ok: false; error: string; status: number } {
  const request = directory.requests.find((item) => item.id === requestId && item.toId === userId);
  if (!request) return { ok: false, error: "Diese Anfrage gibt es nicht.", status: 404 };
  return { ok: true, directory: { ...directory, requests: directory.requests.filter((item) => item.id !== requestId) } };
}

export function removeFriendship(directory: FriendDirectory, userId: string, friendId: string): FriendDirectory {
  return { ...directory, friendships: directory.friendships.filter((friendship) => !pair(userId, friendId)(friendship)) };
}

export function mergeFriends(local: Friend[], remote: KnownFriend[], sampleIds: Set<string>): Friend[] {
  const remoteIds = new Set(remote.map((friend) => friend.id));
  const kept = local
    .filter((friend) => sampleIds.has(friend.id) || remoteIds.has(friend.id))
    .map((friend) => {
      const match = remote.find((item) => item.id === friend.id);
      return match ? { ...friend, name: match.username } : friend;
    });
  const added = remote
    .filter((friend) => !kept.some((item) => item.id === friend.id))
    .map((friend) => ({ id: friend.id, name: friend.username, favorites: [] as string[] }));
  return [...kept, ...added];
}

export function directoryFromUnknown(value: unknown): FriendDirectory {
  if (value == null || typeof value !== "object") return EMPTY;
  const body = value as Partial<FriendDirectory>;
  const users = Array.isArray(body.users) ? body.users.filter((user): user is DirectoryUser => !!user && typeof user.id === "string" && typeof user.username === "string") : [];
  const requests = Array.isArray(body.requests)
    ? body.requests.filter((request): request is StoredFriendRequest => !!request && typeof request.id === "string" && typeof request.fromId === "string" && typeof request.toId === "string" && typeof request.fromUsername === "string")
    : [];
  const friendships = Array.isArray(body.friendships) ? body.friendships.filter((friendship): friendship is Friendship => !!friendship && typeof friendship.id === "string" && typeof friendship.a === "string" && typeof friendship.b === "string") : [];
  return { users, requests, friendships };
}
