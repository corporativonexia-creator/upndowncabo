export default function UnauthorizedPage() {
  return (
    <main className="h61-unauth-shell">
      <style>{`
        .h61-unauth-shell{
          min-height:100vh;
          display:grid;
          place-items:center;
          padding:24px;
          background:linear-gradient(180deg,#143E35 0 185px,#F8F6F2 185px);
          color:#17201D;
          font-family:Inter,Arial,sans-serif;
        }
        .h61-unauth-card{
          width:min(520px,100%);
          padding:32px;
          border:1px solid rgba(20,62,53,.12);
          border-radius:26px;
          background:#fff;
          box-shadow:0 24px 70px rgba(20,62,53,.14);
        }
        .h61-kicker{
          color:#2F6F5B;
          font-size:10px;
          font-weight:900;
          letter-spacing:.12em;
          text-transform:uppercase;
        }
        .h61-unauth-card h1{
          margin:8px 0 10px;
          color:#143E35;
          font-family:"Cormorant Garamond",serif;
          font-size:44px;
          line-height:.95;
        }
        .h61-unauth-card p{
          color:#68736F;
          font-size:13px;
          line-height:1.6;
        }
        .h61-actions{
          display:flex;
          flex-wrap:wrap;
          gap:10px;
          margin-top:22px;
        }
        .h61-btn{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-height:44px;
          padding:10px 16px;
          border-radius:999px;
          font-size:12px;
          font-weight:800;
          text-decoration:none;
        }
        .h61-btn.primary{background:#143E35;color:#fff}
        .h61-btn.secondary{border:1px solid #143E35;color:#143E35;background:#fff}
      `}</style>

      <section className="h61-unauth-card">
        <div className="h61-kicker">Acceso privado</div>
        <h1>Acceso no autorizado</h1>
        <p>
          Tu usuario está autenticado, pero no tiene permiso para entrar a esta sección.
          Puedes cambiar de cuenta o volver a la tienda.
        </p>

        <div className="h61-actions">
          <a className="h61-btn primary" href="/login">
            Cambiar de cuenta
          </a>
          <a className="h61-btn secondary" href="/">
            Volver a la tienda
          </a>
        </div>
      </section>
    </main>
  );
}
