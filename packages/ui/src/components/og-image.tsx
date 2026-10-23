import { LOGO_PATHS, LOGO_SQUARE_VIEWBOX } from './logo'

type OgImageProps = {
  title: string
}

export const OG_IMAGE_SIZE = { width: 1200, height: 630 }

export const OgImage = ({ title }: OgImageProps) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f1f5f9',
      backgroundImage:
        'radial-gradient(circle at 1px 1px, #cbd5e1 1px, transparent 0)',
      backgroundSize: '32px 32px',
      padding: '48px',
    }}>
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(46, 43, 37, 0.12)',
      }}>
      {/* Gradient accent bar */}
      <div
        style={{
          width: '20px',
          display: 'flex',
          background: 'linear-gradient(to bottom, #E8834A, #2E2B25)',
          flexShrink: 0,
        }}
      />
      {/* Card body */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '40px',
          background: '#ffffff',
        }}>
        {/* biome-ignore lint/a11y/noSvgWithoutTitle: rasterised to PNG, no a11y context */}
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox={LOGO_SQUARE_VIEWBOX}
          fill='none'
          width='120'
          height='120'
          style={{ flexShrink: 0 }}>
          {LOGO_PATHS.map(p => (
            <path key={p.d} d={p.d} fill={p.fill} />
          ))}
        </svg>
        <span
          style={{
            fontSize: 96,
            fontWeight: 600,
            color: '#2E2B25',
            lineHeight: 1.2,
          }}>
          {title}
        </span>
      </div>
    </div>
  </div>
)
