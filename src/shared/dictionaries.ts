import * as vscode from "vscode"

export interface Dictionary {
  aff: string
  dic: string
}

export interface DictionaryPaths {
  aff: vscode.Uri
  dic: vscode.Uri
}

export const getDictionary = async (paths: DictionaryPaths): Promise<Dictionary | undefined>  => {

  try {
    const aff = await vscode.workspace.fs.readFile(paths.aff)
    const dic = await vscode.workspace.fs.readFile(paths.dic)

    return {
      aff: aff.toString(),
      dic: dic.toString()
    }
  } catch (e) {
    console.error('failed to load dictions for ' + paths, e)
    return
  }
}