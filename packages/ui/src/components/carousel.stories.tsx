import type { Meta, StoryObj } from '@storybook/react-vite'
import { Card, CardContent } from './card'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from './carousel'

const meta = {
  title: 'Data Display/Carousel',
  component: Carousel,
  tags: ['autodocs'],
} satisfies Meta<typeof Carousel>

export default meta
type Story = StoryObj<typeof meta>

const SLIDES = [1, 2, 3, 4, 5]

export const Default: Story = {
  render: () => (
    <Carousel className='mx-12 w-full max-w-xs'>
      <CarouselContent>
        {SLIDES.map(n => (
          <CarouselItem key={n}>
            <Card>
              <CardContent className='flex aspect-square items-center justify-center p-6'>
                <span className='text-4xl font-semibold'>{n}</span>
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
}

export const SeveralPerView: Story = {
  render: () => (
    <Carousel opts={{ align: 'start' }} className='mx-12 w-full max-w-md'>
      <CarouselContent>
        {SLIDES.map(n => (
          <CarouselItem key={n} className='basis-1/3'>
            <Card>
              <CardContent className='flex aspect-square items-center justify-center p-4'>
                <span className='text-2xl font-semibold'>{n}</span>
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious label='Diapositive précédente' />
      <CarouselNext label='Diapositive suivante' />
    </Carousel>
  ),
}
