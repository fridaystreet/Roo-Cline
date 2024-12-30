import { useMemo } from 'react'
import { useExtensionState } from "../../../../../context/ExtensionStateContext"
import { buildCommands } from './buildCommands'

export const useSlashCommands = () => {

  const { apiConfiguration, setApiConfiguration, uriScheme } = useExtensionState()
  const slashCommands = useMemo(() => {
    return buildCommands(apiConfiguration, setApiConfiguration, uriScheme)
  }, [apiConfiguration, setApiConfiguration, uriScheme])

  return slashCommands 
}