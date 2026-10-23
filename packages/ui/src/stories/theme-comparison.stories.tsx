import type { Meta, StoryObj } from '@storybook/react-vite'
import { themeModes } from '../../.storybook/modes'
import { Badge } from '../components/badge'
import { Button } from '../components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/card'

const meta = {
  title: 'Tokens/Theme Preview',
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Components: Story = {
  parameters: { chromatic: { modes: themeModes } },
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Theme Preview</CardTitle>
        <CardDescription>
          Switch between Neutral and Datasheet Studio using the Brand toolbar
          above
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        <div className='space-y-2'>
          <p className='text-muted-foreground text-sm font-medium'>Badges</p>
          <div className='flex flex-wrap gap-2'>
            <Badge>Default</Badge>
            <Badge variant='secondary'>Secondary</Badge>
            <Badge variant='destructive'>Destructive</Badge>
            <Badge variant='outline'>Outline</Badge>
          </div>
        </div>
        <div className='space-y-2'>
          <p className='text-muted-foreground text-sm font-medium'>
            Buttons — Solid
          </p>
          <div className='flex flex-wrap gap-2'>
            <Button>Primary</Button>
            <Button color='secondary'>Secondary</Button>
            <Button color='destructive'>Destructive</Button>
          </div>
        </div>
        <div className='space-y-2'>
          <p className='text-muted-foreground text-sm font-medium'>
            Buttons — Outline
          </p>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline'>Primary</Button>
            <Button variant='outline' color='secondary'>
              Secondary
            </Button>
            <Button variant='outline' color='destructive'>
              Destructive
            </Button>
          </div>
        </div>
        <div className='space-y-2'>
          <p className='text-muted-foreground text-sm font-medium'>
            Buttons — Ghost
          </p>
          <div className='flex flex-wrap gap-2'>
            <Button variant='ghost'>Primary</Button>
            <Button variant='ghost' color='secondary'>
              Secondary
            </Button>
            <Button variant='ghost' color='destructive'>
              Destructive
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  ),
}
