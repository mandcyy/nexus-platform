import urllib.request, json, os, time

token = open(os.path.expanduser('~/nexus-platform/cloudflare/deploy/.cf_token')).read().strip()
acct = '62dcb140db748a97a99569f9fc8cf1d4'

def cf(path):
    req = urllib.request.Request(f'https://api.cloudflare.com/client/v4{path}',
        headers={'Authorization': 'Bearer ' + token})
    with urllib.request.urlopen(req) as r: return json.loads(r.read())['result']

kvs = {k['title']: k['id'] for k in cf(f'/accounts/{acct}/storage/kv/namespaces')}
dbs = cf(f'/accounts/{acct}/d1/database')
db = next((d for d in dbs if d['name']=='nexus-platform'), None)

# Build bindings - D1 uses 'd1' type with database_id
bindings = []
if db:
    bindings.append({'type': 'd1', 'name': 'NEXUS_DB', 'database_id': db['uuid']})
for name in ['AUTH_CACHE','RATE_LIMIT']:
    if name in kvs:
        bindings.append({'type':'kv_namespace','name':name,'namespace_id':kvs[name]})

print(f'Bindings: {len(bindings)}')

worker = open(os.path.expanduser('~/nexus-platform/cloudflare/deploy/worker.js')).read()
metadata = json.dumps({'main_module': 'worker.js', 'bindings': bindings})

boundary = '----NB' + os.urandom(8).hex()
body = b''
body += ('--' + boundary + '\r\n').encode()
body += b'Content-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n'
body += metadata.encode() + b'\r\n'
body += ('--' + boundary + '\r\n').encode()
body += b'Content-Disposition: form-data; name="worker.js"; filename="worker.js"\r\nContent-Type: application/javascript+module\r\n\r\n'
body += worker.encode() + b'\r\n'
body += ('--' + boundary + '--\r\n').encode()

req = urllib.request.Request(
    f'https://api.cloudflare.com/client/v4/accounts/{acct}/workers/scripts/nexus-api-gateway',
    data=body, method='PUT')
req.add_header('Authorization', 'Bearer ' + token)
req.add_header('Content-Type', 'multipart/form-data; boundary=' + boundary)

try:
    with urllib.request.urlopen(req) as resp:
        r = json.loads(resp.read())
    if r.get('success'):
        print('DEPLOYED!')
    else:
        print('Error:', json.dumps(r.get('errors',[]), indent=2))
except urllib.error.HTTPError as e:
    err = json.loads(e.read())
    msgs = [x.get('message','?')[:80] for x in err.get('errors',[])]
    print(f'HTTP {e.code}: {msgs}')

time.sleep(3)
try:
    req2 = urllib.request.Request(f'https://nexus-api-gateway.{acct}.workers.dev/health')
    with urllib.request.urlopen(req2) as resp:
        print('\n>>> HEALTH:', resp.read().decode()[:200])
except Exception as e:
    print(f'\nTest: curl https://nexus-api-gateway.{acct}.workers.dev/health')
