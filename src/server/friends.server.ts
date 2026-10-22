import { supabaseAsUser } from "@/lib/supabase";

const SETUP = "Supabase ist noch nicht eingerichtet.";

function pair(a: string, b: string) {
  return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a };
}

async function userId(client: NonNullable<ReturnType<typeof supabaseAsUser>>, accessToken: string) {
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return "";
  return data.user.id;
}

export async function listFriendState(accessToken: string) {
  const client = supabaseAsUser(accessToken);
  if (!client) return { ok: false as const, error: SETUP, status: 503 };
  const me = await userId(client, accessToken);
  if (!me) return { ok: false as const, error: "Melde dich an.", status: 401 };
  const [{ data: requests }, { data: ships }, { data: favorites }] = await Promise.all([
    client.from("friend_requests").select("id, from_id, profiles!friend_requests_from_id_fkey(username)").eq("to_id", me),
    client.from("friendships").select("user_a, user_b").or(`user_a.eq.${me},user_b.eq.${me}`),
    client.from("favorites").select("user_id, event_id"),
  ]);
  const friendIds = (ships ?? []).map((ship) => (ship.user_a === me ? ship.user_b : ship.user_a));
  const { data: profiles } = friendIds.length ? await client.from("profiles").select("id, username").in("id", friendIds) : { data: [] };
  const incoming = (requests ?? []).map((request) => {
    const profile = Array.isArray(request.profiles) ? request.profiles[0] : request.profiles;
    return { id: request.id as string, fromId: request.from_id as string, fromUsername: (profile as { username?: string } | null)?.username ?? "Nutzer" };
  });
  const friends = (profiles ?? []).map((profile) => ({
    id: profile.id as string,
    username: profile.username as string,
    favorites: (favorites ?? []).filter((favorite) => favorite.user_id === profile.id).map((favorite) => favorite.event_id as string),
  }));
  return { ok: true as const, requests: incoming, friends };
}

export async function sendFriendRequest(accessToken: string, username: string) {
  const client = supabaseAsUser(accessToken);
  if (!client) return { ok: false as const, error: SETUP, status: 503 };
  const me = await userId(client, accessToken);
  if (!me) return { ok: false as const, error: "Melde dich an.", status: 401 };
  const name = username.trim();
  const { data: target } = await client.from("profiles").select("id, username").eq("username", name).maybeSingle();
  if (!target) return { ok: false as const, error: "Diesen Nutzernamen gibt es nicht.", status: 404 };
  if (target.id === me) return { ok: false as const, error: "Du kannst dich nicht selbst anfragen.", status: 400 };
  const ids = pair(me, target.id);
  const { data: existing } = await client.from("friendships").select("user_a").eq("user_a", ids.user_a).eq("user_b", ids.user_b).maybeSingle();
  if (existing) return { ok: false as const, error: "Ihr seid schon befreundet.", status: 409 };
  const { error } = await client.from("friend_requests").insert({ from_id: me, to_id: target.id });
  if (error) return { ok: false as const, error: "Die Anfrage ist schon offen oder konnte nicht gesendet werden.", status: 409 };
  return { ok: true as const };
}

export async function answerFriendRequest(accessToken: string, requestId: string, accept: boolean) {
  const client = supabaseAsUser(accessToken);
  if (!client) return { ok: false as const, error: SETUP, status: 503 };
  const me = await userId(client, accessToken);
  if (!me) return { ok: false as const, error: "Melde dich an.", status: 401 };
  const { data: request } = await client.from("friend_requests").select("id, from_id, to_id").eq("id", requestId).eq("to_id", me).maybeSingle();
  if (!request) return { ok: false as const, error: "Diese Anfrage gibt es nicht.", status: 404 };
  if (accept) {
    const ids = pair(request.from_id, request.to_id);
    const { error } = await client.from("friendships").insert(ids);
    if (error) return { ok: false as const, error: "Die Freundschaft konnte nicht gespeichert werden.", status: 500 };
  }
  await client.from("friend_requests").delete().eq("id", requestId);
  return listFriendState(accessToken);
}

export async function deleteFriendship(accessToken: string, friendId: string) {
  const client = supabaseAsUser(accessToken);
  if (!client) return { ok: false as const, error: SETUP, status: 503 };
  const me = await userId(client, accessToken);
  if (!me) return { ok: false as const, error: "Melde dich an.", status: 401 };
  const ids = pair(me, friendId);
  await client.from("friendships").delete().eq("user_a", ids.user_a).eq("user_b", ids.user_b);
  return { ok: true as const };
}

export async function updateUsername(accessToken: string, username: string) {
  const client = supabaseAsUser(accessToken);
  if (!client) return { ok: false as const, error: SETUP, status: 503 };
  const me = await userId(client, accessToken);
  if (!me) return { ok: false as const, error: "Melde dich an.", status: 401 };
  const name = username.trim();
  if (name.length < 2 || name.length > 40) return { ok: false as const, error: "Der Nutzername muss 2 bis 40 Zeichen haben.", status: 400 };
  const { error } = await client.from("profiles").update({ username: name }).eq("id", me);
  if (error) return { ok: false as const, error: "Dieser Nutzername ist schon vergeben.", status: 409 };
  return { ok: true as const };
}
