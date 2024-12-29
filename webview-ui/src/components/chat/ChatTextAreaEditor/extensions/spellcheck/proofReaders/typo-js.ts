import Typo from "typo-js"
import { vscode } from '../../../../../../utils/vscode'

export interface WordList {
  [word: string]: number;
}

let Dictionary: Typo | undefined = undefined

const tokenizeString = (sentence: string) => {
  const tokens: any = [];
  let currentOffset = 0;

  const words = sentence.split(/\W+/);
  for (const word of words) {
    const length = word.length;
    tokens.push({
      offset: currentOffset,
      length,
      word,
    });
    currentOffset += length + 1;
  }

  return tokens;
}

const proofreadText = (sentence: string) => {
    const tokens: any = tokenizeString(sentence);
    const errors: any = [];

    tokens.forEach((tkn: any) => {
      if (!Dictionary?.check(tkn.word)) {
        errors.push({ 
          ...tkn,
          message: "Possible spelling mistake found.",
          shortMessage: "Spelling mistake",
          replacements: Dictionary?.suggest(tkn.word, 10).map(value => ({ value })),
          type: {
            typeName: "UnknownWord"
          },
          context: {
            text: sentence,
            offset: 0,
            length: sentence.length
          }
        })
      }
    })

    return errors;
  }



const getDictionary = async (language: string) => new Promise((resolve, reject) => {
  if (Dictionary) {
    resolve(Dictionary)
    return
  }
  const messageHandler = (event: MessageEvent) => {
    const message = event.data
    if (message.type === 'dictionary') {
      console.log('dic', message)
      if (message.dictionary) {
        Dictionary = new Typo(language, message.dictionary.aff, message.dictionary.dic)
        window.removeEventListener('message', messageHandler)
        resolve(Dictionary)
      }
    }
  }
  window.addEventListener('message', messageHandler)
  if (typeof vscode !== 'undefined') {
    vscode.postMessage({
      type: "getDictionary",
      text: language.toLowerCase()
    })
  }
})

export const typoJsProofReader = async (input: string, proof?: boolean, language?: string | undefined): Promise<any> => {
  try {
    await getDictionary(language || 'en')
    return {
      matches: proofreadText(input)
    }
  } catch(e) {
    console.log('error', e)
    throw e
  }

}

