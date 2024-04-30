import {
    RetrievalClientOptions,
    RetrievalOptions,
    RetrievalSearchOptions,
    RetrievalUpsertOptions,
    host,
} from "./host"
import { lookupMime } from "./mime"

const UPSERTFILE_MIME_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

export function isIndexable(filename: string) {
    const type = lookupMime(filename) || "text/plain"
    return /^text\//i.test(type) || UPSERTFILE_MIME_TYPES.includes(type)
}

export async function clearIndex(
    options?: RetrievalClientOptions & RetrievalOptions
): Promise<void> {
    const { trace } = options || {}
    await host.retrieval.init(trace)
    await host.retrieval.clear(options)
}

export async function upsert(
    fileOrUrls: (string | WorkspaceFile)[],
    options?: RetrievalClientOptions & RetrievalUpsertOptions
) {
    if (!fileOrUrls?.length) return
    const { progress, trace, token, ...rest } = options || {}
    const retrieval = host.retrieval
    await retrieval.init(trace)
    const files: WorkspaceFile[] = fileOrUrls.map((f) =>
        typeof f === "string" ? <WorkspaceFile>{ filename: f } : f
    )
    let count = 0
    for (const f of files) {
        if (token?.isCancellationRequested) break
        progress?.report({
            count: ++count,
            message: f.filename,
        })
        const { ok } = await retrieval.upsert(f.filename, {
            content: f.content,
            ...rest,
        })
        progress?.report({
            message: f.filename,
            succeeded: ok,
        })
        trace?.resultItem(ok, f.filename)
    }
}

export interface RetrievalSearchResult {
    files: WorkspaceFile[]
    fragments: WorkspaceFile[]
}

export async function search(
    q: string,
    options?: RetrievalClientOptions & RetrievalSearchOptions
): Promise<RetrievalSearchResult> {
    const { trace, token, ...rest } = options || {}
    const files: WorkspaceFile[] = []
    const retrieval = host.retrieval
    await host.retrieval.init(trace)
    if (token?.isCancellationRequested) return { files, fragments: [] }

    const { results } = await retrieval.search(q, rest)

    const fragments = (results || []).map((r) => {
        const { id, filename, text } = r
        return <WorkspaceFile>{
            filename,
            content: text,
        }
    })
    for (const fr of fragments) {
        let file = files.find((f) => f.filename === fr.filename)
        if (!file) {
            file = <WorkspaceFile>{
                filename: fr.filename,
                content: "...\n",
            }
            files.push(file)
        }
        file.content += fr.content + `\n...`
    }
    return {
        files,
        fragments,
    }
}
