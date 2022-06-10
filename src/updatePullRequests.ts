// spell-checker:ignore labelable
import { debug } from '@actions/core'

import { Context, InfoQueryResult } from './types'

export const updatePullRequests = async (
  context: Context,
  data: InfoQueryResult
): Promise<void> => {
  const { client, message, labelId, assigneeIds } = context
  const { stuckPRs, prevStuckPRs } = data

  debug('Generating UpdatePRs mutation')

  const mutations = [
    ...stuckPRs.pullRequests.map((pr, i) => {
      const labelArgs = `input: { labelableId:"${pr.id}", labelIds: $labelIds }`
      const assignArgs = `input: { assignableId:"${pr.id}", assigneeIds: $assigneeIds }`
      const commentArgs = `input: { subjectId: "${pr.id}", body: $commentBody }`

      return `
        labelPr_${i}: addLabelsToLabelable(${labelArgs}) {
          labelable {
            __typename
          }
        }
        assignPr_${i}: addAssigneesToAssignable(${assignArgs}) {
          assignable {
            __typename
          }
        }
        addComment_${i}: addComment(${commentArgs}) {
          subject {
            id
          }
        }
      `
    }),
    ...prevStuckPRs.pullRequests.map((pr, i) => {
      const nodeArgs = `input:{labelableId:"${pr.id}", labelIds: $labelIds}`
      return `
        removeLabelPr_${i}: removeLabelsFromLabelable(${nodeArgs}) {
          labelable {
            __typename
          }
        }
      `
    })
  ]

  const queryVarsDef: { [key: string]: [string, unknown] } = {
    labelIds: ['[ID!]!', [labelId]],
    assigneeIds: ['[ID!]', assigneeIds]
  }

  if (stuckPRs.pullRequests.length > 0) {
    queryVarsDef.commentBody = ['String!', message]
  }

  const queryArgsStr = Object.entries(queryVarsDef)
    .map(([key, value]) => `$${key}: ${value[0]}`)
    .join(', ')

  const queryVars = Object.fromEntries(
    Object.entries(queryVarsDef).map(([key, value]) => [key, value[1]])
  )

  const query = `mutation UpdatePRs (${queryArgsStr}) {\n${mutations.join(
    '\n'
  )}\n}`
  debug(`Sending UpdatePRs mutation request:\n${query}`)
  debug(`Mutation query vars: ${JSON.stringify(queryVars)}`)
  debug('UpdatePRs mutation sent')

  await client.graphql(query, queryVars)
}
