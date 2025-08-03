export default function CaseCard({ name, price, image }) {
  return (
    <div className="case-card">
      <div className="case-image">
        <img src={`/assets/${image}`} alt={name} />
      </div>
      <h4>{name}</h4>
      <div className="case-price">{price} ₽</div>
      <button className="open-button">Открыть</button>
    </div>
  )
}