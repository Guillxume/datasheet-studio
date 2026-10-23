import type { Meta, StoryObj } from '@storybook/react-vite'
import { themeModes } from '../../.storybook/modes'

const colors = [
  { name: 'Background', var: 'var(--background)' },
  { name: 'Foreground', var: 'var(--foreground)' },
  { name: 'Primary', var: 'var(--primary)' },
  { name: 'Primary Foreground', var: 'var(--primary-foreground)' },
  { name: 'Secondary', var: 'var(--secondary)' },
  { name: 'Secondary Foreground', var: 'var(--secondary-foreground)' },
  { name: 'Accent', var: 'var(--accent)' },
  { name: 'Accent Foreground', var: 'var(--accent-foreground)' },
  { name: 'Muted', var: 'var(--muted)' },
  { name: 'Muted Foreground', var: 'var(--muted-foreground)' },
  { name: 'Destructive', var: 'var(--destructive)' },
  { name: 'Card', var: 'var(--card)' },
  { name: 'Popover', var: 'var(--popover)' },
  { name: 'Border', var: 'var(--border)' },
  { name: 'Input', var: 'var(--input)' },
  { name: 'Ring', var: 'var(--ring)' },
]

const chartColors = [
  { name: 'Chart 1', var: 'var(--chart-1)' },
  { name: 'Chart 2', var: 'var(--chart-2)' },
  { name: 'Chart 3', var: 'var(--chart-3)' },
  { name: 'Chart 4', var: 'var(--chart-4)' },
  { name: 'Chart 5', var: 'var(--chart-5)' },
]

const ColorSwatch = ({ name, cssVar }: { name: string; cssVar: string }) => (
  <div className='flex items-center gap-3 rounded-lg border border-dashed p-3'>
    <div
      className='size-10 shrink-0 rounded-md border'
      style={{ backgroundColor: cssVar }}
    />
    <div className='min-w-0'>
      <p className='truncate text-sm font-medium'>{name}</p>
      <p className='truncate text-xs text-muted-foreground'>{cssVar}</p>
    </div>
  </div>
)

const meta = {
  title: 'Tokens/Colors',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const ThemeColors: Story = {
  parameters: { chromatic: { modes: themeModes } },
  render: () => (
    <div className='space-y-4 p-4'>
      <div>
        <h2 className='mb-1 text-lg font-semibold'>Theme Colors</h2>
        <p className='mb-4 text-sm text-muted-foreground'>
          Core CSS custom properties. Toggle dark mode to compare.
        </p>
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4'>
          {colors.map(c => (
            <ColorSwatch key={c.name} name={c.name} cssVar={c.var} />
          ))}
        </div>
      </div>
    </div>
  ),
}

export const ChartColors: Story = {
  parameters: { chromatic: { modes: themeModes } },
  render: () => (
    <div className='space-y-4 p-4'>
      <div>
        <h2 className='mb-1 text-lg font-semibold'>Chart Colors</h2>
        <p className='mb-4 text-sm text-muted-foreground'>
          Data visualization color tokens.
        </p>
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4'>
          {chartColors.map(c => (
            <ColorSwatch key={c.name} name={c.name} cssVar={c.var} />
          ))}
        </div>
      </div>
    </div>
  ),
}
