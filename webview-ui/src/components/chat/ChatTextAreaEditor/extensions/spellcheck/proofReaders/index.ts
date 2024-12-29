export * from './languageTool'
export * from './typo-js'



/* Data format

{
  "software": {
    "name": "string",
    "version": "string",
    "buildDate": "string",
    "apiVersion": 0,
    "status": "string",
    "premium": true
  },
  "language": {
    "name": "string",
    "code": "string",
    "detectedLanguage": {
      "name": "string",
      "code": "string"
    }
  },
  "matches": [
    {
      "message": "Possible spelling mistake found.",
      "shortMessage": "Spelling mistake",
      "replacements": [
        {
          "value": "test"
        },
        {
          "value": "TSP"
        },
        {
          "value": "esp"
        },
        {
          "value": "temp"
        },
        {
          "value": "TESL"
        },
        {
          "value": "ESP"
        },
        {
          "value": "TEP"
        },
        {
          "value": "TES"
        },
        {
          "value": "TESS"
        }
      ],
      "offset": 0,
      "length": 4,
      "context": {
        "text": "tesp",
        "offset": 0,
        "length": 4
      },
      "sentence": "tesp",
      "type": {
        "typeName": "UnknownWord"
      },
      "rule": {
        "id": "MORFOLOGIK_RULE_EN_GB",
        "description": "Possible spelling mistake",
        "issueType": "misspelling",
        "category": {
          "id": "TYPOS",
          "name": "Possible Typo"
        },
        "isPremium": false,
        "confidence": 0.65
      },
      "ignoreForIncompleteSentence": false,
      "contextForSureMatch": 0
}
  ]
}

*/