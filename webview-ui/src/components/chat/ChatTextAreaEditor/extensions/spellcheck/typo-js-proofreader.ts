export {}
// import Typo from "typo-js"
// import * as vscode from 'vscode'

// export interface Dictionary {
//   aff: string
//   dic: string
// }

// export interface DictionaryPaths {
//   aff: vscode.Uri
//   dic: vscode.Uri
// }

// export interface WordList {
//   [word: string]: number;
// }

// export class SpellcheckerProofreader implements IProofreaderInterface {
//   private dictionary: Typo | null = null;
  
//   loadDictionary(dictionary: Dictionary, language: string = 'en') {
//     this.dictionary = new Typo(language, dictionary.aff, dictionary.dic)
//   }

//   async getSuggestions(word: string): Promise<string[]> {
//     return this.dictionary?.suggest(word) || []
//   }

//   normalizeTextForLanguage(text: string): string {
//     return text.toLowerCase();
//   }

//   async proofreadText(sentence: string): Promise<ITextWithPosition[]> {
//     const tokens = this.tokenizeString(sentence);
//     const errors: ITextWithPosition[] = [];

//     tokens.forEach((tkn) => {
//       if (!this.dictionary?.check(tkn.word)) {
//         errors.push(tkn);
//       }
//     })

//     return errors;
//   }

//   private tokenizeString(sentence: string): ITextWithPosition[] {
//     const tokens: ITextWithPosition[] = [];
//     let currentOffset = 0;

//     const words = sentence.split(/\W+/);
//     for (const word of words) {
//       const length = word.length;
//       tokens.push({
//         offset: currentOffset,
//         length,
//         word,
//       });
//       currentOffset += length + 1;
//     }

//     return tokens;
//   }
// }