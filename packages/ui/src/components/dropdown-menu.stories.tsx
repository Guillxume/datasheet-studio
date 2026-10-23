import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  CloudIcon,
  GitBranchIcon,
  LogOut,
  MailIcon,
  MessageSquareIcon,
  PlusCircleIcon,
  Settings,
  User,
  UserPlusIcon,
} from 'lucide-react'
import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu'

const meta = {
  title: 'Overlays/DropdownMenu',
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='outline'>Open menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-56'>
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <User />
            Profile
            <DropdownMenuShortcut>Ctrl+P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings />
            Settings
            <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <UserPlusIcon />
              Invite users
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className='w-48'>
              <DropdownMenuItem>
                <MailIcon />
                Email
              </DropdownMenuItem>
              <DropdownMenuItem>
                <MessageSquareIcon />
                Message
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <PlusCircleIcon />
                More...
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <CloudIcon />
              Integrations
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className='w-48'>
              <DropdownMenuItem>
                <GitBranchIcon />
                GitHub
              </DropdownMenuItem>
              <DropdownMenuItem>
                <MailIcon />
                Gmail
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant='destructive'>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

export const WithCheckboxItems: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='outline'>View options</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-48'>
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked>
          Show toolbar
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem>Show sidebar</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked>
          Show status bar
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

export const WithRadioItems: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='outline'>Select position</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-48'>
        <DropdownMenuLabel>Panel position</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value='bottom'>
          <DropdownMenuRadioItem value='top'>Top</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value='bottom'>Bottom</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value='right'>Right</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

export const WithDestructiveItem: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='outline'>Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-48'>
        <DropdownMenuItem>
          <User />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant='destructive'>
          <LogOut />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}
