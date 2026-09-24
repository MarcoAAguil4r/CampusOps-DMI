const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function isLoopback(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname);
}

export function getCourseBackendBaseUrl(override?: string): string {
  const configuredUrl = override?.trim() || process.env.EXPO_PUBLIC_COURSE_BACKEND_URL?.trim();
  if (!configuredUrl) {
    throw new Error('EXPO_PUBLIC_COURSE_BACKEND_URL must be configured before contacting the backend');
  }

  let parsed: URL;
  try {
    parsed = new URL(configuredUrl);
  } catch {
    throw new Error('EXPO_PUBLIC_COURSE_BACKEND_URL must be an absolute URL');
  }

  if (parsed.username || parsed.password) {
    throw new Error('EXPO_PUBLIC_COURSE_BACKEND_URL must not contain credentials');
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('EXPO_PUBLIC_COURSE_BACKEND_URL must contain only an origin');
  }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopback(parsed.hostname))) {
    throw new Error('EXPO_PUBLIC_COURSE_BACKEND_URL must use HTTPS outside local development');
  }

  return parsed.origin;
}
