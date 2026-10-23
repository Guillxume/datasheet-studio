type Modifier = 'ctrl' | 'shift' | 'alt'

type Key =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z'
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'

type ParsedHotkey = {
  ctrl: boolean
  shift: boolean
  alt: boolean
  key: Key
}

const parseHotkey = (key: Key, modifiers: Modifier[] = []): ParsedHotkey => {
  const parsed: ParsedHotkey = {
    ctrl: false,
    shift: false,
    alt: false,
    key,
  }

  for (const mod of modifiers) {
    parsed[mod] = true
  }

  return parsed
}

const matchesHotkey = (event: KeyboardEvent, parsed: ParsedHotkey): boolean => {
  if (event.ctrlKey !== parsed.ctrl) return false
  if (event.shiftKey !== parsed.shift) return false
  if (event.altKey !== parsed.alt) return false

  return event.key.toLowerCase() === parsed.key
}

export type { Key, Modifier, ParsedHotkey }
export { matchesHotkey, parseHotkey }
