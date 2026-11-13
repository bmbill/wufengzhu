"""這台電腦每週跑一次（Windows 工作排程器「燈燈相續-分段校準」，週日 20:00；錯過了開機後補跑）：

1. git pull：拿到 GitHub Actions 週日上午新增的毗缽舍那講次（Actions 上沒有語音辨識，只用停頓粗分）。
2. 找出還沒做過聲音對位的講次（tools/cache/segalign/ 裡沒有的），用 calib_segments.py 校準。
3. build_segments.py --only 這些講次，套用校準結果重建 segments.js。
4. 有變動就 commit、push。

紀錄寫在 tools/cache/local_weekly.log。
用法：python tools/local_weekly.py [--dry]（--dry 只列出要做的講次，不拉、不推、不跑）
"""
import datetime, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = sys.executable
ENV = dict(os.environ, PYTHONIOENCODING="utf8")


def log(*a):
    print(datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), *a, flush=True)


def run(cmd):
    log("$", " ".join(cmd))
    r = subprocess.run(cmd, cwd=ROOT, env=ENV, capture_output=True, text=True, encoding="utf8", errors="replace")
    out = (r.stdout + r.stderr).strip()
    if out:
        print("\n".join(l for l in out.splitlines() if "Warning" not in l)[-3000:], flush=True)
    if r.returncode:
        raise SystemExit("失敗：%s（%d）" % (cmd[0], r.returncode))
    return r


def todo():
    cache = json.load(open(os.path.join(ROOT, "tools", "segments_cache.json"), encoding="utf8"))
    d = os.path.join(ROOT, "tools", "cache", "segalign")
    done = {f[:-5] for f in os.listdir(d)} if os.path.isdir(d) else set()
    return sorted((k for k, v in cache.items() if v.get("tx") and k not in done), key=lambda k: (k[0], int(k[1:])))


def main():
    dry = "--dry" in sys.argv
    if not dry:
        run(["git", "pull", "--rebase", "--autostash"])
    new = todo()
    log("要校準的講次：", " ".join(new) or "（沒有）")
    if dry or not new:
        return
    run([PY, "tools/calib_segments.py", "--only", *new, "--workers", "2", "--threads", "5"])
    run([PY, "tools/build_segments.py", "--only", *new])
    files = ["segments.js", "tools/segments_align.json", "tools/segments_cache.json"]
    if subprocess.run(["git", "diff", "--quiet", "--", *files], cwd=ROOT).returncode == 0:
        log("分段沒有變動")
        return
    run(["git", "add", *files])
    run(["git", "commit", "-m", "毗缽舍那新講次：聲音對位校準分段（%s）\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" % " ".join(new)])
    run(["git", "push"])
    log("完成")


if __name__ == "__main__":
    main()
