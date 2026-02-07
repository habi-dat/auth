'use client'

import { Check, ChevronsUpDown, X } from 'lucide-react'
import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface GroupOption {
  id: string
  name: string
  slug: string
}

interface GroupSelectorProps {
  groups: GroupOption[]
  value: string[]
  onChange: (value: string[]) => void
  label?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  /** Group IDs to exclude from the options list (e.g. current group when editing) */
  excludeGroupIds?: string[]
  className?: string
}

export function GroupSelector({
  groups,
  value,
  onChange,
  label,
  placeholder = 'Select groups...',
  searchPlaceholder = 'Search groups...',
  emptyText = 'No groups found.',
  disabled = false,
  excludeGroupIds = [],
  className,
}: GroupSelectorProps) {
  const [open, setOpen] = React.useState(false)

  const availableGroups = React.useMemo(
    () => groups.filter((g) => !excludeGroupIds.includes(g.id)),
    [groups, excludeGroupIds]
  )

  const selectedGroups = React.useMemo(
    () => availableGroups.filter((g) => value.includes(g.id)),
    [availableGroups, value]
  )

  const toggleGroup = (groupId: string) => {
    if (value.includes(groupId)) {
      onChange(value.filter((id) => id !== groupId))
    } else {
      onChange([...value, groupId])
    }
  }

  const removeGroup = (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation()
    onChange(value.filter((id) => id !== groupId))
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {/* div used instead of button so inner remove buttons don't create invalid nested <button> */}
          {/* biome-ignore lint/a11y/useSemanticElements: div required to avoid nested buttons (remove X is a button) */}
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            className={cn(
              'flex h-auto min-h-10 w-full cursor-pointer items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              disabled && 'cursor-not-allowed opacity-50 pointer-events-none',
              !selectedGroups.length && !disabled && 'text-muted-foreground'
            )}
          >
            <span className="flex flex-1 flex-wrap items-center gap-1.5">
              {selectedGroups.length > 0
                ? selectedGroups.map((g) => (
                    <Badge
                      key={g.id}
                      variant="secondary"
                      className="gap-0.5 pr-1 font-normal"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {g.name}
                      <button
                        type="button"
                        className="rounded-full p-0.5 outline-none ring-offset-background hover:bg-muted-foreground/20 focus:ring-2 focus:ring-ring"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => removeGroup(e, g.id)}
                        aria-label={`Remove ${g.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={true}>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {availableGroups.map((g) => {
                  const isSelected = value.includes(g.id)
                  return (
                    <CommandItem
                      key={g.id}
                      value={`${g.name} ${g.slug}`}
                      onSelect={() => toggleGroup(g.id)}
                    >
                      <Check
                        className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')}
                      />
                      {g.name}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
