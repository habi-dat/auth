'use client'

import { Check, ChevronsUpDown } from 'lucide-react'
import * as React from 'react'
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

export interface UserOption {
  id: string
  name: string
  email: string
}

interface UserSelectorProps {
  users: UserOption[]
  value: string | null
  onChange: (userId: string | null) => void
  label?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  /** User IDs to exclude from the options list (e.g. current members) */
  excludeUserIds?: string[]
  className?: string
}

export function UserSelector({
  users,
  value,
  onChange,
  label,
  placeholder = 'Select user...',
  searchPlaceholder = 'Search users...',
  emptyText = 'No users found.',
  disabled = false,
  excludeUserIds = [],
  className,
}: UserSelectorProps) {
  const [open, setOpen] = React.useState(false)

  const availableUsers = React.useMemo(
    () => users.filter((u) => !excludeUserIds.includes(u.id)),
    [users, excludeUserIds]
  )

  const selectedUser = React.useMemo(
    () => availableUsers.find((u) => u.id === value),
    [availableUsers, value]
  )

  const handleSelect = (userId: string) => {
    onChange(userId)
    setOpen(false)
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled || availableUsers.length === 0}
            className={cn(
              'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              !selectedUser && 'text-muted-foreground'
            )}
          >
            <span className="truncate">
              {selectedUser ? `${selectedUser.name} (${selectedUser.email})` : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={true}>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {availableUsers.map((u) => {
                  const isSelected = value === u.id
                  return (
                    <CommandItem
                      key={u.id}
                      value={`${u.name} ${u.email}`}
                      onSelect={() => handleSelect(u.id)}
                    >
                      <Check
                        className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')}
                      />
                      <div className="flex flex-col">
                        <span>{u.name}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
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
