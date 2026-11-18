#!/usr/bin/env python3
"""UP AND DOWN Lote 7: assemble a local-only release worktree; NEVER push/deploy."""
from pathlib import Path
import re
import subprocess
import tempfile

MAIN_SHA = "44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b"
SOURCE_SHA = "c04513dabb8192aee9f555bbfb29583a116ece07"
CANDIDATE = "integracion/premium-white-candidata-20261117"
FILES = (
    "public/assets/updown-product-placeholder.svg",
    "public/updown-parity-runtime.js",
    "public/updown-preview-services-stage7.js",
    "src/app/globals.css",
    "src/app/page.tsx",
    "src/app/producto/[productKey]/page.tsx",
    "src/app/vista-previa/page.tsx",
    "src/app/vista-previa/premium-white.css",
    "src/app/vista-previa/preview-desktop-search-focus.tsx",
    "src/app/vista-previa/preview-filter-auto-collapse.tsx",
    "src/app/vista-previa/preview-header.css",
    "src/app/vista-previa/preview-local-product-navigation.tsx",
    "src/app/vista-previa/producto/[productKey]/page.tsx",
    "src/components/admin/services-admin.tsx",
    "src/components/store/premium-product-detail.css",
    "src/components/store/product-detail.tsx",
    "src/components/store/related-products-rail.tsx",
    "src/components/store/responsive/mobile-header.tsx",
    "src/components/store/responsive/store-search.tsx",
    "src/components/store/storefront-parity.tsx",
    "src/components/store/use-storefront-language.ts",
    "tests/integration-lot2a-style.cjs",
    "tests/integration-lot2c-shared-skin.cjs",
    "tests/premium-white-contracts.cjs",
)
ALLOWED_AFTER_SOURCE = {
    "scripts/prepare-release-local.py", "design/LOTE7-RELEASE-LOCAL-20261118.md",
    "design/INTEGRACION-ESTADO.md",
    # QA only: permitted in the candidate, excluded from the 24-file release.
    ".github/workflows/upndown-premium-release-qa.yml",
    "playwright.premium-release.config.ts",
    "tests/premium-release-viewport.spec.ts",
}


def git(*args, cwd=None, capture=True):
    return subprocess.run(["git", *( ["-C", str(cwd)] if cwd else [] ), *args],
                          check=True, capture_output=capture, text=capture)


def replace_exact(root, file, old, new):
    target = root / file
    data = target.read_text(encoding="utf-8")
    if data.count(old) != 1:
        raise RuntimeError(f"Guard mismatch in {file}: expected one occurrence")
    target.write_text(data.replace(old, new), encoding="utf-8")


def run():
    root = Path(git("rev-parse", "--show-toplevel").stdout.strip())
    remote = git("remote", "get-url", "origin", cwd=root).stdout.strip()
    if not re.search(r"corporativonexia-creator/upndowncabo(?:\.git)?$", remote):
        raise RuntimeError("Unsafe origin: wrong GitHub repository")
    if git("status", "--porcelain", cwd=root).stdout.strip():
        raise RuntimeError("Source checkout has pending changes; use a clean checkout")

    # Read-only remote operation: fetch; no commits, PRs, pushes or deployments.
    git("fetch", "--no-tags", "origin",
        "+refs/heads/main:refs/remotes/origin/main",
        "+refs/heads/" + CANDIDATE + ":refs/remotes/origin/" + CANDIDATE,
        cwd=root, capture=False)
    main = git("rev-parse", "refs/remotes/origin/main", cwd=root).stdout.strip()
    head = git("rev-parse", "refs/remotes/origin/" + CANDIDATE, cwd=root).stdout.strip()
    if main != MAIN_SHA:
        raise RuntimeError("main changed; stop and repeat the preintegration audit")
    # The release source is immutable. Later candidate commits may add ONLY the local assembly tools.
    git("merge-base", "--is-ancestor", SOURCE_SHA, head, cwd=root)
    later = set(git("diff", "--name-only", SOURCE_SHA, head, cwd=root).stdout.splitlines())
    if not later.issubset(ALLOWED_AFTER_SOURCE):
        raise RuntimeError("Candidate code drift after audited SHA: " + ", ".join(sorted(later)))

    if len(FILES) != 24 or len(set(FILES)) != 24:
        raise RuntimeError("Expected exactly 21 application files and 3 test suites")
    target = Path(tempfile.mkdtemp(prefix="upndown-release-local-"))
    target.rmdir()
    git("worktree", "add", "--detach", str(target), MAIN_SHA, cwd=root, capture=False)
    for name in FILES:
        destination = target / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("wb") as output:
            subprocess.run(["git", "-C", str(root), "show", SOURCE_SHA + ":" + name],
                           stdout=output, check=True)

    replace_exact(target, "tests/integration-lot2a-style.cjs",
        '''test("temporary candidate branch prohibits auto-deploy and launch remains closed", () => {
  const config = JSON.parse(fromRoot("vercel.json"));
  assert.equal(config.git?.deploymentEnabled, false);
  const proxy = fromRoot("src/proxy.ts");
  assert.match(proxy, /const UNDER_CONSTRUCTION = true/);
});''',
        '''test("local release excludes candidate deploy override and retains launch gate", () => {
  assert.equal(fs.existsSync(path.resolve(__dirname, "..", "vercel.json")), false);
  const proxy = fromRoot("src/proxy.ts");
  assert.match(proxy, /const UNDER_CONSTRUCTION = true/);
});''')
    replace_exact(target, "tests/integration-lot2c-shared-skin.cjs",
        '''test("no release: launch gate and Git-auto-deploy guard still present", () => {
  assert.ok(read("src/proxy.ts").includes("const UNDER_CONSTRUCTION = true"));
  assert.equal(JSON.parse(read("vercel.json")).git.deploymentEnabled, false);
});''',
        '''test("local release retains launch gate without candidate deployment suppression", () => {
  assert.ok(read("src/proxy.ts").includes("const UNDER_CONSTRUCTION = true"));
  assert.equal(fs.existsSync(path.join(ROOT, "vercel.json")), false);
});''')

    excluded = ["vercel.json", "design/INTEGRACION-ESTADO.md",
                "design/INTEGRACION-INVENTARIO-LOTE1.md", "design/LOTE3-QA-WORK-20261117.md",
                "design/LOTE6-PREINTEGRACION-20261118.md", *ALLOWED_AFTER_SOURCE]
    if any((target / p).exists() for p in excluded):
        raise RuntimeError("Release assembly contains forbidden candidate-only file")
    if "const UNDER_CONSTRUCTION = true" not in (target / "src/proxy.ts").read_text():
        raise RuntimeError("Launch gate was unexpectedly removed")
    git("add", "-N", "--", *FILES, cwd=target)
    changed = git("diff", "--name-only", cwd=target).stdout.splitlines()
    if set(changed) != set(FILES):
        raise RuntimeError("Release diff does not equal the authorized 24-file manifest")
    print("LOCAL RELEASE WORKTREE READY — NO PUSH / NO DEPLOY")
    print("PATH:", target)
    print("MAIN:", MAIN_SHA, "SOURCE:", SOURCE_SHA)
    print("DIFF: exactly 21 application files and 3 release-adapted contract suites")
    print("NEXT: npm ci; node --test three suites; tsc; lint; build; browser fixtures")
    print("Do not commit, push, PR, merge or deploy without a separate approval")


if __name__ == "__main__":
    run()
