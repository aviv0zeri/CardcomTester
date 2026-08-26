import { useEffect, useId, useRef, useState } from 'react'

export type MenuOption<T extends string = string> = {
  value: T
  label: string
}

type MenuSelectProps<T extends string> = {
  value: T
  options: MenuOption<T>[]
  disabled?: boolean
  onChange: (value: T) => void
  'aria-label'?: string
}

export function MenuSelect<T extends string>({
  value,
  options,
  disabled,
  onChange,
  'aria-label': ariaLabel,
}: MenuSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`menu-select${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="menu-select-btn"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setOpen((next) => !next)}
      >
        <span>{selected?.label ?? value}</span>
        <svg className="menu-select-chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M4.2 6.2a.75.75 0 0 1 1.06 0L8 8.94l2.74-2.74a.75.75 0 0 1 1.06 1.06l-3.27 3.27a.75.75 0 0 1-1.06 0L4.2 7.26a.75.75 0 0 1 0-1.06Z"
            fill="currentColor"
          />
        </svg>
      </button>
      {open ? (
        <ul id={listId} className="menu-select-list" role="listbox">
          {options.map((option) => {
            const on = option.value === value
            return (
              <li key={option.value} role="none">
                <button
                  type="button"
                  role="option"
                  className={`menu-select-option${on ? ' is-on' : ''}`}
                  aria-selected={on}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  {option.label}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
