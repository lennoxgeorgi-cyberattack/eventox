import { createFileRoute } from "@tanstack/react-router";

async function friendsApi() {
  return import("@/server/friends.server");
}

function tokenFrom(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export const Route = createFileRoute("/api/friends")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { listFriendState } = await friendsApi();
        const result = await listFriendState(tokenFrom(request));
        if (!result.ok) return Response.json({ error: result.error, requests: [], friends: [] }, { status: result.status });
        return Response.json({ requests: result.requests, friends: result.friends });
      },
      POST: async ({ request }) => {
        const accessToken = tokenFrom(request);
        if (!accessToken) return Response.json({ error: "Melde dich an." }, { status: 401 });
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
        }
        const record = body != null && typeof body === "object" ? (body as Record<string, unknown>) : {};
        const action = text(record.action);
        const { sendFriendRequest, answerFriendRequest, deleteFriendship, updateUsername } = await friendsApi();
        if (action === "request") {
          const result = await sendFriendRequest(accessToken, text(record.username));
          if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
          return Response.json({ ok: true }, { status: 201 });
        }
        if (action === "accept" || action === "decline") {
          const result = await answerFriendRequest(accessToken, text(record.requestId), action === "accept");
          if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
          return Response.json(result);
        }
        if (action === "remove") {
          const result = await deleteFriendship(accessToken, text(record.friendId));
          if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
          return Response.json({ ok: true });
        }
        if (action === "username") {
          const result = await updateUsername(accessToken, text(record.username));
          if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
          return Response.json({ ok: true });
        }
        return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
      },
    },
  },
});
