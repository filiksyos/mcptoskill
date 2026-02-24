const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

export async function redisSet(
  key: string,
  value: unknown,
  ttlSeconds?: number
): Promise<void> {
  const encodedValue = encodeURIComponent(JSON.stringify(value));
  const url = ttlSeconds
    ? `${KV_REST_API_URL}/setex/${key}/${ttlSeconds}/${encodedValue}`
    : `${KV_REST_API_URL}/set/${key}/${encodedValue}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
    },
  });
  if (!response.ok) {
    throw new Error(`redisSet failed: ${response.status} ${response.statusText}`);
  }
}

export async function redisGet<T>(key: string): Promise<T | null> {
  const response = await fetch(`${KV_REST_API_URL}/get/${key}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
    },
  });
  if (!response.ok) {
    throw new Error(`redisGet failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as { result: string | null };
  if (data.result === null) {
    return null;
  }
  return JSON.parse(data.result) as T;
}

export async function redisDel(key: string): Promise<void> {
  const response = await fetch(`${KV_REST_API_URL}/del/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
    },
  });
  if (!response.ok) {
    throw new Error(`redisDel failed: ${response.status} ${response.statusText}`);
  }
}
