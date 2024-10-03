system({
    title: "github workflows",
    description: "Queries results from workflows in GitHub actions.",
})

defTool(
    "github_actions_workflows_list",
    "List all workflows as a list of 'id: name' pair.",
    {},
    async (args) => {
        const { context } = args
        context.log("github action list workflows")
        const res = await github.listWorkflows()
        return CSV.stringify(
            res.map(({ id, name, path }) => ({ id, name, path })),
            { header: true }
        )
    }
)

defTool(
    "github_actions_runs_list",
    `List all runs for a workflow or the entire repository. 
    Use 'git_actions_list_workflows' to list workflows. 
    Omit 'workflow_id' to list all runs.
    head_sha is the commit hash.`,
    {
        type: "object",
        properties: {
            workflow_id: {
                type: "string",
                description:
                    "ID or filename of the workflow to list runs for. Empty lists all runs.",
            },
            branch: {
                type: "string",
                description: "Branch to list runs for.",
            },
            status: {
                type: "string",
                enum: ["success", "failure"],
                description: "Filter runs by completion status",
            },
        },
    },
    async (args) => {
        const { workflow_id, branch, status, context } = args
        context.log(
            `github action list runs for ${workflow_id ? `worfklow ${workflow_id}` : `repository`} and branch ${branch || "all"}`
        )
        const res = await github.listWorkflowRuns(workflow_id, {
            branch,
            status,
        })
        return CSV.stringify(
            res.map(({ id, name, conclusion, head_sha }) => ({
                id,
                name,
                conclusion,
                head_sha,
            })),
            { header: true }
        )
    }
)

defTool(
    "github_actions_jobs_list",
    "List all jobs for a run.",
    {
        type: "object",
        properties: {
            run_id: {
                type: "string",
                description:
                    "ID of the run to list jobs for. Use 'git_actions_list_runs' to list runs for a workflow.",
            },
        },
        required: ["run_id"],
    },
    async (args) => {
        const { run_id, context } = args
        context.log(`github action list jobs for run ${run_id}`)
        const res = await github.listWorkflowJobs(run_id)
        return CSV.stringify(
            res.map(({ id, name, status }) => ({ id, name, status })),
            { header: true }
        )
    }
)

defTool(
    "github_actions_job_logs_get",
    "Download workflow job log. If the log is too large, use 'github_actions_job_logs_diff' to compare logs.",
    {
        type: "object",
        properties: {
            job_id: {
                type: "string",
                description: "ID of the job to download log for.",
            },
        },
        required: ["job_id"],
    },
    async (args) => {
        const { job_id, context } = args
        context.log(`github action download job log ${job_id}`)
        let log = await github.downloadWorkflowJobLog(job_id, {
            llmify: true,
        })
        if (parsers.tokens(log) > 1000)
            log = "...(truncated, tool long)...\n" + log.slice(-3000)
        return log
    }
)

defTool(
    "github_actions_job_logs_diff",
    "Diffs two workflow job logsr.",
    {
        type: "object",
        properties: {
            job_id: {
                type: "string",
                description: "ID of the job to compare.",
            },
            other_job_id: {
                type: "string",
                description: "ID of the other job to compare.",
            },
        },
        required: ["job_id", "other_job_id"],
    },
    async (args) => {
        const { job_id, other_job_id, context } = args
        context.log(`github action diff job logs ${job_id} ${other_job_id}`)
        const log = await github.diffWorkflowJobLogs(job_id, other_job_id)
        return log
    }
)