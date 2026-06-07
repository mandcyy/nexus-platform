/**
 * Nexus Platform — Media Worker
 * Handles image optimization, thumbnail generation at edge.
 * Uses Cloudflare Images for on-the-fly transformation.
 */

interface Env {
  MEDIA_BUCKET: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // On-the-fly image resizing
    const imageMatch = path.match(/^\/media\/(.+)\.(jpg|jpeg|png|webp|avif|gif)$/i);
    if (imageMatch) {
      const key = imageMatch[1];
      const format = imageMatch[2].toLowerCase();
      const width = parseInt(url.searchParams.get('w') || '0');
      const height = parseInt(url.searchParams.get('h') || '0');
      const quality = parseInt(url.searchParams.get('q') || '80');

      const object = await env.MEDIA_BUCKET.get(`media/${key}.${format}`);
      if (!object) return new Response('Not Found', { status: 404 });

      // Use Cloudflare Image Resizing (built-in)
      const options: any = {};
      if (width) options.width = width;
      if (height) options.height = height;
      if (quality) options.quality = quality;
      options.format = format === 'jpg' ? 'jpeg' : format;
      options.fit = 'scale-down';

      const imageRequest = new Request(
        `https://nexus-images.nexus-platform.com/cdn-cgi/image/${Object.entries(options)
          .map(([k, v]) => `${k}=${v}`)
          .join(',')}/${key}.${format}`,
        { headers: request.headers }
      );

      // Let Cloudflare's image resizing handle it
      const response = await fetch(imageRequest, {
        cf: { image: options },
      });

      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Video chunked upload initiation
    if (request.method === 'POST' && path === '/upload/init') {
      const { fileName, fileSize, mimeType, totalChunks } = await request.json!();
      const uploadId = crypto.randomUUID();
      const chunkSize = Math.ceil(fileSize / totalChunks);

      return new Response(JSON.stringify({ uploadId, chunkSize }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Video chunk upload
    if (request.method === 'PUT' && path.startsWith('/upload/chunk/')) {
      const parts = path.split('/');
      const uploadId = parts[3];
      const chunkIndex = parts[4];

      const chunk = await request.arrayBuffer();
      const chunkKey = `chunks/${uploadId}/${chunkIndex}`;

      await env.MEDIA_BUCKET.put(chunkKey, chunk);

      return new Response(JSON.stringify({ uploaded: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Complete multipart upload
    if (request.method === 'POST' && path.startsWith('/upload/complete/')) {
      const uploadId = path.split('/')[3];

      // Assemble chunks (simplified — in production use R2 multipart)
      const finalKey = `media/${uploadId}`;
      const chunks = await env.MEDIA_BUCKET.list({ prefix: `chunks/${uploadId}/` });

      // Combine chunks into final object
      const parts: ArrayBuffer[] = [];
      for (const obj of chunks.objects) {
        const part = await env.MEDIA_BUCKET.get(obj.key);
        if (part) parts.push(await part.arrayBuffer());
      }

      const combined = new Blob(parts);
      await env.MEDIA_BUCKET.put(finalKey, combined.stream());

      // Cleanup chunks
      for (const obj of chunks.objects) {
        await env.MEDIA_BUCKET.delete(obj.key);
      }

      return new Response(JSON.stringify({
        id: uploadId,
        url: `/media/${uploadId}`,
        size: combined.size,
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Not Found', { status: 404 });
  },
};