/**
 * Downloads a file served by the backend (exports, extracts, reports) through
 * the same-origin proxy and saves it with the server-supplied file name.
 */
export const downloadFile = async (
  path: string,
  query: Record<string, string | number | boolean | undefined> = {},
  fallbackName = 'download',
): Promise<void> => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  const res = await fetch(`/api/proxy${path}${qs ? `?${qs}` : ''}`, { credentials: 'include' });
  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename[^;=\n]*=["']?([^"';\n]+)["']?/i.exec(disposition);
  const fileName = match?.[1] ? decodeURIComponent(match[1].trim()) : fallbackName;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
