import Link from "next/link";

export default function Home() {
  return (
    <section className="page">
      <h1 className="page-title">Home</h1>
      <p className="page-subtitle">
        This is your Next.js layout with a separate top bar and sidebar.
      </p>

      <div className="page-grid">
        <Link className="card" href="/my-inventory">
          <div className="card-title">My Inventory</div>
          <div className="card-body">View and manage your items.</div>
        </Link>
        <Link className="card" href="/buttons">
          <div className="card-title">Buttons</div>
          <div className="card-body">
            Watch 10 custom buttons fill up.
          </div>
        </Link>
        <Link className="card" href="/listings">
          <div className="card-title">Listings</div>
          <div className="card-body">Combine resources into gear.</div>
        </Link>
        <Link className="card" href="/quests">
          <div className="card-title">Quests</div>
          <div className="card-body">Track objectives and rewards.</div>
        </Link>
        <Link className="card" href="/settings">
          <div className="card-title">Settings</div>
          <div className="card-body">Configure the game UI.</div>
        </Link>
      </div>
    </section>
  );
}
