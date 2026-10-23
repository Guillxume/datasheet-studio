import { Button } from './button'
import { Logo } from './logo'

type NotFoundPageProps = {
  title: string
  description: string
  backLabel: string
  backHref?: string
}

const NotFoundPage = ({
  title,
  description,
  backLabel,
  backHref = '/',
}: NotFoundPageProps) => (
  <div className='flex min-h-dvh flex-col items-center justify-center gap-4 px-4'>
    <Logo className='size-24' />
    <h1 className='text-2xl font-semibold'>{title}</h1>
    <p className='text-muted-foreground max-w-md text-center'>{description}</p>
    <Button asChild>
      <a href={backHref}>{backLabel}</a>
    </Button>
  </div>
)

export { NotFoundPage }
export type { NotFoundPageProps }
