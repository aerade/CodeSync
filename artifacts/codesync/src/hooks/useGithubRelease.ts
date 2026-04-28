import { useEffect, useState } from "react";

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export type Platform = "mac" | "windows" | "linux";

export interface PlatformAsset {
  platform: Platform;
  label: string;
  ext: string;
  url: string;
  size: number;
}

export interface GithubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  assets: PlatformAsset[];
}

export type ReleaseState =
  | { status: "loading" }
  | { status: "no-release" }
  | { status: "error" }
  | { status: "ok"; release: GithubRelease };

function detectPlatform(name: string): Platform | null {
  const n = name.toLowerCase();
  if (n.endsWith(".dmg") || n.endsWith(".pkg")) return "mac";
  if (n.endsWith(".exe") || n.endsWith(".msi")) return "windows";
  if (n.endsWith(".appimage") || n.endsWith(".deb") || n.endsWith(".rpm")) return "linux";
  return null;
}

const PLATFORM_LABELS: Record<Platform, string> = {
  mac: "macOS",
  windows: "Windows",
  linux: "Linux",
};

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot) : "";
}

export function useGithubRelease(repo: string): ReleaseState {
  const [state, setState] = useState<ReleaseState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(10000),
    })
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 404) {
          setState({ status: "no-release" });
          return;
        }
        if (!r.ok) {
          setState({ status: "error" });
          return;
        }
        const data = (await r.json()) as {
          tag_name: string;
          name: string;
          published_at: string;
          assets: Array<{ name: string; browser_download_url: string; size: number }>;
        };

        const seen = new Set<Platform>();
        const platformAssets: PlatformAsset[] = [];

        for (const asset of data.assets ?? []) {
          const platform = detectPlatform(asset.name);
          if (!platform || seen.has(platform)) continue;
          seen.add(platform);
          platformAssets.push({
            platform,
            label: PLATFORM_LABELS[platform],
            ext: extOf(asset.name),
            url: asset.browser_download_url,
            size: asset.size,
          });
        }

        if (platformAssets.length === 0) {
          setState({ status: "no-release" });
          return;
        }

        setState({
          status: "ok",
          release: {
            tag_name: data.tag_name,
            name: data.name || data.tag_name,
            published_at: data.published_at,
            assets: platformAssets,
          },
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => { cancelled = true; };
  }, [repo]);

  return state;
}

export function detectUserPlatform(): Platform {
  if (typeof navigator === "undefined") return "linux";
  const ua = navigator.userAgent.toLowerCase();
  const plat = (
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? ""
  ).toLowerCase();

  if (plat.includes("mac") || ua.includes("mac")) return "mac";
  if (plat.includes("win") || ua.includes("win")) return "windows";
  return "linux";
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}
