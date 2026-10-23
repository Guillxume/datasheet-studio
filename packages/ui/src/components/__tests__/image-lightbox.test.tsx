// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ImageLightbox } from '../image-lightbox'

const IMAGES = [
  { src: '/a.png', alt: 'image A' },
  { src: '/b.png', alt: 'image B' },
  { src: '/c.png', alt: 'image C' },
]

describe('ImageLightbox', () => {
  it('renders the image at initialIndex when open', () => {
    render(
      <ImageLightbox
        images={IMAGES}
        initialIndex={1}
        open
        onOpenChange={() => {}}
      />,
    )
    const img = screen.getByAltText('image B') as HTMLImageElement
    expect(img.src).toContain('/b.png')
  })

  it('navigates forward with ArrowRight and wraps at the end', () => {
    render(
      <ImageLightbox
        images={IMAGES}
        initialIndex={2}
        open
        onOpenChange={() => {}}
      />,
    )
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByAltText('image A')).toBeInTheDocument()
  })

  it('navigates backward with ArrowLeft and wraps at the start', () => {
    render(
      <ImageLightbox
        images={IMAGES}
        initialIndex={0}
        open
        onOpenChange={() => {}}
      />,
    )
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByAltText('image C')).toBeInTheDocument()
  })

  it('hides navigation when only one image', () => {
    render(<ImageLightbox images={[IMAGES[0]]} open onOpenChange={() => {}} />)
    expect(screen.queryByRole('button', { name: /next/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /previous/i })).toBeNull()
  })

  it('clicking next advances and calls no extra handlers', () => {
    render(
      <ImageLightbox
        images={IMAGES}
        initialIndex={0}
        open
        onOpenChange={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByAltText('image B')).toBeInTheDocument()
  })

  it('resets to initialIndex when reopened', () => {
    const { rerender } = render(
      <ImageLightbox
        images={IMAGES}
        initialIndex={0}
        open={false}
        onOpenChange={() => {}}
      />,
    )
    rerender(
      <ImageLightbox
        images={IMAGES}
        initialIndex={2}
        open
        onOpenChange={() => {}}
      />,
    )
    expect(screen.getByAltText('image C')).toBeInTheDocument()
  })

  it('does not crash when images array is empty and open', () => {
    const onOpenChange = vi.fn()
    render(<ImageLightbox images={[]} open onOpenChange={onOpenChange} />)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('keyboard navigation is a no-op for a single image', () => {
    render(<ImageLightbox images={[IMAGES[0]]} open onOpenChange={() => {}} />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByAltText('image A')).toBeInTheDocument()
  })

  it('renders a visually hidden dialog title for screen readers', () => {
    render(
      <ImageLightbox
        images={IMAGES}
        open
        onOpenChange={() => {}}
        labels={{ title: 'POD photos' }}
      />,
    )
    expect(
      screen.getByText('POD photos', { selector: '.sr-only' }),
    ).toBeInTheDocument()
  })

  it('clamps initialIndex past the end and shows a bounded counter', () => {
    render(
      <ImageLightbox
        images={IMAGES}
        initialIndex={42}
        open
        onOpenChange={() => {}}
      />,
    )
    expect(screen.getByAltText('image C')).toBeInTheDocument()
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
  })

  it('clamps negative initialIndex to the first image', () => {
    render(
      <ImageLightbox
        images={IMAGES}
        initialIndex={-5}
        open
        onOpenChange={() => {}}
      />,
    )
    expect(screen.getByAltText('image A')).toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('applies labels.close to the close button accessible name', () => {
    render(
      <ImageLightbox
        images={IMAGES}
        open
        onOpenChange={() => {}}
        labels={{ close: 'Dismiss' }}
      />,
    )
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  it('invokes onOpenChange(false) when the close button is clicked', () => {
    const onOpenChange = vi.fn()
    render(<ImageLightbox images={IMAGES} open onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
