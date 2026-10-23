# Carousel

Horizontal or vertical slider built on [Embla Carousel](https://www.embla-carousel.com/), with previous / next buttons and arrow-key navigation.

## Import

```tsx
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@guillxume/ui/components/carousel'
```

## Props

### Carousel

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Scroll axis |
| `opts` | Embla options | — | Passed to `useEmblaCarousel` (`loop`, `align`…) |
| `plugins` | Embla plugins | — | E.g. autoplay |
| `setApi` | `(api: CarouselApi) => void` | — | Receives the Embla API (current slide, events…) |

### CarouselPrevious / CarouselNext

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | `'Previous slide'` / `'Next slide'` | Accessible name — override for i18n |
| `variant` | `'solid' \| 'outline' \| 'ghost'` | `'outline'` | Button style |

Both are disabled when there is nothing further to scroll to.

## Accessibility

Follows the WAI-ARIA carousel pattern: the root has `aria-roledescription="carousel"` and each `CarouselItem` is a group with `aria-roledescription="slide"`. Left / right arrows scroll while focus is inside the carousel.

## Examples

### Basic

```tsx
<Carousel className='w-full max-w-xs'>
  <CarouselContent>
    {images.map(src => (
      <CarouselItem key={src}>
        <img src={src} alt='' />
      </CarouselItem>
    ))}
  </CarouselContent>
  <CarouselPrevious label='Image précédente' />
  <CarouselNext label='Image suivante' />
</Carousel>
```

### Several slides per view

```tsx
<CarouselItem className='basis-1/3'>…</CarouselItem>
```

### Tracking the current slide

```tsx
const [api, setApi] = React.useState<CarouselApi>()
React.useEffect(() => {
  api?.on('select', () => setCurrent(api.selectedScrollSnap()))
}, [api])

<Carousel setApi={setApi}>…</Carousel>
```
