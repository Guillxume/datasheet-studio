import type { Meta, StoryObj } from '@storybook/react-vite'
import { PackageIcon, SearchXIcon } from 'lucide-react'
import { Button } from './button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from './empty'
import { Icon } from './icon'

const meta = {
  title: 'Data Display/Empty',
  component: Empty,
  tags: ['autodocs'],
} satisfies Meta<typeof Empty>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Empty className='border'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>
          <Icon icon={PackageIcon} />
        </EmptyMedia>
        <EmptyTitle>No products yet</EmptyTitle>
        <EmptyDescription>
          Create your first product to start filling the catalogue.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button>Create a product</Button>
      </EmptyContent>
    </Empty>
  ),
}

export const NoResults: Story = {
  render: () => (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <Icon icon={SearchXIcon} size='lg' />
        </EmptyMedia>
        <EmptyTitle>No results</EmptyTitle>
        <EmptyDescription>
          Try another search, or <a href='#reset'>reset the filters</a>.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  ),
}
