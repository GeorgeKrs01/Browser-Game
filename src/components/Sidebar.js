import Link from "next/link";

export function Sidebar({ isHidden = false }) {
  return (
    <aside
      className={`sidebar ${isHidden ? "is-hidden" : ""}`}
      aria-hidden={isHidden}
    >
      <div className="sidebar-section">
        <div className="sidebar-heading">Pages</div>
        <nav className="sidebar-nav">
          <Link className="sidebar-link" href="/">
            Home
          </Link>
          <Link className="sidebar-link sidebar-link-highlighted" href="/listings">
            Listings
          </Link>
          <Link className="sidebar-link sidebar-link-highlighted" href="/my-inventory">
            Inventory
          </Link>
          <Link className="sidebar-link sidebar-link-highlighted" href="/crafting">
            Crafting
          </Link>
          <Link className="sidebar-link" href="/inventory">
            Progress bars
          </Link>
          <Link className="sidebar-link" href="/buttons">
            Buttons
          </Link>
          <Link className="sidebar-link" href="/quests">
            Quests
          </Link>
        </nav>
      </div>
    </aside>
  );
}

