import useSWRImmutable from "swr/immutable";
import { QueryJson } from "./lazy-bcd-table";
import { compare } from "compare-versions";
import bcd from "@mdn/browser-compat-data";
import type { BrowserName } from "@mdn/browser-compat-data";

import "./baseline-indicator.scss";
import { useMemo } from "react";

export function BaselineIndicator({
  browserCompat,
}: {
  browserCompat?: string[];
}) {
  // TODO: query all compat strings
  const query = browserCompat?.[0];
  const { data } = useSWRImmutable(query, async (query) => {
    const response = await fetch(`/bcd/api/v0/current/${query}.json`);
    if (!response.ok) {
      throw new Error(response.status.toString());
    }
    return (await response.json()) as QueryJson;
  });

  // TODO: add this to bcd api above, we lack any "old" releases which we need here
  const requiredBrowserVersions = useMemo(
    () =>
      [
        ["chrome", bcd.browsers.chrome.releases],
        ["firefox", bcd.browsers.firefox.releases],
        ["safari", bcd.browsers.safari.releases],
      ]
        .filter(([_, releases]) => typeof releases !== "string")
        .map(([browser, releases]) => {
          const releaseArray = Object.entries(releases);
          const stable = releaseArray.find(
            ([_, { status }]) => status === "current"
          )?.[0] as string;
          const stableMajor = stable.split(".")[0];
          const prevMajor = (parseInt(stableMajor, 10) - 1).toString();
          if (browser === "safari") {
            const prevMajorMinors = releaseArray.filter(
              ([version]) => version.split(".")[0] === prevMajor
            );
            return [browser, prevMajorMinors.slice(-1)[0][0]];
          } else {
            return [browser, prevMajor];
          }
        }) as [BrowserName, string][],
    []
  );

  // TODO: traverse the tree, rather than just looking at the top level
  const incompatibleBrowsers = useMemo(
    () =>
      requiredBrowserVersions.filter(([browser, version]) => {
        // TODO: handle features that are removed
        // TODO: handle features removed and re-added (e.g. prefixed features)
        const support = data?.data.__compat?.support[browser];
        const versionAdded = (
          support instanceof Array ? support : [support]
        ).find((s) => s?.version_added)?.version_added;
        return !(versionAdded && gte(version, versionAdded));
      }),
    [requiredBrowserVersions, data]
  );

  const baseline = !incompatibleBrowsers.length;

  return data ? (
    <a
      href="#browser_compatibility"
      className={`baseline-indicator baseline-${baseline ? "true" : "false"}`}
      title={
        baseline
          ? `Supported in ${requiredBrowserVersions
              .map(([browser, version]) => `${browser} ${version}`)
              .join(", ")}`
          : `Not supported in ${incompatibleBrowsers
              .map(([browser, version]) => `${browser} ${version}`)
              .join(", ")}`
      }
    >
      <i
        className={`icon icon-${baseline ? "yes" : "no"}`}
        aria-hidden={true}
      ></i>
      {!baseline && "not "}baseline
    </a>
  ) : null;
}

// TODO: extract into library, copied from bcd-utils
export function gte(_a: any, _b: any) {
  const a = typeof _a === "string" && _a.startsWith("≤") ? _a.slice(1) : _a;

  const b = typeof _b === "string" && _b.startsWith("≤") ? _b.slice(1) : _b;

  if (a === b) {
    return true;
  }
  if (!a) {
    return false;
  }
  if (!b) {
    return true;
  }
  if (b === true) {
    return true;
  }
  if (a === true) {
    return false;
  }

  if (a === "preview") {
    return true;
  }
  if (b === "preview") {
    return false;
  }

  return compare(a, b, ">=");
}
