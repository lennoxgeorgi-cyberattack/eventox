import { useEffect, useState } from "react";
import type { EventItem, Friend } from "./events";
import type { StoredEvent } from "./event-input";
import type { IncomingRequest } from "./friend-requests";
import { supabaseBrowser, supabaseConfig } from "./supabase";

export type Profile = { name: string; avatar?: string };
export type { IncomingRequest };
type SessionUser = { id: string; email: string };
type State = {
  setupRequired: boolean;
  user: SessionUser | null;
  authPrompt: number;
  favorites: string[];
  friends: Friend[];
  friendRequests: IncomingRequest[];
  userEvents: EventItem[];
  profile: Profile;
};
const PIN_KEY = "eventox-pins";
let state: State = { setupRequired: false, user: null, authPrompt: 0, favorites: [], friends: [], friendRequests: [], userEvents: [], profile: { name: "", avatar: undefined } };
const listeners = new Set<() => void>();

function pins() {
  try {
    const raw = localStorage.getItem(PIN_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function setState(fn: (current: State) => State) {
  state = fn(state);
  listeners.forEach((listener) => listener());
}

function askForAuth() {
  setState((current) => ({ ...current, authPrompt: current.authPrompt + 1 }));
}

async function accessToken() {
  const client = supabaseBrowser();
  if (!client) return "";
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? "";
}

async function authHeaders() {
  const token = await accessToken();
  return token ? { authorization: `Bearer ${token}`, "content-type": "application/json" } : { "content-type": "application/json" };
}

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim()) return body.error;
  } catch {
    /* keep the fallback when the server sends no JSON error */
  }
  return fallback;
}

export async function refreshAccount() {
  const { ready } = supabaseConfig();
  const client = supabaseBrowser();
  if (!ready || !client) {
    setState((current) => ({ ...current, setupRequired: true, user: null, friends: [], friendRequests: [], favorites: [] }));
    return;
  }
  const { data } = await client.auth.getSession();
  const session = data.session;
  if (!session) {
    setState((current) => ({ ...current, setupRequired: false, user: null, profile: { name: "", avatar: undefined }, friends: [], friendRequests: [], favorites: [] }));
    return;
  }
  const user = { id: session.user.id, email: session.user.email ?? "" };
  const [{ data: profile }, { data: favoriteRows }] = await Promise.all([
    client.from("profiles").select("username, avatar_url").eq("id", user.id).maybeSingle(),
    client.from("favorites").select("event_id").eq("user_id", user.id),
  ]);
  const headers = { authorization: `Bearer ${session.access_token}` };
  const friendsResponse = await fetch("/api/friends", { headers });
  const friendsBody = friendsResponse.ok ? ((await friendsResponse.json()) as { requests?: IncomingRequest[]; friends?: { id: string; username: string; favorites: string[] }[] }) : {};
  const pinned = pins();
  setState((current) => ({
    ...current,
    setupRequired: false,
    user,
    profile: { name: profile?.username ?? "", avatar: profile?.avatar_url ?? undefined },
    favorites: (favoriteRows ?? []).map((row) => row.event_id as string),
    friendRequests: friendsBody.requests ?? [],
    friends: (friendsBody.friends ?? []).map((friend) => ({ id: friend.id, name: friend.username, favorites: friend.favorites ?? [], pinned: pinned.has(friend.id) })),
  }));
}

export async function refreshEvents() {
  try {
    const headers = await authHeaders();
    const response = await fetch("/api/events", { headers });
    if (response.status === 503) {
      setState((current) => ({ ...current, setupRequired: true, userEvents: [] }));
      return;
    }
    if (!response.ok) return;
    const body = (await response.json()) as { events?: StoredEvent[] };
    setState((current) => ({ ...current, userEvents: body.events ?? [] }));
  } catch {
    /* keep the last list when the server is unreachable */
  }
}

export function useStore() {
  const [snapshot, setSnapshot] = useState<State>(state);
  useEffect(() => {
    const listener = () => setSnapshot(state);
    listeners.add(listener);
    const client = supabaseBrowser();
    const subscription = client?.auth.onAuthStateChange(() => {
      void refreshAccount();
      void refreshEvents();
    });
    void refreshAccount();
    void refreshEvents();
    return () => {
      listeners.delete(listener);
      subscription?.data.subscription.unsubscribe();
    };
  }, []);
  return snapshot;
}

