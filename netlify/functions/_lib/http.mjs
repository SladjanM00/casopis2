export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function methodNotAllowed(allowed = "GET") {
  return json({ error: "Metod nije dozvoljen." }, 405, { allow: allowed });
}

export function getQuery(req) {
  return new URL(req.url).searchParams;
}
