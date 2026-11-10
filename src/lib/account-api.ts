import { accountProfile } from "./account-session";
import {
  readAccount,
  writeAccount,
  RevisionConflict,
  type AccountRecord,
} from "./account-store";
import { parseProgress, type Progress } from "./progress";
import { publicStatistics } from "./public-statistics";
import { sameAppOrigin } from "./auth-policy";
import { accountPrincipal, type AccountPrincipal } from "./account-principal";

// Dependencies make account isolation testable without weakening production auth.
export type AccountApiDependencies = {
  authenticate: (request?: Request) => Promise<AccountPrincipal | null>;
  profile: typeof accountProfile;
  read: (id: string) => Promise<AccountRecord | null>;
  write: (
    id: string,
    progress: Progress,
    revision: number,
  ) => Promise<AccountRecord>;
};
const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Authorization, X-API-Key",
  "X-Content-Type-Options": "nosniff",
};
const defaults: AccountApiDependencies = {
  authenticate: accountPrincipal,
  profile: accountProfile,
  read: readAccount,
  write: writeAccount,
};
const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(data, { status, headers: { ...privateHeaders, ...headers } });
export function createAccountApi(
  dependencies: AccountApiDependencies = defaults,
) {
  async function run(
    permission: "read" | "write",
    request: Request | undefined,
    work: (id: string) => Promise<Response>,
  ) {
    try {
      const principal = await dependencies.authenticate(request);
      if (!principal)
        return json(
          {
            error: "Unauthorized. Use a Clerk session or a valid API key.",
          },
          401,
        );
      if (permission === "write" && principal.scope !== "read-write")
        return json({ error: "This API key is read-only." }, 403);
      return await work(principal.userId);
    } catch {
      return json(
        {
          error:
            "Account service unavailable. Your local progress is unchanged.",
        },
        503,
      );
    }
  }
  return {
    me: (request?: Request) =>
      run("read", request, async (id) =>
        json({ data: await dependencies.profile(id) }),
      ),
    progress: (request?: Request) =>
      run("read", request, async (id) => {
        const record = await dependencies.read(id);
        return json(
          {
            data: record?.progress ?? null,
            revision: record?.revision ?? 0,
            updatedAt: record?.updatedAt ?? null,
          },
          200,
          { ETag: `"${record?.revision ?? 0}"` },
        );
      }),
    statistics: (request?: Request) =>
      run("read", request, async (id) => {
        const record = await dependencies.read(id);
        return json({
          data: record ? publicStatistics(record.progress) : null,
          updatedAt: record?.updatedAt ?? null,
        });
      }),
    export: (request?: Request) =>
      run("read", request, async (id) => {
        const [profile, record] = await Promise.all([
          dependencies.profile(id),
          dependencies.read(id),
        ]);
        return json(
          {
            version: 1,
            profile,
            progress: record?.progress ?? null,
            revision: record?.revision ?? 0,
            statistics: record ? publicStatistics(record.progress) : null,
            exportedAt: new Date().toISOString(),
          },
          200,
          {
            "Content-Disposition": 'attachment; filename="kotoba-account.json"',
          },
        );
      }),
    update: (request: Request) =>
      run("write", request, async (id) => {
        // Token clients do not need Origin. A supplied Origin must always match.
        const origin = request.headers.get("origin");
        const bearer = /^Bearer\s+\S+$/i.test(
          request.headers.get("authorization") ?? "",
        );
        if (
          (origin && !sameAppOrigin(origin)) ||
          (!origin && !bearer && !request.headers.has("x-api-key"))
        )
          return json({ error: "Invalid origin" }, 403);
        const etag = request.headers.get("if-match");
        if (!etag)
          return json(
            {
              error:
                "If-Match is required. Read progress first to get its ETag.",
            },
            428,
          );
        if (!/^"\d+"$/.test(etag))
          return json({ error: "Invalid If-Match header" }, 400);
        const revision = Number(etag.slice(1, -1));
        if (
          !Number.isSafeInteger(revision) ||
          revision >= Number.MAX_SAFE_INTEGER
        )
          return json({ error: "Invalid revision" }, 400);
        const maximum = 5_000_000;
        if (Number(request.headers.get("content-length")) > maximum)
          return json({ error: "Payload too large" }, 413);
        const reader = request.body?.getReader();
        if (!reader) return json({ error: "Invalid progress" }, 400);
        const parts: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > maximum) {
              await reader.cancel();
              return json({ error: "Payload too large" }, 413);
            }
            parts.push(value);
          }
        } catch {
          return json({ error: "Invalid request body" }, 400);
        }
        let progress: Progress;
        try {
          const bytes = new Uint8Array(size);
          let offset = 0;
          for (const part of parts) {
            bytes.set(part, offset);
            offset += part.byteLength;
          }
          progress = parseProgress(JSON.parse(new TextDecoder().decode(bytes)));
        } catch {
          return json({ error: "Invalid progress" }, 400);
        }
        try {
          const record = await dependencies.write(id, progress, revision);
          return json(
            { revision: record.revision, updatedAt: record.updatedAt },
            200,
            { ETag: `"${record.revision}"` },
          );
        } catch (error) {
          if (error instanceof RevisionConflict)
            return json(
              {
                error:
                  "Progress changed on another device. Reload the account copy or export your local changes first.",
              },
              409,
            );
          throw error;
        }
      }),
  };
}
export const accountApi = createAccountApi();
