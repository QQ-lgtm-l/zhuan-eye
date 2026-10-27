import subprocess, json, ssl, urllib.request, urllib.error, sys

cred = subprocess.run(
    ["git", "credential", "fill"],
    input=b"protocol=https\nhost=github.com\n\n",
    capture_output=True,
).stdout.decode("utf-8", "replace")
token = ""
for line in cred.splitlines():
    if line.startswith("password="):
        token = line.split("=", 1)[1].strip()
if not token:
    print("NO_TOKEN")
    sys.exit(1)

ctx = ssl._create_unverified_context()

def api(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        "https://api.github.com" + path,
        method=method,
        data=data,
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/vnd.github+json",
            "User-Agent": "dsh-push",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode() or "{}")
        except Exception:
            body = {}
        return e.code, body

status, body = api("PATCH", "/repos/QQ-lgtm-l/zhuan-eye", {"private": False})
print("status", status)
if status == 200:
    print("REPO", body.get("full_name"))
    print("PRIVATE", body.get("private"))
    print("URL", body.get("html_url"))
else:
    print("FAILED", body.get("message"))
    sys.exit(1)
