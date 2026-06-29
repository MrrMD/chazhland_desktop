import { profileBgLayer, bannerLayer } from '@/lib/cosmetics'
import { ParticleField, NebulaField, type ParticleKind } from './CosmeticCanvas'

function particleKindOf(id: string): ParticleKind | null {
  if (id.includes('snow')) return 'snow'
  if (id.includes('sakura')) return 'sakura'
  if (id.includes('star')) return 'stars'
  if (id.includes('ember')) return 'embers'
  return null
}

/**
 * Заливка фоновой полосы профиля по косметике: загруженная картинка → настоящий canvas (частицы/
 * туманность) для верхних тиров → CSS-голограмма → обычный CSS-фон/баннер. Заполняет родителя
 * (родитель должен быть position:relative; overflow:hidden). null, если ничего не подходит.
 */
export function CosmeticBackground({ id, imageUrl }: { id?: string | null; imageUrl?: string | null }) {
  if (imageUrl) return <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
  if (!id) return null
  // canvas-частицы (снег/сакура/звёзды/искры) поверх тёмной/градиентной подложки
  if (id.includes('particle')) {
    const pk = particleKindOf(id)
    if (pk) return (
      <>
        <div style={{ position: 'absolute', inset: 0, ...(profileBgLayer(id) ?? bannerLayer(id) ?? { background: '#12101f' }) }} />
        <ParticleField kind={pk} />
      </>
    )
  }
  // canvas-туманность
  if (id.includes('canvas') || id.includes('nebula')) return <NebulaField />
  // голограмма/параллакс — анимированная радужная фольга (CSS)
  if (id.includes('holo') || id.includes('parallax') || id.includes('foil')) {
    return <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg,#6a5cff,#13b886,#e0457b,#e7c14b,#6a5cff)', backgroundSize: '420px 100%', animation: 'shimmer 5s linear infinite', filter: 'saturate(1.25)' }} />
  }
  // обычные CSS-фоны профиля / баннеры
  const css = profileBgLayer(id) ?? bannerLayer(id)
  return css ? <div style={{ position: 'absolute', inset: 0, ...css }} /> : null
}
