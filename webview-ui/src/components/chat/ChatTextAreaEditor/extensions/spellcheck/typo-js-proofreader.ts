import Typo from "typo-js"
import { IProofreaderInterface, ITextWithPosition } from './i-proofreader-interface';

export interface WordList {
  [word: string]: number;
}

export class SpellcheckerProofreader implements IProofreaderInterface {
  private dictionary: Typo;
  private language: string;

  constructor(language: string = 'en_US') {
    this.language = language
   
    const path = `/assets/dictionaries/${this.language}/${this.language}`
    const aff = this._readFile(`${path}.aff`);
    const dic = this._readFile(`${path}.dic`);
    this.dictionary = new Typo(this.language, aff, dic)
  }
  
  _readFile(path: string, charset?: string) {
    var _a;
    charset = charset || "utf8";
    if (typeof XMLHttpRequest !== 'undefined') {
      var req_1 = new XMLHttpRequest();
      req_1.open("GET", path, false);
      (_a = req_1.overrideMimeType) === null || _a === void 0 ? void 0 : _a.call(req_1, "text/plain; charset=" + charset);
      req_1.send(null);
      return req_1.responseText;
    }
    return '';
  }

  async getSuggestions(word: string): Promise<string[]> {
    return this.dictionary.suggest(word)
  }

  normalizeTextForLanguage(text: string): string {
    return text.toLowerCase();
  }

  proofreadText(sentence: string): Promise<ITextWithPosition[]> {
    const tokens = this.tokenizeString(sentence);
    const errors: ITextWithPosition[] = [];

    tokens.forEach((tkn) => {
      if (!this.dictionary.check(tkn.word)) {
        errors.push(tkn);
      }
    });

    return Promise.resolve(errors);
  }

  private tokenizeString(sentence: string): ITextWithPosition[] {
    const tokens: ITextWithPosition[] = [];
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
}