#!/usr/bin/env python3
"""
Nexus Platform — Cloudflare Auto Deploy
Taruh token + account ID di sini, langsung jalan.

CARA PAKAI:
1. Ganti TOKEN dan ACCOUNT_ID di bawah
2. python3 deploy.py
"""

import subprocess, json, os, sys

# ═══════════════════════════════════════════════
# ISI TOKEN + ACCOUNT ID LU DI SINI
# ═══════════════════════════════════════════════
TOKEN = "ISI_TOKEN_LU_DISINI"
ACCOUNT_ID = "ISI_ACCOUNT_ID_LU_DISINI"  # bukan email! 32 karakter hex

# ═══════════════════════════════════════════════

CF_API = "https://api.cloudflare.com/client/v4"

def cf(method, path, body=None):
    """Call Cloudflare API"""
    import urllib.request
    url = path if path.startswith("http") else CF_API + path
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", "Bearer " + TOKEN)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())
    except Exception as e:
        return {"success": False, "errors": [str(e)]}

def main():
    if TOKEN.startswith("ISI_"):
        print("ERROR: Isi TOKEN dulu di script ini!")
        print("Buka file deploy.py, ganti TOKEN dan ACCOUNT_ID")
        sys.exit(1)
    
    if ACCOUNT_ID.startswith("ISI_"):
        print("ERROR: Isi ACCOUNT_ID dulu!")
        print("Buka https://dash.cloudflare.com → copy Account ID dari sidebar kanan")
        print("Account ID itu 32 karakter hex, BUKAN email!")
        sys.exit(1)

    print(">>> Nexus Platform CF Deploy")
    print(f"    Account: {ACCOUNT_ID}")
    
    # Test token
    r = cf("GET", "/user/tokens/verify")
    if r.get("success"):
        print(f"    Token: ACTIVE (id: {r['result']['id'][:8]}...)")
    else:
        print(f"    Token ERROR: {r.get('errors')}")
        sys.exit(1)
    
    # 1. Create D1 Database
    print("\n[1/6] D1 Database...")
    r = cf("GET", f"/accounts/{ACCOUNT_ID}/d1/database")
    db = None
    if r.get("success"):
        for d in r["result"]:
            if d["name"] == "nexus-platform":
                db = d
    if not db:
        r = cf("POST", f"/accounts/{ACCOUNT_ID}/d1/database", {"name": "nexus-platform"})
        if r.get("success"):
            db = r["result"]
            print(f"    Created: {db['uuid']}")
    if db:
        print(f"    Ready: {db['uuid']}")
        
        # Apply schema
        schema_path = os.path.join(os.path.dirname(__file__), "..", "config", "d1-schema.sql")
        with open(schema_path) as f:
            schema = f.read()
        stmts = [s.strip() + ";" for s in schema.split(";") if s.strip()]
        ok = 0
        for stmt in stmts:
            r = cf("POST", f"/accounts/{ACCOUNT_ID}/d1/database/{db['uuid']}/query", {"sql": stmt})
            if r.get("success"): ok += 1
        print(f"    Schema: {ok}/{len(stmts)} tables")
    
    # 2. KV Namespaces
    print("[2/6] KV Namespaces...")
    for ns_name in ["AUTH_CACHE", "RATE_LIMIT"]:
        r = cf("GET", f"/accounts/{ACCOUNT_ID}/storage/kv/namespaces")
        existing = None
        if r.get("success"):
            existing = next((k for k in r["result"] if k["title"] == ns_name), None)
        if not existing:
            r = cf("POST", f"/accounts/{ACCOUNT_ID}/storage/kv/namespaces", {"title": ns_name})
            if r.get("success"):
                print(f"    Created: {ns_name} ({r['result']['id']})")
        else:
            print(f"    Exists: {ns_name} ({existing['id']})")
    
    # 3. R2 Bucket
    print("[3/6] R2 Bucket...")
    r = cf("POST", f"/accounts/{ACCOUNT_ID}/r2/buckets", {"name": "nexus-media"})
    if r.get("success"):
        print("    Created: nexus-media")
    else:
        print("    Already exists")
    
    # 4. Queues
    print("[4/6] Queues...")
    for q in ["nexus-messages", "nexus-notifications"]:
        r = cf("POST", f"/accounts/{ACCOUNT_ID}/workers/queues", {"queue_name": q})
        if r.get("success"):
            print(f"    Created: {q}")
    
    # 5. Build Worker
    print("[5/6] Building Worker...")
    workers_dir = os.path.join(os.path.dirname(__file__), "..", "workers")
    files = [
        "presence/src/PresenceManager.ts",
        "auth-edge/src/UserSession.ts",
        "chat-durable-object/src/ChatRoom.ts",
        "api-gateway/src/queue-consumer.ts",
        "api-gateway/src/index.ts",
    ]
    code = ""
    for f in files:
        fp = os.path.join(workers_dir, f)
        if os.path.exists(fp):
            with open(fp) as fh:
                code += f"\n// === {f} ===\n{fh.read()}"
    
    # Convert to deployable JS
    import re
    js = code
    js = re.sub(r': \w+(\[\])?', '', js)
    js = re.sub(r'interface \w+ \{[\s\S]*?\}', '', js)
    js = re.sub(r'export class', 'class', js)
    js = re.sub(r'export default', 'const __defaultExport =', js)
    js = re.sub(r'import \{.*?\} from .*?;', '', js)
    js = re.sub(r'import .*? from .*?;', '', js)
    js += '\nexport default __defaultExport;\n'
    
    bundle_path = os.path.join(os.path.dirname(__file__), "bundle.js")
    with open(bundle_path, "w") as f:
        f.write(js)
    size = os.path.getsize(bundle_path) / 1024
    print(f"    Bundle: {size:.1f} KB")
    
    # 6. Deploy Worker
    print("[6/6] Deploying Worker...")
    
    # Use multipart/form-data upload manually
    boundary = "----NexusBoundary" + os.urandom(8).hex()
    
    metadata = {
        "main_module": "bundle.js",
        "bindings": [
            {"type": "r2_bucket", "name": "MEDIA_BUCKET", "bucket_name": "nexus-media"},
        ]
    }
    
    if db:
        metadata["bindings"].append({"type": "d1_database", "name": "NEXUS_DB", "id": db["uuid"]})
    
    # Get KV IDs
    r = cf("GET", f"/accounts/{ACCOUNT_ID}/storage/kv/namespaces")
    if r.get("success"):
        for ns in r["result"]:
            if ns["title"] == "AUTH_CACHE":
                metadata["bindings"].append({"type": "kv_namespace", "name": "AUTH_CACHE", "namespace_id": ns["id"]})
            if ns["title"] == "RATE_LIMIT":
                metadata["bindings"].append({"type": "kv_namespace", "name": "RATE_LIMIT", "namespace_id": ns["id"]})
    
    # Build multipart body
    with open(bundle_path, "rb") as f:
        bundle_content = f.read()
    
    body = b""
    # Part 1: metadata
    body += f"--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="metadata"\r\n'
    body += b'Content-Type: application/json\r\n\r\n'
    body += json.dumps(metadata).encode()
    body += b"\r\n"
    # Part 2: bundle.js
    body += f"--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="bundle.js"; filename="bundle.js"\r\n'
    body += b'Content-Type: application/javascript\r\n\r\n'
    body += bundle_content
    body += b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    
    import urllib.request
    deploy_url = f"{CF_API}/accounts/{ACCOUNT_ID}/workers/scripts/nexus-api-gateway"
    req = urllib.request.Request(deploy_url, data=body, method="PUT")
    req.add_header("Authorization", "Bearer " + TOKEN)
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
        if result.get("success"):
            print(f"    Deployed! ✓")
        else:
            print(f"    Error: {result.get('errors')}")
    except urllib.error.HTTPError as e:
        err = json.loads(e.read())
        print(f"    HTTP {e.code}: {err.get('errors')}")
    
    # Done
    print(f"\n{'='*50}")
    print(f"  DEPLOYMENT COMPLETE")
    print(f"{'='*50}")
    print(f"  API: https://nexus-api-gateway.{ACCOUNT_ID}.workers.dev/health")
    print(f"  Dashboard: https://dash.cloudflare.com/{ACCOUNT_ID}/workers")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()
