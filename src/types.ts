import { getOctokit } from '@actions/github'

export interface Config {
  cutoff: string
  label: string
  message: string
  search: string
}

export interface PullRequestInfo {
  id: string
  permalink: string
}

export interface InfoQueryResult {
  repo: {
    label: {
      id: string
    }
  }
  stuckPRs: {
    totalCount: number
    pullRequests: PullRequestInfo[]
  }
  prevStuckPRs: {
    totalCount: number
    pullRequests: PullRequestInfo[]
  }
}

export interface Context {
  client: ReturnType<typeof getOctokit>
  config: Config
  labelId: string
}
