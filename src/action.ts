import * as core from '@actions/core'
import { getOctokit } from '@actions/github'
import ms from 'ms'

import { Config, Context, InfoQueryResult, TeamsAndUsers } from './types'
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
    const repoToken = getInput('repo-token', { required: true });
    const client = getOctokit(repoToken)
    const [repoOwner, repoName] = GITHUB_REPOSITORY.split('/')

    const config: Config = {
      cutoff: getInput('cutoff') || '24h',
      label: getInput('label') || 'stuck',
      search: getInput('search-query', { required: true })
    }

    const stuckLabel = config.label
    const message = getInput('message', { required: true })
    const mentions = message.match(/(?<a>@[a-zA-Z0-9\/_-]+)/g) || []
    const assigneeSlugsFromInput = (getInput('assigneeIds') || '').split(' ').filter(e => e != '')
    const assigneeSlugs = assigneeSlugsFromInput.concat(mentions)
    const stuckCutoff = ms(config.cutoff)
    const stuckSearch = config['search']
    const createdSince = generateCutoffDateString(stuckCutoff)

    const teamsAndUsers = assigneeSlugs.reduce(
      (tau: TeamsAndUsers, slug): TeamsAndUsers => {
        // teams always have a '/' and users never have that
        if (slug.match('/')) {
          // only take name after slash; we assume to only work in a single org
          // without cross-org teams here
          tau.teams.push(slug.split('/')[1])
        } else {
          tau.users.push(slug)
        }
        return tau
      },
      { teams: [], users: [] }
    )

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

    let teamSubQuery = ''
    if (teamsAndUsers.teams.length > 0) {
      const teams = teamsAndUsers.teams.map((v, i) => {
        return `__team_${i}: team(slug: "${v}") { id }\n`
      }).join("\n")
      teamSubQuery = `
        __teams: organization(login: $repoOwner) {
          ${teams}
        }
      `
    }
    let usersSubQuery = ''
    if (teamsAndUsers.users.length > 0) {
      usersSubQuery = teamsAndUsers.users
        .map((v, i) => {
          return `__user_${i}: user(login: "${v}") { id }\n`
        })
        .join('\n')
    }

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
        ${teamSubQuery}
        ${usersSubQuery}
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

    let teamIds: string[] = []
    if (data.__teams) {
      teamIds = Object.values(data.__teams).flatMap(Object.values)
    }

    let userIds: string[] = []
    const userKeys = Object.keys(data).filter(k => k.match(/^__user/))
    for (const key in userKeys) {
      userIds.push(data[key].id)
    }

    const assigneeIds = teamIds.concat(userIds)

    const context: Context = {
      client,
      message,
      labelId: data.repo.label.id,
      assigneeIds
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
