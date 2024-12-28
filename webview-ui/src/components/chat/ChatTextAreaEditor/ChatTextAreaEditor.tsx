import React, { useState, useEffect, useMemo } from 'react';
import { useSpellcheckProofreader, isProofreaderInitialized } from './extensions/spellcheck/useSpellcheckProofreader';
import { SpellcheckExtension } from './extensions/spellcheck/spellchecker-extension';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

const ChatTextAreaEditor = () => {
  const proofreader = useSpellcheckProofreader();
  const [spellcheckInitialized, setSpellcheckInitialized] = useState(false);

  useEffect(() => {
    const checkInitialization = () => {
      if (isProofreaderInitialized()) {
        setSpellcheckInitialized(true);
      } else {
        setTimeout(checkInitialization, 100);
      }
    };

    checkInitialization();
  }, []);

  const extensions = useMemo<Extension[]>(() => {
    const baseExtensions: Extension[] = [
      StarterKit.configure({
        // StarterKit configuration
      }),
      // Other extensions
    ];

    if (spellcheckInitialized) {
      baseExtensions.push(
        SpellcheckExtension.configure({
          proofreader,
          uiStrings: {
            noSuggestions: 'No suggestions found'
          }
        })
      );
    }

    return baseExtensions;
  }, [spellcheckInitialized, proofreader]);

  const editor = useEditor({
    extensions,
    content: '',
    // Other editor options
  });

  return (
    <div className="chat-text-area-editor">
      <EditorContent editor={editor} />
    </div>
  );
};

export default ChatTextAreaEditor;
