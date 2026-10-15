// Small functional icon set, drawn on a 16 px grid like the logo:
// straight strokes, square caps, mitred joins, 45° diagonals.
// Icons only accompany a label or a state; they are never decorative.

export type IconName =
  | 'save'
  | 'download'
  | 'print'
  | 'close'
  | 'folder'
  | 'folder-open'
  | 'up'
  | 'home'
  | 'file'
  | 'plus'
  | 'check'
  | 'alert'
  | 'info'
  | 'chevron-down'
  | 'chevron-right'
  | 'undo'
  | 'edit'
  | 'external'

const PATHS: Record<IconName, string> = {
  save: 'M2.5 2.5h9l2 2v9h-11z M5 2.5v3.5h5v-3.5 M5 13.5v-4h6v4',
  download: 'M8 2v8 M4.5 6.5 8 10l3.5-3.5 M2.5 13.5h11',
  print: 'M4.5 6V2.5h7V6 M2.5 6h11v5.5h-2 M4.5 11.5h-2 M4.5 9.5h7v4h-7z',
  close: 'M3.5 3.5l9 9 M12.5 3.5l-9 9',
  folder: 'M1.5 3.5h5l1.5 1.5h6.5v8h-13z',
  'folder-open': 'M1.5 13.5v-10h5l1.5 1.5h5v2 M1.5 13.5l2-6h11l-2 6z',
  up: 'M8 13.5V3 M4 7l4-4 4 4',
  home: 'M2 7.5 8 2.5l6 5 M3.5 6.5v7h9v-7',
  file: 'M3.5 1.5h6l3 3v10h-9z M9.5 1.5v3h3',
  plus: 'M8 2.5v11 M2.5 8h11',
  check: 'M2.5 8.5l3.5 3.5 7.5-7.5',
  alert: 'M8 1.5 15 14H1z M8 6v4 M8 11.5v1',
  info: 'M1.5 1.5h13v13h-13z M8 7v5 M8 4.5v1',
  'chevron-down': 'M4 6l4 4 4-4',
  'chevron-right': 'M6 4l4 4-4 4',
  undo: 'M5.5 3 2.5 6l3 3 M2.5 6h7a4 4 0 0 1 0 8h-3',
  edit: 'M10 2.5l3.5 3.5-8 8H2v-3.5z M8.5 4l3.5 3.5',
  external: 'M9.5 2.5h4v4 M13.5 2.5 7.5 8.5 M11.5 9.5v4h-9v-9h4',
}

interface Props {
  name: IconName
  size?: number
  className?: string
  /** accessible label; without it the icon is hidden from assistive tech */
  label?: string
}

export function Icon({ name, size = 16, className, label }: Props) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
