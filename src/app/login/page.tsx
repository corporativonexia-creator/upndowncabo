import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = params.next || "/admin";

  return (
    <main className="h61-auth-shell">
      <style>{`
        .h61-auth-shell{
          min-height:100vh;
          display:grid;
          place-items:center;
          padding:24px;
          background:
            radial-gradient(circle at 15% 10%, rgba(200,168,107,.10), transparent 28%),
            linear-gradient(180deg,#143E35 0 185px,#F8F6F2 185px);
          color:#17201D;
          font-family:Inter,Arial,sans-serif;
        }
        .h61-auth-card{
          width:min(460px,100%);
          padding:34px;
          border:1px solid rgba(20,62,53,.12);
          border-radius:28px;
          background:#fff;
          box-shadow:0 24px 70px rgba(20,62,53,.14);
        }
        .h61-brand{
          display:flex;
          flex-direction:column;
          align-items:flex-start;
          gap:5px;
          margin-bottom:30px;
        }
        .h61-brand strong{
          font-family:"Cormorant Garamond",serif;
          color:#143E35;
          font-size:34px;
          line-height:.92;
          letter-spacing:.07em;
        }
        .h61-brand span{
          color:#2F6F5B;
          font-size:9px;
          font-weight:800;
          letter-spacing:.2em;
          text-transform:uppercase;
        }
        .h61-eyebrow{
          margin-bottom:8px;
          color:#2F6F5B;
          font-size:10px;
          font-weight:900;
          letter-spacing:.12em;
          text-transform:uppercase;
        }
        .h61-auth-card h1{
          margin:0;
          color:#143E35;
          font-family:"Cormorant Garamond",serif;
          font-size:46px;
          line-height:.95;
        }
        .h61-sub{
          margin:12px 0 24px;
          color:#68736F;
          font-size:13px;
          line-height:1.6;
        }
        .h61-auth-card form{
          display:grid;
          gap:14px;
        }
        .h61-auth-card form label{
          display:block;
          margin-bottom:6px;
          color:#2F6F5B;
          font-size:10px;
          font-weight:900;
          letter-spacing:.08em;
          text-transform:uppercase;
        }
        .h61-auth-card form input{
          width:100%;
          min-height:50px;
          padding:12px 14px;
          border:1px solid rgba(20,62,53,.18);
          border-radius:14px;
          background:#fff;
          color:#17201D;
          font:inherit;
          outline:none;
          box-sizing:border-box;
        }
        .h61-auth-card form input:focus{
          border-color:#2F6F5B;
          box-shadow:0 0 0 3px rgba(47,111,91,.10);
        }
        .h61-auth-card form button{
          min-height:50px;
          border:0;
          border-radius:999px;
          background:#143E35;
          color:#fff;
          font:800 14px Inter,Arial,sans-serif;
          cursor:pointer;
        }
        .h61-home{
          display:inline-flex;
          margin-top:18px;
          color:#143E35;
          font-size:12px;
          font-weight:800;
          text-decoration:none;
        }
        @media(max-width:520px){
          .h61-auth-shell{padding:16px}
          .h61-auth-card{padding:26px 20px;border-radius:22px}
          .h61-auth-card h1{font-size:40px}
        }
      `}</style>

      <section className="h61-auth-card">
        <div className="h61-brand">
          <strong>UP AND DOWN</strong>
          <span>Cabo Golf Shop by Coque</span>
        </div>

        <div className="h61-eyebrow">Acceso privado</div>
        <h1>Entrar</h1>
        <p className="h61-sub">
          Administradores y vendedores pueden iniciar sesión con su correo y contraseña.
        </p>

        <LoginForm nextPath={nextPath} />

        <a className="h61-home" href="/">
          ← Volver a la tienda
        </a>
      </section>
    </main>
  );
}
