import { useCallback } from "react"
import { Editor } from "@tiptap/core"

export const EnhancePromptButton = ({ editor }: { editor: Editor | null | undefined }) => {

  const aiCommand = useCallback(() => {
    if (!editor?.isEditable) return
    try {
      editor.chain().focus().aiCommand('enhancePrompt').run()
    } catch(e) {
      console.log(e)
    }
  }, [editor])

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {editor?.storage.ai.isEnhancingPrompt && <span style={{ marginRight: 10, color: "var(--vscode-input-foreground)", opacity: 0.5 }}>Enhancing prompt...</span>}
      <span
        role="button"
        aria-label="enhance prompt"
        data-testid="enhance-prompt-button"
        className={`input-icon-button ${editor?.isEditable ? "disabled" : ""} codicon codicon-sparkle`}
        onClick={() => !editor?.isEditable && aiCommand()}
        style={{ fontSize: 16.5 }}
      />
    </div>
  )
}
