import { getOctokit } from '@actions/github'

export interface Config {
  cutoff: string
  label: string
  search: string
}

export interface TeamsAndUsers {
  teams: string[]
  users: string[]
}

export interface PullRequestInfo {
  id: string
  permalink: string
}

export type InfoQueryResult = {
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
  __teams?: ObjectIdable
} & ObjectIdable

export interface ObjectIdable {
  [name: string]: ObjectId
}

export interface ObjectId {
  id: string
}

export interface Context {
  client: ReturnType<typeof getOctokit>
  message: string
  labelId: string
  assigneeIds: string[]
}