export async function signUp(email: string, password: string, username: string) {
  const client = supabaseBrowser();
  if (!client) return { ok: false as const, error: "Supabase ist noch nicht eingerichtet." };
  const { data, error } = await client.auth.signUp({ email: email.trim(), password, options: { data: { username: username.trim() } } });
  if (error) return { ok: false as const, error: error.message };
  if (!data.session) return { ok: true as const, pending: true as const };
  await refreshAccount();
  return { ok: true as const, pending: false as const };
}

export async function signIn(email: string, password: string) {
  const client = supabaseBrowser();
  if (!client) return { ok: false as const, error: "Supabase ist noch nicht eingerichtet." };
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false as const, error: error.message };
  await refreshAccount();
  await refreshEvents();
  return { ok: true as const };
}

export async function signOut() {
  await supabaseBrowser()?.auth.signOut();
  await refreshAccount();
  await refreshEvents();
}

export async function toggleFavorite(id: string) {
  const client = supabaseBrowser();
  if (!client || !state.user) {
    askForAuth();
    return;
  }
  const active = state.favorites.includes(id);
  setState((current) => ({ ...current, favorites: active ? current.favorites.filter((item) => item !== id) : [...current.favorites, id] }));
  const query = client.from("favorites");
  const result = active ? await query.delete().eq("user_id", state.user.id).eq("event_id", id) : await query.insert({ user_id: state.user.id, event_id: id });
  if (result.error) await refreshAccount();
}

export async function requestFriend(username: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!state.user) {
    askForAuth();
    return { ok: false, error: "Melde dich an, um eine Anfrage zu senden." };
  }
  try {
    const response = await fetch("/api/friends", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ action: "request", username }),
    });
    if (!response.ok) return { ok: false, error: await readError(response, "Die Anfrage konnte nicht gesendet werden.") };
    return { ok: true };
  } catch {
    return { ok: false, error: "Die Anfrage konnte nicht gesendet werden." };
  }
}

async function answerRequest(requestId: string, action: "accept" | "decline") {
  if (!state.user) return askForAuth();
  const response = await fetch("/api/friends", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action, requestId }),
  });
  if (response.ok) await refreshAccount();
}

export const acceptFriendRequest = (requestId: string) => answerRequest(requestId, "accept");
export const declineFriendRequest = (requestId: string) => answerRequest(requestId, "decline");

export const togglePinFriend = (id: string) => {
  const next = pins();
  if (next.has(id)) next.delete(id);
  else next.add(id);
  localStorage.setItem(PIN_KEY, JSON.stringify([...next]));
  setState((current) => ({ ...current, friends: current.friends.map((friend) => (friend.id === id ? { ...friend, pinned: next.has(id) } : friend)) }));
};

export const removeFriend = (id: string) => {
  setState((current) => ({ ...current, friends: current.friends.filter((friend) => friend.id !== id) }));
  void (async () => {
    await fetch("/api/friends", { method: "POST", headers: await authHeaders(), body: JSON.stringify({ action: "remove", friendId: id }) });
    await refreshAccount();
  })();
};

export async function addEvent(event: EventItem): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = await accessToken();
  if (!token) {
    askForAuth();
    return { ok: false, error: "Melde dich an, um ein Event zu veröffentlichen." };
  }
  const fallback = "Speichern auf dem Server ist gerade nicht möglich.";
  try {
    const response = await fetch("/api/events", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(event),
    });
    if (!response.ok) return { ok: false, error: await readError(response, fallback) };
    const body = (await response.json()) as { event?: EventItem };
    if (!body.event) return { ok: false, error: fallback };
    setState((current) => ({ ...current, userEvents: [body.event as EventItem, ...current.userEvents.filter((item) => item.id !== body.event?.id)] }));
    return { ok: true };
  } catch {
    return { ok: false, error: fallback };
  }
}

export const setProfile = async (profile: Partial<Profile>) => {
  const client = supabaseBrowser();
  if (!client || !state.user) return askForAuth();
  if (profile.avatar !== undefined) {
    await client.from("profiles").update({ avatar_url: profile.avatar }).eq("id", state.user.id);
  }
  if (profile.name !== undefined) {
    const response = await fetch("/api/friends", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ action: "username", username: profile.name }),
    });
    if (!response.ok) return;
  }
  await refreshAccount();
};
