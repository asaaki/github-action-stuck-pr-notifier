import * as core from '@actions/core'
import { getOctokit } from '@actions/github'
import ms from 'ms'

import { Config, Context, InfoQueryResult } from './types'
import { updatePullRequests } from './updatePullRequests'
import { getInput } from './utils/getInput'

const { debug } = core

const { GITHUB_REPOSITORY } = process.env as { GITHUB_REPOSITORY: string }

const timeNum = (num: number) => num.toString().padStart(2, '0')

const generateCutoffDateString = (cutoff: number): string => {
  const d = new Date(Date.now() - cutoff)
  const year = d.getUTCFullYear()
  const month = timeNum(d.getUTCMonth() + 1)
  const day = timeNum(d.getUTCDate())
  const hours = timeNum(d.getUTCHours())
  const mins = timeNum(d.getUTCMinutes())

  return `${year}-${month}-${day}T${hours}:${mins}:00+00:00`
}

const escapeStr = (str: string): string => JSON.stringify(str).slice(1, -1)

const run = async () => {
  try {
    const client = getOctokit(getInput('repo-token', { required: true }))
    const [repoOwner, repoName] = GITHUB_REPOSITORY.split('/')
    const config: Config = {
      cutoff: getInput('cutoff') || '24h',
      label: getInput('label') || 'stuck',
      message: getInput('message', { required: true }),
      search: getInput('search-query', { required: true })
    }

    const stuckLabel = config.label
    const stuckCutoff = ms(config.cutoff)
    const stuckSearch = config['search']
    const createdSince = generateCutoffDateString(stuckCutoff)

    const queryVarArgs: string = Object.entries({
      repoOwner: 'String!',
      repoName: 'String!',
      stuckLabel: 'String!',
      stuckPRsQuery: 'String!',
      prevStuckPRsQuery: 'String!'
    })
      .map(([key, value]) => `$${key}: ${value}`)
      .join(', ')

    const prNodeArgs = 'type: ISSUE, first: 100'

    const query = `
      query GetStuckPRs(${queryVarArgs}) {
        repo: repository(owner: $repoOwner, name: $repoName) {
          label(name: $stuckLabel) {
            id
          }
        }
        stuckPRs: search(query: $stuckPRsQuery, ${prNodeArgs}) {
          totalCount: issueCount
          pullRequests: nodes {
            ... on PullRequest {
              id
              permalink
            }
          }
        }
        prevStuckPRs: search(query: $prevStuckPRsQuery, ${prNodeArgs}) {
          totalCount: issueCount
          pullRequests: nodes {
            ... on PullRequest {
              id
              permalink
            }
          }
        }
      }
    `

    const stuckPRsQuery = `repo:${escapeStr(GITHUB_REPOSITORY)} is:pr ${escapeStr(
      stuckSearch
    )} is:open created:<=${createdSince} -label:${JSON.stringify(stuckLabel)}`

    const prevStuckPRsQuery = `repo:${escapeStr(GITHUB_REPOSITORY)} is:pr is:closed label:${JSON.stringify(stuckLabel)}`

    debug(`Using stuck PRs search query:\n${stuckPRsQuery}`)
    debug(`Using previously stuck PRs search query:\n${prevStuckPRsQuery}`)

    const data: InfoQueryResult = await client.graphql(query, {
      repoOwner,
      repoName,
      stuckLabel,
      stuckPRsQuery,
      prevStuckPRsQuery
    })

    if (data.stuckPRs.totalCount === 0 && data.prevStuckPRs.totalCount === 0) {
      debug('No stuck PRs found.')
      return
    }

    {
      const total = data.stuckPRs.totalCount
      debug(`Found ${total.toLocaleString('en')} currently stuck ${total === 1 ? 'PR' : 'PRs'}.`)
    }
    {
      const total = data.prevStuckPRs.totalCount
      debug(`Found ${total.toLocaleString('en')} previously stuck ${total === 1 ? 'PR' : 'PRs'}.`)
    }

    const context: Context = {
      client,
      config,
      labelId: data.repo.label.id
    }

    await updatePullRequests(context, data)
  } catch (err: unknown) {
    if (typeof err === 'string') {
      core.setFailed(err)
    } else if (err instanceof Error) {
      core.setFailed(err.message)
    }
  }
}

run()
