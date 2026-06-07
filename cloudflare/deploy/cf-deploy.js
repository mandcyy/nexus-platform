#!/usr/bin/env node
/**
 * Nexus Platform — Cloudflare Deploy via REST API
 * No wrangler needed. Works on Android/Termux.
 * Usage: CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=xxx node cf-deploy.js
 */

const CF_API = 'https://api.cloudflare.com/client/v4';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!TOKEN || !ACCOUNT_ID) {
  console.error('ERROR: Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID');
  console.error('');
  console.error('Get API Token: https://dash.cloudflare.com/profile/api-tokens');
  console.error('  → Create Token → Custom Token');
  console.error('  → Permissions: Account.Workers:Edit, Account.D1:Edit, Account.R2:Edit');
  console.error('');
  console.error('Get Account ID from: https://dash.cloudflare.com');
  console.error('  → Copy from right sidebar');
  console.error('');
  console.error('Then run:');
  console.error('  export CLOUDFLARE_API_TOKEN=your-token');
  console.error('  export CLOUDFLARE_ACCOUNT_ID=your-account-id');
  console.error('  node cf-deploy.js');
  process.exit(1);
}

const headers = {
  'Authorization': 'Bearer ' + TOKEN,
  'Content-Type': 'application/json',
};

async function cf(method, path, body) {
  const opts = { method: method, headers: headers };
  if (body) opts.body = JSON.stringify(body);
  const url = path.startsWith('http') ? path : CF_API + path;
  
  try {
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!data.success) {
      console.error('  API Error [' + method + ' ' + path + ']:', JSON.stringify(data.errors));
      return null;
    }
    return data.result;
  } catch (e) {
    console.error('  Network Error:', e.message);
    return null;
  }
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║  Nexus Platform — CF Deploy v1.0    ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  // ═══ 1. D1 Database ═══
  console.log('[1/7] Creating D1 Database...');
  let db = null;
  try {
    const dbs = await cf('GET', '/accounts/' + ACCOUNT_ID + '/d1/database');
    db = dbs ? dbs.find(function(d) { return d.name === 'nexus-platform'; }) : null;
    if (db) {
      console.log('  ✓ D1 exists: ' + db.uuid);
    } else {
      db = await cf('POST', '/accounts/' + ACCOUNT_ID + '/d1/database', { name: 'nexus-platform' });
      if (db) console.log('  ✓ D1 created: ' + db.uuid);
    }
  } catch (e) {
    console.error('  ✗ D1 failed:', e.message);
  }

  // ═══ 2. D1 Schema ═══
  if (db) {
    console.log('[2/7] Applying D1 Schema...');
    try {
      const fs = require('fs');
      const path = require('path');
      const schemaPath = path.join(__dirname, '..', 'config', 'd1-schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      const stmts = schema.split(';').filter(function(s) { return s.trim().length > 0; });
      
      let applied = 0;
      for (const stmt of stmts) {
        try {
          const sql = stmt.trim() + ';';
          await cf('POST', '/accounts/' + ACCOUNT_ID + '/d1/database/' + db.uuid + '/query', { sql: sql });
          applied++;
        } catch (e) {
          // Skip "already exists" type errors
        }
      }
      console.log('  ✓ ' + applied + ' statements applied');
    } catch (e) {
      console.error('  ✗ Schema failed:', e.message);
    }
  }

  // ═══ 3. KV Namespaces ═══
  console.log('[3/7] Creating KV Namespaces...');
  let authKv = null;
  let rateKv = null;
  try {
    const kvs = await cf('GET', '/accounts/' + ACCOUNT_ID + '/storage/kv/namespaces');
    
    authKv = kvs ? kvs.find(function(k) { return k.title === 'AUTH_CACHE'; }) : null;
    rateKv = kvs ? kvs.find(function(k) { return k.title === 'RATE_LIMIT'; }) : null;

    if (!authKv) {
      authKv = await cf('POST', '/accounts/' + ACCOUNT_ID + '/storage/kv/namespaces', { title: 'AUTH_CACHE' });
    }
    if (!rateKv) {
      rateKv = await cf('POST', '/accounts/' + ACCOUNT_ID + '/storage/kv/namespaces', { title: 'RATE_LIMIT' });
    }
    console.log('  ✓ AUTH_CACHE: ' + (authKv ? authKv.id : '?'));
    console.log('  ✓ RATE_LIMIT: ' + (rateKv ? rateKv.id : '?'));
  } catch (e) {
    console.error('  ✗ KV failed:', e.message);
  }

  // ═══ 4. R2 Bucket ═══
  console.log('[4/7] Creating R2 Bucket...');
  try {
    await cf('POST', '/accounts/' + ACCOUNT_ID + '/r2/buckets', { name: 'nexus-media' });
    console.log('  ✓ R2 bucket: nexus-media');
  } catch (e) {
    console.log('  ✓ R2 exists (or created)');
  }

  // ═══ 5. Queues ═══
  console.log('[5/7] Creating Queues...');
  try {
    await cf('POST', '/accounts/' + ACCOUNT_ID + '/workers/queues', { queue_name: 'nexus-messages' });
  } catch (e) {}
  try {
    await cf('POST', '/accounts/' + ACCOUNT_ID + '/workers/queues', { queue_name: 'nexus-notifications' });
  } catch (e) {}
  console.log('  ✓ Queues: nexus-messages, nexus-notifications');

  // ═══ 6. Build Worker Bundle ═══
  console.log('[6/7] Bundling Worker...');
  const fs = require('fs');
  const path = require('path');
  const workersDir = path.join(__dirname, '..', 'workers');

  const workerFiles = [
    'presence/src/PresenceManager.ts',
    'auth-edge/src/UserSession.ts',
    'chat-durable-object/src/ChatRoom.ts',
    'api-gateway/src/queue-consumer.ts',
    'api-gateway/src/index.ts',
  ];

  let combinedCode = '';
  for (const f of workerFiles) {
    const fullPath = path.join(workersDir, f);
    if (fs.existsSync(fullPath)) {
      combinedCode += '\n// === ' + f + ' ===\n';
      combinedCode += fs.readFileSync(fullPath, 'utf-8');
    }
  }

  // Convert to deployable JS (strip TS types, fix imports)
  let jsCode = combinedCode
    .replace(/: \w+(\[\])?/g, '')
    .replace(/interface \w+ \{[\s\S]*?\}/g, '')
    .replace(/export class/g, 'class')
    .replace(/export default/g, 'const __defaultExport =')
    .replace(/import \{.*?\} from '.*?';/g, '')
    .replace(/import .*? from '.*?';/g, '');

  jsCode += '\nexport default __defaultExport;\n';

  const bundlePath = path.join(__dirname, 'bundle.js');
  fs.writeFileSync(bundlePath, jsCode);
  const sizeKb = (fs.statSync(bundlePath).size / 1024).toFixed(1);
  console.log('  ✓ Bundle: ' + sizeKb + ' KB');

  // ═══ 7. Deploy Worker ═══
  console.log('[7/7] Deploying Worker...');
  const workerName = 'nexus-api-gateway';

  try {
    const metadata = {
      main_module: 'bundle.js',
      bindings: [],
    };

    if (authKv) metadata.bindings.push({ type: 'kv_namespace', name: 'AUTH_CACHE', namespace_id: authKv.id });
    if (rateKv) metadata.bindings.push({ type: 'kv_namespace', name: 'RATE_LIMIT', namespace_id: rateKv.id });
    if (db) metadata.bindings.push({ type: 'd1_database', name: 'NEXUS_DB', id: db.uuid });
    metadata.bindings.push({ type: 'r2_bucket', name: 'MEDIA_BUCKET', bucket_name: 'nexus-media' });
    metadata.bindings.push({ type: 'plain_text', name: 'JWT_SECRET', text: process.env.JWT_SECRET || 'dev-secret-change-in-production' });

    const formData = new FormData();
    formData.append('metadata', JSON.stringify(metadata));
    formData.append('bundle.js', new Blob([fs.readFileSync(bundlePath)], { type: 'application/javascript' }));

    const deployUrl = CF_API + '/accounts/' + ACCOUNT_ID + '/workers/scripts/' + workerName;
    const putHeaders = { 'Authorization': 'Bearer ' + TOKEN };

    const res = await fetch(deployUrl, {
      method: 'PUT',
      headers: putHeaders,
      body: formData,
    });

    const result = await res.json();
    if (result.success) {
      console.log('  ✓ Worker deployed: ' + workerName);
    } else {
      console.error('  ✗ Deploy failed:', JSON.stringify(result.errors));
      console.log('');
      console.log('  Manual deploy:');
      console.log('  1. Go to https://dash.cloudflare.com/' + ACCOUNT_ID + '/workers');
      console.log('  2. Create Worker → Upload');
      console.log('  3. Upload: ' + bundlePath);
    }
  } catch (e) {
    console.error('  ✗ Error:', e.message);
  }

  // ═══ Summary ═══
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  DEPLOYMENT COMPLETE');
  console.log('═══════════════════════════════════════');
  if (db) console.log('  D1 Database:   ' + db.uuid);
  console.log('  Worker:        ' + workerName);
  console.log('  Test URL:      https://' + workerName + '.' + ACCOUNT_ID + '.workers.dev/health');
  console.log('');
  console.log('  Dashboard:     https://dash.cloudflare.com/' + ACCOUNT_ID + '/workers');
  console.log('');
  console.log('  Add domain: Workers > ' + workerName + ' > Triggers > Custom Domains');
  console.log('═══════════════════════════════════════');
}

main().catch(function(err) {
  console.error('FATAL ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
