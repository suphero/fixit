const { BASIC_AUTH_USERNAME, BASIC_AUTH_PASSWORD } = process.env;

export function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return false;

  const [scheme, encoded] = authHeader.split(" ");
  if (scheme !== "Basic" || !encoded) return false;

  const decoded = Buffer.from(encoded, "base64").toString();
  const [username, password] = decoded.split(":");

  return username === BASIC_AUTH_USERNAME && password === BASIC_AUTH_PASSWORD;
}

export function unauthorizedResponse() {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Secure Area"',
    },
  });
}
