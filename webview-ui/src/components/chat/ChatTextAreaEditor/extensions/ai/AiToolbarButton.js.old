import { useCallback, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWandSparkles,
  faCheckDouble,
  faArrowsRepeat,
  faArrowsToDottedLine,
  faBarsFilter,
  faBaby,
  faEllipsis,
  faSpellCheck,
  faTerminal,
  faCommentSmile
} from '@fortawesome/pro-duotone-svg-icons';
import { Badge, makeStyles } from '@material-ui/core';
import clsx from 'clsx'
import { useBlockNoteEditor } from "@blocknote/react"
import MoreOpts from 'app/fuse-layouts/shared-components/MoreOpts'

const useStyles = makeStyles(theme => ({
  aiBadge: {
		'&.MuiBadge-root': {
			minWidth: '0px',
      height: '14px',
			width: 'auto',
      cursor: 'pointer',
      fontSize: '2rem'
		},
		'& .MuiBadge-badge, .MuiBadge-anchorOriginTopRightRectangle': {
      top: '-12px',
      right: '25px',
			// height: '14px',
			// width: '14px',
			minWidth: '10px',
			zIndex: 150,
			borderRadius: '50px',
			borderTopLeftRadius: 0,
      color: 'rgba(0, 0, 0, 0.87)',
      backgroundColor: '#ffc400cf',
			'&.MuiBadge-dot': {
				height: '8px',
				minWidth: '8px',
				width: '8px',
				bottom: '8px',
				right: '8px',
        color: 'rgba(0, 0, 0, 0.87)',
        backgroundColor: '#ffc400cf',
			},
      '&.aiLoading': {
        right: '18px',
  			width: '40px',
      }
		}
	}
}));

export const AiToolbarButton = () => {

  const classes = useStyles();
  const { _tiptapEditor: editor } = useBlockNoteEditor()

  const getAiBadge = useCallback(() => {
    const { selection, doc } = editor.view.state
    const { from, to } = selection
    const text = doc.textBetween(from, to, ' ')

    if (editor.storage?.ai?.loading) return 'Thinking'
    if (text.match(/<(.*)>.?|<(.*) \/>/)) {
      return 'Invalid'
    }
    if ((text.split(' ').length > 1 && text.length > 3)) {
      return 'AI'
    }
  }, [editor])

  const aiCommand = useCallback((command, options) => {
    if (!editor?.isEditable) return
    try {
      editor.chain().focus().aiCommand(command, options).run()
    } catch(e) {
      console.log(e)
    }
  }, [editor])


  const aiMenuOptions = useMemo(() => ([
    {
      tooltip: 'Complete the selected text',
      title: `Complete`,
      icon: <FontAwesomeIcon icon={faCheckDouble} />,
      onClick: () => aiCommand('complete'),
    },
    {
      tooltip: 'Shorten the selected text',
      title: `Shorten`,
      icon: <FontAwesomeIcon icon={faArrowsToDottedLine} />,
      onClick: () => aiCommand('shorten'),
    },
    {
      tooltip: 'Extend the selected text',
      title: `Extend`,
      icon: <FontAwesomeIcon icon={faEllipsis} />,
      onClick: () => aiCommand('extend'),
    },
    {
      tooltip: 'Rephrase the selected text',
      title: `Rephrase`,
      icon: <FontAwesomeIcon icon={faArrowsRepeat} />,
      onClick: () => aiCommand('rephrase'),
    },
    {
      tooltip: 'Summerise the text',
      title: `Summerise`,
      icon: <FontAwesomeIcon icon={faBarsFilter} />,
      onClick: () => aiCommand('summarise'),
    },
    {
      tooltip: 'Use the selected text as an AI prompt',
      title: `tl;dr`,
      icon: <FontAwesomeIcon icon={faTerminal} />,
      onClick: () => aiCommand('prompt'),
    },
    {
      tooltip: 'Simplify the selected text',
      title: `Simplify`,
      icon: <FontAwesomeIcon icon={faBaby} />,
      onClick: () => aiCommand('simplify'),
    },
    {
      tooltip: 'Fix spelling & grammer for the selected text',
      title: `Spelling & Grammar`,
      icon: <FontAwesomeIcon icon={faSpellCheck} />,
      onClick: () => aiCommand('fixSpellingAndGrammar'),
    },
    {
      tooltip: 'Add emojis to the selected text',
      title: `Emojify`,
      icon: <FontAwesomeIcon icon={faCommentSmile} />,
      onClick: () => aiCommand('emojify'),
    },
    {
      tooltip: 'generate an image from the selected text',
      title: `Generate Image`,
      icon: <FontAwesomeIcon icon={faCommentSmile} />,
      onClick: () => aiCommand('generateImage', { style: 'photorealistic' })
    }
  ]), [editor])

  return (
    <MoreOpts
      openOnHover
      closeOnLeave
      IconCompnent={props => <FontAwesomeIcon {...props} icon={faWandSparkles} />}
      menuOptions={aiMenuOptions}
      BadgeComponent={props => <Badge
        className={clsx(editor?.storage?.ai?.loading && 'aiLoading')}
        classes={{ root: classes.aiBadge }}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right'
        }}
        //overlap="rectangular"
        badgeContent={getAiBadge()}
        {...props}
      />}
      // tooltip="Ai Magic"
      // disabled={!getAiBadge()}
    />
  )
}

