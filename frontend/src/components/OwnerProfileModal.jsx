import { useEffect, useState } from "react";
import Modal from "./ui/Modal";
import { apiFetch } from "../lib/api";

function Stars({ rating, count }) {
  if (rating == null) return <span className="tiny muted">No reviews yet</span>;
  const full = Math.round(rating);
  return (
    <span>
      <span style={{ color: "var(--warn-text, #b45309)", fontWeight: 700, letterSpacing: 1 }}>
        {"★".repeat(full)}{"☆".repeat(5 - full)}
      </span>
      <span className="tiny muted" style={{ marginLeft: 6 }}>
        {rating.toFixed(1)} ({count} review{count !== 1 ? "s" : ""})
      </span>
    </span>
  );
}

export default function OwnerProfileModal({ ownerId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ownerId) {
      setProfile(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    apiFetch(`/profile/user/${ownerId}`)
      .then((data) => setProfile(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [ownerId]);

  return (
    <Modal open={ownerId !== null} title="Owner profile" onClose={onClose}>
      {loading && <p className="tiny muted">Loading…</p>}
      {error && <p className="tiny" style={{ color: "var(--bad-text)" }}>Error: {error}</p>}
      {profile && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Avatar + name */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "var(--surface-alt)", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, color: "var(--text-soft)",
              }}>
                {profile.full_name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{profile.full_name}</div>
              {profile.member_since && (
                <div className="tiny muted">
                  Member since {new Date(profile.member_since).getFullYear()}
                </div>
              )}
            </div>
          </div>

          {/* Owner rating */}
          {profile.avg_rating != null ? (
            <div>
              <div className="tiny muted" style={{ marginBottom: 4 }}>Owner rating</div>
              <Stars rating={profile.avg_rating} count={profile.review_count ?? 0} />
            </div>
          ) : null}

          {/* Bio */}
          {profile.bio ? (
            <div>
              <div className="tiny muted" style={{ marginBottom: 4 }}>About</div>
              <p style={{ margin: 0, lineHeight: 1.6, fontSize: 14 }}>{profile.bio}</p>
            </div>
          ) : null}

          {/* Listings count */}
          {profile.listing_count != null ? (
            <div className="tiny muted">
              {profile.listing_count} active listing{profile.listing_count !== 1 ? "s" : ""}
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
