import { useMemo, useCallback, useState } from 'react'
import { PluginKey } from 'prosemirror-state'
import { useApolloClient, gql } from '@apollo/client'
import { AIExtension } from './ai'


export const AIPluginKey = new PluginKey('ai')


const AI_COMMAND = gql`
  query AiCommand($command: AICommandEnum!, $text: String!, $params: JSONObject, $context: ItemContextInput) {
    aiCommand(command: $command, text: $text, params: $params, context: $context) {
      answer
    }
  }
`

export const useAI = ({
  onLoading,
  onSuccess,
  onError
}={}) => {

  const client = useApolloClient()

  const processCommand = useCallback(async ({ command, text, params }) => {
    try {

      const { data: { aiCommand } } = await client.query({
        query: AI_COMMAND,
        variables: {
          command,
          text,
          params
        },
      })

      return aiCommand?.answer

    } catch(e) {
      throw e
    }
  }, [client])

  const AI = useMemo(() => AIExtension.configure({
    processCommand,
    onLoading,
    onSuccess,
    onError
  }), [processCommand, onLoading, onSuccess, onError])

  return AI
}
