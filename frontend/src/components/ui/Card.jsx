export default function Card({ title, subtitle, right, children }) {
  return (
    <section className="card">
      <header className="cardHeader">
        <div>
          <h2 className="cardTitle">{title}</h2>
          {subtitle ? <p className="cardSubtitle">{subtitle}</p> : null}
        </div>
        {right ? <div className="cardRight">{right}</div> : null}
      </header>
      <div className="cardBody">{children}</div>
    </section>
  );
}
