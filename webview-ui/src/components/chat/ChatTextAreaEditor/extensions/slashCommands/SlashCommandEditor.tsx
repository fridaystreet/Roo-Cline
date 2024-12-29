import { EditorContent, Editor } from '@tiptap/react'
import {
  SlashCmd,
  SlashCmdProvider
} from "@harshtalks/slash-tiptap";
import { commands } from './commands'

export const SlashCommandEditor = ({ editor }: { editor: Editor | null }) => {
  return (
  <SlashCmdProvider>
    <EditorContent editor={editor} />
    <SlashCmd.Root editor={editor}>
      <SlashCmd.Cmd>
        <SlashCmd.Empty>No commands available</SlashCmd.Empty>
        <SlashCmd.List>
          {commands.map((item) => {
            return (
              <SlashCmd.Item
                value={item.title}
                onCommand={(val) => {
                  item.command(val);
                }}
                key={item.title}
              >
                  <p>{item.title}</p>
              </SlashCmd.Item>
            );
          })}
        </SlashCmd.List>
      </SlashCmd.Cmd>
    </SlashCmd.Root>
  </SlashCmdProvider>
  );
}