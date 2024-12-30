import { EditorContent, Editor } from '@tiptap/react';
import {
  SlashCmd,
  SlashCmdProvider
} from "@harshtalks/slash-tiptap";
import { useSlashCommands } from './useSlashCommands';
import styled from 'styled-components';

const SlashCmdItem = styled(SlashCmd.Item)`
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  border-radius: 0.375rem;
  padding: 0.5rem;
  text-align: left;
  font-size: 0.875rem;
  color: #333;

  &:hover {
    background-color: #f0f0f0;
  }

  &[aria-selected="true"] {
    background-color: #e0e0e0;
  }
`;

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
        <SlashCmd.Cmd style={{
          zIndex: 50,
          maxHeight: '330px',
          overflowY: 'auto',
          borderRadius: '0.375rem',
          border: '1px solid #e5e7eb',
          backgroundColor: 'white',
          padding: '1rem',
          boxShadow: 'rgba(100, 100, 111, 0.2) 0px 7px 29px 0px',
          transition: 'all',
        }}>
          <SlashCmd.Empty>No commands available</SlashCmd.Empty>
          <SlashCmd.List>
            {commandList.map((item: any) => {
              return (
                <SlashCmdItem
                  value={item.title}
                  onCommand={(val) => {
                    item.command(val);
                  }}
                  onFocus={item.onFocus ? () => item.onFocus(editor) : undefined}
                  key={item.title}
                >
                  <p className="font-medium text-sm">{item.title}</p>
                </SlashCmdItem>
              )
            })}
          </SlashCmd.List>
        </SlashCmd.Cmd>
      </SlashCmd.Root>
    </SlashCmdProvider>
  );
}