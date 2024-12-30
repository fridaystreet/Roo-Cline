import { EditorContent, Editor } from '@tiptap/react'
import {
  SlashCmd,
  SlashCmdProvider
} from "@harshtalks/slash-tiptap";
import { useSlashCommands } from './useSlashCommands';

export const SlashCommandEditor = ({ editor }: { editor: Editor | null }) => {

  const commands = useSlashCommands()

  const commandList = commands.filter((item: any) => {
    if (typeof item.isVisible === 'function') {
      return item.isVisible(item, editor)
    }
    return item
  })
  .map((item: any) => {
    if (typeof item.dynamicValues === 'function') {
      return {
        ...item, 
        ...item.dynamicValues(item, editor)
      }
    }
    return item
  })

  return (
    <SlashCmdProvider>
      <EditorContent editor={editor} />
      <SlashCmd.Root editor={editor}>
        <SlashCmd.Cmd className="z-50 h-auto max-h-[330px] overflow-y-auto rounded-md border border-muted bg-background p-4  shadow-[rgba(100,_100,_111,_0.2)_0px_7px_29px_0px] transition-all bg-white">
          <SlashCmd.Empty>No commands available</SlashCmd.Empty>
          <SlashCmd.List>
            {commandList.map((item: any) => {
              return (
                <SlashCmd.Item
                  value={item.title}
                  onCommand={(val) => {
                    item.command(val);
                  }}
                  onFocus={item.onFocus ? () => item.onFocus(editor) : undefined}
                  className="flex w-full items-center space-x-2 cursor-pointer rounded-md p-2 text-left text-sm hover:bg-gray-200 aria-selected:bg-gray-200"
                  key={item.title}
                >
                  <p className="font-medium text-sm">{item.title}</p>
                </SlashCmd.Item>
              )
            })}
          </SlashCmd.List>
        </SlashCmd.Cmd>
      </SlashCmd.Root>
    </SlashCmdProvider>
  );
}