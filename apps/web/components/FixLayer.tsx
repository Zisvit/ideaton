// Единый фоновый слой (совет: «один мир, одна ручка громкости»).
// Фон — это ТЕКСТУРА страницы, а не «фишка»: медленный дрейф, только
// transform/opacity, БЕЗ filter:blur (слои с blur = paint на каждый
// кадр на мобиле). Контент его не замечает: скролл, интро и печать не трогают.
export default function FixLayer() {
  return (
    <div className="fix-bg" aria-hidden="true">
      <div className="fix-bg__aurora" />
      {/* микро-фигуры: круг · линия · капсула — «различные элементы» фона,
          тихие (opacity .12), в спокойных цветах проекта */}
      <div className="fix-bg__shape fix-bg__shape--ring" />
      <div className="fix-bg__shape fix-bg__shape--line" />
      <div className="fix-bg__shape fix-bg__shape--capsule" />
    </div>
  )
}
